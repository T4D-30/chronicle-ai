import { ARCHETYPE_HIT_DIE } from '@/lib/engine'
import type { SelectOption } from '@/components/ui'

/**
 * Curated class/archetype options for the wizard's Class step.
 * Derived directly from the engine's ARCHETYPE_HIT_DIE map — every option
 * shown here is guaranteed to resolve to a real hit die, so the wizard never
 * offers a choice the engine doesn't already recognise.
 *
 * The engine does NOT restrict archetype to this list (it's a free string
 * with a 'd8' fallback for unknown values) — this is curation for a good
 * wizard experience, not a validation rule. A custom class name typed by
 * the player is still accepted; see the "Custom..." escape hatch below.
 */
export const CLASS_OPTIONS: SelectOption[] = Object.keys(ARCHETYPE_HIT_DIE)
  .sort()
  .map((archetype) => ({
    value: archetype,
    label: archetype.charAt(0).toUpperCase() + archetype.slice(1),
  }))

/**
 * Curated species/ancestry options. The engine treats ancestry as a free
 * lowercase string with no mechanical effects yet (deferred to a later
 * volume per character.ts), so this list is purely presentational.
 */
export const SPECIES_OPTIONS: SelectOption[] = [
  'human',
  'elf',
  'dwarf',
  'halfling',
  'half-elf',
  'half-orc',
  'gnome',
  'dragonborn',
  'tiefling',
  'orc',
].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))

/**
 * Curated background options. Like ancestry, the engine treats this as a
 * free lowercase string with no mechanical effects yet.
 */
export const BACKGROUND_OPTIONS: SelectOption[] = [
  'soldier',
  'scholar',
  'criminal',
  'noble',
  'sailor',
  'hermit',
  'folk hero',
  'acolyte',
  'guild artisan',
  'wanderer',
  'outlander',
  'entertainer',
].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))
