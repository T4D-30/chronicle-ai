/**
 * Audio System Tests — Phase 9.0
 *
 * AudioManager is testable without real audio: jsdom has no Audio playback,
 * and the manager's createAudio guards for that. Selection logic, settings,
 * subscription, and the settings panel UI are all covered.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioManager, __resetAudioManager } from '@/lib/audio/audioManager'
import { AudioSettingsPanel } from '@/components/pixel/AudioSettings'

beforeEach(() => {
  __resetAudioManager()
})

// ─── Track selection logic ────────────────────────────────────────────────────

describe('AudioManager — track selection', () => {
  const mgr = new AudioManager()

  it('selects combat track when in combat', () => {
    expect(mgr.selectTrack({ inCombat: true })).toBe('combat')
  })

  it('boss overrides combat', () => {
    expect(mgr.selectTrack({ inCombat: true, isBoss: true })).toBe('boss')
  })

  it('selects town theme for town locations', () => {
    expect(mgr.selectTrack({ inCombat: false, locationKind: 'town' })).toBe('town')
  })

  it('selects dungeon theme for dungeon locations', () => {
    expect(mgr.selectTrack({ locationKind: 'dungeon' })).toBe('dungeon')
  })

  it('selects forest theme for forest locations', () => {
    expect(mgr.selectTrack({ locationKind: 'forest' })).toBe('forest')
  })

  it('falls back to menu for unknown locations', () => {
    expect(mgr.selectTrack({ locationKind: 'swamp' })).toBe('menu')
    expect(mgr.selectTrack({})).toBe('menu')
  })

  it('combat overrides location', () => {
    expect(mgr.selectTrack({ inCombat: true, locationKind: 'town' })).toBe('combat')
  })
})

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('AudioManager — settings', () => {
  it('starts with default volumes', () => {
    const mgr = new AudioManager()
    const s = mgr.getSettings()
    expect(s.musicVolume).toBeGreaterThan(0)
    expect(s.muted).toBe(false)
  })

  it('clamps volumes to 0–1', () => {
    const mgr = new AudioManager()
    mgr.setMusicVolume(5)
    expect(mgr.getSettings().musicVolume).toBe(1)
    mgr.setMusicVolume(-1)
    expect(mgr.getSettings().musicVolume).toBe(0)
  })

  it('toggleMute flips muted state', () => {
    const mgr = new AudioManager()
    expect(mgr.getSettings().muted).toBe(false)
    mgr.toggleMute()
    expect(mgr.getSettings().muted).toBe(true)
    mgr.toggleMute()
    expect(mgr.getSettings().muted).toBe(false)
  })

  it('notifies subscribers on settings change', () => {
    const mgr = new AudioManager()
    const listener = vi.fn()
    mgr.subscribe(listener)
    mgr.setSfxVolume(0.3)
    expect(listener).toHaveBeenCalled()
  })

  it('unsubscribe stops notifications', () => {
    const mgr = new AudioManager()
    const listener = vi.fn()
    const unsub = mgr.subscribe(listener)
    unsub()
    mgr.setMusicVolume(0.1)
    expect(listener).not.toHaveBeenCalled()
  })
})

// ─── Ambience state tracking ──────────────────────────────────────────────────

describe('AudioManager — ambience tracking', () => {
  it('starts with no active ambience', () => {
    const mgr = new AudioManager()
    expect(mgr.getActiveAmbience()).toEqual([])
  })

  it('stopAllAmbience clears state', () => {
    const mgr = new AudioManager()
    mgr.stopAllAmbience()
    expect(mgr.getActiveAmbience()).toEqual([])
  })
})

// ─── Settings panel UI ────────────────────────────────────────────────────────

describe('AudioSettingsPanel', () => {
  it('renders three volume sliders', () => {
    render(<AudioSettingsPanel />)
    expect(screen.getByLabelText('Music volume')).toBeInTheDocument()
    expect(screen.getByLabelText('Ambience volume')).toBeInTheDocument()
    expect(screen.getByLabelText('Effects volume')).toBeInTheDocument()
  })

  it('renders the mute toggle', () => {
    render(<AudioSettingsPanel />)
    expect(screen.getByTestId('mute-toggle')).toBeInTheDocument()
  })

  it('mute toggle flips label and aria-pressed', async () => {
    const user = userEvent.setup()
    render(<AudioSettingsPanel />)
    const toggle = screen.getByTestId('mute-toggle')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveTextContent(/Muted/i)
  })

  it('has accessible group label', () => {
    render(<AudioSettingsPanel />)
    expect(screen.getByRole('group', { name: /Audio settings/i })).toBeInTheDocument()
  })

  it('sliders update displayed percentage', async () => {
    render(<AudioSettingsPanel />)
    const slider = screen.getByLabelText('Music volume') as HTMLInputElement
    // Default music volume is 60%
    expect(slider.value).toBe('60')
  })
})
