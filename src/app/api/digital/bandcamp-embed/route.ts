import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

type EmbedResult = { id: number; type: "album" | "track" } | null;

function extractFromHtml(html: string, url: string): EmbedResult {
  const type = url.includes("/track/") ? "track" : "album";

  // 1. og:video meta tag — most reliable, gives the embed URL directly
  //    <meta property="og:video" content="https://bandcamp.com/EmbeddedPlayer/album=123/..."/>
  const ogVideo = html.match(/property="og:video(?::url)?"\s+content="([^"]+)"/i)
                ?? html.match(/content="([^"]+)"\s+property="og:video(?::url)?"/i);
  if (ogVideo) {
    const m = ogVideo[1].match(/EmbeddedPlayer\/(album|track)=(\d+)/);
    if (m) return { id: parseInt(m[2], 10), type: m[1] as "album" | "track" };
  }

  // 2. data-tralbum attribute (newer Bandcamp pages)
  const dataTralbum = html.match(/data-tralbum="([^"]+)"/);
  if (dataTralbum) {
    try {
      const decoded = dataTralbum[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded) as { id?: number };
      if (parsed.id) return { id: parsed.id, type };
    } catch { /* continue */ }
  }

  // 3. pagedata blob containing TralbumData
  const pagedata = html.match(/data-blob="([^"]+)"/);
  if (pagedata) {
    try {
      const decoded = pagedata[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded) as { TralbumData?: { id?: number } };
      if (parsed.TralbumData?.id) return { id: parsed.TralbumData.id, type };
    } catch { /* continue */ }
  }

  // 4. Inline TralbumData JS object (old Bandcamp format)
  const tralbumIdx = html.indexOf("TralbumData");
  if (tralbumIdx !== -1) {
    const chunk = html.slice(tralbumIdx, tralbumIdx + 800);
    const idMatch = chunk.match(/"id"\s*:\s*(\d+)/);
    if (idMatch) return { id: parseInt(idMatch[1], 10), type };
  }

  // 5. data-item-id attribute
  const itemId = html.match(/data-item-id="[at]-?(\d+)"/);
  if (itemId) return { id: parseInt(itemId[1], 10), type };

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
