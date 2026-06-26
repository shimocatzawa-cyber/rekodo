export type DesirabilityTier = "rare" | "cult" | "widely-loved" | "in-demand";

export function getDesirabilityTier(
  have:        number | null,
  want:        number | null,
  priceLow:    number | null,
  numForSale:  number | null,
  editionSize: number | null = null,
): DesirabilityTier | null {
  if (have === null || want === null) return null;

  const price = priceLow ?? 0;
  const total = have + want;
  if (total < 30) return null;

  const notForSale = numForSale === 0;
  const confidence = Math.log10(total + 1) / Math.log10(50001);
  const ratio      = want / Math.max(have, 1);
  const baseScore  = ratio * (0.4 + 0.6 * confidence);
  const priceBoost = (price >= 50 || notForSale) ? Math.min(price / 400, 0.5) : 0;
  const finalScore = baseScore + priceBoost;

  // Merged from two formerly-separate tiers (holy-grail + rare) — a record
  // qualifies as "rare" via either path: a high want/have score among a large,
  // well-tracked community, a smaller community with steep price/scarcity, or
  // a confirmed tiny pressing (≤500 copies) that more people want than own.
  const isRare =
    (finalScore >= 1.5 && total >= 500 && (price >= 50 || notForSale)) ||
    (want > have && (price >= 200 || notForSale) && total >= 30) ||
    (editionSize !== null && editionSize <= 500 && want > have && total >= 30);
  if (isRare) return "rare";

  // Cult: a confirmed limited pressing (≤1000 copies) gives stronger confidence
  // that demand is genuine scarcity-driven — lower the score threshold and relax
  // the community-size cap (a 500-press can still have 2000 Discogs followers).
  const smallEdition  = editionSize !== null && editionSize <= 1000;
  const cultThreshold = smallEdition ? 1.8 : 2.5;
  const cultMaxTotal  = smallEdition ? 2000 : 500;
  if (baseScore >= cultThreshold && total >= 30 && total < cultMaxTotal) return "cult";

  if (total >= 5000 && ratio >= 0.15 && ratio <= 0.65) return "widely-loved";
  if (baseScore >= 0.45) return "in-demand";
  return null;
}
