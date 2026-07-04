import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCharacterStore } from '@/store/characterStore'
import { Button, Input, ConfirmDialog, SkeletonGrid } from '@/components/ui'
import { CharacterCard } from '@/components/character/CharacterCard'

export default function CharacterLibraryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const {
    characters,
    isLoading,
    error,
    fetchCharacters,
    removeCharacter,
    duplicateCharacter,
    clearError,
  } = useCharacterStore()

  const [search, setSearch] = useState('')
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (user?.id) void fetchCharacters(user.id)
  }, [user?.id, fetchCharacters])

  const filteredCharacters = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query.length === 0) return characters
    return characters.filter((c) => {
      const { sheet } = c
      return (
        sheet.name.toLowerCase().includes(query) ||
        sheet.archetype.toLowerCase().includes(query) ||
        sheet.ancestry.toLowerCase().includes(query) ||
        sheet.background.toLowerCase().includes(query)
      )
    })
  }, [characters, search])

  async function handleDuplicate(id: string) {
    if (!user?.id) return
    setDuplicatingId(id)
    try {
      const copy = await duplicateCharacter(id, user.id)
      navigate(`/characters/${copy.id}`)
    } catch {
      // Error surfaced via store.error below
    } finally {
      setDuplicatingId(null)
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return
    setIsDeleting(true)
    await removeCharacter(pendingDeleteId)
    setIsDeleting(false)
    setPendingDeleteId(null)
  }

  const characterPendingDelete = characters.find((c) => c.id === pendingDeleteId)

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <p className="stat-label text-arcane-500 mb-1">CHRONICLE AI</p>
            <h1 className="font-display text-3xl font-bold text-white">Character Library</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/characters/import">
              <Button variant="ghost">Import Character</Button>
            </Link>
            <Link to="/characters/new">
              <Button variant="arcane">+ Create New</Button>
            </Link>
          </div>
        </div>

        <div className="mb-6">
          <Input
            placeholder="Search by name, class, species, or background…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search characters"
          />
        </div>

        {error && (
          <div className="chr-panel p-4 rounded-lg border-harm-600/40 mb-6 flex items-center justify-between gap-4">
            <p className="text-harm-400 text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        )}

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : filteredCharacters.length === 0 ? (
          <EmptyState hasSearch={search.trim().length > 0} hasAnyCharacters={characters.length > 0} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onOpen={(id) => navigate(`/characters/${id}`)}
                onDuplicate={handleDuplicate}
                onDelete={(id) => setPendingDeleteId(id)}
                isDuplicating={duplicatingId === character.id}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this character?"
        description={
          characterPendingDelete
            ? `"${characterPendingDelete.sheet.name}" will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  )
}

function EmptyState({
  hasSearch,
  hasAnyCharacters,
}: {
  hasSearch: boolean
  hasAnyCharacters: boolean
}) {
  if (hasSearch) {
    return (
      <div className="chr-panel p-8 rounded-lg text-center">
        <p className="text-void-400">No characters match your search.</p>
      </div>
    )
  }

  if (hasAnyCharacters) return null

  return (
    <div className="chr-panel-arcane p-10 rounded-lg text-center">
      <p className="font-lore text-void-300 italic mb-4">
        "Every hero's story begins with a single choice."
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link to="/characters/new">
          <Button variant="arcane">Create Your First Character</Button>
        </Link>
        <Link to="/characters/import">
          <Button variant="ghost">Import a Sheet</Button>
        </Link>
      </div>
    </div>
  )
}
