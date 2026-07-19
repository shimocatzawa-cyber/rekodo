import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

type Track = { n: number; title: string };
type EmbedResult = { id: number; type: "album" | "track"; tracks: Track[] } | null;

type TrackInfo = { track_num?: number; title?: string };

function extractTracks(parsed: { trackinfo?: TrackInfo[] } | null | undefined): Track[] {
  if (!parsed?.trackinfo) return [];
  return parsed.trackinfo
    .filter(t => t.track_num && t.title)
    .map(t => ({ n: t.track_num!, title: t.title! }))
    .sort((a, b) => a.n - b.n);
}

function extractFromHtml(html: string, url: string): EmbedResult {
  const type = url.includes("/track/") ? "track" : "album";

  // 1. data-tralbum attribute (newer Bandcamp pages) — try first as it has full trackinfo
  const dataTralbum = html.match(/data-tralbum="([^"]+)"/);
  if (dataTralbum) {
    try {
      const decoded = dataTralbum[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded) as { id?: number; trackinfo?: TrackInfo[] };
      if (parsed.id) return { id: parsed.id, type, tracks: extractTracks(parsed) };
    } catch { /* continue */ }
  }

  // 2. og:video meta tag — reliable for ID but no trackinfo
  const ogVideo = html.match(/property="og:video(?::url)?"\s+content="([^"]+)"/i)
               ?? html.match(/content="([^"]+)"\s+property="og:video(?::url)?"/i);
  let ogId: number | null = null;
  let ogType: "album" | "track" = type;
  if (ogVideo) {
    const m = ogVideo[1].match(/EmbeddedPlayer\/(album|track)=(\d+)/);
    if (m) { ogId = parseInt(m[2], 10); ogType = m[1] as "album" | "track"; }
  }

  // 3. pagedata blob containing TralbumData
  const pagedata = html.match(/data-blob="([^"]+)"/);
  if (pagedata) {
    try {
      const decoded = pagedata[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded) as { TralbumData?: { id?: number; trackinfo?: TrackInfo[] } };
      if (parsed.TralbumData?.id) {
        return { id: parsed.TralbumData.id, type, tracks: extractTracks(parsed.TralbumData) };
      }
    } catch { /* continue */ }
  }

  // 4. Inline TralbumData JS object — parse a large chunk to capture trackinfo
  const tralbumIdx = html.indexOf("TralbumData");
  if (tralbumIdx !== -1) {
    // Try to grab a big enough slice to include trackinfo
    const chunk = html.slice(tralbumIdx, tralbumIdx + 60_000);
    const idMatch = chunk.match(/"id"\s*:\s*(\d+)/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      // Try to parse trackinfo from inline JSON
      const trackinfoMatch = chunk.match(/"trackinfo"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
      let tracks: Track[] = [];
      if (trackinfoMatch) {
        try {
          const raw = JSON.parse(trackinfoMatch[1]) as TrackInfo[];
          tracks = extractTracks({ trackinfo: raw });
        } catch { /* no tracks */ }
      }
      return { id, type, tracks };
    }
  }

  // 5. og:video ID fallback (no tracks)
  if (ogId) return { id: ogId, type: ogType, tracks: [] };

  // 6. data-item-id attribute
  const itemId = html.match(/data-item-id="[at]-?(\d+)"/);
  if (itemId) return { id: parseInt(itemId[1], 10), type, tracks: [] };

  return null;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = request.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  if (!url.match(/^https?:\/\/[^/]*\.?bandcamp\.com\//)) {
    return NextResponse.json({ error: "Not a Bandcamp URL" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    html = await res.text();
  } catch (err) {
    return NextResponse.json({ error: `Fetch failed: ${String(err)}` }, { status: 502 });
  }

  const result = extractFromHtml(html, url);
  if (!result) return NextResponse.json({ error: "Could not find Bandcamp ID" }, { status: 422 });
  return NextResponse.json(result);
}
