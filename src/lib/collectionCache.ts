import { kv } from "@vercel/kv";
import type { LinkRow, RecordRow } from "@/app/collection/page";

export type CollectionCachePayload = {
  allLinks: LinkRow[];
  recordRows: RecordRow[];
};

const KEY = (userId: string) => `rk:col:${userId}`;
const TTL = 48 * 60 * 60; // 48 h safety net — syncs invalidate proactively

function available() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getCollectionCache(userId: string): Promise<CollectionCachePayload | null> {
  if (!available()) return null;
  try {
    return await kv.get<CollectionCachePayload>(KEY(userId));
  } catch {
    return null;
  }
}

export async function setCollectionCache(userId: string, data: CollectionCachePayload): Promise<void> {
  if (!available()) return;
  try {
    await kv.set(KEY(userId), data, { ex: TTL });
  } catch (err) {
    console.error("[kv] collection cache write failed:", err);
  }
}

export async function invalidateCollectionCache(userId: string): Promise<void> {
  if (!available()) return;
  try {
    await kv.del(KEY(userId));
  } catch (err) {
    console.error("[kv] collection cache invalidation failed:", err);
  }
}
