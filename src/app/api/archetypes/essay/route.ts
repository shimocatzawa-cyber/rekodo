import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    primary?: string;
    primaryScore?: number;
    secondary?: string | null;
    shadow?: string;
    signals?: Record<string, { score: number; label: string; rhythmType?: string }>;
    recordCount?: number;
  };
  const { primary, primaryScore, secondary, shadow, signals, recordCount } = body;

  if (!primary || !signals) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Check essay cache — 30 day TTL
  const { data: cache } = await db
    .from("archetype_cache")
    .select("essay_text, essay_generated_at, primary_archetype")
    .eq("user_id", user.id)
    .maybeSingle() as { data: { essay_text: string | null; essay_generated_at: string | null; primary_archetype: string | null } | null };

  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (
    cache?.essay_text &&
    cache.essay_generated_at &&
    cache.primary_archetype === primary &&
    Date.now() - new Date(cache.essay_generated_at).getTime() < thirtyDays
  ) {
    return Response.json({ essay: cache.essay_text });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Essay generation unavailable" }, { status: 503 });
  }

  const s = signals;
  const promptContent = `Write a personalised collector narrative for:
Primary: ${primary} (score: ${primaryScore ?? 0}/100)
Secondary: ${secondary || 'none'}
Shadow: ${shadow ?? 'none'}
Records: ${recordCount ?? 0}

Key signals:
- Label Loyalty: ${s.labelLoyalty?.label ?? 'unknown'} (${s.labelLoyalty?.score ?? 0}/100)
- Condition Standard: ${s.conditionStandard?.label ?? 'unknown'} (${s.conditionStandard?.score ?? 0}/100)
- Geographic Range: ${s.geographicRange?.label ?? 'unknown'} (${s.geographicRange?.score ?? 0}/100)
- Historical Depth: ${s.historicalDepth?.label ?? 'unknown'} (${s.historicalDepth?.score ?? 0}/100)
- Sonic Coherence: ${s.sonicCoherence?.label ?? 'unknown'} (${s.sonicCoherence?.score ?? 0}/100)
- Acquisition Rhythm: ${s.acquisitionRhythm?.rhythmType ?? s.acquisitionRhythm?.label ?? 'unknown'}
- Trophy Ratio: ${s.trophyRatio?.label ?? 'unknown'} (${s.trophyRatio?.score ?? 0}/100)

Write the narrative now. Second person. 180-220 words.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: `You are rekōdo's archetype narrator. Write in the second person, directly addressing the collector.
Tone: literary, warm, precise. Not sentimental. Not generic.
Style: short paragraphs, no bullet points, no headers.
Length: 180–220 words exactly.
Do not mention rekōdo or any app. Do not use the word "archetype".
Write about what the collection reveals about this specific person based on the signal data provided.`,
        messages: [{ role: "user", content: promptContent }],
      }),
    });

    if (!res.ok) {
      return Response.json({ error: "Essay generation unavailable" }, { status: 503 });
    }

    const data = await res.json() as {
      content?: Array<{ type: string; text: string }>;
    };
    const essay = data.content?.[0]?.text ?? "";

    if (essay) {
      await db.from("archetype_cache").update({
        essay_text: essay,
        essay_generated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }

    return Response.json({ essay });
  } catch {
    return Response.json({ error: "Essay generation unavailable" }, { status: 503 });
  }
}
