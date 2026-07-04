import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Cast Spell</Button>)
    expect(screen.getByText('Cast Spell')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Attack</Button>)
    await user.click(screen.getByText('Attack'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Locked</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders all variants without crashing', () => {
    const { rerender } = render(<Button variant="arcane">Arcane</Button>)
    rerender(<Button variant="spirit">Spirit</Button>)
    rerender(<Button variant="ghost">Ghost</Button>)
    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByText('Danger')).toBeInTheDocument()
  })
})
