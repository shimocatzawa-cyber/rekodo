import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UA = "Mozilla/5.0 (compatible; rekodo/1.0)";

function fallbackSearchUrl(artist: string, album: string): string {
  return `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}`;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const artist = req.nextUrl.searchParams.get("artist")?.trim() ?? "";
  const album  = req.nextUrl.searchParams.get("album")?.trim()  ?? "";

  if (!artist || !album) {
    return Response.json({ searchUrl: fallbackSearchUrl(artist, album) });
  }

  const searchUrl = `https://bandcamp.com/search?q=${encodeURIComponent(`${artist} ${album}`)}&item_type=a`;

  try {
    // ── Step 1: fetch the Bandcamp search results page ──────────────────────
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      next: { revalidate: 3600 },
    });

    if (!searchRes.ok) {
      return Response.json({ searchUrl: fallbackSearchUrl(artist, album) });
    }

    const searchHtml = await searchRes.text();

    // ── Step 2: find the first album result URL ──────────────────────────────
    // Bandcamp album pages live at https://[artist].bandcamp.com/album/[slug]
    const albumMatch = searchHtml.match(
      /href="(https?:\/\/[a-z0-9-]+\.bandcamp\.com\/album\/[a-z0-9_-]+)"/i
    );

    if (!albumMatch) {
      return Response.json({ searchUrl: fallbackSearchUrl(artist, album) });
    }

    const albumUrl = albumMatch[1];

    // ── Step 3: fetch the album page ─────────────────────────────────────────
    const albumRes = await fetch(albumUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
      next: { revalidate: 3600 },
    });

    if (!albumRes.ok) {
      return Response.json({ albumUrl, searchUrl: fallbackSearchUrl(artist, album) });
    }

    const albumHtml = await albumRes.text();

    // ── Step 4: extract the numeric album ID from page source ─────────────────
    // Try patterns in order of reliability:
    //   "album_id":12345   — appears on track pages referencing the parent album
    //   EmbeddedPlayer/album=12345  — if the page already contains an embed
    //   "id" : 12345       — TralbumData.id on album pages (must be ≥7 digits to
    //                         avoid matching smaller numbers in unrelated contexts)
    const idMatch =
      albumHtml.match(/"album_id"\s*:\s*(\d+)/) ||
      albumHtml.match(/EmbeddedPlayer\/album=(\d+)/) ||
      albumHtml.match(/"id"\s*:\s*(\d{7,})/);

    if (!idMatch) {
      return Response.json({ albumUrl, searchUrl: fallbackSearchUrl(artist, album) });
    }

    const albumId   = idMatch[1];
    const embedUrl  = `https://bandcamp.com/EmbeddedPlayer/album=${albumId}/size=small/bgcol=ffffff/linkcol=CC5500/tracklist=false/transparent=true/`;

    return Response.json({
      embedUrl,
      albumUrl,
      searchUrl: fallbackSearchUrl(artist, album),
    });

  } catch {
    return Response.json({ searchUrl: fallbackSearchUrl(artist, album) });
  }
}
