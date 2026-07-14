/**
 * uiSceneStore — UI 3.0 (Pixel RPG Experience)
 *
 * The UI State Machine from UI_VISION.md, Concept 1: screens are game
 * states with explicit transitions, not routes that swap instantly.
 * Zustand per the Constitution's state-management rules ("Zustand for
 * auth + UI state").
 *
 * PRESENTATION ONLY (UI_VISION.md Concept 7): this store models which
 * camera/phase of a reveal sequence is live. It never holds, reads
 * into, or mutates game/session state — game state stays in
 * useAdventureSession and the campaign/character stores.
 *
 * This phase models the title-screen sequence (the machine's first
 * consumer). Future camera states — 'menu-camp', 'world', 'dialogue',
 * 'combat' — are added HERE with their transition rules when their
 * screens are built, instead of each screen inventing ad hoc useState
 * reveal flags. See UI_VISION.md "Cameras, not Pages".
 *
 * Legal transitions (forward-only, plus skip):
 *   title-vista → title-logo → title-prompt → title-menu
 *   any title state → title-menu   (classic JRPG "press any key to
 *                                   skip the intro"; also the
 *                                   reduced-motion entry point — a
 *                                   prefers-reduced-motion player
 *                                   starts at the full menu, no timed
 *                                   sequence)
 * Illegal transitions are a silent no-op returning false — presentation
 * code must never crash the app over a mistimed reveal.
 */

import { create } from 'zustand'

export type UiScene =
  | 'title-vista'
  | 'title-logo'
  | 'title-prompt'
  | 'title-menu'

/** Canonical forward order of the title sequence. */
const TITLE_SEQUENCE: UiScene[] = [
  'title-vista',
  'title-logo',
  'title-prompt',
  'title-menu',
]

/** Explicit legal-transition table (from → allowed targets). */
const LEGAL_TRANSITIONS: Record<UiScene, UiScene[]> = {
  'title-vista':  ['title-logo', 'title-menu'],
  'title-logo':   ['title-prompt', 'title-menu'],
  'title-prompt': ['title-menu'],
  'title-menu':   [],
}

interface UiSceneStore {
  scene: UiScene
  /** Validated jump. Returns whether the transition was legal (and applied). */
  transition: (to: UiScene) => boolean
  /** Step one phase forward along the canonical sequence (no-op at the end). */
  advance: () => void
  /** Back to the start of the sequence (route unmount / tests). */
  reset: () => void
}

export const useUiSceneStore = create<UiSceneStore>((set, get) => ({
  scene: 'title-vista',

  transition: (to) => {
    const from = get().scene
    if (!LEGAL_TRANSITIONS[from].includes(to)) return false
    set({ scene: to })
    return true
  },

  advance: () => {
    const idx = TITLE_SEQUENCE.indexOf(get().scene)
    const next = TITLE_SEQUENCE[idx + 1]
    if (next) set({ scene: next })
  },

  reset: () => set({ scene: 'title-vista' }),
}))
