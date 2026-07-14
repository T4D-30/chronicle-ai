import type { GameSession, NarrativeTurn, Campaign, CharacterRecord } from '@/lib/supabase'
import type { CombatResult } from '@/lib/engine'
import { SessionSummaryPanel } from './SessionSummaryPanel'
import { Window } from '@/components/pixel'

interface JournalPanelProps {
  session?: GameSession
  campaign?: Campaign
  turns?: NarrativeTurn[]
  lastCombatResult?: CombatResult | null
  readyToLevel?: boolean
  /** Character record — needed for the level-up button/preview. Phase 9.2. */
  character?: CharacterRecord | null
  /** Opens the level-up confirmation modal. Phase 9.2. */
  onLevelUp?: () => void
}

export function JournalPanel({
  session, campaign, turns, lastCombatResult, readyToLevel, character, onLevelUp,
}: JournalPanelProps) {
  if (session && campaign) {
    return (
      <SessionSummaryPanel
        session={session}
        campaign={campaign}
        turns={turns ?? []}
        lastCombatResult={lastCombatResult}
        readyToLevel={readyToLevel}
        character={character}
        onLevelUp={onLevelUp}
      />
    )
  }

  return (
    <Window title="Journal" icon="journal">
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <div className="chr-panel p-6 rounded-lg max-w-sm">
          <p className="lore-text text-void-400 text-sm mb-3">
            "Every hero's story deserves to be written down."
          </p>
          <p className="text-void-600 text-xs">
            Session notes and discovered lore will appear here.
            Arrives with Phase 3 — Campaign Loop.
          </p>
        </div>
      </div>
    </Window>
  )
}
