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
import { WeatherLayer } from '@/components/adventure/world/WeatherLayer'
import { parseTimeOfDay } from '@/components/adventure/world/timeOfDay'
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

describe('AdventureWorldPreview — ambient animation (biome furniture, reduced-motion-safe)', () => {
  it('forest breathes: swaying trees and fireflies', () => {
    const { container } = renderPreview('outdoor')
    expect(container.querySelectorAll('.world-sway').length).toBeGreaterThan(0)
    expect(screen.getByTestId('ambient-fireflies')).toBeInTheDocument()
  })

  it('village breathes: chimney smoke, flickering windows, drifting clouds', () => {
    const { container } = renderPreview('town')
    expect(container.querySelectorAll('.world-smoke').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('.torch-flicker').length).toBeGreaterThan(0)
    expect(screen.getByTestId('scene-clouds')).toBeInTheDocument()
  })

  it('dungeon breathes: flickering torches and drifting fog', () => {
    const { container } = renderPreview('dungeon')
    expect(container.querySelectorAll('.torch-flicker').length).toBeGreaterThan(0)
    expect(screen.getByTestId('ambient-fog')).toBeInTheDocument()
  })

  it('never renders rain or snow ambience (no weather field exists)', () => {
    for (const type of ['outdoor', 'town', 'dungeon', 'region', 'building'] as const) {
      const { unmount } = renderPreview(type)
      expect(screen.queryByTestId('ambient-rain')).not.toBeInTheDocument()
      expect(screen.queryByTestId('ambient-snow')).not.toBeInTheDocument()
      unmount()
    }
  })
})

describe('AdventureWorldPreview — player presence', () => {
  it('the party leader is visible in every scene, idle-animated', () => {
    for (const type of ['outdoor', 'town', 'dungeon', 'region', null] as const) {
      const { container, unmount } = renderPreview(type)
      const sprite = screen.getByTestId('player-sprite')
      expect(sprite).toBeInTheDocument()
      expect(container.querySelector('.sprite-breathe')).toBeInTheDocument()
      expect(container.querySelector('.sprite-blink')).toBeInTheDocument()
      unmount()
    }
  })
})

describe('AdventureWorldPreview — time of day (graded ONLY from the Director\'s real worldTime)', () => {
  it.each([
    ['Dawn breaks over the valley', 'morning'],
    ['Late afternoon, the market busy', 'day'],
    ['Dusk, third day of travel', 'sunset'],
    ['Deep night, moonlit road', 'night'],
  ])('"%s" grades the exterior scene as %s', (worldTime, phase) => {
    renderPreview('outdoor', worldTime)
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-time', phase)
  })

  it('renders neutral with no tint when worldTime gives no honest signal', () => {
    renderPreview('outdoor', 'The third bell since the caravan left')
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-time', 'neutral')
    expect(screen.queryByTestId('scene-time-tint')).not.toBeInTheDocument()
  })

  it('renders neutral when worldTime is null', () => {
    renderPreview('outdoor', null)
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-time', 'neutral')
  })

  it('tints exterior scenes at night', () => {
    renderPreview('outdoor', 'Midnight')
    expect(screen.getByTestId('scene-time-tint')).toBeInTheDocument()
  })

  it('never tints interiors/dungeons — no sky to grade', () => {
    renderPreview('dungeon', 'Midnight')
    expect(screen.getByTestId('adventure-world-preview')).toHaveAttribute('data-time', 'neutral')
    expect(screen.queryByTestId('scene-time-tint')).not.toBeInTheDocument()
  })

  it('parseTimeOfDay: "day" phase applies no tint (neutral daylight)', () => {
    expect(parseTimeOfDay('Noon sharp')).toBe('day')
    renderPreview('outdoor', 'Noon sharp')
    expect(screen.queryByTestId('scene-time-tint')).not.toBeInTheDocument()
  })
})

describe('WeatherLayer — clear until a real weather field exists', () => {
  it('renders nothing for null/clear (the only values reachable today)', () => {
    const { container: c1 } = render(<WeatherLayer weather={null} />)
    expect(c1.firstChild).toBeNull()
    const { container: c2 } = render(<WeatherLayer weather="clear" />)
    expect(c2.firstChild).toBeNull()
  })

  it('visualizes rain/snow/fog/cloudy when given a (future) real value', () => {
    render(<div style={{ position: 'relative' }}><WeatherLayer weather="rain" /></div>)
    expect(screen.getByTestId('ambient-rain')).toBeInTheDocument()
    render(<div style={{ position: 'relative' }}><WeatherLayer weather="cloudy" /></div>)
    expect(screen.getByTestId('weather-cloudy')).toBeInTheDocument()
  })

  it('the preview passes no weather by default — no rain/snow can render', () => {
    renderPreview('outdoor', 'Dusk')
    expect(screen.queryByTestId('ambient-rain')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ambient-snow')).not.toBeInTheDocument()
    expect(screen.queryByTestId('weather-cloudy')).not.toBeInTheDocument()
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
