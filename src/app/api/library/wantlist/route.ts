import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET — return all wantlist items for the user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("library_wantlist")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ items: data ?? [] });
}

// POST — save a recommendation to the wantlist
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const {
    recommendation_id,
    format,
    title,
    creator,
    external_url,
    affiliate_url,
    thumbnail_url,
    match_reason,
  } = body as {
    recommendation_id?: string;
    format?: string;
    title?: string;
    creator?: string;
    external_url?: string;
    affiliate_url?: string;
    thumbnail_url?: string;
    match_reason?: string;
  };

  // If recommendation_id provided, pull fields from the recommendation table
  let resolvedFields = { format, title, creator, external_url, affiliate_url, thumbnail_url, match_reason };

  if (recommendation_id) {
    const { data: rec } = await supabase
      .from("library_recommendations")
      .select("format, title, creator, external_url, affiliate_url, thumbnail_url, match_reason")
      .eq("id", recommendation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (rec) {
      resolvedFields = {
        format: format ?? (rec.format ?? undefined),
        title: title ?? (rec.title ?? undefined),
        creator: creator ?? (rec.creator ?? undefined),
        external_url: external_url ?? (rec.external_url ?? undefined),
        affiliate_url: affiliate_url ?? (rec.affiliate_url ?? undefined),
        thumbnail_url: thumbnail_url ?? (rec.thumbnail_url ?? undefined),
        match_reason: match_reason ?? (rec.match_reason ?? undefined),
      };
    }
  }

  if (!resolvedFields.title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("library_wantlist")
    .insert({
      user_id: user.id,
      recommendation_id: recommendation_id ?? null,
      format: (resolvedFields.format as "podcast" | "book" | "audible" | null | undefined) ?? null,
      title: resolvedFields.title,
      creator: resolvedFields.creator ?? null,
      external_url: resolvedFields.external_url ?? null,
      affiliate_url: resolvedFields.affiliate_url ?? null,
      thumbnail_url: resolvedFields.thumbnail_url ?? null,
      match_reason: resolvedFields.match_reason ?? null,
      status: "saved",
    })
    .select()
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ item: data });
}
