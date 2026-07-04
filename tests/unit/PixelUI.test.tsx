/**
 * Pixel UI Component Tests — Phase 9.0
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  PixelPanel, PixelButton, PixelBar, PixelCard, DamageNumber,
} from '@/components/pixel/PixelUI'
import { AmbientOverlay } from '@/components/pixel/AmbientOverlay'

// ─── PixelPanel ───────────────────────────────────────────────────────────────

describe('PixelPanel', () => {
  it('renders children', () => {
    render(<PixelPanel>Panel content</PixelPanel>)
    expect(screen.getByText('Panel content')).toBeInTheDocument()
  })

  it('applies pixel-border class by default', () => {
    const { container } = render(<PixelPanel>x</PixelPanel>)
    expect(container.firstElementChild?.className).toContain('pixel-border')
  })

  it('applies variant borders', () => {
    const { container } = render(<PixelPanel variant="arcane">x</PixelPanel>)
    expect(container.firstElementChild?.className).toContain('pixel-border-arcane')
  })

  it('applies torch glow when glow prop set', () => {
    const { container } = render(<PixelPanel glow>x</PixelPanel>)
    expect(container.firstElementChild?.className).toContain('torch-glow')
  })
})

// ─── PixelButton ──────────────────────────────────────────────────────────────

describe('PixelButton', () => {
  it('renders and fires onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PixelButton onClick={onClick}>Attack</PixelButton>)
    await user.click(screen.getByRole('button', { name: 'Attack' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PixelButton onClick={onClick} disabled>Attack</PixelButton>)
    await user.click(screen.getByRole('button', { name: 'Attack' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows selection cursor when selected', () => {
    render(<PixelButton selected>Item</PixelButton>)
    expect(screen.getByRole('button').className).toContain('pixel-cursor')
  })

  it('is keyboard focusable', () => {
    render(<PixelButton>Focus me</PixelButton>)
    const btn = screen.getByRole('button')
    btn.focus()
    expect(document.activeElement).toBe(btn)
  })
})

// ─── PixelBar ─────────────────────────────────────────────────────────────────

describe('PixelBar', () => {
  it('renders progressbar with correct aria values', () => {
    render(<PixelBar value={22} max={30} label="HP" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '22')
    expect(bar).toHaveAttribute('aria-valuemax', '30')
    expect(bar).toHaveAttribute('aria-label', 'HP: 22 of 30')
  })

  it('shows numbers by default', () => {
    render(<PixelBar value={22} max={30} />)
    expect(screen.getByText('22/30')).toBeInTheDocument()
  })

  it('hides numbers when showNumbers is false', () => {
    render(<PixelBar value={22} max={30} showNumbers={false} />)
    expect(screen.queryByText('22/30')).not.toBeInTheDocument()
  })

  it('clamps value above max', () => {
    render(<PixelBar value={99} max={30} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  })

  it('clamps negative values to zero', () => {
    render(<PixelBar value={-5} max={30} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('HP bar uses heal color above half', () => {
    render(<PixelBar value={25} max={30} kind="hp" />)
    expect(screen.getByTestId('pixel-bar-fill').className).toContain('bg-heal-400')
  })

  it('HP bar uses arcane color between quarter and half', () => {
    render(<PixelBar value={12} max={30} kind="hp" />)
    expect(screen.getByTestId('pixel-bar-fill').className).toContain('bg-arcane-400')
  })

  it('HP bar uses harm color at critical', () => {
    render(<PixelBar value={5} max={30} kind="hp" />)
    expect(screen.getByTestId('pixel-bar-fill').className).toContain('bg-harm-400')
  })

  it('XP bar is always arcane', () => {
    render(<PixelBar value={100} max={300} kind="xp" />)
    expect(screen.getByTestId('pixel-bar-fill').className).toContain('bg-arcane-400')
  })

  it('handles max of zero without crashing', () => {
    render(<PixelBar value={0} max={0} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})

// ─── PixelCard ────────────────────────────────────────────────────────────────

describe('PixelCard', () => {
  it('renders title, body, and footer', () => {
    render(
      <PixelCard title="Iron Sword" icon="⚔️" footer="Common · 5g">
        A reliable blade.
      </PixelCard>
    )
    expect(screen.getByText('Iron Sword')).toBeInTheDocument()
    expect(screen.getByText('A reliable blade.')).toBeInTheDocument()
    expect(screen.getByText('Common · 5g')).toBeInTheDocument()
  })

  it('renders without footer', () => {
    render(<PixelCard title="Quest">Find the relic.</PixelCard>)
    expect(screen.getByText('Quest')).toBeInTheDocument()
    expect(screen.getByText('Find the relic.')).toBeInTheDocument()
  })
})

// ─── DamageNumber ─────────────────────────────────────────────────────────────

describe('DamageNumber', () => {
  it('renders damage amount', () => {
    render(<DamageNumber amount={7} kind="damage" />)
    expect(screen.getByTestId('damage-number-damage')).toHaveTextContent('7')
  })

  it('renders heal with plus prefix', () => {
    render(<DamageNumber amount={5} kind="heal" />)
    expect(screen.getByTestId('damage-number-heal')).toHaveTextContent('+5')
  })

  it('renders MISS for misses', () => {
    render(<DamageNumber amount={0} kind="miss" />)
    expect(screen.getByTestId('damage-number-miss')).toHaveTextContent('MISS')
  })

  it('has accessible label for crits', () => {
    render(<DamageNumber amount={14} kind="crit" />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Critical hit for 14')
  })
})

// ─── AmbientOverlay ───────────────────────────────────────────────────────────

describe('AmbientOverlay', () => {
  it('renders nothing for kind=none', () => {
    const { container } = render(<AmbientOverlay kind="none" />)
    expect(container.firstElementChild).toBeNull()
  })

  it('renders fireflies container aria-hidden', () => {
    render(<AmbientOverlay kind="fireflies" />)
    const el = screen.getByTestId('ambient-fireflies')
    expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders requested particle count', () => {
    render(<AmbientOverlay kind="snow" count={10} />)
    const el = screen.getByTestId('ambient-snow')
    expect(el.querySelectorAll('.particle-snow')).toHaveLength(10)
  })

  it('clamps particle count to 60', () => {
    render(<AmbientOverlay kind="rain" count={500} />)
    const el = screen.getByTestId('ambient-rain')
    expect(el.querySelectorAll('.particle-rain')).toHaveLength(60)
  })

  it('fog renders a single fog layer', () => {
    render(<AmbientOverlay kind="fog" />)
    const el = screen.getByTestId('ambient-fog')
    expect(el.querySelectorAll('.particle-fog')).toHaveLength(1)
  })

  it('has pointer-events disabled', () => {
    render(<AmbientOverlay kind="fireflies" />)
    expect(screen.getByTestId('ambient-fireflies').className).toContain('pointer-events-none')
  })
})
