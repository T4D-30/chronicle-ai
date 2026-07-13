/**
 * AdventureWorldPreview Tests — UI 4.1 (World Presence Pass)
 *
 * The idle-world layer is keyed by REAL LocationType values only —
 * scenery for places that genuinely exist. Covers the type→scene
 * mapping, the neutral default, and the decorative/pointer-inert
 * contract.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdventureWorldPreview } from '@/components/adventure/world/AdventureWorldPreview'
import type { LocationType } from '@/types/campaign'

function renderPreview(locationType: LocationType | null, worldTime: string | null = null) {
  return render(
    <div style={{ position: 'relative' }}>
      <AdventureWorldPreview locationType={locationType} worldTime={worldTime} />
    </div>,
  )
}

describe('AdventureWorldPreview — biome mapping (real LocationTypes only)', () => {
  const CASES: Array<[LocationType, string, string]> = [
    ['outdoor',  'forest',    'scene-furniture-forest'],
    ['town',     'village',   'scene-furniture-village'],
    ['dungeon',  'dungeon',   'scene-furniture-dungeon'],
    ['floor',    'dungeon',   'scene-furniture-dungeon'],
    ['building', 'interior',  'scene-furniture-interior'],
    ['room',     'interior',  'scene-furniture-interior'],
    ['region',   'mountains', 'scene-furniture-mountains'],
  ]

  it.each(CASES)('%s renders the %s scene', (type, kind, furnitureTestId) => {
    renderPreview(type)
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-scene', kind)
    expect(screen.getByTestId(furnitureTestId)).toBeInTheDocument()
  })

  it('renders the neutral default scene with no furniture when no location resolves', () => {
    renderPreview(null)
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-scene', 'default')
    expect(screen.queryByTestId(/scene-furniture-/)).not.toBeInTheDocument()
  })
})

describe('AdventureWorldPreview — decorative contract', () => {
  it('is aria-hidden and pointer-events-none (never intercepts play)', () => {
    renderPreview('town')
    const preview = screen.getByTestId('adventure-world-preview')
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(preview.className).toContain('pointer-events-none')
  })

  it('never mentions weather (no weather field exists on WorldState)', () => {
    renderPreview('outdoor', 'Dusk, light drizzle promised by the innkeep')
    expect(screen.getByTestId('adventure-world-preview')).not.toHaveTextContent(/rain|snow|weather/i)
  })
})
