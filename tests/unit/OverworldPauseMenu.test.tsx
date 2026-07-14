/**
 * Pause Menu Tests — Presentation 3 (Playable Overworld)
 *
 * Esc opens the existing panels over the paused map; movement is frozen
 * while paused; Esc resumes; Tab retains normal focus navigation; the panels are the REAL existing
 * components (Quest Log, Codex, Atlas, Character, Settings).
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OverworldMode } from '@/components/adventure/overworld/OverworldMode'
import { STEP_MS } from '@/components/adventure/overworld/PlayerController'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

function makeState(): AdventureState {
  return {
    status: 'ready',
    campaign: {
      id: 'c1', userId: 'u1', title: 'Test Campaign', description: null, status: 'active',
      characterId: 'ch1', directorConfig: DEFAULT_DIRECTOR_CONFIG,
      worldState: DEFAULT_WORLD_STATE, tone: 'heroic', difficulty: 'standard',
      createdAt: '', updatedAt: '',
    },
    character: {
      id: 'ch1', userId: 'u1', portraitUrl: null, bio: '', experience: 0,
      tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {}, createdAt: '', updatedAt: '',
      sheet: {
        name: 'Pause Hero', level: 1, archetype: 'rogue', ancestry: 'human', background: 'criminal',
        scores: { strength: 10, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 2, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd8', maxHp: 9, currentHp: 9, armorClass: 12, proficiencyBonus: 2,
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
  } as unknown as AdventureState
}

function makeActions(): AdventureActions {
  return {
    pause: vi.fn(), resume: vi.fn(), end: vi.fn(), reload: vi.fn(),
    submitAction: vi.fn(), cancelStream: vi.fn(),
    startCombat: vi.fn(), endCombat: vi.fn(), commitCombatResult: vi.fn(),
    levelUpCharacter: vi.fn(), clearCheckResult: vi.fn(), clearXpGain: vi.fn(),
  } as unknown as AdventureActions
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
})
afterEach(() => {
  vi.useRealTimers()
})

function renderMode() {
  return render(
    <MemoryRouter>
      <div style={{ width: 600, height: 400 }}>
        <OverworldMode state={makeState()} actions={makeActions()} />
      </div>
    </MemoryRouter>,
  )
}

describe('OverworldMode — pause menu', () => {
  it('Escape opens the pause menu on the Character tab; Escape again resumes', () => {
    renderMode()
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('pause-menu')).toBeInTheDocument()
    expect(screen.getByText('Pause Hero')).toBeInTheDocument() // real CharacterSidebar
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
  })

  it('does not intercept Tab for pause-menu toggling', () => {
    renderMode()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
  })

  it('moves focus into the menu and traps it within the modal', () => {
    renderMode()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('pause-tab-character')).toHaveFocus()

    const focusable = screen.getByTestId('pause-menu').querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable[focusable.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByTestId('pause-tab-character')).toHaveFocus()
  })

  it('movement is frozen while paused and restored on resume', () => {
    renderMode()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    act(() => {
      vi.advanceTimersByTime(STEP_MS + 10)
    })
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '8')

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    act(() => {
      vi.advanceTimersByTime(STEP_MS + 10)
    })
    expect(screen.getByTestId('overworld-player')).toHaveAttribute('data-y', '7')
  })

  it('switches between the real existing panels', () => {
    renderMode()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('pause-tab-quests'))
    expect(screen.getByRole('region', { name: 'Quest log' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pause-tab-codex'))
    expect(screen.getByRole('region', { name: 'Codex' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pause-tab-settings'))
    expect(screen.getByTestId('mute-toggle')).toBeInTheDocument() // real AudioSettingsPanel
  })

  it('the Resume button closes the menu', () => {
    renderMode()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByTestId('pause-close'))
    expect(screen.queryByTestId('pause-menu')).not.toBeInTheDocument()
  })
})
