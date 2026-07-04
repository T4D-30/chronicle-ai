/**
 * DirectorDocumentsPanel Tests — Phase 10.3
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const uploadDirectorDocumentMock = vi.fn()
const listDirectorDocumentsMock = vi.fn()
const indexDirectorDocumentMock = vi.fn()
const deleteDirectorDocumentMock = vi.fn()

vi.mock('@/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase')>('@/lib/supabase')
  return {
    ...actual,
    uploadDirectorDocument: (...args: unknown[]) => uploadDirectorDocumentMock(...args),
    listDirectorDocuments: (...args: unknown[]) => listDirectorDocumentsMock(...args),
    indexDirectorDocument: (...args: unknown[]) => indexDirectorDocumentMock(...args),
    deleteDirectorDocument: (...args: unknown[]) => deleteDirectorDocumentMock(...args),
  }
})

// Phase 10.4 — the panel now calls the REAL TextExtractionParser by
// default. These are component tests for the panel's own upload/list/
// delete orchestration, not for text extraction itself (that's covered
// directly in tests/unit/textExtractionParser.test.ts) — mocking the
// parser here keeps these tests fast, deterministic, and free of
// pdfjs-dist/mammoth actually running against fake file bytes.
const extractTextMock = vi.fn().mockResolvedValue({ text: null, confidence: 'unavailable' })
vi.mock('@/lib/directorDocuments/textExtractionParser', () => ({
  getActiveDocumentParser: () => ({ name: 'Mock Parser', supportsExtraction: true, extractText: extractTextMock }),
}))

import { DirectorDocumentsPanel } from '@/components/campaign/DirectorDocumentsPanel'

function makeFile(name: string, type: string): File {
  return new File([new Uint8Array(100)], name, { type })
}

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1', campaignId: 'camp-1', userId: 'user-1', category: 'world_lore' as const,
    fileName: 'lore.pdf', fileType: 'application/pdf' as const, fileSizeBytes: 1000,
    storagePath: 'user-1/doc-1', isIndexed: false, uploadedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  uploadDirectorDocumentMock.mockReset()
  listDirectorDocumentsMock.mockReset()
  indexDirectorDocumentMock.mockReset()
  deleteDirectorDocumentMock.mockReset()
  extractTextMock.mockReset()
  listDirectorDocumentsMock.mockResolvedValue([])
  extractTextMock.mockResolvedValue({ text: null, confidence: 'unavailable' })
})

describe('DirectorDocumentsPanel — loading and empty state', () => {
  it('shows a loading indicator while fetching', () => {
    listDirectorDocumentsMock.mockReturnValue(new Promise(() => {}))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    expect(screen.getByText(/Loading documents/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no documents', async () => {
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())
  })

  it('shows a load error if listDirectorDocuments fails', async () => {
    const { ServiceError } = await import('@/lib/supabase')
    listDirectorDocumentsMock.mockRejectedValue(new ServiceError('Network down.', 'DB_ERROR'))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('Network down.')).toBeInTheDocument())
  })
})

describe('DirectorDocumentsPanel — listing', () => {
  it('renders each fetched document', async () => {
    listDirectorDocumentsMock.mockResolvedValue([
      makeDoc({ id: 'd1', fileName: 'guide.pdf' }),
      makeDoc({ id: 'd2', fileName: 'rules.txt', category: 'homebrew_rules' }),
    ])
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('guide.pdf')).toBeInTheDocument())
    expect(screen.getByText('rules.txt')).toBeInTheDocument()
  })

  it('shows "Indexed" badge for an indexed document, "Not Indexed" for one that is not', async () => {
    listDirectorDocumentsMock.mockResolvedValue([
      makeDoc({ id: 'd1', fileName: 'indexed.pdf', isIndexed: true }),
      makeDoc({ id: 'd2', fileName: 'raw.pdf', isIndexed: false }),
    ])
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('indexed.pdf')).toBeInTheDocument())
    expect(screen.getByText('Indexed')).toBeInTheDocument()
    expect(screen.getByText('Not Indexed')).toBeInTheDocument()
  })

  it('shows the document count', async () => {
    listDirectorDocumentsMock.mockResolvedValue([makeDoc(), makeDoc({ id: 'd2' })])
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('2 uploaded')).toBeInTheDocument())
  })
})

describe('DirectorDocumentsPanel — upload', () => {
  it('uploads a file, calls the active parser to extract text, and indexes the result', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: false }))
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: null, confidence: 'unavailable' })
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('new-doc.pdf', 'application/pdf'))

    await waitFor(() => expect(uploadDirectorDocumentMock).toHaveBeenCalledOnce())
    expect(extractTextMock).toHaveBeenCalledOnce()
    expect(indexDirectorDocumentMock).toHaveBeenCalledWith('doc-1', null)
  })

  it('indexes the document with the real extracted text when extraction succeeds', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: 'The dragon sleeps beneath the mountain.', confidence: 'high' })
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: true }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('lore.txt', 'text/plain'))

    await waitFor(() => expect(indexDirectorDocumentMock).toHaveBeenCalledWith('doc-1', 'The dragon sleeps beneath the mountain.'))
  })

  it('confirms the document is searchable when extraction succeeds (distinct message from the generic "added")', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'lore.txt', isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: 'Real text.', confidence: 'high' })
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'lore.txt', isIndexed: true }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('lore.txt', 'text/plain'))

    expect(await screen.findByText(/lore\.txt.*added and ready.*Director can search it now/i)).toBeInTheDocument()
  })

  it('shows only the generic "added" confirmation (no "ready to search" claim) when extraction does not succeed', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'scanned.pdf', isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: null, confidence: 'unavailable' })
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'scanned.pdf', isIndexed: false }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('scanned.pdf', 'application/pdf'))

    expect(await screen.findByText(/scanned\.pdf.*added/i)).toBeInTheDocument()
    expect(screen.queryByText(/ready.*Director can search it now/i)).not.toBeInTheDocument()
  })

  it('shows an extraction warning (not an error) when extraction yields no text', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'scanned.pdf', isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: null, confidence: 'unavailable' })
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'scanned.pdf', isIndexed: false }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('scanned.pdf', 'application/pdf'))

    expect(await screen.findByText(/no readable text could be extracted/i)).toBeInTheDocument()
    // This is a warning (role=status), never an alert/error — the upload
    // itself succeeded.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show an extraction warning when extraction succeeds', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: false }))
    extractTextMock.mockResolvedValue({ text: 'Real extracted text.', confidence: 'high' })
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: true }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('good.txt', 'text/plain'))

    await waitFor(() => expect(uploadDirectorDocumentMock).toHaveBeenCalledOnce())
    expect(screen.queryByText(/no readable text could be extracted/i)).not.toBeInTheDocument()
  })

  it('a parser throwing does not crash the upload flow — surfaces as a normal upload error', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ isIndexed: false }))
    extractTextMock.mockRejectedValue(new Error('unexpected parser crash'))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('bad.pdf', 'application/pdf'))

    expect(await screen.findByText(/Failed to upload document/i)).toBeInTheDocument()
  })

  it('shows an upload-success confirmation with the real filename', async () => {
    const user = userEvent.setup()
    uploadDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'my-guide.pdf' }))
    indexDirectorDocumentMock.mockResolvedValue(makeDoc({ fileName: 'my-guide.pdf' }))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('my-guide.pdf', 'application/pdf'))

    expect(await screen.findByText(/my-guide\.pdf.*added/i)).toBeInTheDocument()
  })

  it('shows an error if uploadDirectorDocument fails, without crashing', async () => {
    const user = userEvent.setup()
    const { ServiceError } = await import('@/lib/supabase')
    uploadDirectorDocumentMock.mockRejectedValue(new ServiceError('Storage quota exceeded.', 'DB_ERROR'))
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText(/No reference documents yet/i)).toBeInTheDocument())

    const input = screen.getByTestId('director-document-file-input')
    await user.upload(input, makeFile('bad.pdf', 'application/pdf'))

    expect(await screen.findByText('Storage quota exceeded.')).toBeInTheDocument()
  })

  it('has a category selector defaulting to "Other"', async () => {
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByLabelText('Document category')).toBeInTheDocument())
    expect(screen.getByLabelText('Document category')).toHaveValue('other')
  })
})

describe('DirectorDocumentsPanel — delete', () => {
  it('shows a confirmation dialog before deleting', async () => {
    const user = userEvent.setup()
    listDirectorDocumentsMock.mockResolvedValue([makeDoc({ fileName: 'to-delete.pdf' })])
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('to-delete.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(/will be permanently removed/i)).toBeInTheDocument()
    expect(deleteDirectorDocumentMock).not.toHaveBeenCalled()
  })

  it('deletes and removes the document from the list on confirm', async () => {
    const user = userEvent.setup()
    listDirectorDocumentsMock.mockResolvedValue([makeDoc({ fileName: 'to-delete.pdf' })])
    deleteDirectorDocumentMock.mockResolvedValue(undefined)
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('to-delete.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(deleteDirectorDocumentMock).toHaveBeenCalledWith('doc-1', 'user-1/doc-1'))
  })

  it('removes the document from the visible list after successful delete', async () => {
    const user = userEvent.setup()
    listDirectorDocumentsMock.mockResolvedValue([makeDoc({ fileName: 'to-delete.pdf' })])
    deleteDirectorDocumentMock.mockResolvedValue(undefined)
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('to-delete.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('to-delete.pdf')).not.toBeInTheDocument())
  })

  it('does not delete when cancelled', async () => {
    const user = userEvent.setup()
    listDirectorDocumentsMock.mockResolvedValue([makeDoc({ fileName: 'keep-me.pdf' })])
    render(<DirectorDocumentsPanel campaignId="camp-1" userId="user-1" />)
    await waitFor(() => expect(screen.getByText('keep-me.pdf')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(deleteDirectorDocumentMock).not.toHaveBeenCalled()
    expect(screen.getByText('keep-me.pdf')).toBeInTheDocument()
  })
})
