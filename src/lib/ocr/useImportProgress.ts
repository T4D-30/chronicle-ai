/**
 * Chronicle AI — Shared OCR/Vision Infrastructure: Progress Stages
 * Phase 11.7
 *
 * A single, shared progress-stage vocabulary for both
 * CharacterImportUpload and CampaignImportUpload — avoids each upload
 * component inventing its own slightly-different set of loading-state
 * strings. The stages here map directly onto the real steps a Vision
 * import actually goes through; none of them are decorative — each one
 * corresponds to a real await boundary in the calling code.
 */

import { useState, useCallback } from 'react'

export type ImportProgressStage =
  | 'idle'
  | 'uploading'
  | 'reading_pages'
  | 'processing'
  | 'extracting'
  | 'building_draft'
  | 'ready'
  | 'error'

export const PROGRESS_STAGE_LABEL: Record<ImportProgressStage, string> = {
  idle: '',
  uploading: 'Uploading…',
  reading_pages: 'Reading pages…',
  processing: 'Processing…',
  extracting: 'Extracting…',
  building_draft: 'Building draft…',
  ready: 'Ready for review',
  error: '',
}

export interface UseImportProgress {
  stage: ImportProgressStage
  label: string
  isActive: boolean
  setStage: (stage: ImportProgressStage) => void
  reset: () => void
}

/**
 * Tiny shared hook wrapping the stage state + derived label — not because
 * the logic is complex, but so both upload components manage this
 * identically and a future third import surface has one obvious place to
 * reuse rather than a third copy invented ad hoc.
 */
export function useImportProgress(): UseImportProgress {
  const [stage, setStage] = useState<ImportProgressStage>('idle')

  const reset = useCallback(() => setStage('idle'), [])

  return {
    stage,
    label: PROGRESS_STAGE_LABEL[stage],
    isActive: stage !== 'idle' && stage !== 'ready' && stage !== 'error',
    setStage,
    reset,
  }
}
