import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const GMAIL_CLIENT_EMAIL = Deno.env.get("GMAIL_CLIENT_EMAIL")!;
const GMAIL_PRIVATE_KEY = Deno.env.get("GMAIL_PRIVATE_KEY")!;
const GMAIL_SUBJECT = Deno.env.get("GMAIL_SUBJECT")!; // labels@rekodo.co

// ─── Base64url ─────────────────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ─── Gmail JWT auth ─────────────────────────────────────────────────────────

async function getGmailAccessToken(): Promise<string> {
  const privateKey = GMAIL_PRIVATE_KEY.replace(/\\n/g, "\n");
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(enc.encode(JSON.stringify({
    iss: GMAIL_CLIENT_EMAIL,
    sub: GMAIL_SUBJECT,
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));

  const pem = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    enc.encode(`${header}.${payload}`),
  );
  const jwt = `${header}.${payload}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Gmail token error: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// ─── Gmail helpers ──────────────────────────────────────────────────────────

interface GmailMessage {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailPart[];
    mimeType?: string;
  };
  internalDate?: string;
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function decodeBase64url(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

// Converts HTML to plain text while keeping link destinations inline (e.g. "Buy now (https://...)"),
// since Claude only sees this flattened text and needs the URLs to extract per-release buy_url.
// Many label/store newsletters lay releases out as cover-art images with the artist/album only
// in the <img alt> text (visible link text is just a generic "Buy"/"Shop" icon) — inlining alt
// text recovers that. Block boundaries are turned into newlines (rather than collapsed to a
// single space like every other tag) so Claude can tell where one release's block ends and the
// next begins, which is what it needs to match each buy_url to the right release.
function htmlToTextWithLinks(html: string): string {
  return html
    .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, (_m, alt) => {
      const text = alt.replace(/\s+/g, " ").trim();
      return text ? ` [${text}] ` : " ";
    })
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, (_m, href, text) => {
      const label = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return `${label} (${href})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(tr|table|div|p|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function extractBody(part: GmailPart | GmailMessage["payload"]): string {
  if (!part) return "";
  // Prefer text/plain
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64url(part.body.data);
  }
  // Recurse into multipart
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    const html  = part.parts.find((p) => p.mimeType === "text/html");
    const plainText = plain?.body?.data ? decodeBase64url(plain.body.data) : "";
    const htmlText  = html?.body?.data ? htmlToTextWithLinks(decodeBase64url(html.body.data)) : "";
    // Some senders ship a stub plain-text part ("This email was sent as HTML-only,
    // click here to view") with all the real content only in the HTML part. Prefer
    // whichever side actually has the substance rather than always trusting plain.
    if (plainText || htmlText) {
      return htmlText.length > plainText.length * 1.5 ? htmlText : (plainText || htmlText);
    }
    // Recurse deeper
    for (const p of part.parts) {
      const body = extractBody(p);
      if (body) return body;
    }
  }
  if (part.body?.data) return decodeBase64url(part.body.data);
  return "";
}

function getHeader(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value ?? "";
}

async function listMessageIds(token: string, maxResults = 200): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", String(maxResults));
  // Query from the first of the current month so any scheduling gap doesn't drop
  // emails — deduplication by gmail_message_id makes re-processing already-seen
  // messages a safe no-op.
  const now = new Date();
  const monthStart = `${now.getFullYear()}/${now.getMonth() + 1}/1`;
  url.searchParams.set("q", `after:${monthStart}`);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

async function fetchMessage(token: string, id: string): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.json();
}

// ─── Claude extraction ──────────────────────────────────────────────────────

interface ParsedRelease {
  artist: string | null;
  album: string | null;
  release_type: "new_release" | "repress" | "preorder" | "announcement" | "unknown";
  format: string | null;
  label: string | null;
  description: string | null;
  tags: string[];
  buy_url: string | null;
  price: string | null;
  release_date: string | null;
}

const FALLBACK: ParsedRelease = {
  artist: null,
  album: null,
  release_type: "unknown",
  format: null,
  label: null,
  description: null,
  tags: [],
  buy_url: null,
  price: null,
  release_date: null,
};

// A response cut off by max_tokens still has every release up to the cut as
// complete, valid JSON objects — only the last (in-progress) one is broken.
// Recovers everything before that instead of discarding the whole array.
function salvagePartialJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  if (start === -1) return [];
  let depth = 0;
  let lastSafeEnd = -1;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 1) lastSafeEnd = i; // just closed an object that's a direct child of the array
    }
  }
  if (lastSafeEnd === -1) return [];
  try {
    const parsed = JSON.parse(text.slice(start, lastSafeEnd + 1) + "]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function parseWithClaude(
  subject: string,
  sender: string,
  body: string,
): Promise<ParsedRelease[]> {
  const prompt = `You are parsing a record label or record shop newsletter email to extract release information.

Email subject: ${subject}
From: ${sender}
Body (first 20000 chars):
${body.slice(0, 20000)}

Note: link text is followed by its URL in parentheses, e.g. "Buy now (https://example.com/product/123)" — use these URLs for buy_url, matched to the nearest release they belong to.

Extract ALL individual releases mentioned (new releases, represses, preorders, etc).
Many newsletters list multiple records — include every one you can identify.

IMPORTANT parsing rules:
- Newsletters often prefix entries with the format, e.g. "LP Swim Deep - Hum" or "12\" Artist - Title". Always strip the format prefix and place it in the "format" field — never include it in artist.
- The pattern is typically: [FORMAT] [ARTIST] - [ALBUM TITLE]. Split on " - " to separate artist from album.
- Do not include format tokens (LP, EP, 12", 7", CD, etc.) in the artist field.

Return a JSON array where each element has:
- artist: string or null — the artist/band name only, no format prefix
- album: string or null — the album/release title only
- release_type: one of "new_release", "repress", "preorder", "announcement", "unknown"
- format: e.g. "LP", "12\\"", "7\\"", "CD", "Digital", or null
- label: record label name or null
- description: one sentence about this specific release or null
- tags: array of relevant tags (genre, mood, style — max 5)
- buy_url: the direct URL to buy or view this specific release (e.g. a product page or Bandcamp link), or null if not found. Prefer specific album/product page URLs over generic store homepages.
- price: the price of this release as shown in the email (e.g. "£18.99", "$25.00"), or null if not mentioned.
- release_date: the release or shipping date in ISO 8601 format (YYYY-MM-DD), or null if not mentioned. Use the email's received date as context for relative dates like "out now" or "available Friday".

If no releases can be identified return an empty array [].
Return ONLY a valid JSON array, no markdown, no explanation.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      // Newsletters listing dozens of releases (e.g. Norman Records' daily digest, or
      // Resident Music's full-catalog "Fresh On The Site" emails) need real headroom —
      // 8192 still wasn't enough for at least one observed email (hit stop_reason
      // "max_tokens" with 20+ releases pending). salvagePartialJsonArray below is the
      // backstop for whatever this ceiling still isn't enough for.
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("Claude API error:", res.status, await res.text());
    return [FALLBACK];
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as ParsedRelease[];
    return [];
  } catch {
    const salvaged = salvagePartialJsonArray(text) as ParsedRelease[];
    console.error(`Failed to parse Claude response (salvaged ${salvaged.length} releases):`, text);
    return salvaged.length > 0 ? salvaged : [FALLBACK];
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get all message IDs from inbox
    const token = await getGmailAccessToken();
    const allIds = await listMessageIds(token, 200);

    if (allIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0, skipped: 0, message: "Inbox empty" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Find already-processed IDs
    const { data: existing, error: fetchErr } = await supabase
      .from("label_feed")
      .select("gmail_message_id")
      .in("gmail_message_id", allIds);

    if (fetchErr) throw new Error(`Supabase fetch error: ${fetchErr.message}`);

    const seen = new Set((existing ?? []).map((r: { gmail_message_id: string }) => r.gmail_message_id));
    const newIds = allIds.filter((id) => !seen.has(id));

    console.log(`Total: ${allIds.length}, already seen: ${seen.size}, new: ${newIds.length}`);

    if (newIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0, skipped: allIds.length, message: "All up to date" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Process each new message
    let processed = 0;
    const errors: string[] = [];

    for (const id of newIds) {
      try {
        const msg = await fetchMessage(token, id);
        const subject = getHeader(msg, "subject");
        const sender = getHeader(msg, "from");
        const body = extractBody(msg.payload);
        const receivedAt = msg.internalDate
          ? new Date(Number(msg.internalDate)).toISOString()
          : new Date().toISOString();

        const releases = await parseWithClaude(subject, sender, body);

        if (releases.length === 0) {
          console.log(`No releases found in message ${id} (${subject})`);
          // Insert a placeholder row so we don't reprocess this email
          await supabase.from("label_feed").insert({
            gmail_message_id: id, sender, subject, received_at: receivedAt,
            artist: null, album: null, release_type: "unknown",
            format: null, label: null, description: null, tags: [],
          });
          continue;
        }

        for (const parsed of releases) {
          const { error: insertErr } = await supabase.from("label_feed").insert({
            gmail_message_id: id,
            sender,
            subject,
            received_at: receivedAt,
            artist: parsed.artist,
            album: parsed.album,
            release_type: parsed.release_type,
            format: parsed.format,
            label: parsed.label,
            description: parsed.description,
            tags: parsed.tags,
            buy_url: parsed.buy_url ?? null,
            price: parsed.price ?? null,
            release_date: parsed.release_date ?? null,
          });
          if (insertErr) {
            errors.push(`${id}/${parsed.artist}: ${insertErr.message}`);
          } else {
            processed++;
          }
        }
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const result = {
      processed,
      skipped: seen.size,
      errors: errors.length > 0 ? errors : undefined,
    };
    console.log(JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
