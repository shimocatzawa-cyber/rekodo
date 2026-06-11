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
      basic_information: {
        id: number; title: string; year: number;
        artists: Array<{ id: number; name: string }>;
        genres: string[]; styles: string[];
        cover_image: string; thumb: string;
        labels: Array<{ name: string }>;
        formats: Array<{ name?: string; descriptions?: string[] }>;
        country?: string;
      };
      notes?: Array<{ field_id: number; value: string }>;
    }

    interface CollectionItem {
      discogs_id: string; artist: string; album: string; year: number | null;
      genre: string | null; styles: string[]; cover_url: string | null; label: string | null;
      format: string | null; country: string | null;
      media_condition: string | null; sleeve_condition: string | null;
      discogs_artist_id: number | null;
    }

    let totalPages   = 1;
    let totalItems   = 0;
    const allReleases: DiscogsRelease[] = [];

    for (let page = 1; page <= totalPages; page++) {
      const url  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/folders/0/releases?per_page=${BATCH}&page=${page}&sort=added&sort_order=asc`;
      const auth = await buildAuthHeader("GET", url, accessToken, tokenSecret);
      const res  = await rateFetch(url, auth);

      if (!res.ok) {
        if (page === 1) throw new Error(`Discogs collection fetch failed: ${res.status}`);
        break;
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
        media_condition:  notes.find((n) => n.field_id === mediaFieldId)?.value?.trim()  || null,
        sleeve_condition: notes.find((n) => n.field_id === sleeveFieldId)?.value?.trim() || null,
        discogs_artist_id: info.artists?.[0]?.id ?? null,
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
          label: r.label, format: r.format, country: r.country,
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

    // ── Phase 2b: Backfill styles for records that have styles = null ───────────
    // Only touches records where styles IS NULL — pre-migration records.
    // After the first backfill this query returns 0 rows and becomes a no-op,
    // so it adds negligible time to every subsequent sync.
    try {
      await updateJob(supabase, jobId, { phase: "updating" });

      // Build discogs_id → styles lookup from the already-fetched collection data
      const stylesLookup = new Map<string, string[]>(
        collectionItems.map((item) => [item.discogs_id, item.styles])
      );

      // Query only records that still have null styles
      const allRecordIds = [...new Set(existingMap.values())];
      const toUpdate: { id: string; styles: string[] }[] = [];

      for (let i = 0; i < allRecordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, discogs_id")
          .in("id", allRecordIds.slice(i, i + BATCH))
          .is("styles", null);

        for (const r of data ?? []) {
          if (!r.discogs_id) continue;
          const styles = stylesLookup.get(r.discogs_id);
          if (styles !== undefined) toUpdate.push({ id: r.id, styles });
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

    // ── Phase 3: Link records to user_records ─────────────────────────────────
    await updateJob(supabase, jobId, { phase: "linking", progress_done: 0 });

    const savedRecordIds = [...new Set(
      collectionItems
        .map((r) => existingMap.get(r.discogs_id))
        .filter((id): id is string => id !== undefined)
    )];

    const alreadyLinked = new Set<string>();
    for (let i = 0; i < savedRecordIds.length; i += BATCH) {
      const { data } = await supabase
        .from("user_records")
        .select("record_id")
        .eq("user_id", userId)
        .in("record_id", savedRecordIds.slice(i, i + BATCH));
      for (const l of data ?? []) alreadyLinked.add(l.record_id);
    }

    const newLinks = savedRecordIds
      .filter((id) => !alreadyLinked.has(id))
      .map((id) => ({ user_id: userId, record_id: id }));

    for (let i = 0; i < newLinks.length; i += BATCH) {
      const { error: linkErr } = await supabase.from("user_records").insert(newLinks.slice(i, i + BATCH));
      if (linkErr) throw new Error(`user_records insert failed: ${linkErr.message}`);
    }

    // ── Phase 4: Persist condition ratings ────────────────────────────────────
    await updateJob(supabase, jobId, { phase: "conditions" });

    const conditionUpserts = collectionItems
      .filter((item) => item.media_condition || item.sleeve_condition)
      .map((item) => ({
        user_id:          userId,
        record_id:        existingMap.get(item.discogs_id)!,
        media_condition:  item.media_condition,
        sleeve_condition: item.sleeve_condition,
      }))
      .filter((u) => u.record_id);

    for (let i = 0; i < conditionUpserts.length; i += BATCH) {
      await supabase
        .from("user_records")
        .upsert(conditionUpserts.slice(i, i + BATCH), { onConflict: "user_id,record_id" });
    }

    // ── Phase 4b: Remove stale user_records ──────────────────────────────────
    // Delete links to records no longer in the user's Discogs collection.
    // Safety guard: only run if we have a valid collection (savedRecordIds
    // being empty would mean something went wrong and we must not delete anything).
    if (savedRecordIds.length > 0) {
      await updateJob(supabase, jobId, { phase: "cleanup" });

      const currentIds = new Set(savedRecordIds);
      const staleIds: string[] = [];

      for (let from = 0; ; from += BATCH) {
        const { data } = await supabase
          .from("user_records")
          .select("record_id")
          .eq("user_id", userId)
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

    // ── Phase 5: Fetch collection value from Discogs and persist ─────────────
    try {
      const cvUrl  = `https://api.discogs.com/users/${encodeURIComponent(discogsUser)}/collection/value`;
      const cvAuth = await buildAuthHeader("GET", cvUrl, accessToken, tokenSecret);
      const cvRes  = await rateFetch(cvUrl, cvAuth);

      if (cvRes.ok) {
        type ColVal = {
          minimum?: { value?: number; currency?: string };
          median?:  { value?: number };
          maximum?: { value?: number };
        };
        const colVal  = await cvRes.json() as ColVal;
        const valLow  = colVal.minimum?.value  ?? null;
        const valMed  = colVal.median?.value   ?? null;
        const valHigh = colVal.maximum?.value  ?? null;
        const valCurr = colVal.minimum?.currency ?? "USD";
        const now     = new Date().toISOString();

        await supabase
          .from("profiles")
          .update({
            collection_value_low:      valLow,
            collection_value_med:      valMed,
            collection_value_high:     valHigh,
            collection_value_currency: valCurr,
          })
          .eq("id", userId);

        if (valMed != null) {
          await supabase.from("collection_value_snapshots").insert({
            user_id:      userId,
            snapshot_at:  now,
            value_low:    valLow,
            value_med:    valMed,
            value_high:   valHigh,
            currency:     valCurr,
            record_count: savedRecordIds.length,
          });
        }
      }
    } catch { /* non-fatal — sync still completes */ }

    // ── Mark completed ────────────────────────────────────────────────────────
    await updateJob(supabase, jobId, {
      status:          "completed",
      phase:           "done",
      progress_done:   total,
      total_records:   total,
      new_added:       newAdded,
      records_updated: savedRecordIds.length - newAdded,
      completed_at:    new Date().toISOString(),
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
    // @ts-ignore — EdgeRuntime is a Deno Deploy global
    EdgeRuntime.waitUntil(syncPromise);
  }

  return new Response(JSON.stringify({ started: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
