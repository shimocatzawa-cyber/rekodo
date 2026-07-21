import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DISCOGS_CONSUMER_KEY     = Deno.env.get("DISCOGS_CONSUMER_KEY")!;
const DISCOGS_CONSUMER_SECRET  = Deno.env.get("DISCOGS_CONSUMER_SECRET")!;

const UA         = "rekodo/1.0";
const BATCH      = 100;
const RATE_MS    = 1100; // just under 1 req/sec — safely within Discogs' 60/min
const VINYL_SIZES = ["LP", '12"', '10"', '7"', "EP", "Mini-Album"];

// ─── OAuth 1.0a HMAC-SHA1 via Web Crypto (Deno-compatible) ───────────────────

function pct(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function oauthNonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function buildAuthHeader(
  method: string,
  url: string,
  accessToken: string,
  tokenSecret: string
): Promise<string> {
  const params: Record<string, string> = {
    oauth_consumer_key:     DISCOGS_CONSUMER_KEY,
    oauth_nonce:            oauthNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        Math.floor(Date.now() / 1000).toString(),
    oauth_token:            accessToken,
    oauth_version:          "1.0",
  };

  const urlObj = new URL(url);
  const sigParams: Record<string, string> = { ...params };
  urlObj.searchParams.forEach((v, k) => { sigParams[k] = v; });

  const baseUrl     = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const normParams  = Object.entries(sigParams)
    .map(([k, v]) => [pct(k), pct(v)] as [string, string])
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const base       = [method.toUpperCase(), pct(baseUrl), pct(normParams)].join("&");
  const signingKey = `${pct(DISCOGS_CONSUMER_SECRET)}&${pct(tokenSecret)}`;

  const enc    = new TextEncoder();
  const key    = await crypto.subtle.importKey(
    "raw", enc.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false, ["sign"]
  );
  const sig    = await crypto.subtle.sign("HMAC", key, enc.encode(base));
  params.oauth_signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return "OAuth " + Object.entries(params).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ");
}

// ─── Format extraction — mirrors sync/route.ts ────────────────────────────────

function extractFormat(formats?: Array<{ name?: string; descriptions?: string[] }>): string | null {
  const fmt = formats?.[0];
  if (!fmt) return null;
  const name  = fmt.name ?? "";
  const descs = fmt.descriptions ?? [];
  if (name === "Vinyl") return descs.find((d) => VINYL_SIZES.includes(d)) ?? "Vinyl";
  return name || null;
}

const COLOUR_KW = [
  "Black", "White", "Red", "Blue", "Green", "Yellow", "Orange", "Purple",
  "Clear", "Colored", "Coloured", "Marbled", "Splatter", "Opaque",
  "Translucent", "Transparent", "Picture Disc", "Etched",
];

function extractBarcode(identifiers?: Array<{ type?: string; value?: string }>): string | null {
  if (!identifiers?.length) return null;
  const bc = identifiers.find((i) => i.type?.toLowerCase() === "barcode");
  return bc?.value?.trim() || null;
}

function extractMatrix(identifiers?: Array<{ type?: string; value?: string }>): string[] {
  if (!identifiers?.length) return [];
  return identifiers
    .filter((i) => i.type?.toLowerCase().includes("matrix"))
    .map((i) => i.value?.trim())
    .filter((v): v is string => !!v);
}

// Regex patterns for edition size, ordered most-specific first.
// Only high-confidence matches stored — returns null on ambiguous input.
const EDITION_RE = [
  /\/\s*(\d{2,6})\b(?!\s*-?\s*(?:page|pages|track|tracks|section|sections|sided|panel|panels|fold|disc|discs|sheet|sheets))/i,
  /\blimited\s+(?:edition\s+)?(?:of\s+)?(\d{2,6})\b/i,
  /\bnumbered\s+(?:\/\s*)?(\d{2,6})\b/i,
  /\b(\d{2,6})\s+cop(?:y|ies)\b/i,
  /\b(\d{2,6})\s+pressed\b/i,
];

function extractEditionSize(
  formats?: Array<{ text?: string; descriptions?: string[] }>,
  notes?: string
): number | null {
  const candidates = [
    ...(formats ?? []).map((f) => f.text ?? ""),
    ...(formats ?? []).flatMap((f) => f.descriptions ?? []),
    notes ?? "",
  ];
  for (const text of candidates) {
    if (!text) continue;
    for (const re of EDITION_RE) {
      const m = text.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        // Sanity-check: plausible edition sizes only
        if (n >= 10 && n <= 25_000) return n;
      }
    }
  }
  return null;
}

function extractProducers(extraartists?: Array<{ name: string; role: string }>): string[] {
  if (!extraartists?.length) return [];
  return extraartists
    .filter((e) => /producer/i.test(e.role))
    .map((e) => e.name);
}

// text field is only present on the full release API (not basic_information)
function extractVinylColour(formats?: Array<{ name?: string; descriptions?: string[]; text?: string }>): string | null {
  const vinyl = formats?.find((f) => f.name === "Vinyl");
  if (!vinyl) return null;
  if (vinyl.text?.trim()) return vinyl.text.trim();
  const match = (vinyl.descriptions ?? []).find((d) =>
    COLOUR_KW.some((kw) => d.toLowerCase().includes(kw.toLowerCase()))
  );
  return match ?? null;
}

// ─── Rate-limited fetch with 429 back-off ─────────────────────────────────────

async function rateFetch(url: string, auth: string, attempt = 0): Promise<Response> {
  if (attempt > 0) await new Promise((r) => setTimeout(r, 60_000));
  const res = await fetch(url, { headers: { Authorization: auth, "User-Agent": UA } });
  if (res.status === 429 && attempt < 2) {
    console.log("Rate limited — backing off 60s");
    return rateFetch(url, auth, attempt + 1);
  }
  return res;
}

// ─── Supabase update helper ───────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type SB = ReturnType<typeof createClient<any>>;

async function updateJob(supabase: SB, jobId: string, fields: Record<string, unknown>) {
  await supabase
    .from("sync_queue")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", jobId);
}

// ─── Main sync logic ──────────────────────────────────────────────────────────

async function processSync(supabase: SB, jobId: string, userId: string) {
  try {
    await updateJob(supabase, jobId, {
      status:     "processing",
      started_at: new Date().toISOString(),
      phase:      "fetching",
    });

    // ── Look up OAuth tokens ──────────────────────────────────────────────────
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("discogs_tokens")
      .select("access_token, token_secret, discogs_username")
      .eq("user_id", userId)
      .single();

    if (tokenErr || !tokenRow) {
      throw new Error("Discogs tokens not found — please reconnect Discogs from the Collection page");
    }

    const { access_token: accessToken, token_secret: tokenSecret, discogs_username: discogsUser } = tokenRow;

    // ── Phase 1a: Resolve condition field IDs ─────────────────────────────────
    let mediaFieldId = 1, sleeveFieldId = 2;
    try {
      const fieldsUrl  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/fields`;
      const fieldsAuth = await buildAuthHeader("GET", fieldsUrl, accessToken, tokenSecret);
      const fieldsRes  = await rateFetch(fieldsUrl, fieldsAuth);
      if (fieldsRes.ok) {
        const fd = await fieldsRes.json() as { fields?: Array<{ id: number; name: string }> };
        mediaFieldId  = fd.fields?.find((f) => f.name.toLowerCase().includes("media"))?.id  ?? 1;
        sleeveFieldId = fd.fields?.find((f) => f.name.toLowerCase().includes("sleeve"))?.id ?? 2;
      }
    } catch { /* use defaults */ }

    await new Promise((r) => setTimeout(r, RATE_MS));

    // ── Phase 1b: Fetch all collection pages ──────────────────────────────────

    interface DiscogsRelease {
      id: number;
      date_added?: string;
      basic_information: {
        id: number; title: string; year: number;
        artists: Array<{ id: number; name: string }>;
        genres: string[]; styles: string[];
        cover_image: string; thumb: string;
        labels: Array<{ name: string }>;
        formats: Array<{ name?: string; descriptions?: string[]; text?: string }>;
        country?: string;
      };
      notes?: Array<{ field_id: number; value: string }>;
    }

    interface CollectionItem {
      discogs_id: string; artist: string; album: string; year: number | null;
      genre: string | null; styles: string[]; cover_url: string | null; label: string | null;
      format: string | null; country: string | null; vinyl_colour: string | null;
      media_condition: string | null; sleeve_condition: string | null;
      discogs_artist_id: number | null; date_added: string | null;
    }

    let totalPages      = 1;
    let totalItems      = 0;
    let allPagesFetched = false;
    const allReleases: DiscogsRelease[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const url  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/folders/0/releases?per_page=${BATCH}&page=${page}&sort=added&sort_order=asc`;
      const auth = await buildAuthHeader("GET", url, accessToken, tokenSecret);
      const res  = await rateFetch(url, auth);

      if (!res.ok) {
        const msg = res.status === 403
          ? "Discogs is temporarily unavailable — your collection is safe. Try again in a few minutes."
          : `Discogs returned an error (${res.status}) on page ${page} — try again shortly.`;
        throw new Error(msg);
      }

      const pageData = await res.json() as {
        releases: DiscogsRelease[];
        pagination: { pages: number; items: number };
      };

      totalPages = pageData.pagination?.pages ?? 1;
      totalItems = pageData.pagination?.items ?? 0;
      allReleases.push(...(pageData.releases ?? []));

      await updateJob(supabase, jobId, {
        phase:         "fetching",
        current_page:  page,
        total_pages:   totalPages,
        total_records: totalItems,
        progress_done: allReleases.length,
      });

      if (page < totalPages) await new Promise((r) => setTimeout(r, RATE_MS));
    }
    allPagesFetched = true;

    // Map to CollectionItem shape (mirrors sync/route.ts exactly)
    const collectionItems: CollectionItem[] = allReleases.map((item) => {
      const info   = item.basic_information;
      const notes  = item.notes ?? [];
      const artists = (info.artists ?? []).map((a) => a.name.replace(/ \(\d+\)$/, "").trim()).join(", ");
      const fmt    = info.formats?.[0];
      const genre  = info.genres?.[0] ?? info.styles?.[0] ?? (fmt?.descriptions?.[0] ?? null);
      return {
        discogs_id:       String(info.id ?? item.id),
        artist:           artists || "Unknown",
        album:            info.title ?? "Unknown",
        year:             info.year  || null,
        genre,
        styles:           info.styles ?? [],
        cover_url:        info.cover_image ?? info.thumb ?? null,
        label:            info.labels?.[0]?.name ?? null,
        format:           extractFormat(info.formats),
        country:          info.country ?? null,
        vinyl_colour:     extractVinylColour(info.formats),
        media_condition:  notes.find((n) => n.field_id === mediaFieldId)?.value?.trim()  || null,
        sleeve_condition: notes.find((n) => n.field_id === sleeveFieldId)?.value?.trim() || null,
        discogs_artist_id: info.artists?.[0]?.id ?? null,
        date_added: item.date_added ?? null,
      };
    });

    const total = collectionItems.length;

    // ── Phase 2: Insert new records into records table ────────────────────────
    await updateJob(supabase, jobId, { phase: "inserting", progress_done: 0, total_records: total });

    const allDiscogsIds = collectionItems.map((r) => r.discogs_id);
    const existingMap   = new Map<string, string>(); // discogs_id → record uuid

    for (let i = 0; i < allDiscogsIds.length; i += BATCH) {
      const { data } = await supabase
        .from("records")
        .select("id, discogs_id")
        .in("discogs_id", allDiscogsIds.slice(i, i + BATCH));
      for (const r of data ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
    }

    // Deduplicated inserts only
    const seenForInsert = new Set<string>();
    const newItems = collectionItems.filter((r) => {
      if (existingMap.has(r.discogs_id) || seenForInsert.has(r.discogs_id)) return false;
      seenForInsert.add(r.discogs_id);
      return true;
    });

    let newAdded = 0;
    for (let i = 0; i < newItems.length; i += BATCH) {
      const batch = newItems.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("records")
        .insert(batch.map((r) => ({
          discogs_id: r.discogs_id, artist: r.artist, album: r.album,
          year: r.year, genre: r.genre, styles: r.styles, cover_url: r.cover_url,
          label: r.label, format: r.format, country: r.country, vinyl_colour: r.vinyl_colour,
          discogs_artist_id: r.discogs_artist_id,
        })))
        .select("id, discogs_id");

      if (error) {
        // Race condition — re-fetch this batch
        const batchIds = batch.map((r) => r.discogs_id);
        const { data: retried } = await supabase
          .from("records").select("id, discogs_id").in("discogs_id", batchIds);
        for (const r of retried ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
      } else {
        for (const r of data ?? []) if (r.discogs_id) existingMap.set(r.discogs_id, r.id);
        newAdded += data?.length ?? 0;
      }

      await updateJob(supabase, jobId, { progress_done: Math.min(i + BATCH, newItems.length), new_added: newAdded });
    }

    // ── Phase 2b: Backfill styles for records that have null or empty styles ────
    // Catches both styles IS NULL (pre-migration records) and styles = [] (records
    // inserted when Discogs returned no styles but now may have data). Only writes
    // when the current Discogs API response has non-empty styles for that release,
    // so genuine no-style releases are left alone and this stays a no-op once done.
    try {
      await updateJob(supabase, jobId, { phase: "updating" });

      // Build discogs_id → styles lookup from the already-fetched collection data
      // Only keep entries where Discogs actually returned styles — no point writing [].
      const stylesLookup = new Map<string, string[]>(
        collectionItems
          .filter((item) => item.styles.length > 0)
          .map((item) => [item.discogs_id, item.styles])
      );

      // Nothing to backfill if this sync fetched no styles at all
      const allRecordIds = [...new Set(existingMap.values())];
      const toUpdate: { id: string; styles: string[] }[] = [];

      if (stylesLookup.size > 0) {
        for (let i = 0; i < allRecordIds.length; i += BATCH) {
          const { data } = await supabase
            .from("records")
            .select("id, discogs_id, styles")
            .in("id", allRecordIds.slice(i, i + BATCH));

          for (const r of data ?? []) {
            if (!r.discogs_id) continue;
            if (r.styles?.length) continue; // already populated — skip
            const styles = stylesLookup.get(r.discogs_id);
            if (styles) toUpdate.push({ id: r.id, styles });
          }
        }
      }

      for (let i = 0; i < toUpdate.length; i += BATCH) {
        await supabase
          .from("records")
          .upsert(toUpdate.slice(i, i + BATCH), { onConflict: "id" });
        // Heartbeat so the sync_queue updated_at stays fresh
        await updateJob(supabase, jobId, { phase: "updating" });
      }
    } catch { /* non-fatal — styles will retry on next sync */ }

    // ── Phase 2c: Backfill vinyl_colour for existing records ─────────────────
    // Uses already-fetched basic_information data — no extra API calls.
    // Only writes when an actual colour is found; leaves null records as null
    // so Phase 5 (full release API) can pick them up and check the text field.
    try {
      const colourLookup = new Map<string, string | null>(
        collectionItems.map((item) => [item.discogs_id, item.vinyl_colour])
      );

      const allRecordIds2 = [...new Set(existingMap.values())];
      const toUpdateColour: { id: string; vinyl_colour: string }[] = [];

      for (let i = 0; i < allRecordIds2.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("id", allRecordIds2.slice(i, i + BATCH))
          .is("vinyl_colour", null);

        for (const r of data ?? []) {
          if (!r.discogs_id) continue;
          const colour = colourLookup.get(r.discogs_id);
          // Only write real colour values — leave null so Phase 5 can check
          // the full release API's text field on the next pass.
          if (colour) toUpdateColour.push({ id: r.id, vinyl_colour: colour });
        }
      }

      for (let i = 0; i < toUpdateColour.length; i += BATCH) {
        await supabase
          .from("records")
          .upsert(toUpdateColour.slice(i, i + BATCH), { onConflict: "id" });
        await updateJob(supabase, jobId, { phase: "updating" });
      }
    } catch { /* non-fatal — will retry on next sync */ }

    // ── Phase 3: Link records to user_records ─────────────────────────────────
    await updateJob(supabase, jobId, { phase: "linking", progress_done: 0 });

    // Count how many Discogs instances map to each internal record ID (copies).
    // Multiple instances share the same release_id → same record_id in our DB.
    const copiesMap = new Map<string, number>();
    const dateAddedByRecordId = new Map<string, string | null>();
    for (const item of collectionItems) {
      const recordId = existingMap.get(item.discogs_id);
      if (!recordId) continue;
      copiesMap.set(recordId, (copiesMap.get(recordId) ?? 0) + 1);
      dateAddedByRecordId.set(recordId, item.date_added);
    }
    const savedRecordIds = [...copiesMap.keys()];

    // Determine which record IDs are newly linked (for activity feed).
    const alreadyLinked = new Set<string>();
    for (let i = 0; i < savedRecordIds.length; i += BATCH) {
      const { data } = await supabase
        .from("user_records")
        .select("record_id")
        .eq("user_id", userId)
        .in("record_id", savedRecordIds.slice(i, i + BATCH));
      for (const l of data ?? []) alreadyLinked.add(l.record_id);
    }
    const newLinkIds = savedRecordIds.filter((id) => !alreadyLinked.has(id));

    // Upsert all links with current copies count so multi-copy collections
    // reflect accurate totals even when the copy count changes between syncs.
    const allLinkRows = savedRecordIds.map((id) => ({
      user_id: userId,
      record_id: id,
      copies: copiesMap.get(id) ?? 1,
      date_added: dateAddedByRecordId.get(id) ?? null,
    }));
    for (let i = 0; i < allLinkRows.length; i += BATCH) {
      const { error: linkErr } = await supabase
        .from("user_records")
        .upsert(allLinkRows.slice(i, i + BATCH), { onConflict: "user_id,record_id" });
      if (linkErr) console.error("user_records upsert error:", linkErr.message);
    }

    // Log to the activity feed, unless this run *is* the user's first-ever
    // collection population — only additions after that initial import should
    // show up for followers. Mirrors logCollectionAddActivity in src/lib/activity.ts
    // (duplicated here since this Deno edge function can't import from the Next app).
    if (newLinkIds.length > 0) {
      const { count } = await supabase
        .from("user_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if ((count ?? 0) > newLinkIds.length) {
        const { error: activityErr } = await supabase.from("activity_events").insert(
          newLinkIds.map((id) => ({ user_id: userId, event_type: "collection_add", record_id: id }))
        );
        if (activityErr) console.error("activity_events insert error:", activityErr.message);
      }
    }

    // ── Phase 4: Persist condition ratings ────────────────────────────────────
    // Each field upserted independently, only for items where Discogs
    // actually returned a value this sync — same "never overwrite good data
    // with a transient null" rule already applied to vinyl_colour above
    // (Phase 1c). The previous single combined upsert wrote all three fields
    // together for any item that had at least one of them — since nearly
    // every item has a date_added, a sync where Discogs's notes/field-ID
    // lookup came back empty (transient API hiccup, rate limiting, a user's
    // custom field naming not matching "media"/"sleeve") silently nulled out
    // previously-correct condition ratings across the whole collection.
    await updateJob(supabase, jobId, { phase: "conditions" });

    // Deduplicate by record_id before upserting. A user can have multiple copies
    // of the same Discogs release; both map to the same record_id via existingMap,
    // producing duplicate (user_id, record_id) pairs in the same batch — Postgres
    // rejects that with error 21000 ("ON CONFLICT DO UPDATE cannot affect row twice").
    const dedup = <T extends { record_id: string }>(rows: T[]): T[] => {
      const seen = new Map<string, T>();
      for (const row of rows) seen.set(row.record_id, row);
      return [...seen.values()];
    };

    const mediaUpserts = dedup(collectionItems
      .filter((item) => item.media_condition && existingMap.get(item.discogs_id))
      .map((item) => ({
        user_id: userId, record_id: existingMap.get(item.discogs_id)!,
        media_condition: item.media_condition!,
      })));
    const sleeveUpserts = dedup(collectionItems
      .filter((item) => item.sleeve_condition && existingMap.get(item.discogs_id))
      .map((item) => ({
        user_id: userId, record_id: existingMap.get(item.discogs_id)!,
        sleeve_condition: item.sleeve_condition!,
      })));
    const dateAddedUpserts = dedup(collectionItems
      .filter((item) => item.date_added && existingMap.get(item.discogs_id))
      .map((item) => ({
        user_id: userId, record_id: existingMap.get(item.discogs_id)!,
        date_added: item.date_added!,
      })));

    for (const upserts of [mediaUpserts, sleeveUpserts, dateAddedUpserts]) {
      for (let i = 0; i < upserts.length; i += BATCH) {
        await supabase
          .from("user_records")
          .upsert(upserts.slice(i, i + BATCH), { onConflict: "user_id,record_id" });
      }
    }

    // ── Phase 4b: Remove stale user_records ──────────────────────────────────
    // Delete links to records no longer in the user's Discogs collection.
    // Safety guard: only run if we have a valid collection (savedRecordIds
    // being empty would mean something went wrong and we must not delete anything).
    if (savedRecordIds.length > 0 && allPagesFetched) {
      await updateJob(supabase, jobId, { phase: "cleanup" });

      const currentIds = new Set(savedRecordIds);
      const staleIds: string[] = [];

      for (let from = 0; ; from += BATCH) {
        const { data } = await supabase
          .from("user_records")
          .select("record_id")
          .eq("user_id", userId)
          .order("record_id")   // stable ordering required for correct offset pagination
          .range(from, from + BATCH - 1);
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (!currentIds.has(row.record_id)) staleIds.push(row.record_id);
        }
        if (data.length < BATCH) break;
      }

      for (let i = 0; i < staleIds.length; i += BATCH) {
        await supabase
          .from("user_records")
          .delete()
          .eq("user_id", userId)
          .in("record_id", staleIds.slice(i, i + BATCH));
      }
    }

    // ── Phase 5: Backfill missing format / country / colour / producers ──────
    // Individual release lookups fill in fields the collection listing API omits.
    // Bounded by BOTH a record cap and a wall-clock time budget — Supabase Edge
    // Functions have a hard execution time limit, and a sequential, rate-limited
    // loop (1.1s/record) can silently exceed it with no chance to write a
    // "failed" status, leaving the job stuck in "processing" forever. The time
    // budget guarantees this phase always exits cleanly well inside that limit;
    // any records left over are picked up on the next sync.
    await updateJob(supabase, jobId, { phase: "backfill" });

    try {
      const BACKFILL_CAP        = 60;
      const PHASE5_BUDGET_MS    = 80_000;
      const phase5Start         = Date.now();
      type RecordStub = { id: string; discogs_id: string };
      const needingBackfill: RecordStub[] = [];

      for (let i = 0; i < savedRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id, format, country, vinyl_colour, producers, barcode, matrix, edition_size")
          .in("id", savedRecordIds.slice(i, i + BATCH))
          .not("discogs_id", "is", null);
        for (const r of data ?? []) {
          if (!r.discogs_id) continue;
          if (
            r.format === null || r.country === null || r.vinyl_colour === null ||
            r.producers === null || r.barcode === null || r.matrix === null
          ) {
            needingBackfill.push({ id: r.id, discogs_id: r.discogs_id as string });
          }
        }
      }

      const toBackfill = needingBackfill.slice(0, BACKFILL_CAP);
      await updateJob(supabase, jobId, { phase: "backfill", progress_done: 0, total_records: toBackfill.length });

      for (let bi = 0; bi < toBackfill.length; bi++) {
        if (Date.now() - phase5Start > PHASE5_BUDGET_MS) break;

        const record = toBackfill[bi];
        try {
          const releaseUrl = `https://api.discogs.com/releases/${encodeURIComponent(record.discogs_id)}?key=${DISCOGS_CONSUMER_KEY}&secret=${DISCOGS_CONSUMER_SECRET}`;
          const res = await fetch(releaseUrl, { headers: { "User-Agent": UA } });
          if (res.ok) {
            const rd = await res.json() as {
              formats?:      Array<{ name?: string; descriptions?: string[]; text?: string }>;
              country?:      string;
              extraartists?: Array<{ name: string; role: string }>;
              identifiers?:  Array<{ type?: string; value?: string }>;
              notes?:        string;
            };
            // Only write a field when this fetch found a value — never overwrite
            // good data with null/empty from a partial response.
            const patch: Record<string, unknown> = {};
            const format = extractFormat(rd.formats);
            if (format) patch.format = format;
            if (rd.country) patch.country = rd.country;
            // vinyl_colour: "" sentinel means "checked, no colour" — always write.
            patch.vinyl_colour = extractVinylColour(rd.formats) ?? "";
            const producers = extractProducers(rd.extraartists);
            if (producers.length > 0) patch.producers = producers;
            // Pressing identifiers — only write when found; "" sentinel for
            // barcode marks "checked, no barcode" so it's skipped on future syncs.
            const barcode = extractBarcode(rd.identifiers);
            patch.barcode = barcode ?? "";
            // matrix: always write (even [] as sentinel) so null = not yet checked.
            patch.matrix = extractMatrix(rd.identifiers);
            const editionSize = extractEditionSize(rd.formats, rd.notes);
            if (editionSize !== null) patch.edition_size = editionSize;

            await supabase.from("records").update(patch).eq("id", record.id);
          }
        } catch (e) { console.warn(`backfill skip ${record.discogs_id}:`, e); }

        await updateJob(supabase, jobId, { progress_done: bi + 1 });
        if (bi < toBackfill.length - 1) await new Promise((r) => setTimeout(r, RATE_MS));
      }

      // Restore total_records to the overall collection count for the final
      // "completed" update — Phase 5 temporarily repurposed it for progress display.
      await updateJob(supabase, jobId, { total_records: total });
    } catch (e) { console.error("Phase 5 backfill failed:", e); }

    // ── Phase 6: Set last_synced_at + fetch collection value ─────────────────
    const syncedAt = new Date().toISOString();
    await supabase.from("profiles")
      .update({ last_synced_at: syncedAt, taste_summary_count: null })
      .eq("id", userId);

    try {
      const cvUrl  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/value`;
      const cvAuth = await buildAuthHeader("GET", cvUrl, accessToken, tokenSecret);
      const cvRes  = await rateFetch(cvUrl, cvAuth);

      if (!cvRes.ok) {
        const body = await cvRes.text().catch(() => "");
        console.error(`[sync] collection/value API failed: ${cvRes.status} ${cvRes.statusText} — ${body.slice(0, 200)}`);
      } else {
        // Discogs returns flat formatted strings e.g. {"minimum":"A$39,995.27","median":"A$74,193.56","maximum":"A$138,240.02"}
        type ColVal = { minimum?: string; median?: string; maximum?: string };
        const colVal = await cvRes.json() as ColVal;

        // Parse "A$74,193.56" → { value: 74193.56, currency: "AUD" }
        const SYMBOL_TO_ISO: Record<string, string> = {
          "NZ$": "NZD", "HK$": "HKD", "S$": "SGD", "A$": "AUD", "C$": "CAD",
          "MX$": "MXN", "R$": "BRL", "£": "GBP", "€": "EUR", "¥": "JPY",
          "₩": "KRW", "CHF": "CHF", "SEK": "SEK", "NOK": "NOK", "DKK": "DKK",
          "$": "USD",
        };
        function parseColVal(s: string | undefined): { value: number; currency: string } | null {
          if (!s) return null;
          for (const [sym, iso] of Object.entries(SYMBOL_TO_ISO)) {
            if (s.startsWith(sym)) {
              const num = parseFloat(s.slice(sym.length).replace(/,/g, ""));
              if (!isNaN(num)) return { value: num, currency: iso };
            }
          }
          return null;
        }

        const parsedLow  = parseColVal(colVal.minimum);
        const parsedMed  = parseColVal(colVal.median);
        const parsedHigh = parseColVal(colVal.maximum);

        const valuePatch: Record<string, unknown> = {};
        if (parsedLow  != null) { valuePatch.collection_value_low  = parsedLow.value; valuePatch.collection_value_currency = parsedLow.currency; }
        if (parsedMed  != null)   valuePatch.collection_value_med  = parsedMed.value;
        if (parsedHigh != null)   valuePatch.collection_value_high = parsedHigh.value;

        if (Object.keys(valuePatch).length > 0) {
          await supabase.from("profiles").update(valuePatch).eq("id", userId);
        }
      }
    } catch (cvErr) {
      console.error("[sync] collection/value fetch threw:", cvErr);
    }

    // ── Mark completed ────────────────────────────────────────────────────────
    await updateJob(supabase, jobId, {
      status:          "completed",
      phase:           "done",
      progress_done:   total,
      total_records:   total,
      new_added:       newAdded,
      records_updated: savedRecordIds.length - newAdded,
      completed_at:    new Date().toISOString(),
      ...(total === 0 ? { error_message: "0 records returned — Discogs collection may be set to private" } : {}),
    });

  } catch (err) {
    console.error("discogs-sync-processor failed:", err);
    await supabase
      .from("sync_queue")
      .update({
        status:        "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
        updated_at:    new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

// ─── Request handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.json().catch(() => null);
  if (!body?.jobId || !body?.userId) {
    return new Response("Missing jobId or userId", { status: 400 });
  }

  const supabase   = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const syncPromise = processSync(supabase, body.jobId, body.userId);

  // Keep the function alive after responding
  if (typeof EdgeRuntime !== "undefined") {
    // @ts-expect-error — EdgeRuntime is a Deno Deploy global
    EdgeRuntime.waitUntil(syncPromise);
  }

  return new Response(JSON.stringify({ started: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
