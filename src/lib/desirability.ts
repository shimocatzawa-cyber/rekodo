export type DesirabilityTier = "rare" | "cult" | "widely-loved" | "in-demand";

export function getDesirabilityTier(
  have:        number | null,
  want:        number | null,
  priceLow:    number | null,
  numForSale:  number | null,
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
  // well-tracked community, or a smaller community with a steep price/scarcity.
  const isRare =
    (finalScore >= 1.5 && total >= 500 && (price >= 50 || notForSale)) ||
    (want > have && (price >= 200 || notForSale) && total >= 30);
  if (isRare) return "rare";
  if (baseScore >= 2.5 && total >= 30 && total < 500) return "cult";
  if (total >= 5000 && ratio >= 0.15 && ratio <= 0.65) return "widely-loved";
  if (baseScore >= 0.45) return "in-demand";
  return null;
}
