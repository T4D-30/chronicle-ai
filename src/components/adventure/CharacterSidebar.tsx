/**
 * CharacterSidebar
 *
 * Displays the live character state during a session.
 * Every numeric value is derived by calling engine functions directly —
 * no math is reproduced in this component. (Constitution Law 3)
 *
 * Passive skills: 10 + WIS/INT mod + proficiency (if proficient) + equipment bonus.
 * This is the standard D&D passive formula, computed via the same functions
 * the character sheet tabs use.
 */

import {
  getAbilityModifier,
  getProficiencyBonus,

  getEquipmentPassiveBonus,
  CONDITIONS,
  isIncapacitated,
} from '@/lib/engine'
import { Badge, Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import type { CharacterRecord } from '@/lib/supabase'
import { Link } from 'react-router-dom'

interface CharacterSidebarProps {
  character: CharacterRecord
  onClose?: () => void
}

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

export function CharacterSidebar({ character, onClose }: CharacterSidebarProps) {
  const { sheet } = character

  // Engine-derived values — no inline math
  const wisScore  = sheet.scores.wisdom
  const intScore  = sheet.scores.intelligence
  const prof      = getProficiencyBonus(sheet.level)
  const wisMod    = getAbilityModifier(wisScore)
  const intMod    = getAbilityModifier(intScore)

  const perceptionProficient  = sheet.skillProficiencies.includes('perception')
  const investigationProficient = sheet.skillProficiencies.includes('investigation')
  const insightProficient     = sheet.skillProficiencies.includes('insight')

  // Passive = 10 + mod + (prof if proficient) + equipment bonus
  const passivePerception   = 10 + wisMod + (perceptionProficient ? prof : 0)
    + getEquipmentPassiveBonus(sheet.equipment, 'perception')
  const passiveInvestigation = 10 + intMod + (investigationProficient ? prof : 0)
    + getEquipmentPassiveBonus(sheet.equipment, 'investigation')
  const passiveInsight       = 10 + wisMod + (insightProficient ? prof : 0)
    + getEquipmentPassiveBonus(sheet.equipment, 'insight')

  // HP colour by ratio (Constitution Law 2)
  const hpRatio   = sheet.maxHp > 0 ? sheet.currentHp / sheet.maxHp : 0
  const hpColour  = hpRatio > 0.5 ? 'text-heal-400' : hpRatio > 0.2 ? 'text-arcane-400' : 'text-harm-400'
  const hpBarBg   = hpRatio > 0.5 ? 'bg-heal-400' : hpRatio > 0.2 ? 'bg-arcane-400' : 'bg-harm-400'

  const incapacitated = isIncapacitated(sheet.conditions)

  // Equipped items summary (weapons + armor only)
  const equippedWeapons = sheet.equipment.filter((e) => e.equipped && e.slot === 'weapon')
  const equippedArmor   = sheet.equipment.filter((e) => e.equipped && (e.slot === 'armor' || e.slot === 'shield'))

  return (
    <aside className="flex flex-col gap-4 h-full overflow-y-auto p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 pixel-border overflow-hidden flex-shrink-0 bg-void-800 flex items-center justify-center pixel-crisp">
            {character.portraitUrl ? (
              <img
                src={character.portraitUrl}
                alt={`Portrait of ${sheet.name}`}
                className="w-full h-full object-cover pixel-crisp"
              />
            ) : (
              <span className="font-pixel-display text-lg text-void-500">
                {sheet.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-white truncate leading-tight">{sheet.name}</p>
            <p className="font-pixel-body text-sm text-void-400 capitalize truncate">
              Lv {sheet.level} {sheet.ancestry} {sheet.archetype}
            </p>
          </div>
        </div>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close sidebar">
            ✕
          </Button>
        )}
      </div>

      {/* HP bar — pixel track/fill, exact text contract preserved for callers */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-pixel-display text-[8px] text-void-400 uppercase">HP</span>
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

      {/* Core stats row */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill label="AC" value={sheet.armorClass} />
        <StatPill label="PROF" value={fmt(prof)} />
        <StatPill label={sheet.hitDie.toUpperCase()} value="—" dimmed />
      </div>

      {/* Ability modifiers */}
      <div>
        <p className="font-pixel-display text-[8px] text-void-400 uppercase mb-2">Ability Modifiers</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['STR', sheet.modifiers.strength],
              ['DEX', sheet.modifiers.dexterity],
              ['CON', sheet.modifiers.constitution],
              ['INT', sheet.modifiers.intelligence],
              ['WIS', sheet.modifiers.wisdom],
              ['CHA', sheet.modifiers.charisma],
            ] as const
          ).map(([label, mod]) => (
            <PixelPanel key={label} className="p-1.5 text-center">
              <p className="font-pixel-display text-[7px] text-void-600">{label}</p>
              <p className="font-mono text-sm text-arcane-300">{fmt(mod)}</p>
            </PixelPanel>
          ))}
        </div>
      </div>

      {/* Passives */}
      <div>
        <p className="font-pixel-display text-[8px] text-void-400 uppercase mb-2">Passive Skills</p>
        <div className="flex flex-col gap-1">
          <PassiveStat label="Perception" value={passivePerception} proficient={perceptionProficient} />
          <PassiveStat label="Investigation" value={passiveInvestigation} proficient={investigationProficient} />
          <PassiveStat label="Insight" value={passiveInsight} proficient={insightProficient} />
        </div>
      </div>

      {/* Active conditions */}
      {sheet.conditions.length > 0 && (
        <div>
          <p className="font-pixel-display text-[8px] text-void-400 uppercase mb-2">Conditions</p>
          <div className="flex flex-wrap gap-1.5">
            {sheet.conditions.map((c) => {
              const def = CONDITIONS[c.id]
              return (
                <Badge key={c.id} variant="harm" title={def?.effects[0] ?? ''}>
                  {def?.name ?? c.id}
                </Badge>
              )
            })}
          </div>
          {incapacitated && (
            <p className="text-harm-400 text-xs mt-1.5">Cannot take actions.</p>
          )}
        </div>
      )}

      {/* Equipment summary */}
      {(equippedWeapons.length > 0 || equippedArmor.length > 0) && (
        <div>
          <p className="font-pixel-display text-[8px] text-void-400 uppercase mb-2">Equipped</p>
          <div className="flex flex-col gap-1">
            {equippedWeapons.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-void-300">{item.name}</span>
                {item.attackBonus !== undefined && (
                  <span className="font-mono text-arcane-400">{fmt(item.attackBonus)} atk</span>
                )}
              </div>
            ))}
            {equippedArmor.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="text-void-300">{item.name}</span>
                {item.armorBonus !== undefined && (
                  <span className="font-mono text-spirit-400">+{item.armorBonus} AC</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full sheet link */}
      <div className="mt-auto pt-2 border-t border-void-700/50">
        <Link
          to={`/characters/${character.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-void-500 hover:text-arcane-300 transition-colors"
        >
          Full character sheet ↗
        </Link>
      </div>
    </aside>
  )
}

function StatPill({ label, value, dimmed }: { label: string; value: string | number; dimmed?: boolean }) {
  return (
    <PixelPanel className="px-2 py-1.5 text-center">
      <p className="font-pixel-display text-[7px] text-void-600">{label}</p>
      <p className={`font-mono text-sm ${dimmed ? 'text-void-600' : 'text-white'}`}>{value}</p>
    </PixelPanel>
  )
}

function PassiveStat({
  label, value, proficient,
}: {
  label: string; value: number; proficient: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-void-400 text-xs flex items-center gap-1">
        {proficient && <span className="w-1.5 h-1.5 rounded-full bg-arcane-400 inline-block" />}
        {label}
      </span>
      <span className="font-mono text-sm text-white">{value}</span>
    </div>
  )
}
