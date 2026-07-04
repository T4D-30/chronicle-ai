import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Select } from '@/components/ui/Select'

const OPTIONS = [
  { value: 'fighter', label: 'Fighter' },
  { value: 'wizard', label: 'Wizard' },
]

describe('Select', () => {
  it('renders all provided options', () => {
    render(<Select options={OPTIONS} value="fighter" onChange={() => {}} />)
    expect(screen.getByRole('option', { name: 'Fighter' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Wizard' })).toBeInTheDocument()
  })

  it('renders a label and associates it via htmlFor', () => {
    render(<Select label="Class" options={OPTIONS} value="fighter" onChange={() => {}} />)
    expect(screen.getByLabelText('Class')).toBeInTheDocument()
  })

  it('calls onChange when a new option is selected', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(<Select label="Class" options={OPTIONS} value="fighter" onChange={handleChange} />)
    await user.selectOptions(screen.getByLabelText('Class'), 'wizard')
    expect(handleChange).toHaveBeenCalled()
  })

  it('shows an error message when provided', () => {
    render(<Select options={OPTIONS} value="fighter" onChange={() => {}} error="Invalid choice" />)
    expect(screen.getByText('Invalid choice')).toBeInTheDocument()
  })

  it('shows a hint when no error is present', () => {
    render(<Select options={OPTIONS} value="fighter" onChange={() => {}} hint="Pick wisely" />)
    expect(screen.getByText('Pick wisely')).toBeInTheDocument()
  })

  it('renders a placeholder option when provided', () => {
    render(
      <Select
        options={OPTIONS}
        value=""
        onChange={() => {}}
        placeholder="Choose a class…"
      />,
    )
    expect(screen.getByText('Choose a class…')).toBeInTheDocument()
  })
})
