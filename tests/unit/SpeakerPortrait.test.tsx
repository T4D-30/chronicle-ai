/**
 * SpeakerPortrait Tests — Dialogue Cinematics v1 (B1)
 *
 * The asset-ready portrait slot: fallback chain (asset probe → fixture
 * glyph → deterministic initial tile → generic silhouette), identity
 * honesty (same NPC = same tile, unknown = generic), decorative
 * semantics, and StoryHud/OverworldMode integration (fixture glyph
 * portrait for Brother Aldwin; no portrait in ambient/narrator mode).
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SpeakerPortrait, portraitHue } from '@/components/adventure/overworld/SpeakerPortrait'
import { StoryHud } from '@/components/adventure/overworld/StoryHud'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

describe('SpeakerPortrait — fallback chain', () => {
  it('shows the fixture glyph when provided (real fixture content)', () => {
    render(<SpeakerPortrait name="Brother Aldwin" identityKey="monk" glyph="🧑‍🦲" />)
    expect(screen.getByTestId('speaker-portrait')).toHaveAttribute('data-portrait-kind', 'glyph')
    expect(screen.getByTestId('portrait-glyph')).toHaveTextContent('🧑‍🦲')
  })

  it('falls back to a deterministic initial tile for named speakers without a glyph', () => {
    render(<SpeakerPortrait name="Captain Mira" identityKey="npc-mem-7" />)
    const portrait = screen.getByTestId('speaker-portrait')
    expect(portrait).toHaveAttribute('data-portrait-kind', 'initial')
    expect(screen.getByTestId('portrait-initial')).toHaveTextContent('C')
  })

  it('the initial tile is deterministic — same identity, same hue, every render', () => {
    expect(portraitHue('npc-mem-7')).toBe(portraitHue('npc-mem-7'))
    expect(portraitHue('someone-else')).not.toBe(portraitHue('npc-mem-7'))
    // Hue stays in the warm band (20–60)
    expect(portraitHue('npc-mem-7')).toBeGreaterThanOrEqual(20)
    expect(portraitHue('npc-mem-7')).toBeLessThanOrEqual(60)
  })

  it('shows the generic silhouette for unknown/unnamed speakers — no invented identity', () => {
    render(<SpeakerPortrait />)
    expect(screen.getByTestId('speaker-portrait')).toHaveAttribute('data-portrait-kind', 'silhouette')
    expect(screen.getByTestId('portrait-silhouette')).toBeInTheDocument()
  })

  it('probes the portrait asset slot when an identity key exists (art lands with zero code changes)', () => {
    render(<SpeakerPortrait name="Brother Aldwin" identityKey="monk" glyph="🧑‍🦲" />)
    expect(screen.getByTestId('speaker-portrait-probe')).toHaveAttribute(
      'src',
      '/assets/sprites/portraits/npc-monk.png',
    )
  })

  it('is decorative — the portrait is aria-hidden', () => {
    render(<SpeakerPortrait name="Brother Aldwin" glyph="🧑‍🦲" />)
    expect(screen.getByTestId('speaker-portrait')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('StoryHud — speaker presentation (B1)', () => {
  const base = {
    text: 'Peace, traveler.',
    streaming: false,
    suggestedActions: [] as string[],
    busy: false,
    onChoose: vi.fn(),
    onSubmitFree: vi.fn(),
    onClose: vi.fn(),
  }

  it('dialogue mode frames the speaker with a portrait and NpcName', () => {
    render(<StoryHud {...base} speaker="Brother Aldwin" speakerIdentityKey="monk" speakerGlyph="🧑‍🦲" />)
    expect(screen.getByTestId('speaker-portrait')).toHaveAttribute('data-portrait-kind', 'glyph')
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('Brother Aldwin')
  })

  it('ambient/narrator mode shows no portrait', () => {
    render(<StoryHud {...base} speaker={null} />)
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('The Story')
    expect(screen.queryByTestId('speaker-portrait')).not.toBeInTheDocument()
  })
})

// ─── OverworldMode integration ───────────────────────────────────────────────

function makeState(overrides: Partial<AdventureState> = {}): AdventureState {
  return {
    status: 'ready',
    campaign: {
      id: 'c1', userId: 'u1', title: 'Test', description: null, status: 'active',
      characterId: 'ch1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
      worldState: DEFAULT_WORLD_STATE, tone: 'heroic', difficulty: 'standard',
      createdAt: '', updatedAt: '',
    },
    character: {
      id: 'ch1', userId: 'u1', portraitUrl: null, bio: '', experience: 0,
      tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {}, createdAt: '', updatedAt: '',
      sheet: {
        name: 'Hero', level: 1, archetype: 'fighter', ancestry: 'human', background: 'soldier',
        scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd10', maxHp: 10, currentHp: 10, armorClass: 10, proficiencyBonus: 2,
        skillProficiencies: [], savingThrowProficiencies: [], equipment: [],
        conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
      },
    },
    session: {
      id: 's1', campaignId: 'c1', status: 'active', turnNumber: 0,
      currentMode: 'exploration', startedAt: '', endedAt: null,
    },
    turns: [], error: null, isActionInFlight: false,
    narrationStatus: 'idle', streamingText: '', suggestedActions: [],
    lastDirectorResult: null, combatState: null, lastCombatResult: null,
    readyToLevel: false, lastCheckResult: null, lastXpGain: 0,
    ...overrides,
  } as AdventureState
}

function makeActions(): AdventureActions {
  return {
    pause: vi.fn(), resume: vi.fn(), end: vi.fn(), reload: vi.fn(),
    submitAction: vi.fn(), cancelStream: vi.fn(),
    startCombat: vi.fn(), endCombat: vi.fn(), commitCombatResult: vi.fn(),
    levelUpCharacter: vi.fn(), clearCheckResult: vi.fn(), clearXpGain: vi.fn(),
  } as unknown as AdventureActions
}

describe('OverworldMode — dialogue portrait identity (B1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })
  afterEach(() => { vi.useRealTimers() })

  function step(key: string) {
    fireEvent.keyDown(window, { key })
    act(() => vi.advanceTimersByTime(STEP_MS + 10))
  }

  it('talking to a fixture NPC shows its real glyph portrait', () => {
    render(<OverworldMode state={makeState()} actions={makeActions()} />)
    // Spawn (7,8) → (3,5) facing the monk at (2,5)
    for (let i = 0; i < 3; i++) step('ArrowUp')
    for (let i = 0; i < 4; i++) step('ArrowLeft')
    fireEvent.keyDown(window, { key: 'e' })

    expect(screen.getByTestId('story-hud')).toHaveAttribute('data-mode', 'dialogue')
    const portrait = screen.getByTestId('speaker-portrait')
    expect(portrait).toHaveAttribute('data-portrait-kind', 'glyph')
    expect(screen.getByTestId('story-hud-speaker')).toHaveTextContent('Brother Aldwin')
    // Asset probe targets the fixture entity's stable id
    expect(screen.getByTestId('speaker-portrait-probe')).toHaveAttribute(
      'src',
      '/assets/sprites/portraits/npc-monk.png',
    )
  })
})
