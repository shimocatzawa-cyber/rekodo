import type { StarSign } from '@/lib/starSigns'

// Soft prior from self-reported star sign: nudges two thematically-aligned
// archetypes by a small, fixed amount. Deliberately low so collection data
// still drives the result — this is flavour, not a substitute for signals.
export const STAR_SIGN_NUDGE_AMOUNT = 6

export const STAR_SIGN_ARCHETYPE_NUDGE: Record<StarSign, [string, string]> = {
  Aries: ['hunter', 'outlaw'],
  Taurus: ['keeper', 'ritualist'],
  Gemini: ['seeker', 'alchemist'],
  Cancer: ['caregiver', 'lover'],
  Leo: ['ruler', 'lover'],
  Virgo: ['scholar', 'keeper'],
  Libra: ['caregiver', 'alchemist'],
  Scorpio: ['outlaw', 'hunter'],
  Sagittarius: ['pilgrim', 'seeker'],
  Capricorn: ['ruler', 'scholar'],
  Aquarius: ['outlaw', 'alchemist'],
  Pisces: ['lover', 'pilgrim'],
}
