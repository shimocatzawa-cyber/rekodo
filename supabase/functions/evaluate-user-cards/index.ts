import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;

// ── Evaluation ────────────────────────────────────────────────────────────────

async function evaluate(userId: string): Promise<{ newly_unlocked: string[] }> {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── 1. Already-unlocked cards (idempotency gate) ──────────────────────────
  const { data: existingRows } = await db
    .from("user_cards")
    .select("card_id")
    .eq("user_id", userId);
  const alreadyUnlocked = new Set<string>((existingRows ?? []).map((r: { card_id: string }) => r.card_id));

  // ── 2. Parallel data fetch ────────────────────────────────────────────────
  const [
    discogsRes,
    totalRecordsRes,
    wantlistRes,
    listRes,
    untaggedRes,
    offerTotalRes,
    offerClosedRes,
    profileRes,
    genreRes,
    sonicRes,
    eventRes,
  ] = await Promise.all([
    // curator: Discogs connected
    db.from("discogs_tokens").select("user_id", { count: "exact", head: true }).eq("user_id", userId),

    // obsessive: total records
    db.from("user_records").select("*", { count: "exact", head: true }).eq("user_id", userId),

    // seeker / dreamer: wantlist count
    db.from("wantlist").select("*", { count: "exact", head: true }).eq("user_id", userId),

    // librarian: lists count
    db.from("lists").select("*", { count: "exact", head: true }).eq("user_id", userId),

    // completionist: records with BOTH feeling and is_essential null
    db.from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("feeling", null)
      .is("is_essential", null),

    // purist denominator: records where open_to_offers has been set
    db.from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("open_to_offers", "is", null),

    // purist numerator: closed-offer records
    db.from("user_records")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("open_to_offers", false),

    // keeper: supporter flag
    db.from("profiles")
      .select("is_supporter, is_donor")
      .eq("id", userId)
      .maybeSingle(),

    // explorer: user_records joined to records for genre — up to 2000 rows
    db.from("user_records")
      .select("records(genre)")
      .eq("user_id", userId)
      .limit(2000),

    // sonic-archaeologist: user_records joined to records for producers/matrix
    db.from("user_records")
      .select("records(producers, matrix)")
      .eq("user_id", userId)
      .limit(2000),

    // all event-based conditions
    db.from("user_events")
      .select("event_type, metadata, created_at")
      .eq("user_id", userId)
      .limit(5000),
  ]);

  // ── 3. Derive condition values ────────────────────────────────────────────

  const totalRecords  = totalRecordsRes.count  ?? 0;
  const wantlistCount = wantlistRes.count       ?? 0;
  const listCount     = listRes.count           ?? 0;
  const untaggedCount = untaggedRes.count       ?? 0;
  const offerTotal    = offerTotalRes.count     ?? 0;
  const offerClosed   = offerClosedRes.count    ?? 0;
  const profile       = profileRes.data as { is_supporter: boolean | null; is_donor: boolean | null } | null;

  // explorer: distinct primary genres
  const distinctGenres = new Set<string>();
  for (const row of (genreRes.data ?? []) as Array<{ records: { genre: string | null } | null }>) {
    const g = row.records?.genre;
    if (g) distinctGenres.add(g);
  }

  // completionist: every record has been actioned (feeling OR is_essential set)
  const completionistMet = totalRecords > 0 && untaggedCount === 0;

  // purist: 90%+ of records-with-offer-data are closed, with a minimum floor of 5
  const puristMet = offerTotal >= 5 && (offerClosed / offerTotal) >= 0.9;

  // keeper
  const keeperMet = !!(profile?.is_supporter || profile?.is_donor);

  // sonic-archaeologist: 10+ records with producers or matrix populated
  let sonicCount = 0;
  for (const row of (sonicRes.data ?? []) as Array<{ records: { producers: string[] | null; matrix: string[] | null } | null }>) {
    const r = row.records;
    if (!r) continue;
    if ((r.producers?.length ?? 0) > 0 || (r.matrix?.length ?? 0) > 0) sonicCount++;
  }

  // ── 4. Event-based conditions ─────────────────────────────────────────────
  const events = (eventRes.data ?? []) as Array<{
    event_type: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;

  const playEvents = events.filter(e => e.event_type === "play_logged");

  // romantic: same record_id in metadata across 10+ play events
  const playsByRecord = new Map<string, number>();
  for (const e of playEvents) {
    const rid = e.metadata?.record_id as string | undefined;
    if (rid) playsByRecord.set(rid, (playsByRecord.get(rid) ?? 0) + 1);
  }
  const romanticMet = [...playsByRecord.values()].some(n => n >= 10);

  // hunter: dig_used on 7+ distinct calendar days
  const digDays = new Set(
    events
      .filter(e => e.event_type === "dig_used")
      .map(e => e.created_at.slice(0, 10))
  );

  // wanderer: content_viewed for 10+ distinct item IDs
  const viewedItems = new Set(
    events
      .filter(e => e.event_type === "content_viewed")
      .map(e => e.metadata?.item_id as string | undefined)
      .filter((id): id is string => !!id)
  );

  // ── 5. Evaluate all conditions ────────────────────────────────────────────
  const toUnlock: string[] = [];
  const check = (cardId: string, met: boolean) => {
    if (met && !alreadyUnlocked.has(cardId)) toUnlock.push(cardId);
  };

  // State-based
  check("beginner",            true);
  check("curator",             (discogsRes.count ?? 0) > 0);
  check("explorer",            distinctGenres.size >= 8);
  check("completionist",       completionistMet);
  check("seeker",              wantlistCount >= 10);
  check("purist",              puristMet);
  check("keeper",              keeperMet);
  check("obsessive",           totalRecords >= 250);
  check("sonic-archaeologist", sonicCount >= 10);
  check("dreamer",             wantlistCount >= 25);
  check("librarian",           listCount >= 3);

  // Event-based
  check("historian",    events.some(e => e.event_type === "memory_logged"));
  check("romantic",     romanticMet);
  check("alchemist",    events.some(e => e.event_type === "dig_playlist_created"));
  check("wanderer",     viewedItems.size >= 10);
  check("listener",     playEvents.length > 0);
  check("hunter",       digDays.size >= 7);
  check("constellation",events.some(e => e.event_type === "card_shared"));

  // Composite — evaluate after all others so the full picture is known
  const META_CARDS = new Set(["collector", "myth"]);
  const allUnlocked = new Set([...alreadyUnlocked, ...toUnlock]);
  const nonMetaUnlocked = [...allUnlocked].filter(id => !META_CARDS.has(id)).length;
  check("collector", nonMetaUnlocked >= 15);

  // myth: all implemented non-myth cards must be unlocked
  const MYTH_PREREQS = [
    "beginner","curator","explorer","completionist","historian","romantic",
    "seeker","purist","alchemist","wanderer","listener","keeper",
    "obsessive","hunter","sonic-archaeologist","dreamer","constellation",
    "librarian","collector",
  ];
  const allUnlockedFinal = new Set([...alreadyUnlocked, ...toUnlock]);
  check("myth", MYTH_PREREQS.every(id => allUnlockedFinal.has(id)));

  // ── 6. Write newly unlocked cards ─────────────────────────────────────────
  if (toUnlock.length > 0) {
    await db.from("user_cards").upsert(
      toUnlock.map(card_id => ({ user_id: userId, card_id, unlocked_at: new Date().toISOString() })),
      { onConflict: "user_id,card_id", ignoreDuplicates: true }
    );
  }

  return { newly_unlocked: toUnlock };
}

// ── Entry point ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  let userId: string | undefined;

  // For user JWT calls (logEvent client-side): validate and extract user_id from JWT.
  // For service role key calls (admin/batch): getUser returns null, fall through
  // to trust user_id from body. Supabase's own JWT middleware already validated
  // the token before we get here, so any token reaching this point is legitimate.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();

  if (user) {
    userId = user.id;
  } else if (body.user_id) {
    // Non-user token (service role): trust user_id from body
    userId = body.user_id;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized or missing user_id" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await evaluate(userId);
    return new Response(JSON.stringify(result), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[evaluate-user-cards] Error for user", userId, ":", err);
    return new Response(JSON.stringify({ error: "Evaluation failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
