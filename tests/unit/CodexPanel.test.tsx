/**
 * CodexPanel Tests — Phase 9.2
 *
 * CodexPanel was a pure stub before this phase. It now renders real
 * DirectorConfig.npcMemory. These tests confirm: no fake data is ever
 * shown, unmet NPCs never leak, and disposition/facts render correctly.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CodexPanel } from '@/components/adventure/panels/CodexPanel'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign } from '@/lib/supabase'
import type { NpcMemoryEntry } from '@/types/campaign'

function makeCampaign(npcs: NpcMemoryEntry[] = []): Campaign {
  return {
    id: 'camp-1', userId: 'user-1', title: 'Test Campaign', description: null,
    status: 'active', characterId: 'char-1',
    directorConfig: { ...DEFAULT_DIRECTOR_CONFIG, npcMemory: npcs },
    worldState: DEFAULT_WORLD_STATE,
    tone: 'heroic', difficulty: 'standard',
    createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
  }
}

function npc(overrides: Partial<NpcMemoryEntry> = {}): NpcMemoryEntry {
  return {
    id: 'npc-1', name: 'Barkeep Joss', disposition: 'friendly',
    knownFacts: ['Runs the Rusty Anchor tavern'], lastKnownLocation: 'The Rusty Anchor',
    isAlive: true, metPlayer: true,
    ...overrides,
  }
}

describe('CodexPanel — empty state (no fake data)', () => {
  it('shows the honest empty state with no NPCs', () => {
    render(<CodexPanel campaign={makeCampaign([])} />)
    expect(screen.getByText(/No one has been recorded yet/i)).toBeInTheDocument()
  })

  it('renders no cards in the empty state', () => {
    render(<CodexPanel campaign={makeCampaign([])} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

describe('CodexPanel — real NPC rendering', () => {
  it('renders NPC name', () => {
    render(<CodexPanel campaign={makeCampaign([npc()])} />)
    expect(screen.getByText('Barkeep Joss')).toBeInTheDocument()
  })

  it('renders known facts as a list', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ knownFacts: ['Fact one', 'Fact two'] })])} />)
    expect(screen.getByText('Fact one')).toBeInTheDocument()
    expect(screen.getByText('Fact two')).toBeInTheDocument()
  })

  it('shows "no details recorded yet" when knownFacts is empty', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ knownFacts: [] })])} />)
    expect(screen.getByText(/No details recorded yet/i)).toBeInTheDocument()
  })

  it('shows last known location when present', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ lastKnownLocation: 'The Rusty Anchor' })])} />)
    expect(screen.getByText(/Last seen: The Rusty Anchor/i)).toBeInTheDocument()
  })

  it('shows disposition badge', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ disposition: 'hostile' })])} />)
    expect(screen.getByText('Hostile')).toBeInTheDocument()
  })

  it('shows Deceased marker for a dead NPC', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ isAlive: false })])} />)
    expect(screen.getByText('Deceased')).toBeInTheDocument()
  })

  it('does not show Deceased marker for a living NPC', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ isAlive: true })])} />)
    expect(screen.queryByText('Deceased')).not.toBeInTheDocument()
  })
})

describe('CodexPanel — unmet NPC protection', () => {
  it('never renders an NPC the player has not met', () => {
    render(<CodexPanel campaign={makeCampaign([
      npc({ id: 'npc-1', name: 'Met NPC', metPlayer: true }),
      npc({ id: 'npc-2', name: 'Unmet NPC', metPlayer: false }),
    ])} />)
    expect(screen.getByText('Met NPC')).toBeInTheDocument()
    expect(screen.queryByText('Unmet NPC')).not.toBeInTheDocument()
  })

  it('shows the empty state if every NPC is unmet', () => {
    render(<CodexPanel campaign={makeCampaign([npc({ metPlayer: false })])} />)
    expect(screen.getByText(/No one has been recorded yet/i)).toBeInTheDocument()
  })
})

describe('CodexPanel — accessibility', () => {
  it('has an accessible region label', () => {
    render(<CodexPanel campaign={makeCampaign([npc()])} />)
    expect(screen.getByRole('region', { name: 'Codex' })).toBeInTheDocument()
  })

  it('renders NPC cards as a list with listitems', () => {
    render(<CodexPanel campaign={makeCampaign([
      npc({ knownFacts: [] }), npc({ id: 'npc-2', name: 'Second NPC', knownFacts: [] }),
    ])} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
