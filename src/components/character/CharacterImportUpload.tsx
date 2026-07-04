/**
 * CharacterImportUpload — Phase 10.1
 *
 * The upload half of the import pipeline. Accepts PDF/PNG/JPG, validates
 * the file client-side against the same SUPPORTED_IMPORT_TYPES the
 * provider layer uses (single source of truth — see lib/import/types.ts),
 * then calls the currently active provider (getActiveImportProvider()) and
 * hands the result to the parent for the review screen to consume.
 *
 * This component never knows or cares whether the active provider does
 * real extraction or is the manual-entry fallback — that's the entire
 * point of the CharacterImportProvider interface.
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import {
  getActiveImportProvider,
  isSupportedImportFile,
  ImportParseError,
  SUPPORTED_IMPORT_TYPES,
} from '@/lib/import'
import type { CharacterImportResult } from '@/lib/import'

// 8MB cap — generous for a scanned character sheet PDF/photo, well below
// typical Supabase/edge-function payload limits should this later be
// routed through a real extraction service.
const MAX_FILE_BYTES = 8 * 1024 * 1024

const ACCEPT_ATTR = SUPPORTED_IMPORT_TYPES.join(',')

interface CharacterImportUploadProps {
  onParsed: (file: File, result: CharacterImportResult) => void
}

export function CharacterImportUpload({ onParsed }: CharacterImportUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)

    if (!isSupportedImportFile(file)) {
      setError(`Unsupported file type. Please upload a PDF, PNG, or JPG.`)
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — please upload a file under 8MB.')
      return
    }

    setIsParsing(true)
    try {
      const provider = getActiveImportProvider()
      const result = await provider.parse(file)
      onParsed(file, result)
    } catch (err) {
      setError(
        err instanceof ImportParseError
          ? err.message
          : 'Could not process that file. Please try again or create your character manually.',
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
        aria-label="Upload a character sheet file — PDF, PNG, or JPG"
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
        <span className="text-3xl" aria-hidden="true">📄</span>
        <p className="font-pixel-display text-[9px] text-arcane-400 uppercase">
          {isParsing ? 'Processing…' : 'Drop a character sheet here'}
        </p>
        <p className="text-void-500 text-xs">or click to browse — PDF, PNG, or JPG</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="import-file-input"
        />
      </div>

      {isParsing && (
        <p className="text-void-400 text-xs mt-3 text-center" role="status">
          Reading your file…
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
