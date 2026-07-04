import { useState } from 'react'
import { Input, Badge } from '@/components/ui'
import { isIncapacitated, getXpForNextLevel } from '@/lib/engine'
import { PixelPanel, PixelBar } from '@/components/pixel'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface OverviewTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function OverviewTab({ character, onPatch }: OverviewTabProps) {
  const { sheet } = character
  const [currentHpInput, setCurrentHpInput] = useState(String(sheet.currentHp))

  const hpRatio = sheet.maxHp > 0 ? sheet.currentHp / sheet.maxHp : 0
  const hpColor = hpRatio > 0.5 ? 'text-heal-400' : hpRatio > 0.2 ? 'text-arcane-400' : 'text-harm-400'
  const incapacitated = isIncapacitated(sheet.conditions)

  // Real XP progress toward next level, from the engine's own threshold table.
  // At level 20 (max), there is no "next level" — xpForNext equals current
  // total in that case so the bar shows full rather than divide-by-zero.
  const xpForNext = getXpForNextLevel(sheet.level)
  const isMaxLevel = sheet.level >= 20
  const xpBarMax = isMaxLevel ? Math.max(character.experience, 1) : xpForNext

  function commitCurrentHp() {
    const parsed = Number.parseInt(currentHpInput, 10)
    if (Number.isNaN(parsed)) {
      setCurrentHpInput(String(sheet.currentHp))
      return
    }
    // currentHp may legitimately go negative (death-state tracking, per the
    // engine's isDead() check) or exceed maxHp briefly via temp HP rules —
    // the engine itself does not clamp this on update, only on creation, so
    // we don't invent a clamp here either.
    onPatch(
      { currentHp: parsed },
      { sheet: { ...sheet, currentHp: parsed } },
    )
  }

  function adjustHp(delta: number) {
    const next = sheet.currentHp + delta
    setCurrentHpInput(String(next))
    onPatch({ currentHp: next }, { sheet: { ...sheet, currentHp: next } })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start gap-6">
        <div className="w-24 h-24 pixel-border overflow-hidden flex-shrink-0 bg-void-800 flex items-center justify-center pixel-crisp">
          {character.portraitUrl ? (
            <img
              src={character.portraitUrl}
              alt={`Portrait of ${sheet.name}`}
              className="w-full h-full object-cover pixel-crisp"
            />
          ) : (
            <span className="font-pixel-display text-2xl text-void-500">
              {sheet.name.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-[200px]">
          <h2 className="font-display text-2xl text-white">{sheet.name}</h2>
          <p className="text-void-400 text-sm capitalize">
            Level {sheet.level} {sheet.ancestry} {sheet.archetype} · {sheet.background}
          </p>
          {incapacitated && (
            <Badge variant="harm" className="mt-2">
              Incapacitated
            </Badge>
          )}

          {/* Real XP progress — sourced from the engine's XP_THRESHOLDS table */}
          <div className="mt-3 max-w-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="font-pixel-display text-[7px] text-void-500 uppercase">
                {isMaxLevel ? 'Max Level' : `To Level ${sheet.level + 1}`}
              </span>
              <span className="font-mono text-[10px] text-void-500 tabular-nums">
                {character.experience} / {xpBarMax}
              </span>
            </div>
            <PixelBar
              value={character.experience}
              max={xpBarMax}
              kind="xp"
              showNumbers={false}
              aria-label={isMaxLevel ? 'Experience, max level reached' : `Experience toward level ${sheet.level + 1}`}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <PixelPanel className="p-4">
          <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">Hit Points</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustHp(-1)}
              aria-label="Decrease current HP"
              className="text-void-400 hover:text-harm-400 font-mono text-lg px-1"
            >
              −
            </button>
            <input
              type="number"
              aria-label="Current HP"
              value={currentHpInput}
              onChange={(e) => setCurrentHpInput(e.target.value)}
              onBlur={commitCurrentHp}
              onKeyDown={(e) => e.key === 'Enter' && commitCurrentHp()}
              className={`w-14 text-center bg-void-900 border border-void-700 py-1 font-mono ${hpColor}`}
            />
            <span className="text-void-500 font-mono">/ {sheet.maxHp}</span>
            <button
              type="button"
              onClick={() => adjustHp(1)}
              aria-label="Increase current HP"
              className="text-void-400 hover:text-heal-400 font-mono text-lg px-1"
            >
              +
            </button>
          </div>
        </PixelPanel>

        <DerivedStat label="Armor Class" value={sheet.armorClass} />
        <DerivedStat label="Proficiency" value={formatModifier(sheet.proficiencyBonus)} />
        <DerivedStat label="Hit Die" value={sheet.hitDie} />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {(
          [
            ['STR', sheet.modifiers.strength, sheet.scores.strength],
            ['DEX', sheet.modifiers.dexterity, sheet.scores.dexterity],
            ['CON', sheet.modifiers.constitution, sheet.scores.constitution],
            ['INT', sheet.modifiers.intelligence, sheet.scores.intelligence],
            ['WIS', sheet.modifiers.wisdom, sheet.scores.wisdom],
            ['CHA', sheet.modifiers.charisma, sheet.scores.charisma],
          ] as const
        ).map(([label, mod, score]) => (
          <PixelPanel key={label} className="p-3 text-center">
            <p className="font-pixel-display text-[7px] text-void-500">{label}</p>
            <p className="font-mono text-lg text-arcane-300">{formatModifier(mod)}</p>
            <p className="text-void-600 text-xs font-mono">{score}</p>
          </PixelPanel>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Experience"
          type="number"
          min={0}
          value={character.experience}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(parsed)) {
              onPatch({ experience: parsed }, { experience: parsed })
            }
          }}
        />
      </div>
    </div>
  )
}

function DerivedStat({ label, value }: { label: string; value: string | number }) {
  return (
    <PixelPanel className="p-4">
      <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">{label}</p>
      <p className="font-mono text-xl text-white">{value}</p>
    </PixelPanel>
  )
}
