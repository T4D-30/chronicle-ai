/**
 * useAudio + AudioSettingsPanel — Phase 9.0
 *
 * React bindings for the AudioManager singleton, plus the settings UI:
 * three volume sliders (music, ambience, sfx) and a master mute toggle.
 */

import { useSyncExternalStore, useCallback } from 'react'
import { getAudioManager } from '@/lib/audio/audioManager'
import type { AudioSettings } from '@/lib/audio/audioManager'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudio() {
  const manager = getAudioManager()

  const settings = useSyncExternalStore(
    useCallback((cb) => manager.subscribe(cb), [manager]),
    () => JSON.stringify(manager.getSettings()),
  )

  const parsed: AudioSettings = JSON.parse(settings)

  return {
    settings: parsed,
    currentMusic: manager.getCurrentMusic(),
    setMusicVolume: (v: number) => manager.setMusicVolume(v),
    setAmbienceVolume: (v: number) => manager.setAmbienceVolume(v),
    setSfxVolume: (v: number) => manager.setSfxVolume(v),
    toggleMute: () => manager.toggleMute(),
    setContext: manager.setContext.bind(manager),
    startAmbience: manager.startAmbience.bind(manager),
    stopAmbience: manager.stopAmbience.bind(manager),
  }
}

// ─── Settings panel ───────────────────────────────────────────────────────────

function VolumeSlider({
  label, value, onChange, id,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  id: string
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="font-pixel-body text-base text-void-300 w-24 flex-shrink-0">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1 accent-arcane-400 h-2"
        aria-label={`${label} volume`}
      />
      <span className="font-pixel-body text-sm text-void-400 w-10 text-right tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

export function AudioSettingsPanel() {
  const {
    settings, setMusicVolume, setAmbienceVolume, setSfxVolume, toggleMute,
  } = useAudio()

  return (
    <div
      className="pixel-border bg-void-900 p-4 flex flex-col gap-3"
      role="group"
      aria-label="Audio settings"
      data-testid="audio-settings"
    >
      <div className="flex items-center justify-between">
        <p className="font-pixel-display text-[10px] text-arcane-300 uppercase">Audio</p>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={settings.muted}
          aria-label={settings.muted ? 'Unmute all audio' : 'Mute all audio'}
          data-testid="mute-toggle"
          className={[
            'pixel-btn font-pixel-body px-3 py-1 text-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
            settings.muted
              ? 'bg-harm-600 text-white border-red-900'
              : 'bg-void-800 text-void-200 border-void-700',
          ].join(' ')}
        >
          {settings.muted ? '🔇 Muted' : '🔊 Sound On'}
        </button>
      </div>

      <VolumeSlider id="vol-music"    label="Music"    value={settings.musicVolume}    onChange={setMusicVolume} />
      <VolumeSlider id="vol-ambience" label="Ambience" value={settings.ambienceVolume} onChange={setAmbienceVolume} />
      <VolumeSlider id="vol-sfx"      label="Effects"  value={settings.sfxVolume}      onChange={setSfxVolume} />

      <p className="text-void-600 text-xs">
        Audio activates when sound files are added to <code className="font-mono">public/audio/</code>.
        See the README there for royalty-free sourcing.
      </p>
    </div>
  )
}
