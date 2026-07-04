import { useState } from 'react'
import { Select, Input, Button } from '@/components/ui'
import { resolveHitDie } from '@/lib/engine'
import { CLASS_OPTIONS } from '../characterContent'
import type { CharacterDraft } from '../useCharacterDraft'

interface ClassStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

export function ClassStep({ draft, onChange }: ClassStepProps) {
  const knownValues = CLASS_OPTIONS.map((o) => o.value)
  const isCustom = draft.archetype.length > 0 && !knownValues.includes(draft.archetype)
  const [useCustom, setUseCustom] = useState(isCustom)

  // Live engine derivation — not a lookup table duplicated in the UI.
  const hitDie = resolveHitDie(draft.archetype)

  return (
    <div className="flex flex-col gap-5">
      {!useCustom ? (
        <>
          <Select
            label="Class / Archetype"
            options={CLASS_OPTIONS}
            value={draft.archetype}
            onChange={(e) => onChange({ archetype: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setUseCustom(true)}
          >
            Use a custom class instead
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Custom Class / Archetype"
            value={draft.archetype}
            onChange={(e) => onChange({ archetype: e.target.value })}
            placeholder="e.g. Artificer, Blood Hunter"
            hint="Unrecognised classes default to a d8 hit die."
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              setUseCustom(false)
              onChange({ archetype: CLASS_OPTIONS[0].value })
            }}
          >
            Choose from the list instead
          </Button>
        </>
      )}

      <div className="chr-panel-spirit p-4 rounded-lg">
        <p className="stat-label text-spirit-400 mb-1">Hit Die</p>
        <p className="font-mono text-2xl text-white">{hitDie}</p>
        <p className="text-void-500 text-xs mt-1">
          Resolved automatically from your class. Determines max HP at each level.
        </p>
      </div>
    </div>
  )
}
