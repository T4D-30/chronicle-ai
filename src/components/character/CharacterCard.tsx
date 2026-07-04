import { Badge, Button } from '@/components/ui'
import { PixelPanel, PixelBar } from '@/components/pixel'
import type { CharacterRecord } from '@/lib/supabase'

interface CharacterCardProps {
  character: CharacterRecord
  onOpen: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  isDuplicating?: boolean
}

/** Party-selection presentation — Phase 9.1 retro RPG integration. */
export function CharacterCard({
  character,
  onOpen,
  onDuplicate,
  onDelete,
  isDuplicating = false,
}: CharacterCardProps) {
  const { sheet } = character

  return (
    <PixelPanel className="p-4 flex flex-col gap-3 transition-colors">
      <button
        type="button"
        onClick={() => onOpen(character.id)}
        className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
      >
        <div className="w-14 h-14 pixel-border overflow-hidden flex-shrink-0 bg-void-800 flex items-center justify-center pixel-crisp">
          {character.portraitUrl ? (
            <img
              src={character.portraitUrl}
              alt={`Portrait of ${sheet.name}`}
              className="w-full h-full object-cover pixel-crisp"
            />
          ) : (
            <span className="font-pixel-display text-lg text-void-500">
              {sheet.name.charAt(0).toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-lg text-white truncate">{sheet.name}</h3>
          <p className="font-pixel-body text-base text-void-400 capitalize truncate">
            Level {sheet.level} {sheet.ancestry} {sheet.archetype}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-3">
        <Badge variant="neutral">AC {sheet.armorClass}</Badge>
        <PixelBar value={sheet.currentHp} max={sheet.maxHp} kind="hp" showNumbers className="flex-1" />
      </div>

      <div className="flex items-center gap-2 mt-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(character.id)}>
          Open
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDuplicate(character.id)}
          loading={isDuplicating}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => onDelete(character.id)}
        >
          Delete
        </Button>
      </div>
    </PixelPanel>
  )
}
