/**
 * SessionSummaryPanel — Phase 3
 *
 * Shows a summary of the current/recent session:
 * - Turn count
 * - Session status and duration
 * - Recent story beats (last few turns)
 * - XP earned (combat only for now)
 *
 * This panel is shown in the "Journal" tab for now and will become
 * its own dedicated post-session view in Phase 3 Campaign Loop.
 */

import { Link } from 'react-router-dom'
import type { GameSession, NarrativeTurn, Campaign, CharacterRecord } from '@/lib/supabase'
import type { CombatResult } from '@/lib/engine'
import { Badge, Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'

interface SessionSummaryPanelProps {
  session: GameSession
  campaign: Campaign
  turns: NarrativeTurn[]
  xpEarned?: number
  lastCombatResult?: CombatResult | null
  readyToLevel?: boolean
  /** Character record — needed to render the level-up button/preview. Phase 9.2. */
  character?: CharacterRecord | null
  /** Opens the level-up confirmation modal. Phase 9.2. */
  onLevelUp?: () => void
}

export function SessionSummaryPanel({
  session,
  campaign,
  turns,
  xpEarned = 0,
  lastCombatResult,
  readyToLevel = false,
  character,
  onLevelUp,
}: SessionSummaryPanelProps) {
  const startedAt = new Date(session.startedAt)
  const duration = session.endedAt
    ? Math.round((new Date(session.endedAt).getTime() - startedAt.getTime()) / 60000)
    : Math.round((Date.now() - startedAt.getTime()) / 60000)

  const recentBeats = turns.slice(-5).reverse()

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      {/* Header */}
      <PixelPanel variant="arcane" className="p-4">
        <p className="font-pixel-display text-[8px] text-arcane-400 mb-1 uppercase">SESSION JOURNAL</p>
        <h2 className="font-display text-xl text-white">{campaign.title}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant={session.status === 'active' ? 'spirit' : session.status === 'paused' ? 'arcane' : 'neutral'}>
            {session.status}
          </Badge>
          <Badge variant="neutral">Turn {session.turnNumber}</Badge>
          <Badge variant="neutral">{duration}m elapsed</Badge>
        </div>
      </PixelPanel>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="TURNS" value={String(session.turnNumber)} />
        <StatCard label="DURATION" value={`${duration}m`} />
        <StatCard label="XP" value={xpEarned > 0 ? `+${xpEarned}` : '—'} highlight={xpEarned > 0} />
      </div>

      {/* Level-up notice */}
      {readyToLevel && (
        <PixelPanel variant="spirit" glow className="p-3">
          <p className="font-pixel-display text-[8px] text-heal-400 mb-1 uppercase">⬆ LEVEL UP AVAILABLE</p>
          <p className="text-void-300 text-xs mb-2">
            {character
              ? `${character.sheet.name} has enough XP to advance to Level ${character.sheet.level + 1}.`
              : 'Your character has enough XP to level up.'}
          </p>
          {character && onLevelUp && (
            <Button type="button" variant="arcane" size="sm" onClick={onLevelUp}>
              Level Up
            </Button>
          )}
        </PixelPanel>
      )}

      {/* Last combat summary */}
      {lastCombatResult && (
        <div>
          <p className="stat-label mb-2">Last Combat</p>
          <PixelPanel className="p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={`font-body font-semibold text-sm ${lastCombatResult.outcome === 'victory' ? 'text-heal-400' : lastCombatResult.outcome === 'defeat' ? 'text-harm-400' : 'text-arcane-300'}`}>
                {lastCombatResult.outcome === 'victory' ? 'Victory' : lastCombatResult.outcome === 'defeat' ? 'Defeat' : 'Escaped'}
              </span>
              <span className="stat-label text-void-600">{lastCombatResult.rounds} rounds</span>
            </div>
            {lastCombatResult.enemiesDefeated.length > 0 && (
              <p className="text-void-400 text-xs">Defeated: {lastCombatResult.enemiesDefeated.map((e) => e.name).join(', ')}</p>
            )}
            {lastCombatResult.xpAwarded > 0 && (
              <p className="text-heal-400 text-xs font-mono">+{lastCombatResult.xpAwarded} XP</p>
            )}
            {lastCombatResult.loot.length > 0 && (
              <div>
                <p className="stat-label text-void-600 mb-0.5">Loot</p>
                {lastCombatResult.loot.map((l) => (
                  <p key={l.id} className="text-void-300 text-xs">
                    {l.quantity > 1 ? `${l.quantity}× ` : ''}{l.name}
                    {l.goldValue > 0 ? ` (${l.goldValue}gp)` : ''}
                  </p>
                ))}
              </div>
            )}
          </PixelPanel>
        </div>
      )}
      {/* Story beats */}
      <div>
        <p className="stat-label mb-2">Recent Story Beats</p>
        {recentBeats.length === 0 ? (
          <PixelPanel className="p-4 text-center">
            <p className="text-void-600 text-sm">No turns yet. Your story begins when you act.</p>
          </PixelPanel>
        ) : (
          <div className="flex flex-col gap-3">
            {recentBeats.map((turn) => (
              <PixelPanel key={turn.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="stat-label text-void-600">Turn {turn.turnNumber}</span>
                  <span className="stat-label text-void-700 capitalize">{turn.mode}</span>
                </div>
                {turn.playerInput && (
                  <p className="text-arcane-300 text-xs mb-1">&gt; {turn.playerInput}</p>
                )}
                {turn.aiNarration && (
                  <p className="lore-text text-xs text-void-400 line-clamp-3">{turn.aiNarration}</p>
                )}
              </PixelPanel>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto pt-2 border-t border-void-700/50">
        <Link
          to={`/campaigns/${campaign.id}`}
          className="text-xs text-void-500 hover:text-arcane-300 transition-colors"
        >
          ← Back to Campaign
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <PixelPanel className="p-3 text-center">
      <p className="stat-label text-void-600 mb-1">{label}</p>
      <p className={`font-mono text-lg font-bold ${highlight ? 'text-heal-400' : 'text-white'}`}>{value}</p>
    </PixelPanel>
  )
}
