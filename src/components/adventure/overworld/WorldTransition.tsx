/**
 * WorldTransition — Presentation 3 (Playable Overworld)
 *
 * SNES-style area fade: black overlay fades in (movement already
 * locked), the map swaps at full black, then it fades back out. Phase
 * timing is timer-driven in OverworldMode (deterministic in tests);
 * the fades are CSS animations whose inline styles carry the final
 * state — under prefers-reduced-motion the animations are killed and
 * the final states apply instantly, so reduced-motion players get an
 * instant area swap (black frame → new map), never a stuck overlay.
 */

export const TRANSITION_PHASE_MS = 240

export type TransitionPhase = 'out' | 'in' | null

export function WorldTransition({ phase }: { phase: TransitionPhase }) {
  if (!phase) return null
  return (
    <div
      className={[
        'absolute inset-0 z-30 pointer-events-none bg-void-950',
        phase === 'out' ? 'overlay-fade-in' : 'overlay-fade-out',
      ].join(' ')}
      style={{ opacity: phase === 'out' ? 1 : 0 }}
      data-testid="world-transition"
      data-phase={phase}
      aria-hidden="true"
    />
  )
}
