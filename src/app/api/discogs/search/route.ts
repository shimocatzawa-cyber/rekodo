import { type NextRequest } from "next/server";

const VINYL_FORMATS  = new Set(["Vinyl", "LP", '12"', '7"', '10"', "12in", "7in", "10in", "45 RPM", "33 ⅓ RPM"]);
const REISSUE_TOKENS = new Set(["Reissue", "Repress", "RE", "Unofficial Release", "Bootleg", "Remastered", "Compilation"]);

interface DiscogsResult {
  format?:    string[];
  year?:      string;
  community?: { have?: number; want?: number };
}

function isVinyl(fmt: string[]): boolean {
  return fmt.some(f => VINYL_FORMATS.has(f));
}

function isReissue(fmt: string[]): boolean {
  return fmt.some(f => REISSUE_TOKENS.has(f));
}

function sortDiscogs(results: DiscogsResult[]): DiscogsResult[] {
  return [...results].sort((a, b) => {
    const fmtA = a.format ?? [];
    const fmtB = b.format ?? [];

    // 1. Vinyl before non-vinyl
    const vinylDiff = (isVinyl(fmtA) ? 0 : 1) - (isVinyl(fmtB) ? 0 : 1);
    if (vinylDiff !== 0) return vinylDiff;

    // 2. Original pressings before reissues
    const reissueDiff = (isReissue(fmtA) ? 1 : 0) - (isReissue(fmtB) ? 1 : 0);
    if (reissueDiff !== 0) return reissueDiff;

    // 3. Most collected/wanted first (popularity proxy)
    const haveA = (a.community?.have ?? 0) + (a.community?.want ?? 0);
    const haveB = (b.community?.have ?? 0) + (b.community?.want ?? 0);
    if (haveA !== haveB) return haveB - haveA;

    // 4. Oldest year first (original pressings tend to come first)
    const yA = parseInt(a.year ?? "9999", 10) || 9999;
    const yB = parseInt(b.year ?? "9999", 10) || 9999;
    return yA - yB;
  });
}

export async function GET(request: NextRequest) {
  const q    = request.nextUrl.searchParams.get("q")?.trim();
  const mode = request.nextUrl.searchParams.get("mode") ?? "record";

  if (!q) return Response.json({ results: [] });

  const key    = process.env.DISCOGS_CONSUMER_KEY;
  const secret = process.env.DISCOGS_CONSUMER_SECRET;

  if (!key || !secret) {
    return Response.json({ error: "Discogs not configured" }, { status: 500 });
  }

  const url = new URL("https://api.discogs.com/database/search");
  url.searchParams.set("q", q);
  url.searchParams.set("type", mode === "song" ? "track" : "release");
  url.searchParams.set("per_page", "25");  // fetch more to sort effectively
  url.searchParams.set("key", key);
  url.searchParams.set("secret", secret);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "rekodo/1.0" },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return Response.json({ error: "Discogs search failed" }, { status: 502 });
  }

  const data = await res.json();
  const raw: DiscogsResult[] = data.results ?? [];

  // Sort and return top 15 for display
  const sorted = mode === "song" ? raw : sortDiscogs(raw);
  return Response.json({ results: sorted.slice(0, 15) });
}
