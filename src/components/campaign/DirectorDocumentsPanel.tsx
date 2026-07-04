/**
 * DirectorDocumentsPanel — Phase 10.3 (upload/list/delete UI) → Phase 10.4 (extraction feedback)
 *
 * A campaign's persistent reference-material library: DM guides, campaign
 * bibles, homebrew rules, world lore, character notes the Director can
 * later retrieve from during narration (see
 * src/lib/directorDocuments/fullTextRetriever.ts and the Edge Function
 * integration in supabase/functions/narrate/index.ts).
 *
 * Deliberately NOT built as an "upload → wizard review" flow like
 * CharacterImportPage/CampaignImportPage — there's no draft to review
 * here, just a persistent list a player adds to and removes from over the
 * life of a campaign. Mounted on CampaignDetailPage.
 *
 * Phase 10.4 note: this panel calls whatever parser
 * getActiveDocumentParser() (src/lib/directorDocuments/textExtractionParser.ts)
 * currently returns — real extraction as of Phase 10.4 — and distinguishes
 * three real outcomes in its messaging: upload failed (role=alert), upload
 * succeeded and the document is now searchable (a confirmation naming the
 * real filename), and upload succeeded but extraction found no text
 * (role=status, explicitly not styled as an error, since the document is
 * safely stored either way).
 */

import { useEffect, useState } from 'react'
import { Button, Badge, ConfirmDialog } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import {
  uploadDirectorDocument,
  listDirectorDocuments,
  indexDirectorDocument,
  deleteDirectorDocument,
  ServiceError,
} from '@/lib/supabase'
import { getActiveDocumentParser } from '@/lib/directorDocuments/textExtractionParser'
import type { DirectorDocumentMetadata, DirectorDocumentCategory } from '@/lib/directorDocuments/types'
import { SUPPORTED_DIRECTOR_DOCUMENT_TYPES, isSupportedDirectorDocument } from '@/lib/directorDocuments/types'

const CATEGORY_LABEL: Record<DirectorDocumentCategory, string> = {
  dm_guide: 'DM Guide',
  campaign_bible: 'Campaign Bible',
  homebrew_rules: 'Homebrew Rules',
  world_lore: 'World Lore',
  character_notes: 'Character Notes',
  other: 'Other',
}

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL) as DirectorDocumentCategory[]

const MAX_FILE_BYTES = 15 * 1024 * 1024
const ACCEPT_ATTR = '.pdf,.docx,.txt,.md,.markdown,' + SUPPORTED_DIRECTOR_DOCUMENT_TYPES.join(',')

interface DirectorDocumentsPanelProps {
  campaignId: string
  userId: string
}

export function DirectorDocumentsPanel({ campaignId, userId }: DirectorDocumentsPanelProps) {
  const [documents, setDocuments] = useState<DirectorDocumentMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [category, setCategory] = useState<DirectorDocumentCategory>('other')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [justUploaded, setJustUploaded] = useState<string | null>(null)
  /**
   * Distinct from uploadError — the upload itself always succeeds even
   * when extraction fails (a corrupt PDF, a scanned image-only PDF, an
   * empty file). The document is saved either way; this only tells the
   * player their document isn't searchable by the Director yet, which is
   * a real, useful distinction from "the upload failed."
   */
  const [extractionWarning, setExtractionWarning] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<DirectorDocumentMetadata | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setIsLoading(true)
      try {
        const docs = await listDirectorDocuments(campaignId)
        if (mounted) setDocuments(docs)
      } catch (err) {
        if (mounted) setLoadError(err instanceof ServiceError ? err.message : 'Failed to load documents.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [campaignId])

  async function handleFile(file: File) {
    setUploadError(null)
    setJustUploaded(null)
    setExtractionWarning(null)

    if (!isSupportedDirectorDocument(file)) {
      setUploadError('Unsupported file type. Please upload a PDF, DOCX, TXT, or Markdown file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File is too large — please upload a file under 15MB.')
      return
    }

    setIsUploading(true)
    try {
      const doc = await uploadDirectorDocument({ campaignId, userId, category, file })

      // Extraction is a best-effort step AFTER a successful upload — a
      // failure here never undoes the upload. The document is always
      // saved; only its searchability by the Director is at stake.
      const parser = getActiveDocumentParser()
      const extraction = await parser.extractText(file)
      const finalDoc = await indexDirectorDocument(doc.id, extraction.text)

      setDocuments((prev) => [finalDoc, ...prev])
      setJustUploaded(
        finalDoc.isIndexed
          ? `"${finalDoc.fileName}" added and ready — the Director can search it now.`
          : `"${finalDoc.fileName}" added.`,
      )
      window.setTimeout(() => setJustUploaded(null), 3200)

      if (!finalDoc.isIndexed) {
        setExtractionWarning(
          `No readable text could be extracted from "${finalDoc.fileName}" — ` +
          'the Director won\'t be able to search this document yet. This can happen with scanned/' +
          'image-only PDFs, password-protected files, or an empty document. The file itself is safe and stored.',
        )
      }
    } catch (err) {
      setUploadError(err instanceof ServiceError ? err.message : 'Failed to upload document. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    event.target.value = ''
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    try {
      await deleteDirectorDocument(pendingDelete.id, pendingDelete.storagePath)
      setDocuments((prev) => prev.filter((d) => d.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setUploadError(err instanceof ServiceError ? err.message : 'Failed to delete document.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <PixelPanel variant="arcane" className="p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="font-pixel-display text-[9px] text-arcane-400 uppercase">Reference Documents</p>
        {documents.length > 0 && (
          <span className="text-void-500 text-xs">{documents.length} uploaded</span>
        )}
      </div>
      <p className="text-void-400 text-xs mb-4">
        DM guides, campaign bibles, homebrew rules, or world lore — the
        Director can search these during play once they're indexed.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DirectorDocumentCategory)}
          aria-label="Document category"
          className="pixel-border bg-void-900 text-void-200 text-sm px-2 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <label className="flex-1">
          <span className="sr-only">Upload a reference document</span>
          <input
            type="file"
            accept={ACCEPT_ATTR}
            onChange={handleInputChange}
            disabled={isUploading}
            data-testid="director-document-file-input"
            className="block w-full text-xs text-void-400 file:mr-3 file:py-1.5 file:px-3 file:pixel-border file:bg-arcane-900/40 file:text-arcane-300 file:text-xs file:cursor-pointer hover:file:bg-arcane-900/60 disabled:opacity-50"
          />
        </label>
      </div>

      {isUploading && (
        <p className="text-void-400 text-xs mb-3" role="status">Uploading…</p>
      )}
      {justUploaded && !isUploading && (
        <p className="text-arcane-300 text-xs mb-3" role="status">
          ✓ {justUploaded}
        </p>
      )}
      {extractionWarning && !isUploading && (
        <p role="status" className="text-void-400 text-xs mb-3">
          ⚠ {extractionWarning}
        </p>
      )}
      {uploadError && (
        <p role="alert" className="text-harm-400 text-xs mb-3">{uploadError}</p>
      )}

      {isLoading ? (
        <p className="text-void-500 text-xs" role="status">Loading documents…</p>
      ) : loadError ? (
        <p role="alert" className="text-harm-400 text-xs">{loadError}</p>
      ) : documents.length === 0 ? (
        <p className="text-void-600 text-xs italic">No reference documents yet.</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {documents.map((doc) => (
            <li key={doc.id} className="pixel-border bg-void-900/60 p-2.5 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-void-200 text-sm truncate">{doc.fileName}</span>
                  <Badge variant={doc.isIndexed ? 'spirit' : 'neutral'}>
                    {doc.isIndexed ? 'Indexed' : 'Not Indexed'}
                  </Badge>
                </div>
                <span className="text-void-600 text-xs">{CATEGORY_LABEL[doc.category]}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPendingDelete(doc)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this document?"
        description={pendingDelete ? `"${pendingDelete.fileName}" will be permanently removed and the Director will no longer be able to reference it.` : ''}
        confirmLabel="Delete"
        isDestructive
        isLoading={isDeleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </PixelPanel>
  )
}
