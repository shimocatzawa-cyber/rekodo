import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic   = "force-dynamic";
export const maxDuration = 300;

// ── String utilities ──────────────────────────────────────────────────────────

function levenshteinDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const longer  = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

const STRIP_SUFFIXES = [
  "remastered", "deluxe edition", "expanded edition",
  "anniversary edition", "reissue", "ep", "lp",
];

function normalize(s: string): string {
  let n = s.toLowerCase().replace(/[^\w\s-]/g, " ").trim();
  for (const suffix of STRIP_SUFFIXES) {
    n = n.replace(new RegExp(`\\s+${suffix}\\s*$`, "i"), "").trim();
  }
  return n.replace(/\s+/g, " ").trim();
}

// ── Bandcamp scraping ─────────────────────────────────────────────────────────

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function extractFanIdFromText(text: string): number | null {
  const patterns = [
    /"fan_id"\s*:\s*(\d+)/,
    /[?&]fan_id=(\d+)/,
    /"id"\s*:\s*(\d+)[^}]*"bandcamp_url"/,
    /FanData[^{]*\{[^}]*"id"\s*:\s*(\d+)/,
    /current_fan[^{]*\{[^}]*"id"\s*:\s*(\d+)/,
    /CurrentFan[^{]*\{[^}]*"id"\s*:\s*(\d+)/,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0) return n;
    }
  }
  return null;
}

async function getFanId(username: string): Promise<{ fanId: number | null; error?: string }> {
  const timeout = 12_000;

  let html = "";
  try {
    const htmlRes = await fetch(`https://bandcamp.com/${username}`, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(timeout),
    });
    if (htmlRes.status === 404) return { fanId: null, error: "Bandcamp user not found. Check the username in your profile settings." };
    if (!htmlRes.ok) return { fanId: null, error: `Could not reach Bandcamp (HTTP ${htmlRes.status}). Try again in a moment.` };
    html = await htmlRes.text();
  } catch (err) {
    return { fanId: null, error: `Could not connect to Bandcamp: ${err instanceof Error ? err.message : String(err)}` };
  }

  const fromInline = extractFanIdFromText(html);
  if (fromInline) return { fanId: fromInline };

  for (const match of html.matchAll(/data-blob="([^"]+)"/g)) {
    try {
      const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
      const blob = JSON.parse(raw) as Record<string, unknown>;
      type FanData = { id?: number };
      const fanData = (blob?.fan_data ?? blob?.CurrentFan ?? blob?.FanData ?? blob?.current_fan) as FanData | undefined;
      if (fanData?.id && typeof fanData.id === "number") return { fanId: fanData.id };
      const blobFanId = extractFanIdFromText(JSON.stringify(blob));
      if (blobFanId) return { fanId: blobFanId };
    } catch { continue; }
  }

  for (const scriptMatch of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const content = scriptMatch[1];
    if (!content.includes("fan")) continue;
    const id = extractFanIdFromText(content);
    if (id) return { fanId: id };
  }

  try {
    const rssRes = await fetch(`https://bandcamp.com/${username}/wishlist?format=rss`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
    if (rssRes.ok) { const id = extractFanIdFromText(await rssRes.text()); if (id) return { fanId: id }; }
  } catch { /* continue */ }

  try {
    const collRssRes = await fetch(`https://bandcamp.com/${username}/collection?format=rss`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(timeout) });
    if (collRssRes.ok) { const id = extractFanIdFromText(await collRssRes.text()); if (id) return { fanId: id }; }
  } catch { /* continue */ }

  return { fanId: null, error: "Could not find your Bandcamp fan ID. Make sure your Bandcamp collection is set to Public in your account settings, then try again." };
}

// ── Tag extraction from album page HTML ───────────────────────────────────────

function extractTagsFromHtml(html: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  // Primary: <a class="tag"> links
  for (const m of html.matchAll(/<a[^>]+class="tag"[^>]*>([^<]+)<\/a>/gi)) {
    const t = m[1].trim().toLowerCase();
    if (t && !seen.has(t)) { seen.add(t); tags.push(t); }
  }
  if (tags.length > 0) return tags;

  // Fallback: TralbumData.tags JSON array
  const tagsMatch = html.match(/"tags"\s*:\s*(\[[^\]]*\])/);
  if (tagsMatch) {
    try {
      const parsed = JSON.parse(tagsMatch[1]) as unknown[];
      for (const t of parsed) {
        if (typeof t === "string") { const tag = t.toLowerCase(); if (!seen.has(tag)) { seen.add(tag); tags.push(tag); } }
        else if (t && typeof t === "object" && "name" in t && typeof (t as Record<string,unknown>).name === "string") {
          const tag = ((t as Record<string,unknown>).name as string).toLowerCase();
          if (!seen.has(tag)) { seen.add(tag); tags.push(tag); }
        }
      }
    } catch { /* ignore */ }
  }

  return tags;
}

async function fetchTagsForUrl(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    return extractTagsFromHtml(await res.text());
  } catch { return []; }
}

// Fetch tags for a batch of items concurrently, capped at `concurrency` at once
async function fetchTagsBatch(urls: string[], concurrency = 6): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()!;
      result.set(url, await fetchTagsForUrl(url));
      if (queue.length > 0) await new Promise(r => setTimeout(r, 150));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return result;
}

// ── Collection fetch ──────────────────────────────────────────────────────────

type CollectionItem = {
  band_name:    string;
  album_title:  string;
  item_url:     string | null;
  purchased_at: string | null;
  release_date: string | null;
  label:        string | null;
};

async function fetchCollection(fanId: number): Promise<CollectionItem[]> {
  const items: CollectionItem[] = [];
  let olderThanToken = "9999999999:9999999999:a::";
  const MAX_PAGES = 500;

  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetch("https://bandcamp.com/api/fancollection/1/collection_items", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ fan_id: fanId, older_than_token: olderThanToken, count: 20 }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch { break; }

    if (!res.ok) break;

    type ApiItem = {
      band_name?: string; album_title?: string; item_url?: string;
      purchased?: string; release_date?: string; label_name?: string;
    };
    let data: { items?: ApiItem[]; more_available?: boolean; last_token?: string };
    try { data = (await res.json()) as typeof data; }
    catch { break; }

    for (const item of data.items ?? []) {
      if (!item.band_name || !item.album_title) continue;
      // Parse purchased timestamp — Bandcamp returns either ISO string or Unix seconds
      let purchasedAt: string | null = null;
      if (item.purchased) {
        const asNum = Number(item.purchased);
        purchasedAt = isNaN(asNum)
          ? item.purchased
          : new Date(asNum * 1000).toISOString();
      }
      items.push({
        band_name:    item.band_name,
        album_title:  item.album_title,
        item_url:     item.item_url ?? null,
        purchased_at: purchasedAt,
        release_date: item.release_date ?? null,
        label:        item.label_name ?? null,
      });
    }

    if (!data.more_available || !data.last_token || data.last_token === olderThanToken) break;
    olderThanToken = data.last_token;
    await new Promise(r => setTimeout(r, 300));
  }

  return items;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId } = (await request.json()) as { userId?: string };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("bandcamp_username").eq("id", userId).single();

    if (!profile?.bandcamp_username) {
      return NextResponse.json({ error: "No Bandcamp username set. Add it in your profile settings." }, { status: 400 });
    }

    const username = profile.bandcamp_username.trim().toLowerCase();
    const { fanId, error: fanError } = await getFanId(username);
    if (!fanId) return NextResponse.json({ error: fanError }, { status: 400 });

    const collection = await fetchCollection(fanId);
    if (collection.length === 0) {
      return NextResponse.json({ success: true, total: 0, duplicates: 0, new: 0, message: "No albums found in your Bandcamp collection." });
    }

    // Scrape tags from album pages in parallel
    const urlsToScrape = collection.map(i => i.item_url).filter(Boolean) as string[];
    const tagMap = urlsToScrape.length > 0 ? await fetchTagsBatch(urlsToScrape) : new Map<string, string[]>();

    // Fetch user's physical collection for deduplication
    const { data: userRecordsData } = await supabase.from("user_records").select("record_id").eq("user_id", userId);
    const recordIds = (userRecordsData ?? []).map(r => r.record_id as string);
    type RecordRow = { id: string; artist: string; album: string };
    const physicalCollection: RecordRow[] = [];

    if (recordIds.length > 0) {
      const BATCH = 400;
      for (let i = 0; i < recordIds.length; i += BATCH) {
        const { data } = await supabase.from("records").select("id, artist, album").in("id", recordIds.slice(i, i + BATCH));
        for (const r of data ?? []) physicalCollection.push(r as RecordRow);
      }
    }

    const normalizedPhysical = physicalCollection.map(r => ({ id: r.id, artist: normalize(r.artist), album: normalize(r.album) }));
    let duplicateCount = 0;

    const upsertRows = collection.map(item => {
      const normArtist = normalize(item.band_name);
      const normAlbum  = normalize(item.album_title);
      let isDuplicate = false, matchedId: string | null = null;

      for (const physical of normalizedPhysical) {
        if (similarity(normArtist, physical.artist) >= 0.85 && similarity(normAlbum, physical.album) >= 0.85) {
          isDuplicate = true; matchedId = physical.id; break;
        }
      }
      if (isDuplicate) duplicateCount++;

      const tags = item.item_url ? (tagMap.get(item.item_url) ?? null) : null;

      return {
        user_id:           userId,
        source:            "bandcamp",
        artist:            item.band_name,
        album:             item.album_title,
        is_duplicate:      isDuplicate,
        matched_record_id: matchedId,
        imported_at:       new Date().toISOString(),
        purchased_at:      item.purchased_at,
        item_url:          item.item_url,
        release_date:      item.release_date,
        label:             item.label,
        tags:              tags && tags.length > 0 ? tags : null,
      };
    });

    // Deduplicate by artist+album
    const seen = new Set<string>();
    const dedupedRows = upsertRows.filter(r => {
      const key = `${r.artist.toLowerCase()}||${r.album.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Replace previous sync data
    const { error: delError } = await supabase.from("digital_imports").delete().eq("user_id", userId).eq("source", "bandcamp");
    if (delError) return NextResponse.json({ error: `DB delete failed: ${delError.message}` }, { status: 500 });

    const INSERT_BATCH = 100;
    for (let i = 0; i < dedupedRows.length; i += INSERT_BATCH) {
      const { error: insError } = await supabase.from("digital_imports").insert(dedupedRows.slice(i, i + INSERT_BATCH));
      if (insError) return NextResponse.json({ error: `DB insert failed: ${insError.message}` }, { status: 500 });
    }

    const total    = dedupedRows.length;
    const newCount = total - duplicateCount;
    const taggedCount = dedupedRows.filter(r => r.tags && r.tags.length > 0).length;

    return NextResponse.json({
      success: true, total, duplicates: duplicateCount, new: newCount,
      message: `${total} albums imported from Bandcamp. ${taggedCount} with genre tags.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Bandcamp import error:", msg);
    return NextResponse.json({ error: `Import error: ${msg}` }, { status: 500 });
  }
}
