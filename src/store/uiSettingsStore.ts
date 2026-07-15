/**
 * uiSettingsStore — Dialogue Cinematics v1 (B3)
 *
 * Persistent player-facing UI preferences. Zustand (the designated UI
 * state owner) with the bundled persist middleware — localStorage,
 * versioned key. Presentation preferences ONLY: nothing here is game
 * state, and prefers-reduced-motion always outranks these settings at
 * the consuming component (StoryHud renders instantly under reduced
 * motion regardless of textSpeed).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant'

/** Typewriter interval per speed (ms/char). `normal` is the exact
 *  pre-setting behavior (18 ms); `instant` renders complete text. */
export const TEXT_SPEED_CHAR_MS: Record<TextSpeed, number> = {
  slow: 36,
  normal: 18,
  fast: 8,
  instant: 0,
}

export const TEXT_SPEED_OPTIONS: TextSpeed[] = ['slow', 'normal', 'fast', 'instant']

interface UiSettingsStore {
  textSpeed: TextSpeed
  setTextSpeed: (speed: TextSpeed) => void
}

export const useUiSettingsStore = create<UiSettingsStore>()(
  persist(
    (set) => ({
      textSpeed: 'normal',
      setTextSpeed: (textSpeed) => set({ textSpeed }),
    }),
    { name: 'chronai-ui-settings-v1' },
  ),
)
