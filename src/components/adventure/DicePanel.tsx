/**
 * DicePanel
 *
 * Interactive dice roller using the real Chronicle AI dice engine.
 *
 * Architecture note: rolls are UI-local (not persisted to the DB) until
 * Phase 2 AI narration lands and turns are properly appended via appendTurn().
 * The panel still uses the real rollDie/rollD20/rollPool functions from the
 * engine — there is no separate "dice simulator" here.
 *
 * Law 6 compliance: every roll shows the face value, modifier, total, and
 * outcome tier (if DC was set). Nothing is hidden.
 */

import { useState } from 'react'
import {
  rollDie,
  rollD20,
  ALL_DICE,
  Outcome,
  OUTCOME_META,
  evaluateRoll,
  DC,
} from '@/lib/engine'
import type { DieNotation, RollResult, RollMode } from '@/lib/engine'
import { Button } from '@/components/ui'

interface LocalRoll {
  id: string
  result: RollResult
  dc: number | null
  label: string
}

function makeId() {
  return `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const OUTCOME_COLOURS: Record<Outcome, string> = {
  [Outcome.CRITICAL_SUCCESS]:          'text-arcane-400',
  [Outcome.FULL_SUCCESS]:              'text-heal-400',
  [Outcome.SUCCESS_WITH_COST]:         'text-arcane-300',
  [Outcome.FAILURE_WITH_OPPORTUNITY]:  'text-void-400',
  [Outcome.COMPLICATION]:              'text-harm-400',
}

export function DicePanel() {
  const [rolls, setRolls] = useState<LocalRoll[]>([])
  const [mode, setMode] = useState<RollMode>('normal')
  const [modifier, setModifier] = useState(0)
  const [dc, setDc] = useState<number | null>(null)

  function addRoll(result: RollResult, label: string) {
    const entry: LocalRoll = { id: makeId(), result, dc, label }
    setRolls((prev) => [entry, ...prev].slice(0, 20)) // keep last 20
  }

  function rollDie_(die: DieNotation) {
    const result = die === 'd20'
      ? rollD20(modifier, mode)
      : rollDie(die, modifier, mode)
    addRoll(result, die === 'd20' && mode !== 'normal' ? `${die} (${mode})` : die)
  }

  function clearRolls() {
    setRolls([])
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-hidden">
      {/* Controls */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <p className="stat-label">Roll Mode</p>
        <div className="flex gap-2">
          {(['normal', 'advantage', 'disadvantage'] as RollMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={[
                'px-3 py-1.5 rounded text-xs font-body font-semibold capitalize border transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                mode === m
                  ? 'bg-arcane-900/50 border-arcane-500 text-arcane-300'
                  : 'bg-void-900 border-void-700/50 text-void-400 hover:border-void-500',
              ].join(' ')}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Modifier & DC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="stat-label mb-1">Modifier</p>
            <input
              type="number"
              value={modifier}
              onChange={(e) => setModifier(Number(e.target.value) || 0)}
              aria-label="Modifier"
              className="w-full px-3 py-1.5 rounded bg-void-900 border border-void-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-arcane-400"
            />
          </div>
          <div>
            <p className="stat-label mb-1">DC (optional)</p>
            <input
              type="number"
              value={dc ?? ''}
              placeholder="—"
              onChange={(e) => setDc(e.target.value ? Number(e.target.value) : null)}
              aria-label="Difficulty class"
              className="w-full px-3 py-1.5 rounded bg-void-900 border border-void-700 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-arcane-400 placeholder:text-void-600"
            />
          </div>
        </div>

        {/* DC quick-set */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.entries(DC) as [string, number][]).map(([tier, value]) => (
            <button
              key={tier}
              type="button"
              onClick={() => setDc(dc === value ? null : value)}
              aria-pressed={dc === value}
              className={[
                'px-2 py-0.5 rounded text-xs font-mono border transition-colors',
                dc === value
                  ? 'bg-spirit-900/40 border-spirit-600 text-spirit-300'
                  : 'bg-void-900 border-void-700/50 text-void-500 hover:text-void-300',
              ].join(' ')}
            >
              {tier[0] + tier.slice(1).toLowerCase()} {value}
            </button>
          ))}
        </div>
      </div>

      {/* Die buttons */}
      <div className="flex-shrink-0">
        <p className="stat-label mb-2">Dice</p>
        <div className="grid grid-cols-4 gap-2">
          {ALL_DICE.map((die) => (
            <button
              key={die}
              type="button"
              onClick={() => rollDie_(die)}
              className={[
                'py-3 rounded-lg border font-mono font-bold text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
                die === 'd20'
                  ? 'bg-arcane-900/40 border-arcane-700/60 text-arcane-300 hover:bg-arcane-900/60 col-span-2'
                  : 'bg-void-900 border-void-700/50 text-white hover:border-arcane-700/60',
              ].join(' ')}
            >
              {die}
            </button>
          ))}
        </div>
      </div>

      {/* Roll history */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex items-center justify-between mb-2">
          <p className="stat-label">Roll History</p>
          {rolls.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearRolls}>
              Clear
            </Button>
          )}
        </div>

        {rolls.length === 0 ? (
          <p className="text-void-600 text-xs italic text-center pt-4">
            No rolls yet. Click a die to roll.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rolls.map((entry) => (
              <RollEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RollEntry({ entry }: { entry: LocalRoll }) {
  const { result, dc, label } = entry
  const checkResult = dc !== null ? evaluateRoll(result, dc) : null
  const meta = checkResult ? OUTCOME_META[checkResult.outcome] : null
  const outColour = meta ? OUTCOME_COLOURS[checkResult!.outcome] : 'text-white'

  return (
    <div className="chr-panel px-3 py-2 rounded-lg flex flex-col gap-0.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="stat-label text-void-500">{label.toUpperCase()}</span>
        {result.isNatural20 && <span className="text-arcane-400 text-xs font-mono">NAT 20</span>}
        {result.isNatural1  && <span className="text-harm-400  text-xs font-mono">NAT 1</span>}
      </div>

      {/* Face breakdown */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {result.rolls.filter((r) => r.kept).map((r, i) => (
          <span key={i} className="font-mono text-lg text-white">{r.face}</span>
        ))}
        {result.rolls.filter((r) => !r.kept).map((r, i) => (
          <span key={`unk-${i}`} className="font-mono text-void-600 line-through text-sm">{r.face}</span>
        ))}
        {result.modifier !== 0 && (
          <span className="font-mono text-void-400 text-sm">
            {result.modifier > 0 ? '+' : ''}{result.modifier}
          </span>
        )}
        <span className="font-mono text-white font-bold text-lg ml-1">= {result.total}</span>
        {dc !== null && (
          <span className="text-void-500 text-xs ml-1">vs DC {dc}</span>
        )}
      </div>

      {/* Outcome tier */}
      {meta && (
        <p className={`text-xs font-body font-semibold ${outColour}`}>
          {meta.label}
        </p>
      )}
    </div>
  )
}
