import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from '@/components/ui/Textarea'

describe('Textarea', () => {
  it('renders with a label', () => {
    render(<Textarea label="Biography" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Biography')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Textarea label="Biography" value="" onChange={handleChange} />)
    await user.type(screen.getByLabelText('Biography'), 'A')
    expect(handleChange).toHaveBeenCalled()
  })

  it('shows hint text', () => {
    render(<Textarea label="Bio" value="" onChange={() => {}} hint="Optional" />)
    expect(screen.getByText('Optional')).toBeInTheDocument()
  })

  it('shows error text and suppresses hint', () => {
    render(<Textarea label="Bio" value="" onChange={() => {}} hint="Optional" error="Too long" />)
    expect(screen.getByText('Too long')).toBeInTheDocument()
    expect(screen.queryByText('Optional')).not.toBeInTheDocument()
  })

  it('defaults to 4 rows', () => {
    render(<Textarea label="Bio" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '4')
  })

  it('respects a custom rows value', () => {
    render(<Textarea label="Bio" value="" onChange={() => {}} rows={12} />)
    expect(screen.getByLabelText('Bio')).toHaveAttribute('rows', '12')
  })
})
