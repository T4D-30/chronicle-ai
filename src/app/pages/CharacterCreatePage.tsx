import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCharacterStore } from '@/store/characterStore'
import { CharacterWizard } from '@/components/character/CharacterWizard'
import { LoadingSpinner } from '@/components/ui'
import type { CharacterRecord } from '@/lib/supabase'

export default function CharacterCreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const upsertCharacter = useCharacterStore((s) => s.upsertCharacter)

  function handleCreated(character: CharacterRecord) {
    upsertCharacter(character)
    navigate(`/characters/${character.id}`)
  }

  if (!user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading…" />
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <CharacterWizard
        userId={user.id}
        onCreated={handleCreated}
        onCancel={() => navigate('/characters')}
      />
    </main>
  )
}
