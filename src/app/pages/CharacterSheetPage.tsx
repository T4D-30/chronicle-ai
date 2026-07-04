import { useParams } from 'react-router-dom'
import { CharacterSheet } from '@/components/character/CharacterSheet'

export default function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <p className="text-harm-400">No character selected.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <CharacterSheet characterId={id} />
    </main>
  )
}
