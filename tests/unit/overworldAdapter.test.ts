/**
 * overworldAdapter Tests — Presentation 3 (Playable Overworld)
 *
 * The single boundary: every intent becomes a call on the EXISTING
 * AdventureActions surface and nothing else — no Supabase, no state
 * mutation, no new contracts.
 */
import { describe, it, expect, vi } from 'vitest'
import { handleOverworldIntent } from '@/components/adventure/overworld/overworldAdapter'
import type { AdventureActions } from '@/components/adventure/useAdventureSession'

function mockActions(): AdventureActions {
  return {
    pause: vi.fn(), resume: vi.fn(), end: vi.fn(), reload: vi.fn(),
    submitAction: vi.fn(), cancelStream: vi.fn(),
    startCombat: vi.fn(), endCombat: vi.fn(), commitCombatResult: vi.fn(),
    levelUpCharacter: vi.fn(), clearCheckResult: vi.fn(), clearXpGain: vi.fn(),
  } as unknown as AdventureActions
}

describe('handleOverworldIntent — grounded through the existing controller', () => {
  it('interact intents submit their grounded text via submitAction', () => {
    const actions = mockActions()
    handleOverworldIntent(
      { type: 'interact', verb: 'talk', entityId: 'monk', entityName: 'Brother Aldwin', text: 'I greet the monk.' },
      actions,
    )
    expect(actions.submitAction).toHaveBeenCalledWith('I greet the monk.')
    expect(actions.startCombat).not.toHaveBeenCalled()
  })

  it('exit intents submit their named-location text via submitAction', () => {
    const actions = mockActions()
    handleOverworldIntent(
      { type: 'exit', exitId: 'forest-gate', to: 'forest-path', spawn: 'from-courtyard', text: 'I pass through the gate.' },
      actions,
    )
    expect(actions.submitAction).toHaveBeenCalledWith('I pass through the gate.')
  })

  it('encounter intents call the existing startCombat with fixture enemies', () => {
    const actions = mockActions()
    handleOverworldIntent({ type: 'encounter', triggerId: 'forest-ambush', label: 'Ambush' }, actions)
    expect(actions.startCombat).toHaveBeenCalledOnce()
    const enemies = (actions.startCombat as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(enemies[0]).toMatchObject({ name: 'Forest Wolf', isPlayer: false })
    expect(actions.submitAction).not.toHaveBeenCalled()
  })

  it('unknown encounter triggers are a safe no-op', () => {
    const actions = mockActions()
    handleOverworldIntent({ type: 'encounter', triggerId: 'nope', label: 'x' }, actions)
    expect(actions.startCombat).not.toHaveBeenCalled()
  })
})
