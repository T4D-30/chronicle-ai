import { useState } from 'react'
import { Select, Input, Button } from '@/components/ui'
import { SPECIES_OPTIONS } from '../characterContent'
import type { CharacterDraft } from '../useCharacterDraft'

interface SpeciesStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

export function SpeciesStep({ draft, onChange }: SpeciesStepProps) {
  const knownValues = SPECIES_OPTIONS.map((o) => o.value)
  const isCustom = draft.ancestry.length > 0 && !knownValues.includes(draft.ancestry)
  const [useCustom, setUseCustom] = useState(isCustom)

  return (
    <div className="flex flex-col gap-5">
      {!useCustom ? (
        <>
          <Select
            label="Species / Ancestry"
            options={SPECIES_OPTIONS}
            value={draft.ancestry}
            onChange={(e) => onChange({ ancestry: e.target.value })}
            hint="Mechanical effects from ancestry are deferred to a future volume — this is narrative for now."
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setUseCustom(true)}
          >
            Use a custom species instead
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Custom Species / Ancestry"
            value={draft.ancestry}
            onChange={(e) => onChange({ ancestry: e.target.value })}
            placeholder="e.g. Aasimar, Genasi, Warforged"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              setUseCustom(false)
              onChange({ ancestry: SPECIES_OPTIONS[0].value })
            }}
          >
            Choose from the list instead
          </Button>
        </>
      )}
    </div>
  )
}
