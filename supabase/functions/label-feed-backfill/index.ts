// One-off backfill: re-parses already-ingested label_feed emails so buy_url picks up
// product links that the old (link-stripping) body extractor lost. Matches re-parsed
// releases back to existing rows by gmail_message_id + artist/album and fills buy_url
// only where it's currently null — never touches rows that already have a buy_url.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const GMAIL_CLIENT_EMAIL = Deno.env.get("GMAIL_CLIENT_EMAIL")!;
const GMAIL_PRIVATE_KEY = Deno.env.get("GMAIL_PRIVATE_KEY")!;
const GMAIL_SUBJECT = Deno.env.get("GMAIL_SUBJECT")!;

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

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

interface GmailMessage {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: GmailPart[];
    mimeType?: string;
  };
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

function htmlToTextWithLinks(html: string): string {
  return html
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, (_m, href, text) => {
      const label = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return `${label} (${href})`;
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBody(part: GmailPart | GmailMessage["payload"]): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64url(part.body.data);
  }
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64url(plain.body.data);
    const html = part.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) {
      return htmlToTextWithLinks(decodeBase64url(html.body.data));
    }
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

async function fetchMessage(token: string, id: string): Promise<GmailMessage> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.json();
}

interface ParsedRelease {
  artist: string | null;
  album: string | null;
  buy_url: string | null;
}

async function parseWithClaude(subject: string, sender: string, body: string): Promise<ParsedRelease[]> {
  const prompt = `You are parsing a record label or record shop newsletter email to extract release information.

Email subject: ${subject}
From: ${sender}
Body (first 4000 chars):
${body.slice(0, 4000)}

Note: link text is followed by its URL in parentheses, e.g. "Buy now (https://example.com/product/123)" — use these URLs for buy_url, matched to the nearest release they belong to.

Extract ALL individual releases mentioned (new releases, represses, preorders, etc).
Many newsletters list multiple records — include every one you can identify.

IMPORTANT parsing rules:
- Newsletters often prefix entries with the format, e.g. "LP Swim Deep - Hum" or "12\" Artist - Title". Always strip the format prefix and place it in the "format" field — never include it in artist.
- The pattern is typically: [FORMAT] [ARTIST] - [ALBUM TITLE]. Split on " - " to separate artist from album.

Return a JSON array where each element has:
- artist: string or null — the artist/band name only, no format prefix
- album: string or null — the album/release title only
- buy_url: the direct URL to buy or view this specific release (e.g. a product page or Bandcamp link), or null if not found. Prefer specific album/product page URLs over generic store homepages.

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
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("Claude API error:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? (parsed as ParsedRelease[]) : [];
  } catch {
    console.error("Failed to parse Claude response:", text);
    return [];
  }
}

function norm(s: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: rows, error: fetchErr } = await supabase
      .from("label_feed")
      .select("id, gmail_message_id, subject, sender, artist, album")
      .is("buy_url", null)
      .not("gmail_message_id", "is", null)
      .not("artist", "is", null);

    if (fetchErr) throw new Error(`Supabase fetch error: ${fetchErr.message}`);
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ messages: 0, updated: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const byMessage = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.gmail_message_id as string;
      if (!byMessage.has(key)) byMessage.set(key, []);
      byMessage.get(key)!.push(row);
    }

    const token = await getGmailAccessToken();
    let updated = 0;
    const errors: string[] = [];

    for (const [messageId, dbRows] of byMessage) {
      try {
        const msg = await fetchMessage(token, messageId);
        const subject = getHeader(msg, "subject");
        const sender = getHeader(msg, "from");
        const body = extractBody(msg.payload);

        const parsed = await parseWithClaude(subject, sender, body);
        if (parsed.length === 0) continue;

        for (const dbRow of dbRows) {
          const match = parsed.find((p) =>
            norm(p.artist) === norm(dbRow.artist) && norm(p.album) === norm(dbRow.album)
          ) ?? parsed.find((p) => norm(p.artist) === norm(dbRow.artist));

          if (match?.buy_url) {
            const { error: updateErr } = await supabase
              .from("label_feed")
              .update({ buy_url: match.buy_url })
              .eq("id", dbRow.id)
              .is("buy_url", null);
            if (updateErr) errors.push(`${dbRow.id}: ${updateErr.message}`);
            else updated++;
          }
        }
      } catch (err) {
        errors.push(`${messageId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const result = { messages: byMessage.size, rows: rows.length, updated, errors: errors.length > 0 ? errors : undefined };
    console.log(JSON.stringify(result));
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
