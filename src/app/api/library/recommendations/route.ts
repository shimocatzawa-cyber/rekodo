import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { computeCollectionIntelligence } from "@/lib/library/intelligence";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const STALE_DAYS = 7;
const BATCH = 400;

interface IntelligenceRow {
  top_artists: Array<{ name: string; count: number; notable_records: string[] }>;
  top_labels: Array<{ name: string; count: number }>;
  top_genres: Array<{ name: string; count: number }>;
  top_decades: Array<{ decade: string; count: number }>;
  top_countries: Array<{ country: string; count: number }>;
  taste_summary: string | null;
  last_computed_at: string;
}

// ── GET — return existing recommendations + staleness info ────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data: recs } = await supabase
    .from("library_recommendations")
    .select("*")
    .eq("user_id", user.id)
    .order("relevance_score", { ascending: false });

  const { data: intel } = await supabase
    .from("collection_intelligence")
    .select("last_computed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const oldest = recs && recs.length > 0
    ? recs.reduce((min, r) => r.created_at < min ? r.created_at : min, recs[0].created_at)
    : null;

  const sevenDaysAgo = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
  const isStale = !oldest || oldest < sevenDaysAgo;

  return Response.json({
    recommendations: recs ?? [],
    generated_at: oldest,
    is_stale: isStale,
    intelligence_at: intel?.last_computed_at ?? null,
  });
}

// ── POST — generate new recommendations ──────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const supporter = await isSupporter(supabase, user.id);
  if (!supporter) return Response.json({ error: "supporter_required" }, { status: 403 });

  // Fetch or compute collection intelligence
  let intelRow = await supabase
    .from("collection_intelligence")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()
    .then((r) => r.data as IntelligenceRow | null);

  if (!intelRow) {
    // Need to read the collection first for inline computation
    const { data: links } = await supabase
      .from("user_records")
      .select("record_id")
      .eq("user_id", user.id)
      .limit(5000);

    const recordIds = (links ?? []).map((l) => l.record_id);
    if (recordIds.length === 0) {
      return Response.json({ error: "No collection — add records to use Library" }, { status: 400 });
    }

    type RecordRow = { id: string; artist: string; album: string; year: number | null; genre: string | null; label: string | null; country: string | null };
    const recordMap = new Map<string, RecordRow>();
    for (let i = 0; i < recordIds.length; i += BATCH) {
      const { data } = await supabase
        .from("records")
        .select("id, artist, album, year, genre, label, country")
        .in("id", recordIds.slice(i, i + BATCH));
      for (const r of data ?? []) recordMap.set(r.id, r as RecordRow);
    }
    const collection = recordIds.map((id) => recordMap.get(id)).filter((r): r is RecordRow => r !== undefined);

    try {
      await computeCollectionIntelligence(supabase, user.id, collection);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: `Intelligence computation failed: ${msg}` }, { status: 500 });
    }

    intelRow = await supabase
      .from("collection_intelligence")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then((r) => r.data as IntelligenceRow | null);

    if (!intelRow) {
      return Response.json({ error: "No collection intelligence found" }, { status: 400 });
    }
  }

  // Fetch existing titles so Claude doesn't repeat them on regenerate
  const { data: existingRecs } = await supabase
    .from("library_recommendations")
    .select("title, format")
    .eq("user_id", user.id);

  const prevPodcasts = existingRecs?.filter(r => r.format === "podcast").map(r => r.title).join(", ") || "";
  const prevBooks    = existingRecs?.filter(r => r.format === "book").map(r => r.title).join(", ")    || "";
  const prevAudible  = existingRecs?.filter(r => r.format === "audible").map(r => r.title).join(", ") || "";

  const intelJson = JSON.stringify(intelRow);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Run 3 AI calls in parallel ────────────────────────────────────────────

  const podcastPrompt = `You are rekōdo, a music identity app for serious vinyl collectors.

This user's collection intelligence:
${intelJson}
${prevPodcasts ? `\nAlready shown — do NOT repeat any of these: ${prevPodcasts}\n` : ""}
Your task: identify 5 podcast episodes specifically relevant to artists, labels, or themes in this collection.

Depth rules — these are strict:
- An artist mentioned once in passing = score 0, discard entirely
- An artist as a secondary subject = score 3–4 maximum
- An artist as a primary subject (episode dedicated to them) = score 7–10
- An artist as THE sole subject (full episode biography) = score 9–10
- Only return recommendations scoring 6 or above
- A podcast episode must have the matched artist as a primary or sole subject. "Features a discussion of X" does not qualify. "Dedicated episode on X" qualifies.

match_reason rules:
- Must reference something specific from their collection
- Bad: "You like jazz."
- Good: "You own 4 ECM records — this episode covers the label's founding philosophy with Manfred Eicher."

Return JSON only, no preamble, no markdown:
[{
  "title": "",
  "show": "",
  "creator": "",
  "description": "",
  "match_reason": "",
  "match_artists": [],
  "match_labels": [],
  "artist_coverage_depth": "dedicated | primary | passing",
  "relevance_score": 0,
  "search_query": ""
}]`;

  const bookPrompt = `You are rekōdo, a music identity app for serious vinyl collectors.

This user's collection intelligence:
${intelJson}
${prevBooks ? `\nAlready shown — do NOT repeat any of these: ${prevBooks}\n` : ""}
Your task: identify 5 books — biographies, label histories, genre studies, or music criticism — that a collector with this specific taste would find essential.

Existence rules — these are absolute:
- Only recommend books you are certain exist. If you are not sure a book exists, do not include it.
- Every book must have a real author, real publisher, and real publication year you can state confidently.
- Do NOT invent titles. Do NOT combine a real author with a fictional title. Do NOT guess.
- If you cannot think of a verified book for a given artist, skip that artist entirely.

Depth rules — these are strict:
- Only recommend where the matched artist is the explicit subject of the entire work
- A chapter mention does not qualify
- A biography qualifies
- A label history that centres on a specific artist qualifies
- A general history that references them in passing does not qualify
- Prioritise artists the user owns 3 or more records by
- Include at least one label history if a major label appears in their collection (ECM, Blue Note, 4AD, Matador, Drag City, etc.) — but only if a real label history book exists
- Include at least one broader music criticism book matching their dominant genre or era

match_reason rules:
- Must be specific and reference their actual collection
- Bad: "A great read for music fans."
- Good: "You own six Cocteau Twins records — this is the only serious critical study of the 4AD label that shaped their entire sound."

Return JSON only, no preamble, no markdown:
[{
  "title": "",
  "author": "",
  "year": 0,
  "description": "",
  "match_reason": "",
  "match_artists": [],
  "match_labels": [],
  "artist_coverage_depth": "dedicated | primary | passing",
  "relevance_score": 0,
  "isbn": ""
}]`;

  const audiblePrompt = `You are rekōdo, a music identity app for serious vinyl collectors.

This user's collection intelligence:
${intelJson}
${prevAudible ? `\nAlready shown — do NOT repeat any of these: ${prevAudible}\n` : ""}
Your task: identify 5 audiobooks available on Audible — specifically artist biographies and music memoirs — matched to artists this collector demonstrably loves.

Depth rules — these are strict:
- Only recommend where the user owns 3 or more records by that artist, OR where the artist is so central to the collection's character that their omission would be notable
- Only recommend books that genuinely exist on Audible — if uncertain, omit entirely rather than hallucinate
- Prefer audiobooks narrated by the artist or someone close to them

match_reason rules:
- Must feel like a knowledgeable friend speaking, not an algorithm
- Bad: "A great Coltrane biography."
- Good: "You own six Coltrane records including A Love Supreme — Ashley Kahn's book on that specific album is the essential read, and it exists on Audible."

Return JSON only, no preamble, no markdown:
[{
  "title": "",
  "author": "",
  "narrator": "",
  "description": "",
  "match_reason": "",
  "match_artists": [],
  "artist_coverage_depth": "dedicated | primary | passing",
  "audible_search_query": "",
  "relevance_score": 0
}]`;

  const [podcastMsg, bookMsg, audibleMsg] = await Promise.all([
    anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: podcastPrompt }],
    }),
    anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: bookPrompt }],
    }),
    anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: audiblePrompt }],
    }),
  ]);

  function parseAiResponse(msg: Anthropic.Message): unknown[] {
    const content = msg.content[0];
    if (content.type !== "text") return [];
    try {
      const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  type CoverageDepth = "dedicated" | "primary" | "passing";
  interface PodcastAi {
    title: string; show: string; creator: string; description: string;
    match_reason: string; match_artists: string[]; match_labels: string[];
    artist_coverage_depth: CoverageDepth; relevance_score: number; search_query: string;
  }
  interface BookAi {
    title: string; author: string; year: number; description: string;
    match_reason: string; match_artists: string[]; match_labels: string[];
    artist_coverage_depth: CoverageDepth; relevance_score: number; isbn: string;
  }
  interface AudibleAi {
    title: string; author: string; narrator: string; description: string;
    match_reason: string; match_artists: string[];
    artist_coverage_depth: CoverageDepth; audible_search_query: string; relevance_score: number;
  }

  const rawPodcasts = parseAiResponse(podcastMsg) as PodcastAi[];
  const rawBooks    = parseAiResponse(bookMsg)    as BookAi[];
  const rawAudible  = parseAiResponse(audibleMsg) as AudibleAi[];

  // Server-side filter: discard 'passing' depth
  const podcasts = rawPodcasts.filter((p) => p.artist_coverage_depth !== "passing");
  const books    = rawBooks.filter((b)    => b.artist_coverage_depth !== "passing");
  const audible  = rawAudible.filter((a)  => a.artist_coverage_depth !== "passing");

  // ── Enrich with external APIs ─────────────────────────────────────────────

  async function enrichBook(book: BookAi): Promise<{ thumbnail_url: string | null; external_url: string | null; source_id: string | null; verified: boolean }> {
    try {
      const searchUrl = book.isbn
        ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(book.isbn)}&limit=1`
        : `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}&limit=1`;

      const res = await fetch(searchUrl, { headers: { "User-Agent": "rekodo/1.0" } });
      if (!res.ok) return { thumbnail_url: null, external_url: null, source_id: null, verified: false };

      const data = await res.json() as { docs?: Array<{ key?: string; isbn?: string[]; cover_i?: number }> };
      const doc = data.docs?.[0];
      // No match in Open Library — treat as unverified and discard
      if (!doc) return { thumbnail_url: null, external_url: null, source_id: null, verified: false };

      const olid = doc.key?.replace("/works/", "") ?? null;
      const coverId = doc.cover_i;
      const isbn = doc.isbn?.[0] ?? book.isbn ?? null;
      const thumbnail_url = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
        : isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null;
      const external_url = olid
        ? `https://openlibrary.org/works/${olid}`
        : isbn ? `https://openlibrary.org/isbn/${isbn}` : null;
      return { thumbnail_url, external_url, source_id: olid ?? isbn, verified: true };
    } catch {
      return { thumbnail_url: null, external_url: null, source_id: null, verified: false };
    }
  }

  async function enrichPodcast(podcast: PodcastAi): Promise<{ thumbnail_url: string | null; external_url: string | null; source_id: string | null }> {
    const showQ    = encodeURIComponent(podcast.show || podcast.title);
    const searchQ  = encodeURIComponent(podcast.search_query || `${podcast.title} ${podcast.show}`);
    const fallback = `https://podcasts.apple.com/search?term=${searchQ}`;

    let thumbnailUrl: string | null = null;
    let sourceId: string | null = null;

    // iTunes: search for the podcast show (more reliable than episode-level search)
    try {
      const ir = await fetch(`https://itunes.apple.com/search?term=${showQ}&entity=podcast&limit=3`, {
        headers: { "User-Agent": "rekodo/1.0" },
      });
      if (ir.ok) {
        const id = await ir.json() as { results?: Array<{ collectionViewUrl?: string; artworkUrl600?: string; collectionId?: number }> };
        const show = id.results?.[0];
        if (show?.collectionViewUrl) {
          if (!thumbnailUrl) thumbnailUrl = show.artworkUrl600 ?? null;
          sourceId = show.collectionId ? String(show.collectionId) : null;
          return { thumbnail_url: thumbnailUrl, external_url: show.collectionViewUrl, source_id: sourceId };
        }
      }
    } catch { /* fall through */ }

    return { thumbnail_url: thumbnailUrl, external_url: fallback, source_id: sourceId };
  }

  function enrichAudible(a: AudibleAi): { external_url: string } {
    // Audible has no public API — build a targeted search URL using title + author.
    // The iTunes audiobook API returns Apple Books URLs (not Audible), so we skip it.
    const q = encodeURIComponent(a.audible_search_query || `${a.title} ${a.author}`);
    return { external_url: `https://www.audible.com/search?keywords=${q}` };
  }

  const [enrichedPodcastData, allEnrichedBooksData] = await Promise.all([
    Promise.all(podcasts.map(enrichPodcast)),
    Promise.all(books.map(enrichBook)),
  ]);
  const enrichedAudibleData = audible.map(enrichAudible);

  // Discard books Open Library couldn't verify — they're likely hallucinated
  const verifiedBookIndices = books.map((_, i) => i).filter((i) => allEnrichedBooksData[i].verified);
  const verifiedBooks        = verifiedBookIndices.map((i) => books[i]);
  const enrichedBooksData    = verifiedBookIndices.map((i) => allEnrichedBooksData[i]);

  // ── Build rows for DB ─────────────────────────────────────────────────────

  type DbRow = {
    user_id: string;
    format: "podcast" | "book" | "audible";
    title: string;
    creator: string | null;
    description: string | null;
    match_reason: string | null;
    match_artists: string[] | null;
    match_labels: string[] | null;
    external_url: string | null;
    affiliate_url: string | null;
    thumbnail_url: string | null;
    source_api: string | null;
    source_id: string | null;
    artist_coverage_depth: "dedicated" | "primary" | "passing" | null;
    relevance_score: number | null;
  };

  const podcastRows: DbRow[] = podcasts.map((p, i) => ({
    user_id: user.id,
    format: "podcast" as const,
    title: p.title,
    creator: p.creator || p.show || null,
    description: p.description || null,
    match_reason: p.match_reason || null,
    match_artists: p.match_artists?.length ? p.match_artists : null,
    match_labels: p.match_labels?.length ? p.match_labels : null,
    external_url: enrichedPodcastData[i].external_url,
    affiliate_url: null,
    thumbnail_url: enrichedPodcastData[i].thumbnail_url,
    source_api: "itunes",
    source_id: enrichedPodcastData[i].source_id,
    artist_coverage_depth: p.artist_coverage_depth || null,
    relevance_score: p.relevance_score ?? null,
  }));

  const bookRows: DbRow[] = verifiedBooks.map((b, i) => ({
    user_id: user.id,
    format: "book" as const,
    title: b.title,
    creator: b.author || null,
    description: b.description || null,
    match_reason: b.match_reason || null,
    match_artists: b.match_artists?.length ? b.match_artists : null,
    match_labels: b.match_labels?.length ? b.match_labels : null,
    external_url: enrichedBooksData[i].external_url,
    affiliate_url: `https://bookshop.org/search?keywords=${encodeURIComponent(`${b.title} ${b.author}`)}`,
    thumbnail_url: enrichedBooksData[i].thumbnail_url,
    source_api: "openlibrary",
    source_id: enrichedBooksData[i].source_id,
    artist_coverage_depth: b.artist_coverage_depth || null,
    relevance_score: b.relevance_score ?? null,
  }));

  const audibleRows: DbRow[] = audible.map((a, i) => ({
    user_id: user.id,
    format: "audible" as const,
    title: a.title,
    creator: a.author || null,
    description: a.description || null,
    match_reason: a.match_reason || null,
    match_artists: a.match_artists?.length ? a.match_artists : null,
    match_labels: null,
    external_url: enrichedAudibleData[i].external_url,
    affiliate_url: null,
    thumbnail_url: null,
    source_api: "itunes",
    source_id: null,
    artist_coverage_depth: a.artist_coverage_depth || null,
    relevance_score: a.relevance_score ?? null,
  }));

  const allRows = [...podcastRows, ...bookRows, ...audibleRows];

  await supabase.from("library_recommendations").delete().eq("user_id", user.id);

  if (allRows.length > 0) {
    const { error } = await supabase.from("library_recommendations").insert(allRows);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  const { data: saved } = await supabase
    .from("library_recommendations")
    .select("*")
    .eq("user_id", user.id)
    .order("relevance_score", { ascending: false });

  return Response.json({ recommendations: saved ?? [], generated_at: new Date().toISOString() });
}

