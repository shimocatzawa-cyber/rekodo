import { feelingLabel } from "@/lib/feelings";
import { seededRandom, dayKey } from "@/lib/dailyRotation";

type LinkRow = {
  record_id: string;
  feeling: string | null;
  play_count: number;
  last_played_at: string | null;
};

// Treat "never played" as roughly 3 years stale for weighting purposes —
// high priority, but not so dominant that a record played once 8 months
// ago never gets a turn.
const NEVER_PLAYED_WEIGHT_DAYS = 1095;

function daysSince(dateStr: string | null, now: Date): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return null;
  return Math.max(0, (now.getTime() - then) / (1000 * 60 * 60 * 24));
}

export function selectDailyPick(
  links: LinkRow[],
  userId: string,
  now: Date
): { record_id: string; feeling: string | null; daysSinceLastPlayed: number | null } | null {
  if (links.length === 0) return null;

  const feelingTagged = links.filter((l) => l.feeling);
  const pool = feelingTagged.length > 0 ? feelingTagged : links;

  const weights = pool.map((l) => {
    const days = daysSince(l.last_played_at, now) ?? NEVER_PLAYED_WEIGHT_DAYS;
    return Math.max(Math.sqrt(days) / (l.play_count + 1), 0.01);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let draw = seededRandom(`dailyPick:${userId}:${dayKey(now)}`) * totalWeight;

  let chosenIndex = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    draw -= weights[i];
    if (draw <= 0) { chosenIndex = i; break; }
  }

  const chosen = pool[chosenIndex];
  return {
    record_id: chosen.record_id,
    feeling: chosen.feeling,
    daysSinceLastPlayed: daysSince(chosen.last_played_at, now),
  };
}

function durationPhrase(days: number): string {
  if (days < 30) return "a few days";
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"}`;
}

export function dailyPickBlurb(feeling: string | null, daysSinceLastPlayed: number | null): string {
  const moodPhrase = feeling ? `something ${feelingLabel(feeling)}` : "something";
  if (daysSinceLastPlayed === null) {
    return `Tonight's pick: ${moodPhrase} — sitting on your shelf, still unplayed.`;
  }
  return `Tonight's pick: ${moodPhrase} you haven't spun in ${durationPhrase(daysSinceLastPlayed)}.`;
}
