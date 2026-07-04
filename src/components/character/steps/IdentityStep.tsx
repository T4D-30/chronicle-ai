import { Input } from '@/components/ui'
import type { CharacterDraft } from '../useCharacterDraft'

interface IdentityStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

export function IdentityStep({ draft, onChange }: IdentityStepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Character Name"
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Aldric Sorn"
        maxLength={60}
        hint="1–60 characters."
        autoFocus
      />
      <Input
        label="Starting Level"
        type="number"
        min={1}
        max={20}
        value={draft.level}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          onChange({ level: Number.isNaN(parsed) ? 1 : parsed })
        }}
        hint="1–20. Most new characters begin at level 1."
      />
    </div>
  )
}
