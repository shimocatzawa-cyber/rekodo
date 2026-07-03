import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const preferredRegion = "syd1";

const getCachedOffers = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase
      .from("user_records")
      .select(`
        id,
        open_to_offers_at,
        media_condition,
        sleeve_condition,
        records ( id, artist, album, cover_url, year ),
        profiles!user_records_user_id_fkey ( id, username, display_name, avatar_url, is_public )
      `)
      .eq("open_to_offers", true)
      .order("open_to_offers_at", { ascending: false })
      .limit(100);

    if (error) return [];

    return (data ?? [])
      .filter((row: any) => row.profiles?.is_public && row.records?.album)
      .map((row: any) => ({
        id: row.id,
        openToOffersAt: row.open_to_offers_at,
        mediaCondition: row.media_condition,
        sleeveCondition: row.sleeve_condition,
        record: {
          id: row.records.id,
          artist: row.records.artist,
          album: row.records.album,
          coverUrl: row.records.cover_url,
          year: row.records.year,
        },
        profile: {
          id: row.profiles.id,
          username: row.profiles.username,
          displayName: row.profiles.display_name,
          avatarUrl: row.profiles.avatar_url,
        },
      }));
  },
  ["community-offers"],
  { revalidate: 600 },
);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const items = await getCachedOffers();
  return Response.json({ items });
}
