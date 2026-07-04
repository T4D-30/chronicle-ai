import { useState } from 'react'
import { Button, Badge, Select } from '@/components/ui'
import {
  CONDITION_IDS,
  CONDITIONS,
  createActiveCondition,
  applyCondition,
  removeCondition,
  isIncapacitated,
  isImmobilized,
} from '@/lib/engine'
import type { ConditionId } from '@/lib/engine'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface ConditionsTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

const CONDITION_OPTIONS = CONDITION_IDS.map((id) => ({
  value: id,
  label: CONDITIONS[id].name,
}))

export function ConditionsTab({ character, onPatch }: ConditionsTabProps) {
  const { sheet } = character
  const [selectedCondition, setSelectedCondition] = useState<ConditionId>(CONDITION_IDS[0])
  const [source, setSource] = useState('')

  const incapacitated = isIncapacitated(sheet.conditions)
  const immobilized = isImmobilized(sheet.conditions)

  function commitConditions(next: typeof sheet.conditions) {
    // conditions lives both on character.conditions (DB-aligned mirror) and
    // on sheet.conditions (the engine's working copy) — keep both in sync
    // in the optimistic local preview.
    onPatch(
      { conditions: next },
      { sheet: { ...sheet, conditions: next }, conditions: next },
    )
  }

  function handleApply() {
    const newCondition = createActiveCondition(
      selectedCondition,
      source.trim() || 'manually applied',
      0,
    )
    const next = applyCondition(sheet.conditions, newCondition, 0)
    commitConditions(next)
    setSource('')
  }

  function handleRemove(id: ConditionId) {
    const next = removeCondition(sheet.conditions, id)
    commitConditions(next)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {incapacitated && <Badge variant="harm">Incapacitated</Badge>}
        {immobilized && <Badge variant="harm">Immobilized</Badge>}
        {!incapacitated && !immobilized && sheet.conditions.length === 0 && (
          <Badge variant="heal">Healthy</Badge>
        )}
      </div>

      {sheet.conditions.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {sheet.conditions.map((active) => {
            const def = CONDITIONS[active.id]
            return (
              <li key={active.id} className="chr-panel p-4 rounded-lg border-harm-600/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-body font-semibold text-white">{def.name}</h3>
                    <p className="text-void-500 text-xs">
                      Source: {active.source}
                      {active.stackLevel > 1 && ` · Stack ${active.stackLevel}`}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(active.id)}>
                    Remove
                  </Button>
                </div>
                <ul className="mt-2 flex flex-col gap-1">
                  {def.effects.map((effect, i) => (
                    <li key={i} className="text-void-300 text-sm flex gap-2">
                      <span className="text-harm-400">·</span> {effect}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-void-500 text-sm">No active conditions.</p>
      )}

      <div className="chr-panel p-4 rounded-lg">
        <p className="stat-label text-void-300 mb-3">Apply Condition</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Select
            label="Condition"
            options={CONDITION_OPTIONS}
            value={selectedCondition}
            onChange={(e) => setSelectedCondition(e.target.value as ConditionId)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="condition-source" className="stat-label text-void-300">
              Source
            </label>
            <input
              id="condition-source"
              type="text"
              placeholder="e.g. spider bite"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-3 py-2 rounded-md bg-void-900 border border-void-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-arcane-400"
            />
          </div>
        </div>
        <Button type="button" variant="danger" size="sm" onClick={handleApply}>
          Apply Condition
        </Button>
      </div>
    </div>
  )
}
