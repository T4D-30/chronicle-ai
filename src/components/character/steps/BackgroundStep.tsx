import { useState } from 'react'
import { Select, Input, Button } from '@/components/ui'
import { BACKGROUND_OPTIONS } from '../characterContent'
import type { CharacterDraft } from '../useCharacterDraft'

interface BackgroundStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

export function BackgroundStep({ draft, onChange }: BackgroundStepProps) {
  const knownValues = BACKGROUND_OPTIONS.map((o) => o.value)
  const isCustom = draft.background.length > 0 && !knownValues.includes(draft.background)
  const [useCustom, setUseCustom] = useState(isCustom)

  return (
    <div className="flex flex-col gap-5">
      {!useCustom ? (
        <>
          <Select
            label="Background"
            options={BACKGROUND_OPTIONS}
            value={draft.background}
            onChange={(e) => onChange({ background: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setUseCustom(true)}
          >
            Use a custom background instead
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Custom Background"
            value={draft.background}
            onChange={(e) => onChange({ background: e.target.value })}
            placeholder="e.g. Pirate, Spy, Knight"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => {
              setUseCustom(false)
              onChange({ background: BACKGROUND_OPTIONS[0].value })
            }}
          >
            Choose from the list instead
          </Button>
        </>
      )}
    </div>
  )
}
