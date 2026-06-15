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

function extractBody(part: GmailPart | GmailMessage["payload"]): string {
  if (!part) return "";
  // Prefer text/plain
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64url(part.body.data);
  }
  // Recurse into multipart
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64url(plain.body.data);
    // Fall back to HTML and strip tags
    const html = part.parts.find((p) => p.mimeType === "text/html");
    if (html?.body?.data) {
      return decodeBase64url(html.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

async function listMessageIds(token: string, maxResults = 50): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("labelIds", "INBOX");
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
}

const FALLBACK: ParsedRelease = {
  artist: null,
  album: null,
  release_type: "unknown",
  format: null,
  label: null,
  description: null,
  tags: [],
};

async function parseWithClaude(
  subject: string,
  sender: string,
  body: string,
): Promise<ParsedRelease> {
  const prompt = `You are parsing a record label newsletter email to extract release information.

Email subject: ${subject}
From: ${sender}
Body (first 3000 chars):
${body.slice(0, 3000)}

Extract the primary release mentioned and return a JSON object with these fields:
- artist: string or null
- album: string or null
- release_type: one of "new_release", "repress", "preorder", "announcement", "unknown"
- format: e.g. "LP", "12\"", "7\"", "CD", "Digital", or null
- label: record label name or null
- description: one or two sentence description of the release or null
- tags: array of relevant tags (genre, mood, style — max 6)

Return ONLY valid JSON, no markdown, no explanation.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error("Claude API error:", res.status, await res.text());
    return FALLBACK;
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as ParsedRelease;
  } catch {
    console.error("Failed to parse Claude response:", text);
    return FALLBACK;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get all message IDs from inbox
    const token = await getGmailAccessToken();
    const allIds = await listMessageIds(token, 50);

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

        const parsed = await parseWithClaude(subject, sender, body);

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
        });

        if (insertErr) {
          errors.push(`${id}: ${insertErr.message}`);
        } else {
          processed++;
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
