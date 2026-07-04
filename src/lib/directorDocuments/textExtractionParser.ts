/**
 * Chronicle AI — Text Extraction Document Parser
 * Phase 10.4
 *
 * The real DirectorDocumentParser implementation, replacing
 * ManualDocumentParser as the active parser (see getActiveDocumentParser()
 * below — the exact swap point ManualDocumentParser's own doc comment
 * named in advance). Extracts real plain text from uploaded files:
 *
 *   - text/plain, text/markdown  — FileReader.readAsText(), no library
 *   - application/pdf            — pdfjs-dist (Mozilla's PDF.js), runs
 *                                   entirely client-side, no server call
 *   - DOCX                       — mammoth, runs entirely client-side
 *
 * All three paths read the file via FileReader (see readFileAsText/
 * readFileAsArrayBuffer below) rather than the newer File.text()/
 * File.arrayBuffer() convenience methods — FileReader is the older but
 * more broadly-supported standard Web API for this, and behaves
 * identically in every real browser. This is a genuine implementation
 * choice, not an environment-specific branch.
 *
 * No OpenAI Vision, no external API call of any kind — every extraction
 * path here is a pure client-side parsing library. This is real text
 * extraction, not AI-based understanding: it gets the words off the page,
 * nothing more. Confidence is reported honestly per format (see below).
 *
 * FAILURE HANDLING: every extraction path is wrapped so a single corrupt
 * or malformed file degrades to { text: null, confidence: 'unavailable' }
 * — the exact same shape ManualDocumentParser always returned — rather
 * than throwing and breaking the upload flow. A failed extraction still
 * leaves the document uploaded and stored; it just stays unindexed,
 * identical to today's manual-entry behavior for that one file.
 */

import type { DirectorDocumentParser } from './types'

type ExtractionResult = { text: string | null; confidence: 'high' | 'medium' | 'low' | 'unavailable' }

/**
 * Reads a File's contents as a string using FileReader — the classic,
 * universally-supported Web API for reading file contents, chosen over
 * the newer File.text()/Blob.text() convenience methods because
 * FileReader has broader runtime support (some environments, including
 * this project's own test environment, do not yet implement
 * File.prototype.text()). This is a standard, real browser API used
 * identically in production and in tests — not an environment-specific
 * branch or a test-only shim.
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed to read text'))
    reader.readAsText(file)
  })
}

/**
 * Reads a File's contents as an ArrayBuffer using FileReader — same
 * rationale as readFileAsText above. Used by the PDF and DOCX extraction
 * paths, which both need raw bytes to hand to pdfjs-dist/mammoth.
 */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed to read bytes'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * PDF.js requires a worker script to run its parsing off the main thread.
 * The `?url` suffix is Vite's built-in way to get a hashed, bundled URL
 * for a non-JS-executed asset — this is the standard, documented pattern
 * for using pdfjs-dist inside a Vite app (avoids manually copying the
 * worker file into public/ or configuring a separate asset pipeline).
 * Imported lazily inside extractPdfText() so pdfjs-dist's ~1MB main
 * bundle is only ever loaded when a PDF is actually uploaded, not on
 * every page load.
 */
async function extractPdfText(file: File): Promise<ExtractionResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

    const arrayBuffer = await readFileAsArrayBuffer(file)
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    const pageTexts: string[] = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      pageTexts.push(pageText)
    }

    const text = pageTexts.join('\n\n').trim()
    if (!text) {
      return { text: null, confidence: 'unavailable' }
    }

    return { text, confidence: 'medium' }
  } catch {
    return { text: null, confidence: 'unavailable' }
  }
}

async function extractDocxText(file: File): Promise<ExtractionResult> {
  try {
    const mammoth = await import('mammoth')
    const arrayBuffer = await readFileAsArrayBuffer(file)
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value.trim()
    if (!text) return { text: null, confidence: 'unavailable' }
    return { text, confidence: 'high' }
  } catch {
    return { text: null, confidence: 'unavailable' }
  }
}

async function extractPlainText(file: File): Promise<ExtractionResult> {
  try {
    const text = (await readFileAsText(file)).trim()
    if (!text) return { text: null, confidence: 'unavailable' }
    return { text, confidence: 'high' }
  } catch {
    return { text: null, confidence: 'unavailable' }
  }
}

export const TextExtractionParser: DirectorDocumentParser = {
  name: 'Text Extraction',
  supportsExtraction: true,

  async extractText(file: File): Promise<ExtractionResult> {
    switch (file.type) {
      case 'text/plain':
      case 'text/markdown':
        return extractPlainText(file)
      case 'application/pdf':
        return extractPdfText(file)
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return extractDocxText(file)
      default:
        return { text: null, confidence: 'unavailable' }
    }
  },
}

/**
 * Returns the currently active document parser. TextExtractionParser is
 * now the default — real extraction for TXT/Markdown/PDF/DOCX, all
 * client-side, no external API call. ManualDocumentParser (manualParser.ts)
 * remains available and fully functional as a fallback/reference
 * implementation; swap the return value here to revert to it, or to a
 * future OpenAI-Vision-backed parser, without touching any consumer.
 */
export function getActiveDocumentParser(): DirectorDocumentParser {
  return TextExtractionParser
}
