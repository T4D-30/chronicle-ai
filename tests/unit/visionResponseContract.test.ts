/**
 * visionResponseContract Tests — Phase 11.2 / 11.3
 *
 * Direct, real tests of the exact logic the vision-extract Edge Function
 * runs to validate and merge OpenAI's raw JSON response. This module was
 * specifically extracted from the Edge Function (which cannot be
 * imported into Vitest — Deno-only, esm.sh imports, confirmed
 * unreachable) so this logic could be tested for real rather than only
 * approximated or skipped. See the module's own header and the Edge
 * Function's header for the full rationale.
 */
import { describe, it, expect } from 'vitest'
import {
  isValidConfidence,
  sanitizePageResult,
  mergePageResults,
} from '@/lib/ocr/visionResponseContract'

describe('isValidConfidence', () => {
  it('accepts all four real confidence values', () => {
    expect(isValidConfidence('high')).toBe(true)
    expect(isValidConfidence('medium')).toBe(true)
    expect(isValidConfidence('low')).toBe(true)
    expect(isValidConfidence('needs-review')).toBe(true)
  })

  it('rejects a value OpenAI might plausibly but incorrectly return', () => {
    expect(isValidConfidence('certain')).toBe(false)
    expect(isValidConfidence('unsure')).toBe(false)
    expect(isValidConfidence('HIGH')).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(isValidConfidence(1)).toBe(false)
    expect(isValidConfidence(null)).toBe(false)
    expect(isValidConfidence(undefined)).toBe(false)
    expect(isValidConfidence({})).toBe(false)
  })
})

describe('sanitizePageResult — well-formed model output', () => {
  it('extracts real fields with valid confidence', () => {
    const raw = {
      fields: { name: { value: 'Aldric Sorn', confidence: 'high', sourceText: 'Name: Aldric Sorn' } },
      unstructuredNotes: [],
      overallConfidence: 'high',
    }
    const result = sanitizePageResult(raw)
    expect(result?.fields.name).toEqual({ value: 'Aldric Sorn', confidence: 'high', sourceText: 'Name: Aldric Sorn' })
  })

  it('extracts multiple fields correctly', () => {
    const raw = {
      fields: {
        name: { value: 'Aldric Sorn', confidence: 'high' },
        level: { value: 5, confidence: 'medium' },
      },
      unstructuredNotes: [],
      overallConfidence: 'medium',
    }
    const result = sanitizePageResult(raw)
    expect(Object.keys(result?.fields ?? {})).toEqual(['name', 'level'])
  })

  it('omits sourceText when not provided by the model', () => {
    const raw = { fields: { name: { value: 'Aldric Sorn', confidence: 'high' } }, unstructuredNotes: [], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.fields.name).not.toHaveProperty('sourceText')
  })

  it('preserves unstructuredNotes verbatim', () => {
    const raw = { fields: {}, unstructuredNotes: ['Spells: Fireball, Shield'], overallConfidence: 'needs-review' }
    const result = sanitizePageResult(raw)
    expect(result?.notes).toEqual(['Spells: Fireball, Shield'])
  })

  it('extracts the overallConfidence', () => {
    const raw = { fields: {}, unstructuredNotes: [], overallConfidence: 'low' }
    const result = sanitizePageResult(raw)
    expect(result?.confidence).toBe('low')
  })
})

describe('sanitizePageResult — malformed/adversarial model output (never trust the model blindly)', () => {
  it('returns null for a non-object payload', () => {
    expect(sanitizePageResult('not an object')).toBeNull()
    expect(sanitizePageResult(42)).toBeNull()
    expect(sanitizePageResult(null)).toBeNull()
  })

  it('drops a field with an invalid confidence value rather than accepting a lie about certainty', () => {
    const raw = { fields: { name: { value: 'Aldric Sorn', confidence: 'super-duper-sure' } }, unstructuredNotes: [], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.fields).not.toHaveProperty('name')
  })

  it('drops a field missing the value key entirely', () => {
    const raw = { fields: { name: { confidence: 'high' } }, unstructuredNotes: [], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.fields).not.toHaveProperty('name')
  })

  it('drops a field that is not an object at all', () => {
    const raw = { fields: { name: 'just a string, not a field object' }, unstructuredNotes: [], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.fields).not.toHaveProperty('name')
  })

  it('keeps valid fields even when a sibling field is malformed — one bad field does not poison the whole page', () => {
    const raw = {
      fields: {
        name: { value: 'Aldric Sorn', confidence: 'high' },
        level: { confidence: 'high' },
      },
      unstructuredNotes: [],
      overallConfidence: 'high',
    }
    const result = sanitizePageResult(raw)
    expect(result?.fields.name).toBeDefined()
    expect(result?.fields.level).toBeUndefined()
  })

  it('treats a missing fields object as no fields, not a crash', () => {
    const raw = { unstructuredNotes: [], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.fields).toEqual({})
  })

  it('filters out non-string entries from unstructuredNotes', () => {
    const raw = { fields: {}, unstructuredNotes: ['real note', 42, null, 'another real note'], overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.notes).toEqual(['real note', 'another real note'])
  })

  it('treats a non-array unstructuredNotes as an empty array', () => {
    const raw = { fields: {}, unstructuredNotes: 'not an array', overallConfidence: 'high' }
    const result = sanitizePageResult(raw)
    expect(result?.notes).toEqual([])
  })

  it('falls back to "needs-review" for an invalid overallConfidence, rather than a false claim', () => {
    const raw = { fields: {}, unstructuredNotes: [], overallConfidence: 'extremely confident' }
    const result = sanitizePageResult(raw)
    expect(result?.confidence).toBe('needs-review')
  })

  it('falls back to "needs-review" when overallConfidence is missing entirely', () => {
    const raw = { fields: {}, unstructuredNotes: [] }
    const result = sanitizePageResult(raw)
    expect(result?.confidence).toBe('needs-review')
  })
})

describe('mergePageResults — single page', () => {
  it('passes through one page\'s fields and confidence directly', () => {
    const result = mergePageResults(
      [{ fields: { name: { value: 'Aldric Sorn', confidence: 'high' } }, notes: [], confidence: 'high' }],
      0,
    )
    expect(result.fields.name.value).toBe('Aldric Sorn')
    expect(result.overallConfidence).toBe('high')
  })

  it('reports pagesProcessed and pagesFailed accurately', () => {
    const result = mergePageResults(
      [{ fields: {}, notes: [], confidence: 'high' }],
      0,
    )
    expect(result.pagesProcessed).toBe(1)
    expect(result.pagesFailed).toBe(0)
  })
})

describe('mergePageResults — multi-page documents', () => {
  it('merges fields from multiple pages into one flat object', () => {
    const result = mergePageResults(
      [
        { fields: { title: { value: 'The Shattered Throne', confidence: 'high' } }, notes: [], confidence: 'high' },
        { fields: { premise: { value: 'A kingdom in turmoil.', confidence: 'medium' } }, notes: [], confidence: 'medium' },
      ],
      0,
    )
    expect(result.fields.title.value).toBe('The Shattered Throne')
    expect(result.fields.premise.value).toBe('A kingdom in turmoil.')
  })

  it('later pages win on a field-key collision (last-write-wins, not reconciliation)', () => {
    const result = mergePageResults(
      [
        { fields: { title: { value: 'Draft Title', confidence: 'low' } }, notes: [], confidence: 'low' },
        { fields: { title: { value: 'Final Title', confidence: 'high' } }, notes: [], confidence: 'high' },
      ],
      0,
    )
    expect(result.fields.title.value).toBe('Final Title')
  })

  it('concatenates unstructuredNotes across all pages, in page order', () => {
    const result = mergePageResults(
      [
        { fields: {}, notes: ['Page 1 note'], confidence: 'high' },
        { fields: {}, notes: ['Page 2 note'], confidence: 'high' },
      ],
      0,
    )
    expect(result.unstructuredNotes).toEqual(['Page 1 note', 'Page 2 note'])
  })

  it('reports overallConfidence as the WORST confidence across all pages, not an average or the first/last page', () => {
    const result = mergePageResults(
      [
        { fields: {}, notes: [], confidence: 'high' },
        { fields: {}, notes: [], confidence: 'low' },
        { fields: {}, notes: [], confidence: 'high' },
      ],
      0,
    )
    expect(result.overallConfidence).toBe('low')
  })

  it('treats "needs-review" as worse than "low" in the confidence ordering', () => {
    const result = mergePageResults(
      [
        { fields: {}, notes: [], confidence: 'low' },
        { fields: {}, notes: [], confidence: 'needs-review' },
      ],
      0,
    )
    expect(result.overallConfidence).toBe('needs-review')
  })

  it('reports pagesProcessed matching the number of successfully sanitized pages', () => {
    const result = mergePageResults(
      [
        { fields: {}, notes: [], confidence: 'high' },
        { fields: {}, notes: [], confidence: 'high' },
        { fields: {}, notes: [], confidence: 'high' },
      ],
      2,
    )
    expect(result.pagesProcessed).toBe(3)
    expect(result.pagesFailed).toBe(2)
  })
})

describe('mergePageResults — zero successful pages (every page failed)', () => {
  it('returns overallConfidence "needs-review" when no pages succeeded', () => {
    const result = mergePageResults([], 3)
    expect(result.overallConfidence).toBe('needs-review')
  })

  it('returns empty fields and notes', () => {
    const result = mergePageResults([], 3)
    expect(result.fields).toEqual({})
    expect(result.unstructuredNotes).toEqual([])
  })

  it('reports pagesProcessed: 0 and the correct pagesFailed count', () => {
    const result = mergePageResults([], 3)
    expect(result.pagesProcessed).toBe(0)
    expect(result.pagesFailed).toBe(3)
  })
})
