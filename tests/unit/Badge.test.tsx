import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Poisoned</Badge>)
    expect(screen.getByText('Poisoned')).toBeInTheDocument()
  })

  it('renders all variants without crashing', () => {
    const { rerender } = render(<Badge variant="arcane">Arcane</Badge>)
    rerender(<Badge variant="spirit">Spirit</Badge>)
    rerender(<Badge variant="harm">Harm</Badge>)
    rerender(<Badge variant="heal">Heal</Badge>)
    rerender(<Badge variant="neutral">Neutral</Badge>)
    expect(screen.getByText('Neutral')).toBeInTheDocument()
  })

  it('forwards extra className', () => {
    render(<Badge className="custom-class">Tag</Badge>)
    expect(screen.getByText('Tag')).toHaveClass('custom-class')
  })
})
