import { STAR_SIGNS, type StarSign } from "@/lib/starSigns";

// Aspect distance → compatibility score, using traditional zodiac aspects:
// 0 same sign, 1 semisextile (30°), 2 sextile (60°), 3 square (90°),
// 4 trine (120°, same element), 5 quincunx (150°), 6 opposition (180°)
const ASPECT_SCORES = [85, 40, 75, 35, 90, 30, 65] as const;

export function starSignCompatibility(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ai = (STAR_SIGNS as readonly string[]).indexOf(a);
  const bi = (STAR_SIGNS as readonly string[]).indexOf(b);
  if (ai === -1 || bi === -1) return null;
  const dist = Math.min(Math.abs(ai - bi), 12 - Math.abs(ai - bi));
  return ASPECT_SCORES[dist];
}
