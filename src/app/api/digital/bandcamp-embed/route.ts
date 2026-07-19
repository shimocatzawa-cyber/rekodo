import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

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

  // Extract album/track ID from TralbumData block
  const tralbumIdx = html.indexOf("TralbumData");
  if (tralbumIdx !== -1) {
    const chunk = html.slice(tralbumIdx, tralbumIdx + 600);
    const idMatch = chunk.match(/"id"\s*:\s*(\d+)/);
    if (idMatch) {
      const id = parseInt(idMatch[1], 10);
      const type = url.includes("/track/") ? "track" : "album";
      return NextResponse.json({ id, type });
    }
  }

  // Fallback: data-item-id attribute
  const itemIdMatch = html.match(/data-item-id="[at]-?(\d+)"/);
  if (itemIdMatch) {
    const id = parseInt(itemIdMatch[1], 10);
    const type = url.includes("/track/") ? "track" : "album";
    return NextResponse.json({ id, type });
  }

  return NextResponse.json({ error: "Could not find Bandcamp ID" }, { status: 422 });
}
