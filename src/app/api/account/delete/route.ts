import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Permanently deletes the caller's own account and everything tied to it.
// auth.admin.deleteUser cascades through every FK-linked table (profiles,
// user_records, lists, list_items, discogs_tokens, sync_queue,
// collection_intelligence, library_recommendations/wantlist,
// user_quiz_profile, taste_profile_cache, archetype_cache, api_daily_usage,
// dig_daily_count, collection_photos, collection_value_snapshots, payments,
// follows, saved_lists, list_likes, list_comments, deep_dive_sessions,
// digital_imports, wantlist — see migration 20260623000001, which had to fix
// four of those FKs from NO ACTION to CASCADE first, or this would fail
// outright for any user who'd used Insights/Library/the taste quiz.
// (compatibility_scores, which the collectors/matches feature reads/writes,
// doesn't exist as a live table at all right now — confirmed separately,
// that feature looks broken independent of this endpoint — so there's
// nothing to clean up there yet.)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const admin = getServiceClient();

  // Cancel any active subscription first — deleting the account shouldn't
  // leave someone being billed for access they no longer have.
  try {
    const { data: profile } = await admin
      .from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle() as
      { data: { stripe_customer_id: string | null } | null };
    if (profile?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: "active", limit: 10 });
      await Promise.all(subs.data.map(s => stripe.subscriptions.cancel(s.id)));
    }
  } catch (err) {
    console.error("[account/delete] Stripe cancellation failed:", err);
    // Best-effort — don't block account deletion on a Stripe API error.
  }

  // Storage objects aren't tied to the DB by FK, so they survive the user
  // row's deletion unless removed explicitly.
  await Promise.all([
    admin.storage.from("avatars").remove([`${user.id}/avatar.jpg`]),
    admin.storage.from("collection-photos").remove([`${user.id}/1.jpg`]),
  ]).catch(() => {});

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
