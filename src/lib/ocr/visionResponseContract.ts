/**
 * Chronicle AI — Vision Extraction Response Contract
 * Phase 11.2 / 11.3
 *
 * Pure functions for validating and merging the raw JSON OpenAI returns
 * into the real VisionExtractionResponse shape. Extracted into this
 * standalone module — rather than living inline in
 * supabase/functions/vision-extract/index.ts, where every other Edge
 * Function in this project (narrate) keeps its logic — for exactly one
 * reason: Deno Edge Functions cannot be imported into Vitest at all (they
 * use esm.sh URL imports and the global Deno namespace, neither of which
 * exist under Node/Vitest — confirmed unreachable by every prior phase
 * that touched narrate/index.ts). This logic has zero Deno-specific or
 * Node-specific dependency — it's plain, pure TypeScript — so it CAN live
 * in a file both the Edge Function (via a relative import) and this
 * project's real test suite (via the normal @/ alias) both import
 * unmodified. This is the FIRST Edge Function in this project split this
 * way; narrate/index.ts is intentionally NOT touched or refactored to
 * match — this pattern was applied only to new code with no working
 * precedent to disturb.
 *
 * The Edge Function (supabase/functions/vision-extract/index.ts) imports
 * this file via a relative path
 * (../../../src/lib/ocr/visionResponseContract.ts) — Deno's module
 * resolution supports plain relative TypeScript imports natively, no
 * bundler needed, unlike the esm.sh CDN imports used for npm packages
 * (@supabase/supabase-js, openai) that don't publish Deno-compatible
 * builds.
 */

export type FieldConfidence = 'high' | 'medium' | 'low' | 'needs-review'

export interface VisionExtractedField {
  value: unknown
  confidence: FieldConfidence
  sourceText?: string
}

export interface SanitizedPageResult {
  fields: Record<string, VisionExtractedField>
  notes: string[]
  confidence: FieldConfidence
}

export interface VisionExtractResponse {
  fields: Record<string, VisionExtractedField>
  unstructuredNotes: string[]
  overallConfidence: FieldConfidence
  pagesProcessed: number
  pagesFailed: number
}

const VALID_CONFIDENCE: readonly string[] = ['high', 'medium', 'low', 'needs-review']

export function isValidConfidence(value: unknown): value is FieldConfidence {
  return typeof value === 'string' && VALID_CONFIDENCE.includes(value)
}

/**
 * Validates and sanitizes one page's raw model output into the real
 * VisionExtractedField shape — never trusts the model's JSON blindly. An
 * individual field with a malformed confidence value (or missing
 * `value`) is dropped — better to omit a field than accept a lie about
 * how confident the model actually was — not the whole page.
 */
export function sanitizePageResult(raw: unknown): SanitizedPageResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  const fields: Record<string, VisionExtractedField> = {}
  if (typeof obj.fields === 'object' && obj.fields !== null) {
    for (const [key, rawField] of Object.entries(obj.fields as Record<string, unknown>)) {
      if (typeof rawField !== 'object' || rawField === null) continue
      const f = rawField as Record<string, unknown>
      if (!('value' in f) || !isValidConfidence(f.confidence)) continue
      fields[key] = {
        value: f.value,
        confidence: f.confidence,
        ...(typeof f.sourceText === 'string' ? { sourceText: f.sourceText } : {}),
      }
    }
  }

  const notes = Array.isArray(obj.unstructuredNotes)
    ? obj.unstructuredNotes.filter((n): n is string => typeof n === 'string')
    : []

  const confidence = isValidConfidence(obj.overallConfidence) ? obj.overallConfidence : 'needs-review'

  return { fields, notes, confidence }
}

/**
 * Merges per-page sanitized results into one response. Later pages'
 * fields win on key collision — a multi-page character sheet is unusual,
 * but a multi-page campaign document legitimately has different info per
 * page; simple last-write-wins is honest and predictable, not an attempt
 * at cross-page reconciliation the model itself didn't do.
 */
export function mergePageResults(
  pageResults: SanitizedPageResult[],
  pagesFailed: number,
): VisionExtractResponse {
  const fields: Record<string, VisionExtractedField> = {}
  const notes: string[] = []
  const confidenceOrder: FieldConfidence[] = ['needs-review', 'low', 'medium', 'high']
  let worstConfidence: FieldConfidence = 'high'

  for (const page of pageResults) {
    Object.assign(fields, page.fields)
    notes.push(...page.notes)
    if (confidenceOrder.indexOf(page.confidence) < confidenceOrder.indexOf(worstConfidence)) {
      worstConfidence = page.confidence
    }
  }

  return {
    fields,
    unstructuredNotes: notes,
    overallConfidence: pageResults.length === 0 ? 'needs-review' : worstConfidence,
    pagesProcessed: pageResults.length,
    pagesFailed,
  }
}
