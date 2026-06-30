import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkDailyLimit, isSupporter } from "@/lib/rateLimit";

export const maxDuration = 60;

const client = new Anthropic();

const PROMPTS: Record<string, (artist: string) => string> = {
  rankings: (artist) =>
    `You are a knowledgeable music critic writing for serious vinyl collectors. Rank ${artist}'s studio albums from best to worst. For each album include a 2–3 sentence critical review (specific, opinionated, no generic praise) and a collector note about pressings or editions worth seeking.
Return ONLY valid JSON, no markdown, no backticks:
{"albums":[{"rank":1,"title":"Album Title","year":1975,"review":"...","collectorNote":"..."}]}`,

  podcasts: (artist) =>
    `You are a music research assistant helping a vinyl collector. List notable podcast episodes that feature or deeply discuss ${artist}. Focus on episodes where the artist is a main subject or guest.
Return ONLY valid JSON, no markdown, no backticks:
{"episodes":[{"show":"Show Name","episode":"Episode title","year":2021,"type":"interview","note":"Why worth listening"}]}`,

  books: (artist) =>
    `You are a music research assistant helping a vinyl collector deepen their knowledge.

List books and audiobooks about or significantly featuring ${artist}.
IMPORTANT ORDERING RULE — return results in this priority order:
1. Works written BY the artist themselves (memoirs, autobiographies, manifestos, collected writings) — these come first, always
2. Official or authorised biographies
3. Critical studies focused primarily on this artist
4. Books where this artist features substantially (not just mentioned)
5. Essential books about the scene or era they defined

Return ONLY valid JSON, no markdown:
{"items":[{"title":"Book Title","author":"Author Name","year":2003,"type":"memoir","written_by_artist":true,"format":"book","note":"One sentence on why this is essential reading for a fan of this artist"}]}

The "type" field must be one of: "memoir", "autobiography", "biography", "authorised biography", "critical study", "collected writings", "scene history".
The "format" field must be one of: "book", "audiobook", "both".
The "written_by_artist" field must be true if the artist wrote it themselves, otherwise false.`,

  interviews: (artist) =>
    `You are a music research assistant. List the most significant interviews given by ${artist} — print, video, or audio. Focus on interviews that reveal something meaningful about their creative process, influences, or philosophy.

For each interview, provide the publication's primary domain (e.g. "pitchfork.com", "thewire.co.uk", "npr.org", "youtube.com") — this is used to construct a search link and must be accurate.

Return ONLY valid JSON, no markdown:
{"interviews":[{"publication":"Publication or platform display name","domain":"publicationdomain.com","title":"Interview title or description","year":1982,"format":"print","note":"One sentence on what makes this interview essential"}]}

The "format" field must be one of: "print", "video", "audio".`,
};

export async function POST(request: NextRequest) {
  try {
    // Deep Dive is a supporter-only feature (src/app/deep-dive/page.tsx
    // gates the page itself) — this route had no auth check at all, so it
    // was directly callable by anyone, logged in or not, bypassing both the
    // login wall and the paywall, with no rate limit on Anthropic spend.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!(await isSupporter(supabase, user.id))) {
      return NextResponse.json({ error: "Supporter access required" }, { status: 403 });
    }
    const FREE_DEEP_DIVE_LIMIT = 15;
    const { allowed, used, limit } = await checkDailyLimit(supabase, user.id, "deep_dive", FREE_DEEP_DIVE_LIMIT);
    if (!allowed) {
      return NextResponse.json({ error: "daily_limit_reached", used, limit }, { status: 429 });
    }

    const { artist, section } = (await request.json()) as {
      artist?: string;
      section?: string;
    };

    if (!artist || !section || !PROMPTS[section]) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: section === "rankings" ? 3000 : 2048,
      messages: [{ role: "user", content: PROMPTS[section](artist) }],
    });

    if (message.stop_reason === "max_tokens") {
      return NextResponse.json({ error: "Response truncated" }, { status: 500 });
    }

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const clean = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let data: unknown;
    try {
      data = JSON.parse(clean);
    } catch {
      return NextResponse.json(
        { error: "Parse error", raw: clean },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Deep Dive API error:", error);
    return NextResponse.json({ error: "Claude API error" }, { status: 500 });
  }
}
