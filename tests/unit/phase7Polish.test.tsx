/**
 * Phase 7 Polish Tests
 * Covers: AdventureHub touch targets, library skeleton loading,
 * and LandingPage value props.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

// ── AdventureHub touch targets ────────────────────────────────────────────────

import { AdventureHub } from '@/components/adventure/AdventureHub'
import type { AdventureState, AdventureActions } from '@/components/adventure/useAdventureSession'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'

const DEBUG_ENABLED = import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true'

const MOCK_STATE: AdventureState = {
  status: 'ready',
  campaign: {
    id: 'c1', userId: 'u1', title: 'Test Campaign', description: null,
    status: 'active', characterId: 'ch1',
    directorConfig: DEFAULT_DIRECTOR_CONFIG,
    worldState: DEFAULT_WORLD_STATE,
    tone: 'heroic', difficulty: 'standard',
    createdAt: '', updatedAt: '',
  },
  character: {
    id: 'ch1', userId: 'u1',
    portraitUrl: null, bio: '', experience: 0, tempHp: 0,
    deathSavesSuccess: 0, deathSavesFailure: 0,
    conditions: [], features: [], inventory: [], spells: {},
    createdAt: '', updatedAt: '',
    sheet: {
      name: 'Hero', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
      scores: { strength:16, dexterity:14, constitution:14, intelligence:10, wisdom:12, charisma:8 },
      modifiers: { strength:3, dexterity:2, constitution:2, intelligence:0, wisdom:1, charisma:-1 },
      hitDie: 'd10' as const, maxHp: 30, currentHp: 22, armorClass: 16, proficiencyBonus: 2,
      skillProficiencies: ['perception' as const], savingThrowProficiencies: [], equipment: [],
      conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
    },
  },
  session: {
    id: 's1', campaignId: 'c1', status: 'active', turnNumber: 1,
    currentMode: 'exploration' as const,
    startedAt: new Date().toISOString(), endedAt: null,
  },
  turns: [],
  error: null,
  isActionInFlight: false,
  narrationStatus: 'idle', streamingText: '', suggestedActions: [],
  lastDirectorResult: null,
  combatState: null,
  lastCombatResult: null,
  readyToLevel: false,
    lastCheckResult: null,
    lastXpGain: 0,
}

const MOCK_ACTIONS: AdventureActions = {
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  end: vi.fn().mockResolvedValue(undefined),
  reload: vi.fn().mockResolvedValue(undefined),
  submitAction: vi.fn(),
  cancelStream: vi.fn(),
  startCombat: vi.fn(),
  endCombat: vi.fn(),
  commitCombatResult: vi.fn().mockResolvedValue(undefined),
  levelUpCharacter: vi.fn().mockResolvedValue(undefined),
  clearCheckResult: vi.fn(),
  clearXpGain: vi.fn(),
}

describe('AdventureHub — touch targets', () => {
  function renderHub() {
    return render(
      <MemoryRouter>
        <AdventureHub state={MOCK_STATE} actions={MOCK_ACTIONS} />
      </MemoryRouter>
    )
  }

  it('tab nav buttons have min-h-[44px] class for touch target compliance', () => {
    renderHub()
    const tabs = within(screen.getByTestId('adventure-tab-nav')).getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)
    // Every tab button should carry the min-height touch target class
    tabs.forEach((tab) => {
      expect(tab.className).toContain('min-h-[44px]')
    })
  })

  it('renders the expected adventure panel tabs for the current debug flag', () => {
    renderHub()
    const tabs = within(screen.getByTestId('adventure-tab-nav')).getAllByRole('tab')
    expect(tabs).toHaveLength(DEBUG_ENABLED ? 9 : 8)
  })

  it('tab nav has safe-area-bottom class for iOS notch', () => {
    renderHub()
    const nav = screen.getByTestId('adventure-tab-nav')
    expect(nav.className).toContain('safe-area-bottom')
  })
})

// ── Library skeleton loading ──────────────────────────────────────────────────

import { SkeletonGrid } from '@/components/ui'

describe('SkeletonGrid — library loading UX', () => {
  it('renders 6 cards by default', () => {
    const { container } = render(<SkeletonGrid />)
    const grid = container.querySelector('[role="status"]')
    const cards = grid?.querySelectorAll(':scope > [role="presentation"]') ?? []
    expect(cards.length).toBe(6)
  })

  it('is aria-busy while showing skeletons', () => {
    render(<SkeletonGrid />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  })

  it('has an accessible label', () => {
    render(<SkeletonGrid />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading content…')
  })

  it('skeleton cards are hidden from assistive tech (aria-hidden)', () => {
    const { container } = render(<SkeletonGrid count={2} />)
    const cards = container.querySelectorAll('[role="presentation"]')
    cards.forEach((card) => {
      expect(card).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

// ── LandingPage title screen (UI 3.0) ────────────────────────────────────────

import { fireEvent } from '@testing-library/react'
import LandingPage from '@/app/pages/LandingPage'

/** The title screen boots into a JRPG reveal sequence (UI 3.0); "press
 *  any key" skips straight to the full menu. Same onboarding contract
 *  as before, asserted after the reveal. */
function renderTitleScreen() {
  const result = render(<MemoryRouter><LandingPage /></MemoryRouter>)
  fireEvent.keyDown(window, { key: 'Enter' })
  return result
}

describe('LandingPage — title screen onboarding', () => {
  it('shows the app title', () => {
    renderTitleScreen()
    expect(screen.getByRole('heading', { name: /Chronicle AI/i })).toBeInTheDocument()
  })

  it('has a primary CTA link', () => {
    renderTitleScreen()
    expect(screen.getByRole('link', { name: /Begin Your Chronicle/i })).toBeInTheDocument()
  })

  it('has a sign-in link', () => {
    renderTitleScreen()
    expect(screen.getByRole('link', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('shows feature value props', () => {
    renderTitleScreen()
    expect(screen.getByText(/Real D&D Mechanics/i)).toBeInTheDocument()
    expect(screen.getByText(/AI Director/i)).toBeInTheDocument()
    expect(screen.getByText(/Solo Adventure/i)).toBeInTheDocument()
  })

  it('does not reference stale Phase 0 label', () => {
    renderTitleScreen()
    expect(screen.queryByText(/Phase 0/i)).not.toBeInTheDocument()
  })

  it('features list is an accessible list', () => {
    renderTitleScreen()
    expect(screen.getByRole('list', { name: /features/i })).toBeInTheDocument()
  })

  it('starts on the world alone — no menu before the reveal', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByTestId('world-renderer')).toBeInTheDocument()
    expect(screen.queryByTestId('title-menu')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Begin Your Chronicle/i })).not.toBeInTheDocument()
  })

  it('any key reveals the menu from the initial vista (skip the intro)', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.keyDown(window, { key: 'x' })
    expect(screen.getByTestId('title-menu')).toBeInTheDocument()
  })
})
