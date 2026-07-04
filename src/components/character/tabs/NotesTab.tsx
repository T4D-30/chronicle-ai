import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface NotesTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

export function NotesTab({ character, onPatch }: NotesTabProps) {
  const [bio, setBio] = useState(character.bio)

  // Keep local textarea in sync if the character reloads from elsewhere
  // (e.g. after a save-error rollback in useCharacterSheet).
  useEffect(() => {
    setBio(character.bio)
  }, [character.bio])

  function handleChange(value: string) {
    setBio(value)
    onPatch({ bio: value }, { bio: value })
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        label="Biography"
        value={bio}
        onChange={(e) => handleChange(e.target.value)}
        rows={12}
        hint="Freeform in-fiction backstory. Never read by the rules engine — purely for you and your table."
      />
    </div>
  )
}
