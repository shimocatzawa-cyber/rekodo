import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupporter } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AlbumQuery { artist: string; title: string; }

export interface ArtworkResponse {
  images: Record<string, string>;    // key "artist|title" → i.discogs.com URL
  notFound: string[];                // keys where Discogs returned zero results
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!(await isSupporter(supabase, user.id))) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { albums?: AlbumQuery[] };
  const albums = body.albums ?? [];
  if (albums.length === 0) return Response.json({ images: {}, notFound: [] } satisfies ArtworkResponse);

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;
  const headers: Record<string, string> = { "User-Agent": "rekodo/1.0 (shimocatzawa@gmail.com)" };
  if (key && secret) headers["Authorization"] = `Discogs key=${key}, secret=${secret}`;

  const images: Record<string, string> = {};
  const notFound: string[] = [];

  const BATCH    = 4;
  const DELAY_MS = 1100;

  for (let i = 0; i < albums.length; i += BATCH) {
    if (i > 0) await new Promise(r => setTimeout(r, DELAY_MS));
    await Promise.all(
      albums.slice(i, i + BATCH).map(async (album) => {
        const mapKey = `${album.artist}|${album.title}`;
        try {
          const q = encodeURIComponent(`${album.artist} ${album.title}`);
          const res = await fetch(
            `https://api.discogs.com/database/search?q=${q}&type=master&per_page=5`,
            { headers, signal: AbortSignal.timeout(6000) }
          );
          if (!res.ok) return; // rate limit or error — skip, don't flag as notFound
          const data = await res.json() as { results?: { cover_image?: string; thumb?: string }[] };
          const results = data.results ?? [];

          if (results.length === 0) {
            notFound.push(mapKey);
            return;
          }

          // Found on Discogs — try to get a real image
          for (const result of results) {
            const url = result.cover_image ?? result.thumb ?? "";
            if (url.includes("i.discogs.com")) {
              images[mapKey] = url;
              return;
            }
          }
          // Has results but no usable image — verified but no art (don't add to notFound)
        } catch { /* network error — skip silently, don't flag */ }
      })
    );
  }

  return Response.json({ images, notFound } satisfies ArtworkResponse);
}
