import { NextResponse } from "next/server";
import { createClient as createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Check with regular client (respects RLS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regularResult = await (authClient as any)
    .from("shelf_posts")
    .select("id, user_id, created_at")
    .limit(10);

  // Check with service role client (bypasses RLS)
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceResult = await (sb as any)
    .from("shelf_posts")
    .select("id, user_id, created_at")
    .limit(10);

  return NextResponse.json({
    viewerId: user?.id ?? null,
    regularClient: { data: regularResult.data, error: regularResult.error?.message },
    serviceClient: { data: serviceResult.data, error: serviceResult.error?.message },
  });
}
