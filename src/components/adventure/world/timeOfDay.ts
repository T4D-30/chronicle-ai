/**
 * timeOfDay — UI 4.1 (World Presence Pass)
 *
 * Derives a presentation-only lighting phase from the Director's real
 * free-text `worldTime` ("Dusk, third day of travel"). This is a
 * keyword grade of what the Director actually wrote — never a guess:
 * when no keyword matches (or worldTime is null), the scene stays in
 * neutral daylight with no tint at all. Affects lighting/sky/ambient
 * tint only; zero gameplay implications.
 */

export type TimeOfDay = 'morning' | 'day' | 'sunset' | 'night'

const KEYWORDS: Array<[TimeOfDay, RegExp]> = [
  // night first so "nightfall"/"midnight" never fall through to other buckets
  ['night',   /\b(night|midnight|moonli\w*|moon|starlit|stars)\b/i],
  ['sunset',  /\b(dusk|sunset|sundown|twilight|evening|nightfall)\b/i],
  ['morning', /\b(dawn|sunrise|daybreak|morning|first light)\b/i],
  ['day',     /\b(noon|midday|afternoon)\b/i],
]

/** Returns the graded phase, or null when the Director's text (or its
 *  absence) gives no honest signal — callers render neutral. */
export function parseTimeOfDay(worldTime: string | null | undefined): TimeOfDay | null {
  if (!worldTime) return null
  for (const [phase, pattern] of KEYWORDS) {
    if (pattern.test(worldTime)) return phase
  }
  return null
}

/** Full-scene tint per phase (exterior scenes only; interiors and
 *  dungeons have no sky to grade). Neutral phases return null. */
export function tintFor(phase: TimeOfDay | null): string | null {
  switch (phase) {
    case 'morning':
      return 'linear-gradient(180deg, rgba(232, 167, 74, 0.12) 0%, transparent 60%)'
    case 'sunset':
      return 'linear-gradient(180deg, rgba(180, 90, 26, 0.18) 0%, rgba(122, 30, 30, 0.06) 55%, transparent 80%)'
    case 'night':
      return 'linear-gradient(180deg, rgba(10, 10, 15, 0.42) 0%, rgba(10, 10, 15, 0.28) 100%)'
    case 'day':
    default:
      return null
  }
}
