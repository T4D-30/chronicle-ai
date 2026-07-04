/**
 * Prompt Builder Tests — Phase 2.4
 *
 * Verifies NarrateRequest construction, character summarization,
 * recent-turn slicing, and director config mapping.
 */
import { describe, it, expect } from 'vitest'
import { buildNarrateRequest, estimateRequestTokens } from '@/lib/ai/promptBuilder'
import type { BuildNarrateRequestOptions } from '@/lib/ai/promptBuilder'
import { buildCharacter } from '@/lib/engine'
import { DEFAULT_DIRECTOR_CONFIG, DEFAULT_WORLD_STATE } from '@/types/campaign'
import type { Campaign, GameSession, NarrativeTurn } from '@/lib/supabase'

const SESSION: GameSession = {
  id: 'sess-1', campaignId: 'camp-1', turnNumber: 5,
  status: 'active', currentMode: 'exploration',
  startedAt: '2024-01-01T00:00:00Z', endedAt: null,
}

const CAMPAIGN: Campaign = {
  id: 'camp-1', userId: 'user-1', title: 'The Shattered Throne',
  description: 'A kingdom in turmoil.', status: 'active',
  characterId: 'char-1',
  directorConfig: {
    ...DEFAULT_DIRECTOR_CONFIG,
    tone: 'grim', difficulty: 'brutal', rulesStyle: 'narrative',
    hiddenArc: 'The Duke is the real villain.',
  },
  worldState: DEFAULT_WORLD_STATE,
  tone: 'grim', difficulty: 'brutal',
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
}

const CHARACTER = buildCharacter({
  name: 'Aldric Sorn', level: 3, archetype: 'fighter', ancestry: 'human', background: 'soldier',
  scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 8 },
})

const TURNS: NarrativeTurn[] = Array.from({ length: 12 }, (_, i) => ({
  id: `t${i}`, sessionId: 'sess-1', turnNumber: i,
  playerInput: `Action ${i}`, aiNarration: `Narration ${i}`,
  diceRolls: [], mode: 'exploration' as const,
  createdAt: '2024-01-01T00:00:00Z',
}))

function makeOpts(overrides: Partial<BuildNarrateRequestOptions> = {}): BuildNarrateRequestOptions {
  return {
    session: SESSION, campaign: CAMPAIGN, character: CHARACTER,
    playerInput: 'I search the room for hidden passages.',
    recentTurns: TURNS,
    ...overrides,
  }
}

describe('buildNarrateRequest — structure', () => {
  it('includes sessionId from session', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.sessionId).toBe('sess-1')
  })

  it('includes the mode from session.currentMode', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.mode).toBe('exploration')
  })

  it('trims player input', () => {
    const req = buildNarrateRequest(makeOpts({ playerInput: '  look around  ' }))
    expect(req.playerInput).toBe('look around')
  })

  it('includes campaign title and description in worldContext', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.worldContext.campaignTitle).toBe('The Shattered Throne')
    expect(req.worldContext.campaignDescription).toBe('A kingdom in turmoil.')
  })

  it('includes directorConfig fields', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.directorConfig.tone).toBe('grim')
    expect(req.directorConfig.difficulty).toBe('brutal')
    expect(req.directorConfig.rulesStyle).toBe('narrative')
    expect(req.directorConfig.hiddenArc).toBe('The Duke is the real villain.')
  })
})

describe('buildNarrateRequest — character summary', () => {
  it('uses summarizeCharacter for the character field', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.character.name).toBe('Aldric Sorn')
    expect(req.character.level).toBe(3)
    expect(req.character.archetype).toBe('fighter')
    expect(req.character.maxHp).toBeGreaterThan(0)
  })

  it('includes all six ability scores', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(typeof req.character.str).toBe('number')
    expect(typeof req.character.wis).toBe('number')
    expect(typeof req.character.cha).toBe('number')
  })

  it('includes all six modifiers', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.character.strMod).toBe(3) // STR 16 → +3
    expect(req.character.wisMod).toBe(1) // WIS 12 → +1
    expect(req.character.chaMod).toBe(-1) // CHA 8 → -1
  })
})

describe('buildNarrateRequest — recentTurns slicing', () => {
  it('caps recentTurns at 8 entries', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.worldContext.recentTurns.length).toBeLessThanOrEqual(8)
  })

  it('includes the most recent turns (last 8)', () => {
    const req = buildNarrateRequest(makeOpts())
    const last = req.worldContext.recentTurns
    // The last entry should be turn 11 (index 11 of TURNS)
    expect(last[last.length - 1].turnNumber).toBe(11)
  })

  it('maps turn fields correctly', () => {
    const req = buildNarrateRequest(makeOpts())
    const first = req.worldContext.recentTurns[0]
    expect(first).toHaveProperty('turnNumber')
    expect(first).toHaveProperty('playerInput')
    expect(first).toHaveProperty('aiNarration')
    expect(first).toHaveProperty('mode')
  })

  it('handles empty recentTurns gracefully', () => {
    const req = buildNarrateRequest(makeOpts({ recentTurns: [] }))
    expect(req.worldContext.recentTurns).toHaveLength(0)
  })
})

describe('buildNarrateRequest — currentLocation (Phase 9.2, real data only)', () => {
  it('is null when currentLocationId is not set', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.worldContext.currentLocation).toBeNull()
  })

  it('resolves the location name when currentLocationId matches a known location', () => {
    const campaignWithLoc: Campaign = {
      ...CAMPAIGN,
      worldState: {
        ...DEFAULT_WORLD_STATE,
        locations: [{ id: 'l1', name: 'Rivergate', type: 'town', parentId: null, description: '', visited: true, discovered: true, properties: {} }],
        currentLocationId: 'l1',
      },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithLoc }))
    expect(req.worldContext.currentLocation).toBe('Rivergate')
  })

  it('is null when currentLocationId does not resolve to any known location — never guesses', () => {
    const campaignWithBadLoc: Campaign = {
      ...CAMPAIGN,
      worldState: { ...DEFAULT_WORLD_STATE, locations: [], currentLocationId: 'ghost-id' },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithBadLoc }))
    expect(req.worldContext.currentLocation).toBeNull()
  })
})

describe('buildNarrateRequest — durable context digests (Phase 9.2)', () => {
  it('activeQuestDigest is empty when no threads exist', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.worldContext.activeQuestDigest).toEqual([])
  })

  it('includes only active, non-hidden threads in activeQuestDigest', () => {
    const campaignWithThreads: Campaign = {
      ...CAMPAIGN,
      directorConfig: {
        ...CAMPAIGN.directorConfig,
        activeThreads: [
          { id: 't1', title: 'Find the merchant', description: '', status: 'active', startedAtTurn: 0, resolvedAtTurn: null, isHidden: false },
          { id: 't2', title: 'Resolved thing', description: '', status: 'resolved', startedAtTurn: 0, resolvedAtTurn: 3, isHidden: false },
          { id: 't3', title: 'Secret Director thread', description: '', status: 'active', startedAtTurn: 0, resolvedAtTurn: null, isHidden: true },
        ],
      },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithThreads }))
    expect(req.worldContext.activeQuestDigest).toEqual([{ id: 't1', title: 'Find the merchant' }])
  })

  it('caps activeQuestDigest at 6 entries to bound token cost', () => {
    const manyThreads = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`, title: `Quest ${i}`, description: '', status: 'active' as const,
      startedAtTurn: 0, resolvedAtTurn: null, isHidden: false,
    }))
    const campaignWithManyThreads: Campaign = {
      ...CAMPAIGN,
      directorConfig: { ...CAMPAIGN.directorConfig, activeThreads: manyThreads },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithManyThreads }))
    expect(req.worldContext.activeQuestDigest).toHaveLength(6)
  })

  it('knownNpcDigest is empty when no NPCs have been met', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req.worldContext.knownNpcDigest).toEqual([])
  })

  it('includes only met NPCs in knownNpcDigest, with disposition and facts', () => {
    const campaignWithNpcs: Campaign = {
      ...CAMPAIGN,
      directorConfig: {
        ...CAMPAIGN.directorConfig,
        npcMemory: [
          { id: 'n1', name: 'Barkeep Joss', disposition: 'friendly', knownFacts: ['Runs the tavern'], lastKnownLocation: null, isAlive: true, metPlayer: true },
          { id: 'n2', name: 'Unmet Stranger', disposition: 'neutral', knownFacts: [], lastKnownLocation: null, isAlive: true, metPlayer: false },
        ],
      },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithNpcs }))
    expect(req.worldContext.knownNpcDigest).toEqual([
      { name: 'Barkeep Joss', disposition: 'friendly', facts: ['Runs the tavern'] },
    ])
  })

  it('caps knownNpcDigest at 8 entries and facts at 3 per NPC to bound token cost', () => {
    const manyNpcs = Array.from({ length: 12 }, (_, i) => ({
      id: `n${i}`, name: `NPC ${i}`, disposition: 'neutral' as const,
      knownFacts: ['fact1', 'fact2', 'fact3', 'fact4', 'fact5'],
      lastKnownLocation: null, isAlive: true, metPlayer: true,
    }))
    const campaignWithManyNpcs: Campaign = {
      ...CAMPAIGN,
      directorConfig: { ...CAMPAIGN.directorConfig, npcMemory: manyNpcs },
    }
    const req = buildNarrateRequest(makeOpts({ campaign: campaignWithManyNpcs }))
    expect(req.worldContext.knownNpcDigest).toHaveLength(8)
    expect(req.worldContext.knownNpcDigest[0].facts).toHaveLength(3)
  })
})

describe('buildNarrateRequest — checkResult (Phase 9.3, full dice transparency)', () => {
  it('omits checkResult entirely when not provided (pure narration turn)', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req).not.toHaveProperty('checkResult')
  })

  it('includes checkResult exactly as passed when provided', () => {
    const checkResult = {
      category: 'FINESSE', stat: 'DEX', dc: 15, total: 17,
      outcome: 'success', outcomeLabel: 'Success', isSuccess: true,
    }
    const req = buildNarrateRequest(makeOpts({ checkResult }))
    expect(req.checkResult).toEqual(checkResult)
  })
})

describe('buildNarrateRequest — documentContext (Phase 10.3, Director document retrieval)', () => {
  it('omits documentContext entirely when not provided', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(req).not.toHaveProperty('documentContext')
  })

  it('omits documentContext when an empty array is provided (no relevant documents found)', () => {
    const req = buildNarrateRequest(makeOpts({ documentContext: [] }))
    expect(req).not.toHaveProperty('documentContext')
  })

  it('includes documentContext exactly as passed when non-empty', () => {
    const documentContext = [
      { fileName: 'world-lore.pdf', category: 'world_lore', excerpt: 'The ancient dragon Vermithrax sleeps beneath the mountains.' },
    ]
    const req = buildNarrateRequest(makeOpts({ documentContext }))
    expect(req.documentContext).toEqual(documentContext)
  })

  it('preserves multiple document excerpts in order', () => {
    const documentContext = [
      { fileName: 'a.pdf', category: 'dm_guide', excerpt: 'excerpt A' },
      { fileName: 'b.pdf', category: 'homebrew_rules', excerpt: 'excerpt B' },
    ]
    const req = buildNarrateRequest(makeOpts({ documentContext }))
    expect(req.documentContext).toHaveLength(2)
    expect(req.documentContext?.[0].fileName).toBe('a.pdf')
    expect(req.documentContext?.[1].fileName).toBe('b.pdf')
  })
})

describe('estimateRequestTokens', () => {
  it('returns a positive number', () => {
    const req = buildNarrateRequest(makeOpts())
    expect(estimateRequestTokens(req)).toBeGreaterThan(0)
  })

  it('returns more tokens for longer player input', () => {
    const short = estimateRequestTokens(buildNarrateRequest(makeOpts({ playerInput: 'hi' })))
    const long  = estimateRequestTokens(buildNarrateRequest(makeOpts({ playerInput: 'I examine every inch of the ancient stone corridor, running my fingers along the carved runes.' })))
    expect(long).toBeGreaterThan(short)
  })
})
