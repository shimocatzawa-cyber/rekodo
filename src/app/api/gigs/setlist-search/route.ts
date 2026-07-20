import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SfmSong     = { name?: string; tape?: boolean };
type SfmSet      = { name?: string; song?: SfmSong[] };
type SfmSetlist  = {
  id: string;
  eventDate: string; // "dd-MM-yyyy"
  artist: { name: string };
  venue: { name: string; city?: { name: string; country?: { name: string } } };
  sets: { set?: SfmSet[] };
  url: string;
};
type SfmResponse = { setlist?: SfmSetlist[]; total?: number };

function isoToSfm(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function sfmToIso(ddMMyyyy: string) {
  const [d, m, y] = ddMMyyyy.split("-");
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const artist = searchParams.get("artist")?.trim();
  const date   = searchParams.get("date")?.trim(); // YYYY-MM-DD

  if (!artist || !date) return NextResponse.json({ error: "artist and date required" }, { status: 400 });

  const apiKey = process.env.SETLIST_FM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Setlist.fm not configured" }, { status: 503 });

  let res: Response;
  try {
    res = await fetch(
      `https://api.setlist.fm/rest/1.0/search/setlists?artistName=${encodeURIComponent(artist)}&date=${isoToSfm(date)}&p=1`,
      {
        headers: { "x-api-key": apiKey, "Accept": "application/json" },
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (e) {
    return NextResponse.json({ error: `Setlist.fm unreachable: ${String(e)}` }, { status: 502 });
  }

  if (res.status === 404) return NextResponse.json({ results: [] });
  if (!res.ok) return NextResponse.json({ error: `Setlist.fm returned HTTP ${res.status}` }, { status: 502 });

  const data = await res.json() as SfmResponse;

  const results = (data.setlist ?? []).map(s => {
    const songs: { title: string; setLabel: string }[] = [];
    for (const set of s.sets?.set ?? []) {
      const label = set.name?.trim() || "Main Set";
      for (const song of set.song ?? []) {
        if (!song.tape && song.name) songs.push({ title: song.name, setLabel: label });
      }
    }
    return {
      id:         s.id,
      artistName: s.artist.name,
      venueName:  s.venue.name,
      city:       s.venue.city?.name ?? "",
      country:    s.venue.city?.country?.name ?? "",
      eventDate:  sfmToIso(s.eventDate),
      url:        s.url,
      songs,
    };
  });

  return NextResponse.json({ results });
}
