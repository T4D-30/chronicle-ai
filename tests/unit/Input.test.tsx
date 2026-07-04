import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<Input error="Invalid email" />)
    expect(screen.getByText('Invalid email')).toBeInTheDocument()
  })

  it('shows hint when no error', () => {
    render(<Input hint="Use your adventurer email" />)
    expect(screen.getByText('Use your adventurer email')).toBeInTheDocument()
  })

  it('calls onChange when typing', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Input label="Name" onChange={handleChange} />)
    await user.type(screen.getByLabelText('Name'), 'Aeron')
    expect(handleChange).toHaveBeenCalled()
  })
})
