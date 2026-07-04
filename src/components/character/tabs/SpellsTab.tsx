import type { CharacterRecord } from '@/lib/supabase'

interface SpellsTabProps {
  character: CharacterRecord
}

/**
 * Spell mechanics (slots, prepared/known spell lists, casting) are not yet
 * implemented in the engine — SpellDataRow exists as a storage placeholder
 * only (see src/types/database.ts: "Phase 5 full schema"). Rather than build
 * a UI that pretends to manage spell slots the rules engine can't actually
 * enforce, this tab is honest about the gap. The raw stored data (if any
 * was set some other way) is still shown read-only so nothing is hidden.
 */
export function SpellsTab({ character }: SpellsTabProps) {
  const hasAnyData =
    (character.spells.known?.length ?? 0) > 0 ||
    (character.spells.prepared?.length ?? 0) > 0 ||
    Object.keys(character.spells.slots ?? {}).length > 0

  return (
    <div className="flex flex-col gap-6">
      <div className="chr-panel-spirit p-4 rounded-lg">
        <p className="stat-label text-spirit-400 mb-1">Coming in a Future Phase</p>
        <p className="text-void-300 text-sm">
          Spell slots, preparation, and casting mechanics aren't implemented in the rules engine
          yet. This tab will become fully functional once that system lands — Chronicle AI never
          shows a control that the engine can't actually back.
        </p>
      </div>

      {hasAnyData && (
        <div className="chr-panel p-4 rounded-lg">
          <p className="stat-label text-void-500 mb-2">Stored Data (read-only)</p>
          {character.spells.known && character.spells.known.length > 0 && (
            <p className="text-void-300 text-sm mb-1">
              Known: {character.spells.known.join(', ')}
            </p>
          )}
          {character.spells.prepared && character.spells.prepared.length > 0 && (
            <p className="text-void-300 text-sm">
              Prepared: {character.spells.prepared.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
