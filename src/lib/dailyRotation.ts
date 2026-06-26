function hashSeed(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic [0, 1) value for a given seed key — same key always yields the same value. */
export function seededRandom(seedKey: string): number {
  return mulberry32(hashSeed(seedKey))();
}

/**
 * Deterministic day key (YYYY-MM-DD) that rolls over at 09:00 local time.
 * We shift the clock back 9 hours so midnight–08:59 still belongs to the
 * previous day's pick, and 09:00 onward belongs to today's.
 * Falls back to UTC if no timezone is provided or the value is invalid.
 */
export function dayKey(now: Date, timezone?: string): string {
  const shifted = new Date(now.getTime() - 9 * 60 * 60 * 1000);
  if (timezone) {
    try {
      // en-CA formats as YYYY-MM-DD — exactly what we need.
      return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(shifted);
    } catch { /* invalid timezone — fall through */ }
  }
  return shifted.toISOString().slice(0, 10);
}
