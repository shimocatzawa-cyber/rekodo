import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

const UA = "Mozilla/5.0 (compatible; rekodo/1.0)";

async function getFanId(username: string): Promise<{ fanId: number | null; error?: string }> {
  const htmlRes = await fetch(`https://bandcamp.com/${username}`, {
    headers: { "User-Agent": UA, "Accept": "text/html" },
  });

  if (htmlRes.status === 404) {
    return {
      fanId: null,
      error: "Bandcamp user not found. Check the username in your profile settings.",
    };
  }
  if (!htmlRes.ok) {
    return { fanId: null, error: `Could not reach Bandcamp (status ${htmlRes.status}).` };
  }

  const html = await htmlRes.text();

  // Strategy 1: data-blob attribute (works on older Bandcamp page structure)
  for (const match of html.matchAll(/data-blob="([^"]+)"/g)) {
    try {
      const raw = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'");
      const blob = JSON.parse(raw) as Record<string, unknown>;
      type FanData = { id?: number };
      const fanData = (blob?.fan_data ?? blob?.CurrentFan ?? blob?.FanData ?? blob?.current_fan) as FanData | undefined;
      if (fanData?.id) return { fanId: fanData.id };
    } catch { continue; }
  }

  // Strategy 2: fan_id embedded directly in HTML (script tags, gift links, etc.)
  const inlineMatch = html.match(/"fan_id"\s*:\s*(\d+)/) ?? html.match(/[?&]fan_id=(\d+)/);
  if (inlineMatch) return { fanId: parseInt(inlineMatch[1], 10) };

  // Strategy 3: wishlist RSS feed — Bandcamp embeds fan_id in gift link query params
  const rssRes = await fetch(`https://bandcamp.com/${username}/wishlist?format=rss`, {
    headers: { "User-Agent": UA },
  });
  if (rssRes.ok) {
    const rssText = await rssRes.text();
    const rssMatch = rssText.match(/[?&]fan_id=(\d+)/);
    if (rssMatch) return { fanId: parseInt(rssMatch[1], 10) };
  }

  return {
    fanId: null,
    error: "Could not find your Bandcamp fan ID. Make sure your collection is set to Public in your Bandcamp account settings.",
  };
}

type CollectionItem = { band_name: string; album_title: string };

async function fetchCollection(fanId: number): Promise<CollectionItem[]> {
  const items: CollectionItem[] = [];
  let olderThanToken = "9999999999:9999999999:a::";

  for (;;) {
    const res = await fetch("https://bandcamp.com/api/fancollection/1/collection_items", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ fan_id: fanId, older_than_token: olderThanToken, count: 20 }),
    });

    if (!res.ok) break;

    const data = (await res.json()) as {
      items?: { band_name?: string; album_title?: string }[];
      more_available?: boolean;
      last_token?: string;
    };

    for (const item of data.items ?? []) {
      if (item.band_name && item.album_title) {
        items.push({ band_name: item.band_name, album_title: item.album_title });
      }
    }

    if (!data.more_available) break;
    olderThanToken = data.last_token ?? olderThanToken;

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
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("bandcamp_username")
      .eq("id", userId)
      .single();

    if (!profile?.bandcamp_username) {
      return NextResponse.json(
        { error: "No Bandcamp username set. Add it in your profile settings." },
        { status: 400 }
      );
    }

    const username = profile.bandcamp_username.trim().toLowerCase();

    const { fanId, error: fanError } = await getFanId(username);
    if (!fanId) return NextResponse.json({ error: fanError }, { status: 400 });

    const collection = await fetchCollection(fanId);

    if (collection.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        duplicates: 0,
        new: 0,
        message: "No albums found in your Bandcamp collection.",
      });
    }

    // Fetch user's physical collection for deduplication
    const { data: userRecordsData } = await supabase
      .from("user_records")
      .select("record_id")
      .eq("user_id", userId);

    const recordIds = (userRecordsData ?? []).map(r => r.record_id as string);

    type RecordRow = { id: string; artist: string; album: string };
    const physicalCollection: RecordRow[] = [];

    if (recordIds.length > 0) {
      const BATCH = 400;
      for (let i = 0; i < recordIds.length; i += BATCH) {
        const { data } = await supabase
          .from("records")
          .select("id, artist, album")
          .in("id", recordIds.slice(i, i + BATCH));
        for (const r of data ?? []) physicalCollection.push(r as RecordRow);
      }
    }

    const normalizedPhysical = physicalCollection.map(r => ({
      id:     r.id,
      artist: normalize(r.artist),
      album:  normalize(r.album),
    }));

    let duplicateCount = 0;

    const upsertRows = collection.map(item => {
      const normArtist = normalize(item.band_name);
      const normAlbum  = normalize(item.album_title);

      let isDuplicate    = false;
      let matchedId: string | null = null;

      for (const physical of normalizedPhysical) {
        if (
          similarity(normArtist, physical.artist) >= 0.85 &&
          similarity(normAlbum,  physical.album)  >= 0.85
        ) {
          isDuplicate = true;
          matchedId   = physical.id;
          break;
        }
      }

      if (isDuplicate) duplicateCount++;

      return {
        user_id:           userId,
        source:            "bandcamp",
        artist:            item.band_name,
        album:             item.album_title,
        is_duplicate:      isDuplicate,
        matched_record_id: matchedId,
        imported_at:       new Date().toISOString(),
      };
    });

    // Replace previous sync data rather than upsert — avoids depending on a
    // unique constraint and ensures stale entries are cleaned up.
    const { error: delError } = await supabase
      .from("digital_imports")
      .delete()
      .eq("user_id", userId)
      .eq("source", "bandcamp");
    if (delError) throw new Error(`Failed to clear previous import: ${delError.message}`);

    const INSERT_BATCH = 100;
    for (let i = 0; i < upsertRows.length; i += INSERT_BATCH) {
      const { error: insError } = await supabase
        .from("digital_imports")
        .insert(upsertRows.slice(i, i + INSERT_BATCH));
      if (insError) throw new Error(`Failed to save import batch: ${insError.message}`);
    }

    const total    = collection.length;
    const newCount = total - duplicateCount;

    return NextResponse.json({
      success:    true,
      total,
      duplicates: duplicateCount,
      new:        newCount,
      message:    `${total} albums imported from Bandcamp. ${duplicateCount} already in your physical collection.`,
    });
  } catch (error) {
    console.error("Bandcamp import error:", error);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
