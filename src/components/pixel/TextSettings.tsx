/**
 * TextSettingsPanel — Dialogue Cinematics v1 (B3)
 *
 * Player-adjustable dialogue text speed, mounted beside
 * AudioSettingsPanel in the pause overlay's Settings tab. A segmented
 * row of the existing Button variants (the AtlasPanel list/map toggle
 * pattern) — keyboard accessible, aria-pressed per option.
 *
 * prefers-reduced-motion still renders text instantly regardless of
 * this setting (StoryHud enforces the precedence).
 */

import { Button } from '@/components/ui'
import { useUiSettingsStore, TEXT_SPEED_OPTIONS } from '@/store/uiSettingsStore'
import type { TextSpeed } from '@/store/uiSettingsStore'

const SPEED_LABEL: Record<TextSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Instant',
}

export function TextSettingsPanel() {
  const textSpeed = useUiSettingsStore((s) => s.textSpeed)
  const setTextSpeed = useUiSettingsStore((s) => s.setTextSpeed)

  return (
    <div className="chr-panel rounded-lg p-4" data-testid="text-settings-panel">
      <p className="font-pixel-display text-[10px] text-bronze-400 uppercase mb-3">Text</p>
      <div className="flex items-center justify-between gap-3">
        <span className="font-body text-sm text-void-200" id="text-speed-label">
          Text Speed
        </span>
        <div className="flex gap-1.5" role="group" aria-labelledby="text-speed-label">
          {TEXT_SPEED_OPTIONS.map((speed) => (
            <Button
              key={speed}
              type="button"
              size="sm"
              variant={textSpeed === speed ? 'arcane' : 'ghost'}
              aria-pressed={textSpeed === speed}
              onClick={() => setTextSpeed(speed)}
              data-testid={`text-speed-${speed}`}
            >
              {SPEED_LABEL[speed]}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-void-500 text-xs mt-2 font-body">
        Dialogue and narration reveal speed. Reduced-motion mode always shows text instantly.
      </p>
    </div>
  )
}
