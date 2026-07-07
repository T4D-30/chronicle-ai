/**
 * PartyStatusPanel — Phase 11.5 (Adventure Hub redesign)
 *
 * The right-column "party/status" panel from the redesign reference.
 * Deliberately does NOT duplicate CharacterSidebar's detailed stat block
 * (ability modifiers, passives, equipment) — that remains the
 * "Character" tab's job, reachable via the left nav / bottom tabs
 * unchanged. This panel is the always-visible, at-a-glance summary: who
 * you are, your HP, your XP progress, and what just happened.
 *
 * SOLO PARTY, HONESTLY REPRESENTED: Chronicle AI has no multiplayer/party
 * system (explicitly out of scope for this phase and unbuilt anywhere in
 * this codebase) — "party" here means the one character in this session,
 * shown the way a party roster would be, not a fabricated group. A
 * future multiplayer feature would extend this component to map over
 * multiple party members; nothing here assumes that will never happen,
 * but nothing here pretends it already does.
 *
 * XP BAR IS REAL DATA, NOT A PLACEHOLDER: character.experience (a real
 * column — src/types/database.ts) and getXpForNextLevel() (the same
 * engine function LevelUpModal already uses to compute the next
 * threshold) are both genuine, existing values. The bar's fill
 * percentage is computed the same way any XP bar would be — progress
 * between the CURRENT level's threshold and the NEXT level's threshold,
 * not from zero — using XP_THRESHOLDS, the same table the engine's own
 * level-up flow reads from.
 *
 * RECENT EVENTS ARE REAL TURNS: reuses the same `turns: NarrativeTurn[]`
 * array already flowing through AdventureState (JournalPanel's own data
 * source) — no separate "events" concept was invented. Shows the most
 * recent few turns' player input as a compact list; the "View full
 * journal" button switches to the existing Journal tab via the same
 * onViewJournal callback AdventureHub already wires other panel
 * switches through.
 */

import { getXpForNextLevel, XP_THRESHOLDS } from '@/lib/engine'
import { Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import type { CharacterRecord, NarrativeTurn } from '@/lib/supabase'

interface PartyStatusPanelProps {
  character: CharacterRecord
  turns: NarrativeTurn[]
  onViewJournal: () => void
}

export function PartyStatusPanel({ character, turns, onViewJournal }: PartyStatusPanelProps) {
  const { sheet } = character

  const hpRatio = sheet.maxHp > 0 ? sheet.currentHp / sheet.maxHp : 0
  const hpBarBg = hpRatio > 0.5 ? 'bg-heal-400' : hpRatio > 0.2 ? 'bg-arcane-400' : 'bg-harm-400'
  const hpColour = hpRatio > 0.5 ? 'text-heal-400' : hpRatio > 0.2 ? 'text-arcane-400' : 'text-harm-400'

  const currentLevelFloor = XP_THRESHOLDS[sheet.level] ?? 0
  const nextLevelCeiling = getXpForNextLevel(sheet.level)
  const isMaxLevel = sheet.level >= 20
  const xpIntoLevel = Math.max(0, character.experience - currentLevelFloor)
  const xpSpanForLevel = Math.max(1, nextLevelCeiling - currentLevelFloor)
  const xpRatio = isMaxLevel ? 1 : Math.min(1, xpIntoLevel / xpSpanForLevel)

  const recentTurns = [...turns].reverse().slice(0, 4)

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3" data-testid="party-status-panel">
      <PixelPanel className="p-3">
        <p className="font-mono text-[10px] tracking-widest text-arcane-400 mb-2 uppercase">Party</p>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 pixel-border overflow-hidden flex-shrink-0 bg-void-800 flex items-center justify-center pixel-crisp"
            data-testid="party-portrait"
          >
            {character.portraitUrl ? (
              <img
                src={character.portraitUrl}
                alt={`Portrait of ${sheet.name}`}
                className="w-full h-full object-cover pixel-crisp"
              />
            ) : (
              <span className="font-pixel-display text-xl text-void-500" aria-hidden="true">
                {sheet.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-white truncate leading-tight">{sheet.name}</p>
            <p className="font-body text-sm text-void-400 capitalize truncate">
              Lv {sheet.level} {sheet.ancestry} {sheet.archetype}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] tracking-widest text-void-400 uppercase">HP</span>
            <span className={`font-mono text-sm ${hpColour}`}>
              {sheet.currentHp} / {sheet.maxHp}
            </span>
          </div>
          <div className="pixel-bar-track h-3">
            <div
              className={`pixel-bar-fill ${hpBarBg}`}
              style={{ width: `${Math.max(0, Math.min(100, hpRatio * 100))}%` }}
              role="progressbar"
              aria-valuenow={sheet.currentHp}
              aria-valuemin={0}
              aria-valuemax={sheet.maxHp}
              aria-label="Hit points"
            />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] tracking-widest text-void-400 uppercase">XP</span>
            <span className="font-mono text-sm text-spirit-300">
              {isMaxLevel ? 'Max Level' : `${xpIntoLevel} / ${xpSpanForLevel}`}
            </span>
          </div>
          <div className="pixel-bar-track h-2">
            <div
              className="pixel-bar-fill bg-spirit-400"
              style={{ width: `${Math.max(0, Math.min(100, xpRatio * 100))}%` }}
              role="progressbar"
              aria-valuenow={isMaxLevel ? xpSpanForLevel : xpIntoLevel}
              aria-valuemin={0}
              aria-valuemax={xpSpanForLevel}
              aria-label="Experience progress"
            />
          </div>
        </div>
      </PixelPanel>

      <PixelPanel className="p-3 flex-1 min-h-0 flex flex-col">
        <p className="font-mono text-[10px] tracking-widest text-spirit-400 mb-2 uppercase">Recent Events</p>
        {recentTurns.length === 0 ? (
          <p className="text-void-600 text-xs" data-testid="recent-events-empty">
            Nothing has happened yet — take an action to begin.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5 overflow-y-auto min-h-0" data-testid="recent-events-list">
            {recentTurns.map((turn) => (
              <li key={turn.id} className="text-void-300 text-xs leading-snug line-clamp-2">
                <span className="text-void-600 font-mono mr-1">#{turn.turnNumber}</span>
                {turn.playerInput || turn.aiNarration || '—'}
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onViewJournal}
          className="mt-2 w-full"
        >
          View Full Journal
        </Button>
      </PixelPanel>
    </div>
  )
}
