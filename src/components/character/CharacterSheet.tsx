import { Link } from 'react-router-dom'
import { Tabs, TabPanel, LoadingSpinner, Button } from '@/components/ui'
import type { TabDefinition } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import { useCharacterSheet } from './useCharacterSheet'
import type { SaveStatus } from './useCharacterSheet'
import { OverviewTab } from './tabs/OverviewTab'
import { AbilitiesTab } from './tabs/AbilitiesTab'
import { SkillsTab } from './tabs/SkillsTab'
import { SavesTab } from './tabs/SavesTab'
import { InventoryTab } from './tabs/InventoryTab'
import { EquipmentTab } from './tabs/EquipmentTab'
import { SpellsTab } from './tabs/SpellsTab'
import { FeaturesTab } from './tabs/FeaturesTab'
import { ConditionsTab } from './tabs/ConditionsTab'
import { NotesTab } from './tabs/NotesTab'

interface CharacterSheetProps {
  characterId: string
}

const SHEET_TABS: TabDefinition[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'skills', label: 'Skills' },
  { id: 'saves', label: 'Saves' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'spells', label: 'Spells' },
  { id: 'features', label: 'Features' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'notes', label: 'Notes' },
]

function SaveStatusIndicator({ status, error }: { status: SaveStatus; error: string | null }) {
  if (status === 'idle') return null

  const label =
    status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed'
  const color =
    status === 'saving'
      ? 'text-void-400'
      : status === 'saved'
        ? 'text-heal-400'
        : 'text-harm-400'

  return (
    <div className="flex flex-col items-end">
      <span className={`text-xs font-body ${color}`} role="status" aria-live="polite">
        {label}
      </span>
      {status === 'error' && error && (
        <span className="text-xs text-harm-400 max-w-xs text-right">{error}</span>
      )}
    </div>
  )
}

export function CharacterSheet({ characterId }: CharacterSheetProps) {
  const { character, isLoading, loadError, saveStatus, saveError, patch } =
    useCharacterSheet(characterId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" label="Loading character…" />
      </div>
    )
  }

  if (loadError || !character) {
    return (
      <PixelPanel variant="harm" className="p-8 text-center max-w-md mx-auto">
        <p className="text-harm-400 mb-4">{loadError ?? 'Character not found.'}</p>
        <Link to="/characters">
          <Button variant="ghost">Back to Library</Button>
        </Link>
      </PixelPanel>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <Link to="/characters" className="text-void-400 hover:text-arcane-300 text-sm">
          ← Back to Library
        </Link>
        <SaveStatusIndicator status={saveStatus} error={saveError} />
      </div>

      <PixelPanel variant="arcane" className="p-6 md:p-8">
        <Tabs tabs={SHEET_TABS} defaultTabId="overview">
          <TabPanel tabId="overview">
            <OverviewTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="abilities">
            <AbilitiesTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="skills">
            <SkillsTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="saves">
            <SavesTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="inventory">
            <InventoryTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="equipment">
            <EquipmentTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="spells">
            <SpellsTab character={character} />
          </TabPanel>
          <TabPanel tabId="features">
            <FeaturesTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="conditions">
            <ConditionsTab character={character} onPatch={patch} />
          </TabPanel>
          <TabPanel tabId="notes">
            <NotesTab character={character} onPatch={patch} />
          </TabPanel>
        </Tabs>
      </PixelPanel>
    </div>
  )
}
