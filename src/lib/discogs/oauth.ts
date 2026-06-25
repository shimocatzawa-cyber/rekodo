import { createHmac } from "crypto";

const UA = "rekodo/1.0";

// RFC 3986 percent-encode (encodeURIComponent misses !'()*)
function pct(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function nonce(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function buildAuthHeader(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  tokenKey = "",
  tokenSecret = "",
  extra: Record<string, string> = {}
): string {
  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
    ...extra,
  };
  if (tokenKey) params.oauth_token = tokenKey;

  // Merge URL query params into signature base
  const urlObj = new URL(url);
  const sigParams: Record<string, string> = { ...params };
  urlObj.searchParams.forEach((v, k) => {
    sigParams[k] = v;
  });

  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const normParams = Object.entries(sigParams)
    .map(([k, v]) => [pct(k), pct(v)] as [string, string])
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const base = [method.toUpperCase(), pct(baseUrl), pct(normParams)].join("&");
  const key = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  params.oauth_signature = createHmac("sha1", key).update(base).digest("base64");

  return (
    "OAuth " +
    Object.entries(params)
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ")
  );
}

// ─── Discogs OAuth endpoints ───────────────────────────────────────────────

export async function getRequestToken(
  consumerKey: string,
  consumerSecret: string,
  callbackUrl: string
): Promise<{ token: string; secret: string }> {
  const url = "https://api.discogs.com/oauth/request_token";
  const auth = buildAuthHeader("POST", url, consumerKey, consumerSecret, "", "", {
    oauth_callback: callbackUrl,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request token ${res.status}: ${text}`);
  }
  const p = new URLSearchParams(await res.text());
  return { token: p.get("oauth_token") ?? "", secret: p.get("oauth_token_secret") ?? "" };
}

export async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  requestToken: string,
  requestSecret: string,
  verifier: string
): Promise<{ token: string; secret: string; username?: string }> {
  const url = "https://api.discogs.com/oauth/access_token";
  const auth = buildAuthHeader(
    "POST",
    url,
    consumerKey,
    consumerSecret,
    requestToken,
    requestSecret,
    { oauth_verifier: verifier }
  );
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: auth,
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Access token ${res.status}: ${text}`);
  }
  const body = await res.text();
  console.log("Discogs access token raw response:", body);
  const p = new URLSearchParams(body);
  return {
    token: p.get("oauth_token") ?? "",
    secret: p.get("oauth_token_secret") ?? "",
    // Discogs includes username in the access token response body
    username: p.get("username") ?? undefined,
  };
}

export async function getIdentity(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  tokenSecret: string
): Promise<{ username: string }> {
  const url = "https://api.discogs.com/oauth/identity";
  const auth = buildAuthHeader("GET", url, consumerKey, consumerSecret, accessToken, tokenSecret);
  const res = await fetch(url, { headers: { Authorization: auth, "User-Agent": UA } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Identity ${res.status}: ${text}`);
  }
  const data = await res.json();
  // Primary: data.username. Fallback: parse resource_url ("https://api.discogs.com/users/{username}")
  const username =
    data.username ||
    (typeof data.resource_url === "string"
      ? data.resource_url.split("/users/")[1]?.split("/")[0]
      : undefined);
  if (!username) {
    throw new Error(`Could not determine username from identity response: ${JSON.stringify(data)}`);
  }
  return { username };
}

// ─── Collection fetch ──────────────────────────────────────────────────────

export interface CollectionRelease {
  discogs_id: string;
  artist: string;
  album: string;
  year: number | null;
  genre: string | null;
  cover_url: string | null;
  label: string | null;
  format: string | null;
  country: string | null;
}

export async function fetchCollectionReleases(
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  tokenSecret: string,
  username: string
): Promise<CollectionRelease[]> {
  const perPage = 100;
  const releases: CollectionRelease[] = [];

  console.log(`fetchCollectionReleases: username="${username}"`);

  for (let page = 1; ; page++) {
    const url = new URL(
      `https://api.discogs.com/users/${encodeURIComponent(username)}/collection/folders/0/releases`
    );
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));

    console.log(`Discogs collection page ${page}: GET ${url.toString()}`);

    const auth = buildAuthHeader(
      "GET",
      url.toString(),
      consumerKey,
      consumerSecret,
      accessToken,
      tokenSecret
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, "User-Agent": UA },
    });

    console.log(`Discogs collection page ${page}: status ${res.status}`);

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`Discogs collection page ${page} failed ${res.status}: ${errorText}`);
      if (page === 1) {
        const msg = res.status === 403
          ? "Discogs is temporarily unavailable — your collection is safe. Try again in a few minutes."
          : `Discogs returned an error (${res.status}) — try again shortly.`;
        throw new Error(msg);
      }
      break;
    }

    const data = await res.json();
    console.log(`Discogs collection page ${page}: ${(data.releases ?? []).length} releases, pagination:`, data.pagination);
    for (const item of data.releases ?? []) {
      const info = item.basic_information ?? {};
      const artistNames = (info.artists ?? [])
        .map((a: { name: string }) => a.name.replace(/ \(\d+\)$/, "").trim())
        .join(", ");
      const fmt = info.formats?.[0];
      const genre =
        info.genres?.[0] ??
        info.styles?.[0] ??
        (fmt?.descriptions?.[0] ?? null);

      // Extract vinyl size / format type from formats[0]
      const fmtName: string = fmt?.name ?? "";
      const fmtDescs: string[] = fmt?.descriptions ?? [];
      const vinylSizes = ['LP', '12"', '10"', '7"', 'EP', 'Mini-Album'];
      const format: string | null =
        fmtName === "Vinyl"
          ? (fmtDescs.find((d) => vinylSizes.includes(d)) ?? "Vinyl")
          : fmtName || null;

      releases.push({
        discogs_id: String(info.id ?? item.id),
        artist: artistNames || "Unknown",
        album: info.title ?? "Unknown",
        year: info.year || null,
        genre,
        cover_url: info.cover_image ?? info.thumb ?? null,
        label: info.labels?.[0]?.name ?? null,
        format,
        country: info.country ?? null,
      });
    }

    const pagination = data.pagination ?? {};
    if (page >= (pagination.pages ?? 1)) break;
  }

  return releases;
}
