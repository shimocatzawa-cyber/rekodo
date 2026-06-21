export const FEELINGS = [
  "upbeat", "joyful", "calm", "tender", "nostalgic",
  "melancholy", "powerful", "haunted", "longing",
  "cool", "dreamy", "defiant",
] as const;

export type Feeling = typeof FEELINGS[number];

export function isValidFeeling(value: string): value is Feeling {
  return (FEELINGS as readonly string[]).includes(value);
}

export function feelingLabel(feeling: string): string {
  return feeling.charAt(0).toUpperCase() + feeling.slice(1);
}
