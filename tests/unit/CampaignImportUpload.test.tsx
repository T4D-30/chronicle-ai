/**
 * CampaignImportUpload Tests — Phase 10.2
 * Mirrors tests/unit/CharacterImportUpload.test.tsx.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CampaignImportUpload } from '@/components/campaign/CampaignImportUpload'

function makeFile(name: string, type: string, sizeBytes = 100): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

describe('CampaignImportUpload', () => {
  it('renders the drop zone with upload instructions', () => {
    render(<CampaignImportUpload onParsed={vi.fn()} />)
    expect(screen.getByText(/Drop a campaign document here/i)).toBeInTheDocument()
  })

  it('calls onParsed with the file and a real CampaignImportResult for a supported PDF', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)

    const file = makeFile('campaign.pdf', 'application/pdf')
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
    const [passedFile, result] = onParsed.mock.calls[0]
    expect(passedFile.name).toBe('campaign.pdf')
    expect(result.providerName).toBe('Manual Entry')
  })

  it('accepts DOCX files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    const file = makeFile('campaign.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('accepts TXT files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    const file = makeFile('campaign.txt', 'text/plain')
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('accepts Markdown files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    const file = makeFile('campaign.md', 'text/markdown')
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('accepts JSON files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    const file = makeFile('campaign.json', 'application/json')
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('shows an error and does not call onParsed for an unsupported file type dropped in (accept attr only filters the picker, not drag-and-drop)', async () => {
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    // PNG is a valid character-import type but NOT a campaign-import type —
    // a genuinely unsupported type for this specific pipeline.
    const file = makeFile('campaign.png', 'image/png')
    const dropZone = screen.getByRole('button', { name: /Upload a campaign document/i })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported file type/i)
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('shows an error and does not call onParsed for an oversized file', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CampaignImportUpload onParsed={onParsed} />)
    const file = makeFile('campaign.pdf', 'application/pdf', 16 * 1024 * 1024) // 16MB > 15MB cap
    const input = screen.getByTestId('campaign-import-file-input')
    await user.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('has a Choose File button as a keyboard-accessible alternative to drag-and-drop', () => {
    render(<CampaignImportUpload onParsed={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeInTheDocument()
  })

  it('drop zone is keyboard-focusable with role=button', () => {
    render(<CampaignImportUpload onParsed={vi.fn()} />)
    const dropZone = screen.getByRole('button', { name: /Upload a campaign document/i })
    expect(dropZone).toHaveAttribute('tabIndex', '0')
  })
})
