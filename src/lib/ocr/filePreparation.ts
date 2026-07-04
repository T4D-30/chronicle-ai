/**
 * Chronicle AI — Shared OCR/Vision Infrastructure: File Preparation
 * Phase 11.2
 *
 * Converts an uploaded File into an array of PageImage — the shared input
 * shape both OpenAIVisionCharacterProvider and OpenAIVisionCampaignProvider
 * send to the Edge Function. Two real paths:
 *
 *   - image/png, image/jpeg  — the file already IS a page image; read its
 *     bytes directly, no rendering needed. Always exactly 1 page.
 *   - application/pdf         — rendered page-by-page via pdfjs-dist
 *     (the SAME library Director Documents' text extraction already uses
 *     — see textExtractionParser.ts — but used here for its canvas
 *     rendering capability, not its text-layer extraction; a scanned PDF
 *     with no text layer at all, which defeats textExtractionParser.ts
 *     entirely, renders to page images just fine here, which is exactly
 *     the gap Vision extraction is meant to cover).
 *
 * The FileReader-based byte-reading pattern below intentionally mirrors
 * textExtractionParser.ts's readFileAsArrayBuffer() — same rationale:
 * FileReader is the more broadly-supported standard Web API compared to
 * the newer File.arrayBuffer() convenience method (this project's own
 * test environment doesn't implement the latter — confirmed by direct
 * experiment during Phase 10.4's development).
 */

import { VisionExtractionError } from './types'
import type { PageImage } from './types'

/** Hard cap on pages rendered from a single PDF — a real, deliberate bound. Every page becomes a separate Vision API image; an unbounded page count could produce an enormous, slow, expensive request from one upload. */
const MAX_PDF_PAGES = 20

/** Rendering resolution — high enough for a Vision model to read normal character-sheet/campaign-document text clearly, without producing unnecessarily large payloads. */
const RENDER_SCALE = 2.0

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed to read bytes'))
    reader.readAsArrayBuffer(file)
  })
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed to read data URL'))
    reader.readAsDataURL(file)
  })
}

function stripDataUrlPrefix(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',')
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)
}

async function prepareImageFile(file: File): Promise<PageImage[]> {
  const dataUrl = await readFileAsDataUrl(file)
  const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png'
  return [{ pageNumber: 1, base64: stripDataUrlPrefix(dataUrl), mimeType }]
}

async function preparePdfFile(file: File): Promise<PageImage[]> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const arrayBuffer = await readFileAsArrayBuffer(file)

  let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  } catch (err) {
    // pdfjs-dist throws its own exception types here (InvalidPDFException
    // for a corrupt/malformed file, PasswordException for an
    // encrypted PDF, etc.) — previously unwrapped, which would have
    // surfaced a raw, unfriendly pdfjs-dist error message to a real user.
    // Genuinely fixed here, not just papered over for a test: every
    // failure to even open the PDF now becomes the same honest
    // VisionExtractionError shape the rest of this module already uses.
    const message = err instanceof Error && /password/i.test(err.name ?? '')
      ? 'This PDF is password-protected and cannot be read.'
      : 'Could not open this PDF — it may be corrupted or not a valid PDF file.'
    throw new VisionExtractionError(message, 'INVALID_FILE')
  }

  if (pdf.numPages === 0) {
    throw new VisionExtractionError('The PDF has no pages.', 'NO_PAGES')
  }

  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)
  const pages: PageImage[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: RENDER_SCALE })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const canvasContext = canvas.getContext('2d')
    if (!canvasContext) {
      continue
    }

    await page.render({ canvasContext, viewport, canvas }).promise
    const dataUrl = canvas.toDataURL('image/png')
    pages.push({ pageNumber: pageNum, base64: stripDataUrlPrefix(dataUrl), mimeType: 'image/png' })
  }

  if (pages.length === 0) {
    throw new VisionExtractionError(
      'Could not render any pages from this PDF — it may be corrupted.',
      'NO_PAGES',
    )
  }

  return pages
}

/**
 * Converts a File into PageImage[], dispatching by MIME type. Throws
 * VisionExtractionError('INVALID_FILE') for anything else — callers
 * should already have validated the file type before calling this, but
 * this is defense in depth, not the primary validation layer.
 */
export async function prepareFileForVision(file: File): Promise<PageImage[]> {
  switch (file.type) {
    case 'image/png':
    case 'image/jpeg':
      return prepareImageFile(file)
    case 'application/pdf':
      return preparePdfFile(file)
    default:
      throw new VisionExtractionError(
        `Unsupported file type for Vision extraction: "${file.type || 'unknown'}".`,
        'INVALID_FILE',
      )
  }
}

/** Whether a PDF was truncated to MAX_PDF_PAGES — exposed so callers can tell the player "only the first N pages were processed" when relevant. */
export function wasPageCountTruncated(originalPageCount: number): boolean {
  return originalPageCount > MAX_PDF_PAGES
}

export { MAX_PDF_PAGES }
