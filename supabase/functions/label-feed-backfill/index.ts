// Repair tool: re-parses already-ingested label_feed emails to fill in fields that came
// back null on first ingest (commonly because the old body extractor lost <img alt> text
// and collapsed block boundaries, starving Claude of context). Matches re-parsed releases
// back to existing rows by gmail_message_id + artist/album and only fills currently-null
// fields — never overwrites a value that's already set.
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
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64url(part.body.data);
  }
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
  release_type: "new_release" | "repress" | "preorder" | "announcement" | "unknown";
  format: string | null;
  label: string | null;
  description: string | null;
  tags: string[];
  buy_url: string | null;
  price: string | null;
  release_date: string | null;
}

async function parseWithClaude(subject: string, sender: string, body: string): Promise<ParsedRelease[]> {
  const prompt = `You are parsing a record label or record shop newsletter email to extract release information.

Email subject: ${subject}
From: ${sender}
Body (first 20000 chars):
${body.slice(0, 20000)}

Note: link text is followed by its URL in parentheses, e.g. "Buy now (https://example.com/product/123)" — use these URLs for buy_url, matched to the nearest release they belong to.
Cover-art image alt text appears inline as [Artist - Album] — use it to identify releases when there's no other surrounding text.

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
      // Newsletters listing dozens of releases (e.g. Norman Records' daily digest) need
      // more room than 2048 tokens — once the output gets cut off mid-array, JSON.parse
      // throws and the whole message silently yields zero releases.
      max_tokens: 8192,
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

Deno.serve(async (req) => {
  try {
    // dryRun: true skips DB writes and instead returns what Claude extracted per message,
    // so a stuck repair (e.g. updated: 0) can be diagnosed without guessing blind.
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch {
      // no/invalid JSON body — default to a real run
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Scoped to the last 5 days — this repairs recent ingest misses, not the whole historical
    // backlog. Without a cutoff, a single invocation re-fetches + re-parses every incomplete
    // row ever ingested, which blows past the edge function's compute/time limit.
    const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error: fetchErr } = await supabase
      .from("label_feed")
      .select("id, gmail_message_id, subject, sender, artist, album, format, label, description, tags, buy_url, price, release_date")
      .not("gmail_message_id", "is", null)
      .not("artist", "is", null)
      .gte("received_at", cutoff)
      .or("album.is.null,buy_url.is.null,format.is.null,label.is.null,price.is.null,release_date.is.null");

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
    const debug: unknown[] = [];

    for (const [messageId, dbRows] of byMessage) {
      try {
        const msg = await fetchMessage(token, messageId);
        const subject = getHeader(msg, "subject");
        const sender = getHeader(msg, "from");
        const body = extractBody(msg.payload);

        const parsed = await parseWithClaude(subject, sender, body);

        if (dryRun) {
          debug.push({
            messageId,
            subject,
            sender,
            bodyLength: body.length,
            bodyPreview: body.slice(0, 1500),
            parsed,
            dbRows: dbRows.map((r) => ({ id: r.id, artist: r.artist, album: r.album })),
          });
          continue;
        }

        if (parsed.length === 0) continue;

        for (const dbRow of dbRows) {
          const match = parsed.find((p) =>
            norm(p.artist) === norm(dbRow.artist) && norm(p.album) === norm(dbRow.album)
          ) ?? parsed.find((p) => norm(p.artist) === norm(dbRow.artist));

          if (!match) continue;

          // Only fill fields that are currently empty — never overwrite an existing value.
          const patch: Record<string, unknown> = {};
          if (!dbRow.album && match.album) patch.album = match.album;
          if (!dbRow.format && match.format) patch.format = match.format;
          if (!dbRow.label && match.label) patch.label = match.label;
          if (!dbRow.description && match.description) patch.description = match.description;
          if (!dbRow.buy_url && match.buy_url) patch.buy_url = match.buy_url;
          if (!dbRow.price && match.price) patch.price = match.price;
          if (!dbRow.release_date && match.release_date) patch.release_date = match.release_date;
          if ((!dbRow.tags || (dbRow.tags as string[]).length === 0) && match.tags?.length) patch.tags = match.tags;

          if (Object.keys(patch).length > 0) {
            const { error: updateErr } = await supabase
              .from("label_feed")
              .update(patch)
              .eq("id", dbRow.id);
            if (updateErr) errors.push(`${dbRow.id}: ${updateErr.message}`);
            else updated++;
          }
        }
      } catch (err) {
        errors.push(`${messageId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const result = dryRun
      ? { messages: byMessage.size, rows: rows.length, debug }
      : { messages: byMessage.size, rows: rows.length, updated, errors: errors.length > 0 ? errors : undefined };
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
