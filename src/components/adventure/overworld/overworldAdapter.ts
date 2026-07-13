/**
 * overworldAdapter — Presentation 3 (Playable Overworld)
 *
 * THE single boundary between the overworld presentation layer and the
 * game: every typed OverworldIntent becomes a call on the EXISTING
 * AdventureActions surface — nothing else. Interact and exit intents
 * ground as plain-text actions through actions.submitAction (the exact
 * mechanism ActionBar's quick actions already use), so the Adventure
 * Controller, rules engine, and Director resolve every outcome.
 * Encounter intents call the existing actions.startCombat with the
 * trigger's fixture enemies. No Supabase, no state mutation, no new
 * controller contracts.
 */

import type { AdventureActions } from '../useAdventureSession'
import type { EnemyCombatant } from '@/lib/engine'
import type { OverworldIntent } from './overworldTypes'

/** Fixture enemies per encounter trigger id — vertical-slice content,
 *  resolved by the EXISTING combat mode without any resolution change. */
const ENCOUNTER_ENEMIES: Record<string, EnemyCombatant[]> = {
  'forest-ambush': [
    {
      id: 'wolf-1',
      name: 'Forest Wolf',
      isPlayer: false,
      maxHp: 11,
      currentHp: 11,
      armorClass: 13,
      attackBonus: 4,
      damageDie: 'd6',
      damageBonus: 2,
      dexMod: 2,
    },
  ],
}

export function handleOverworldIntent(intent: OverworldIntent, actions: AdventureActions): void {
  switch (intent.type) {
    case 'interact':
    case 'exit':
      actions.submitAction(intent.text)
      break
    case 'encounter': {
      const enemies = ENCOUNTER_ENEMIES[intent.triggerId]
      if (enemies) {
        actions.startCombat(enemies.map((e) => ({ ...e })))
      }
      break
    }
  }
}
