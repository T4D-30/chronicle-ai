/**
 * CharacterImportUpload Tests — Phase 10.1
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CharacterImportUpload } from '@/components/character/CharacterImportUpload'

function makeFile(name: string, type: string, sizeBytes = 100): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

describe('CharacterImportUpload', () => {
  it('renders the drop zone with upload instructions', () => {
    render(<CharacterImportUpload onParsed={vi.fn()} />)
    expect(screen.getByText(/Drop a character sheet here/i)).toBeInTheDocument()
  })

  it('calls onParsed with the file and a real CharacterImportResult for a supported PDF', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CharacterImportUpload onParsed={onParsed} />)

    const file = makeFile('sheet.pdf', 'application/pdf')
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
    const [passedFile, result] = onParsed.mock.calls[0]
    expect(passedFile.name).toBe('sheet.pdf')
    expect(result.providerName).toBe('Manual Entry')
  })

  it('accepts PNG files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CharacterImportUpload onParsed={onParsed} />)
    const file = makeFile('sheet.png', 'image/png')
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('accepts JPEG files', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CharacterImportUpload onParsed={onParsed} />)
    const file = makeFile('sheet.jpg', 'image/jpeg')
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, file)
    await waitFor(() => expect(onParsed).toHaveBeenCalledOnce())
  })

  it('shows an error and does not call onParsed for an unsupported file type dropped in (accept attr only filters the picker, not drag-and-drop)', async () => {
    const onParsed = vi.fn()
    render(<CharacterImportUpload onParsed={onParsed} />)
    const file = makeFile('sheet.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const dropZone = screen.getByRole('button', { name: /Upload a character sheet file/i })

    const dataTransfer = { files: [file] }
    fireEvent.drop(dropZone, { dataTransfer })

    expect(await screen.findByRole('alert')).toHaveTextContent(/Unsupported file type/i)
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('shows an error and does not call onParsed for an oversized file', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(<CharacterImportUpload onParsed={onParsed} />)
    const file = makeFile('sheet.pdf', 'application/pdf', 9 * 1024 * 1024) // 9MB > 8MB cap
    const input = screen.getByTestId('import-file-input')
    await user.upload(input, file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('has a Choose File button as a keyboard-accessible alternative to drag-and-drop', () => {
    render(<CharacterImportUpload onParsed={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Choose File' })).toBeInTheDocument()
  })

  it('drop zone is keyboard-focusable with role=button', () => {
    render(<CharacterImportUpload onParsed={vi.fn()} />)
    const dropZone = screen.getByRole('button', { name: /Upload a character sheet file/i })
    expect(dropZone).toHaveAttribute('tabIndex', '0')
  })
})
