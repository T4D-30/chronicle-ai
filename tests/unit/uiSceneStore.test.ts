/**
 * uiSceneStore Tests — UI 3.0 (Pixel RPG Experience)
 *
 * The UI State Machine's transition table is the contract: forward-only
 * title sequence, skip-to-menu from any earlier phase, illegal jumps
 * are silent no-ops. Presentation only — nothing here touches game state.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useUiSceneStore } from '@/store/uiSceneStore'

describe('uiSceneStore — title sequence state machine', () => {
  beforeEach(() => {
    useUiSceneStore.getState().reset()
  })

  it('starts at title-vista', () => {
    expect(useUiSceneStore.getState().scene).toBe('title-vista')
  })

  it('advance() walks the canonical sequence in order', () => {
    const store = useUiSceneStore.getState()
    store.advance()
    expect(useUiSceneStore.getState().scene).toBe('title-logo')
    useUiSceneStore.getState().advance()
    expect(useUiSceneStore.getState().scene).toBe('title-prompt')
    useUiSceneStore.getState().advance()
    expect(useUiSceneStore.getState().scene).toBe('title-menu')
  })

  it('advance() is a no-op at the end of the sequence', () => {
    useUiSceneStore.setState({ scene: 'title-menu' })
    useUiSceneStore.getState().advance()
    expect(useUiSceneStore.getState().scene).toBe('title-menu')
  })

  it('allows skip-to-menu from every earlier phase (press any key to skip)', () => {
    for (const from of ['title-vista', 'title-logo', 'title-prompt'] as const) {
      useUiSceneStore.setState({ scene: from })
      expect(useUiSceneStore.getState().transition('title-menu')).toBe(true)
      expect(useUiSceneStore.getState().scene).toBe('title-menu')
    }
  })

  it('rejects backward transitions as silent no-ops', () => {
    useUiSceneStore.setState({ scene: 'title-menu' })
    expect(useUiSceneStore.getState().transition('title-vista')).toBe(false)
    expect(useUiSceneStore.getState().scene).toBe('title-menu')
  })

  it('rejects skipping forward past the next legal step (except to menu)', () => {
    // vista → prompt is not in the table (must pass through logo, or skip
    // all the way to menu)
    expect(useUiSceneStore.getState().transition('title-prompt')).toBe(false)
    expect(useUiSceneStore.getState().scene).toBe('title-vista')
  })

  it('reset() returns to the start of the sequence', () => {
    useUiSceneStore.setState({ scene: 'title-menu' })
    useUiSceneStore.getState().reset()
    expect(useUiSceneStore.getState().scene).toBe('title-vista')
  })
})
