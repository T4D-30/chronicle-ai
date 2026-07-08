/**
 * CodexPanel — Phase 9.2 (Codex MVP)
 *
 * Displays DirectorConfig.npcMemory (NpcMemoryEntry[]) — a field that has
 * existed on the schema since Phase 2.2 but was never populated or rendered
 * until this phase. See src/lib/engine/worldDispatcher.ts for how the
 * Director populates it via directorConfigUpdates.npcMemoryUpdates, and
 * supabase/functions/narrate/index.ts for the prompt instructions.
 *
 * Only NPCs the player has actually met (metPlayer: true) are shown — the
 * Director's private tracking of unmet NPCs stays private, matching how
 * Atlas gates undiscovered locations.
 *
 * No fake data: empty until the Director records a real NPC interaction.
 */

import { useMemo } from 'react'
import { Badge } from '@/components/ui'
import { PixelPanel, PixelCard, Window } from '@/components/pixel'
import type { Campaign } from '@/lib/supabase'
import type { NpcMemoryEntry } from '@/types/campaign'

interface CodexPanelProps {
  campaign: Campaign
}

const DISPOSITION_META: Record<NpcMemoryEntry['disposition'], { label: string; badgeVariant: 'spirit' | 'neutral' | 'arcane' | 'harm'; cardVariant: 'spirit' | 'default' | 'arcane' | 'harm' }> = {
  friendly:   { label: 'Friendly',   badgeVariant: 'spirit', cardVariant: 'spirit' },
  neutral:    { label: 'Neutral',    badgeVariant: 'neutral', cardVariant: 'default' },
  suspicious: { label: 'Suspicious', badgeVariant: 'arcane', cardVariant: 'arcane' },
  hostile:    { label: 'Hostile',    badgeVariant: 'harm', cardVariant: 'harm' },
}

export function CodexPanel({ campaign }: CodexPanelProps) {
  const knownNpcs = useMemo(
    () => campaign.directorConfig.npcMemory.filter((n) => n.metPlayer),
    [campaign.directorConfig.npcMemory],
  )

  const hasAny = knownNpcs.length > 0

  return (
    <Window title="Codex" icon="codex" regionLabel="Codex">
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <PixelPanel variant="arcane" className="p-6 max-w-sm">
            <p className="lore-text text-void-400 text-sm mb-3">
              "Knowledge is the adventurer's most reliable weapon."
            </p>
            <p className="text-void-600 text-xs">
              NPCs you meet during play are recorded here — their
              disposition toward you and what you've learned about them.
              No one has been recorded yet.
            </p>
          </PixelPanel>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list">
          {knownNpcs.map((npc) => (
            <div key={npc.id} role="listitem">
              <NpcCard npc={npc} />
            </div>
          ))}
        </div>
      )}
    </Window>
  )
}

function NpcCard({ npc }: { npc: NpcMemoryEntry }) {
  const meta = DISPOSITION_META[npc.disposition]
  return (
    <PixelCard
      title={npc.name}
      icon={npc.isAlive ? '👤' : '💀'}
      variant={meta.cardVariant}
      footer={
        <div className="flex items-center justify-between">
          <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
          {!npc.isAlive && <span className="text-void-600">Deceased</span>}
        </div>
      }
    >
      {npc.lastKnownLocation && (
        <p className="text-void-500 text-xs mb-1.5">Last seen: {npc.lastKnownLocation}</p>
      )}
      {npc.knownFacts.length > 0 ? (
        <ul className="flex flex-col gap-1 list-disc list-inside">
          {npc.knownFacts.map((fact, i) => (
            <li key={i} className="text-void-300 text-xs">{fact}</li>
          ))}
        </ul>
      ) : (
        <p className="text-void-600 text-xs italic">No details recorded yet.</p>
      )}
    </PixelCard>
  )
}
