/**
 * Campaign Import — Core Pipeline Tests
 * Phase 10.2
 *
 * Mirrors tests/unit/characterImport.test.ts. Covers the provider-agnostic
 * architecture: file type validation (including the Markdown MIME-sniffing
 * fallback), the manual-entry fallback provider, and the swap point. No
 * document parsing exists to test yet — that's future work.
 */
import { describe, it, expect } from 'vitest'
import {
  isSupportedCampaignImportFile,
  SUPPORTED_CAMPAIGN_IMPORT_TYPES,
  CampaignImportParseError,
} from '@/lib/campaignImport/types'
import {
  ManualCampaignEntryProvider,
  getActiveCampaignImportProvider,
} from '@/lib/campaignImport/manualEntryProvider'

function makeFile(name: string, type: string): File {
  return new File(['dummy content'], name, { type })
}

describe('isSupportedCampaignImportFile', () => {
  it('accepts application/pdf', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.pdf', 'application/pdf'))).toBe(true)
  })

  it('accepts DOCX', () => {
    expect(isSupportedCampaignImportFile(
      makeFile('campaign.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    )).toBe(true)
  })

  it('accepts text/plain', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.txt', 'text/plain'))).toBe(true)
  })

  it('accepts text/markdown', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.md', 'text/markdown'))).toBe(true)
  })

  it('accepts application/json', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.json', 'application/json'))).toBe(true)
  })

  it('accepts a .md file reported as text/plain (common browser MIME-sniffing quirk)', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.md', 'text/plain'))).toBe(true)
  })

  it('accepts a .md file reported with an empty MIME type', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.md', ''))).toBe(true)
  })

  it('accepts a .markdown file reported as text/plain', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.markdown', 'text/plain'))).toBe(true)
  })

  it('accepts any file honestly reporting text/plain, including unusual extensions (text/plain is independently a supported type for real .txt files, not just a markdown fallback)', () => {
    // Note: this is expected, not a gap. A .exe file that genuinely reports
    // itself as text/plain is indistinguishable, at the MIME-type level
    // alone, from a real .txt file — text/plain is directly in
    // SUPPORTED_CAMPAIGN_IMPORT_TYPES for TXT support, independent of the
    // markdown-extension fallback below.
    expect(isSupportedCampaignImportFile(makeFile('campaign.exe', 'text/plain'))).toBe(true)
  })

  it('rejects a file with neither a supported MIME type nor a markdown extension', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.exe', 'application/x-msdownload'))).toBe(false)
  })

  it('rejects an unsupported type', () => {
    expect(isSupportedCampaignImportFile(makeFile('campaign.png', 'image/png'))).toBe(false)
  })

  it('SUPPORTED_CAMPAIGN_IMPORT_TYPES contains exactly PDF, DOCX, TXT, Markdown, JSON', () => {
    expect(SUPPORTED_CAMPAIGN_IMPORT_TYPES).toEqual([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'application/json',
    ])
  })
})

describe('ManualCampaignEntryProvider', () => {
  it('has supportsExtraction: false — honest about doing no real parsing', () => {
    expect(ManualCampaignEntryProvider.supportsExtraction).toBe(false)
  })

  it('resolves successfully for a supported file type', async () => {
    const result = await ManualCampaignEntryProvider.parse(makeFile('campaign.pdf', 'application/pdf'))
    expect(result.providerName).toBe('Manual Entry')
  })

  it('throws CampaignImportParseError for an unsupported file type', async () => {
    await expect(
      ManualCampaignEntryProvider.parse(makeFile('campaign.png', 'image/png')),
    ).rejects.toThrow(CampaignImportParseError)
  })

  it('returns overallConfidence: needs-review — never claims false confidence', async () => {
    const result = await ManualCampaignEntryProvider.parse(makeFile('campaign.pdf', 'application/pdf'))
    expect(result.overallConfidence).toBe('needs-review')
  })

  it('does not populate any structured field — no fake data', async () => {
    const result = await ManualCampaignEntryProvider.parse(makeFile('campaign.pdf', 'application/pdf'))
    expect(result.title).toBeUndefined()
    expect(result.premise).toBeUndefined()
    expect(result.tone).toBeUndefined()
    expect(result.difficulty).toBeUndefined()
    expect(result.directorNotes).toBeUndefined()
  })

  it('includes an honest note that extraction did not happen', async () => {
    const result = await ManualCampaignEntryProvider.parse(makeFile('my-campaign.pdf', 'application/pdf'))
    expect(result.unstructuredNotes?.[0]).toContain('my-campaign.pdf')
    expect(result.unstructuredNotes?.[0]).toContain('not available yet')
  })

  it('accepts a JSON campaign file without attempting to parse its contents', async () => {
    const result = await ManualCampaignEntryProvider.parse(makeFile('campaign.json', 'application/json'))
    expect(result.providerName).toBe('Manual Entry')
    expect(result.title).toBeUndefined()
  })
})

describe('getActiveCampaignImportProvider — the future swap point', () => {
  it('currently returns ManualCampaignEntryProvider', () => {
    expect(getActiveCampaignImportProvider()).toBe(ManualCampaignEntryProvider)
  })

  it('returns an object conforming to the CampaignImportProvider contract', () => {
    const provider = getActiveCampaignImportProvider()
    expect(typeof provider.name).toBe('string')
    expect(typeof provider.supportsExtraction).toBe('boolean')
    expect(typeof provider.parse).toBe('function')
  })
})
