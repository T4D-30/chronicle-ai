import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LoadingSpinner, Button } from '@/components/ui'
import { useCharacterStore } from '@/store/characterStore'
import { useAuth } from '@/hooks/useAuth'
import type { CampaignDraft } from '../useCampaignDraft'

interface CharacterStepProps {
  draft: CampaignDraft
  onSelect: (id: string, name: string) => void
  onClear: () => void
}

export function CharacterStep({ draft, onSelect, onClear }: CharacterStepProps) {
  const { user } = useAuth()
  const { characters, isLoading, fetchCharacters } = useCharacterStore()

  useEffect(() => {
    if (user?.id) void fetchCharacters(user.id)
  }, [user?.id, fetchCharacters])

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner size="md" label="Loading your characters…" />
      </div>
    )
  }

  if (characters.length === 0) {
    return (
      <div className="chr-panel p-6 text-center rounded-lg">
        <p className="text-void-400 mb-4">You don't have any characters yet.</p>
        <Link to="/characters/new" target="_blank" rel="noopener noreferrer">
          <Button type="button" variant="arcane" size="sm">
            Create a Character
          </Button>
        </Link>
        <p className="text-void-600 text-xs mt-3">Opens in a new tab — come back here when done.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {characters.map((char) => {
        const selected = draft.characterId === char.id
        return (
          <button
            key={char.id}
            type="button"
            onClick={() => selected ? onClear() : onSelect(char.id, char.sheet.name)}
            aria-pressed={selected}
            className={[
              'flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
              selected
                ? 'bg-arcane-900/40 border-arcane-500'
                : 'bg-void-900 border-void-700/50 hover:border-void-500',
            ].join(' ')}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-void-800 border border-void-700 flex items-center justify-center">
              {char.portraitUrl ? (
                <img
                  src={char.portraitUrl}
                  alt={`Portrait of ${char.sheet.name}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-lg text-void-500">
                  {char.sheet.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-body font-semibold text-white truncate">{char.sheet.name}</p>
              <p className="text-void-400 text-xs capitalize truncate">
                Level {char.sheet.level} {char.sheet.ancestry} {char.sheet.archetype}
              </p>
            </div>
            {selected && (
              <span className="ml-auto text-arcane-300 text-xs font-mono">✓ Selected</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
