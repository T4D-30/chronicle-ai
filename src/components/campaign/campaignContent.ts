import type { SelectOption } from '@/components/ui'
import type { CampaignTone, CampaignDifficulty, RulesStyle } from '@/types/campaign'

export const TONE_OPTIONS: Array<SelectOption & { description: string }> = [
  { value: 'heroic',     label: 'Heroic',     description: 'Classic fantasy adventure — bold deeds, clear stakes, triumphant moments.' },
  { value: 'grim',      label: 'Grim',       description: 'Dark and grounded — loss is real, victories are costly, the world is dangerous.' },
  { value: 'mysterious',label: 'Mysterious',  description: 'Secrets and slow revelation — the world hides things worth uncovering.' },
  { value: 'comedic',   label: 'Comedic',    description: 'Lighter and playful — absurdity welcome, stakes can bend for a good bit.' },
]

export const DIFFICULTY_OPTIONS: Array<SelectOption & { description: string }> = [
  { value: 'easy',     label: 'Easy',     description: 'Forgiving odds — the Director favours your success and cushions failures.' },
  { value: 'standard', label: 'Standard', description: 'Balanced — outcomes follow the dice honestly, good and bad alike.' },
  { value: 'brutal',   label: 'Brutal',   description: 'Harsh consequences — failures sting, every resource matters.' },
]

export const RULES_STYLE_OPTIONS: Array<SelectOption & { description: string }> = [
  { value: 'narrative', label: 'Narrative',  description: 'Story-first — the Director elaborates broadly and weaves rich prose around every roll.' },
  { value: 'standard',  label: 'Standard',  description: 'Balanced narration — clear outcomes with enough colour to feel alive.' },
  { value: 'crunchy',   label: 'Crunchy',   description: 'Rules-adjacent — the Director calls out modifiers, conditions, and mechanical effects.' },
  { value: 'cinematic', label: 'Cinematic', description: 'Dramatic flair — outcomes are narrated with maximum tension and theatrical weight.' },
]

/** Display label for a CampaignTone value. */
export function toneLabel(tone: CampaignTone): string {
  return TONE_OPTIONS.find((o) => o.value === tone)?.label ?? tone
}

/** Display label for a CampaignDifficulty value. */
export function difficultyLabel(difficulty: CampaignDifficulty): string {
  return DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label ?? difficulty
}

/** Display label for a RulesStyle value. */
export function rulesStyleLabel(style: RulesStyle): string {
  return RULES_STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style
}

/** Campaign status badge colour variant. */
export function statusVariant(status: string): 'arcane' | 'spirit' | 'neutral' | 'heal' {
  switch (status) {
    case 'active':    return 'spirit'
    case 'paused':    return 'arcane'
    case 'completed': return 'heal'
    default:          return 'neutral'
  }
}

/** Human-readable campaign status. */
export function statusLabel(status: string): string {
  switch (status) {
    case 'idle':      return 'Not started'
    case 'active':    return 'In progress'
    case 'paused':    return 'Paused'
    case 'completed': return 'Complete'
    default:          return status
  }
}
