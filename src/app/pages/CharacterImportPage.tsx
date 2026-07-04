/**
 * CharacterImportPage — Phase 10.1
 *
 * Pipeline: Upload → (provider.parse()) → Review (existing CharacterWizard,
 * seeded with the converted draft, landing on the Review step) → Save.
 *
 * The review/correction/save steps are NOT duplicated here — they're the
 * exact same CharacterWizard + ReviewStep + createCharacter() path manual
 * creation already uses. This page's only real job is: accept a file,
 * hand it to the active provider, convert the result to a draft, and get
 * out of the way.
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCharacterStore } from '@/store/characterStore'
import { CharacterWizard } from '@/components/character/CharacterWizard'
import { CharacterImportUpload } from '@/components/character/CharacterImportUpload'
import { LoadingSpinner, Badge } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import { importResultToDraft } from '@/lib/import'
import type { CharacterImportResult } from '@/lib/import'
import type { CharacterDraft } from '@/components/character/useCharacterDraft'
import type { CharacterRecord } from '@/lib/supabase'

export default function CharacterImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const upsertCharacter = useCharacterStore((s) => s.upsertCharacter)

  const [importedDraft, setImportedDraft] = useState<Partial<CharacterDraft> | null>(null)
  const [importSummary, setImportSummary] = useState<{ providerName: string; notes: string[] } | null>(null)

  function handleParsed(_file: File, result: CharacterImportResult) {
    const { draft, notes, providerName } = importResultToDraft(result)
    setImportedDraft(draft)
    setImportSummary({ providerName, notes })
  }

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
      <div className="w-full max-w-3xl mx-auto mb-6">
        <Link to="/characters" className="text-void-400 hover:text-arcane-300 text-sm">
          ← Back to Library
        </Link>
      </div>

      {!importedDraft ? (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
          <div>
            <p className="stat-label text-arcane-500 mb-1">CHRONICLE AI</p>
            <h1 className="font-display text-3xl font-bold text-white">Import Character Sheet</h1>
            <p className="text-void-400 text-sm mt-2">
              Upload a PDF, PNG, or JPG of your character sheet. You'll review and confirm
              every field before anything is saved — nothing is created automatically.
            </p>
          </div>
          <CharacterImportUpload onParsed={handleParsed} />
        </div>
      ) : (
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-4">
          {importSummary && (
            <PixelPanel variant={importSummary.notes.length > 0 ? 'harm' : 'spirit'} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={importSummary.notes.length > 0 ? 'harm' : 'spirit'}>
                  {importSummary.providerName}
                </Badge>
                <span className="font-pixel-display text-[8px] text-void-400 uppercase">Import Result</span>
              </div>
              {importSummary.notes.length > 0 ? (
                importSummary.notes.map((note, i) => (
                  <p key={i} className="text-void-300 text-sm">{note}</p>
                ))
              ) : (
                <p className="text-void-300 text-sm">
                  Review every field below carefully before saving — automatic extraction can make mistakes.
                </p>
              )}
            </PixelPanel>
          )}
          <CharacterWizard
            userId={user.id}
            initialDraft={importedDraft}
            initialStep="review"
            onCreated={handleCreated}
            onCancel={() => navigate('/characters')}
          />
        </div>
      )}
    </main>
  )
}
