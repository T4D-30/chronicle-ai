/**
 * CampaignImportUpload — Phase 10.2
 *
 * Mirrors CharacterImportUpload (Phase 10.1) exactly in structure. Accepts
 * PDF/DOCX/TXT/MD/JSON, validates client-side against the same
 * SUPPORTED_CAMPAIGN_IMPORT_TYPES the provider layer uses, then calls the
 * currently active provider (getActiveCampaignImportProvider()) and hands
 * the result to the parent for the review screen to consume.
 *
 * This component never knows or cares whether the active provider does
 * real extraction or is the manual-entry fallback.
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import {
  getActiveCampaignImportProvider,
  isSupportedCampaignImportFile,
  CampaignImportParseError,
} from '@/lib/campaignImport'
import type { CampaignImportResult } from '@/lib/campaignImport'

// 15MB cap — campaign bibles/adventure modules run larger than a single
// character sheet; still well below typical payload limits for a future
// server-side extraction pass.
const MAX_FILE_BYTES = 15 * 1024 * 1024

// Explicit accept list rather than SUPPORTED_CAMPAIGN_IMPORT_TYPES.join(',')
// — the markdown MIME-sniffing fallback (isSupportedCampaignImportFile)
// means the accept attribute alone can't fully express what's allowed
// (browsers report .md inconsistently), so this lists file extensions too,
// which most browsers also honor in the native picker.
const ACCEPT_ATTR = '.pdf,.docx,.txt,.md,.markdown,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json'

interface CampaignImportUploadProps {
  onParsed: (file: File, result: CampaignImportResult) => void
}

export function CampaignImportUpload({ onParsed }: CampaignImportUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /**
   * Distinct from isParsing — set the instant a file passes client-side
   * validation, before the (currently synchronous, but architecturally
   * async) provider call even starts. Lets the upload zone give immediate
   * "got it" feedback rather than only showing progress once real work
   * begins — a real UX improvement (Priority 3, "better upload progress")
   * without needing actual granular progress events, which no provider
   * (including a future real one) is guaranteed to emit.
   */
  const [acceptedFileName, setAcceptedFileName] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setAcceptedFileName(null)

    if (!isSupportedCampaignImportFile(file)) {
      setError('Unsupported file type. Please upload a PDF, DOCX, TXT, Markdown, or JSON file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — please upload a file under 15MB.')
      return
    }

    setAcceptedFileName(file.name)
    setIsParsing(true)
    try {
      const provider = getActiveCampaignImportProvider()
      const result = await provider.parse(file)
      onParsed(file, result)
    } catch (err) {
      setAcceptedFileName(null)
      setError(
        err instanceof CampaignImportParseError
          ? err.message
          : 'Could not process that file. Please try again or create your campaign manually.',
      )
    } finally {
      setIsParsing(false)
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    event.target.value = '' // allow re-selecting the same file after an error
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  return (
    <PixelPanel variant="arcane" className="p-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a campaign document — PDF, DOCX, TXT, Markdown, or JSON"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={[
          'pixel-border flex flex-col items-center justify-center gap-3 py-10 px-6 text-center cursor-pointer transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400',
          isDragging ? 'bg-arcane-900/30 border-arcane-500' : 'bg-void-900 border-void-700/50 hover:border-arcane-700',
        ].join(' ')}
      >
        <span className="text-3xl" aria-hidden="true">📖</span>
        <p className="font-pixel-display text-[9px] text-arcane-400 uppercase">
          {isParsing ? 'Processing…' : 'Drop a campaign document here'}
        </p>
        <p className="text-void-500 text-xs">or click to browse — PDF, DOCX, TXT, Markdown, or JSON</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="campaign-import-file-input"
        />
      </div>

      {acceptedFileName && isParsing && (
        <p className="text-arcane-300 text-xs mt-3 text-center" role="status">
          ✓ "{acceptedFileName}" received — reading…
        </p>
      )}

      {error && (
        <p role="alert" className="text-harm-400 text-sm mt-3">
          {error}
        </p>
      )}

      <div className="flex justify-center mt-4">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
          Choose File
        </Button>
      </div>
    </PixelPanel>
  )
}
