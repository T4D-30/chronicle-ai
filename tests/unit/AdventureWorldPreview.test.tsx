/**
 * AdventureWorldPreview Tests — UI 4.1 (World Presence Pass)
 *
 * The idle-world layer is keyed by REAL LocationType values only —
 * scenery for places that genuinely exist. Covers the type→scene
 * mapping, the neutral default, and the decorative/pointer-inert
 * contract.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AdventureWorldPreview } from '@/components/adventure/world/AdventureWorldPreview'
import { WeatherLayer } from '@/components/adventure/world/WeatherLayer'
import { PlayerSprite } from '@/components/adventure/world/PlayerSprite'
import { parseTimeOfDay } from '@/components/adventure/world/timeOfDay'
import type { LocationType } from '@/types/campaign'
import type { CharacterRecord } from '@/lib/supabase'

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

describe('PlayerSprite — character presence (UI 4.2)', () => {
  function renderSprite(props: Parameters<typeof PlayerSprite>[0] = {}) {
    return render(<div style={{ position: 'relative' }}><PlayerSprite {...props} /></div>)
  }

  it('renders the generic traveler with no weapon by default', () => {
    renderSprite()
    const sprite = screen.getByTestId('player-sprite')
    expect(sprite).toHaveAttribute('data-body', 'traveler')
    expect(sprite).toHaveAttribute('data-weapon', 'none')
    expect(sprite).toHaveAttribute('data-facing', 'right')
    expect(screen.queryByTestId('sprite-weapon')).not.toBeInTheDocument()
  })

  it.each(['bruiser', 'skirmisher', 'devout', 'caster'] as const)(
    'renders the %s build',
    (body) => {
      renderSprite({ body })
      expect(screen.getByTestId('player-sprite')).toHaveAttribute('data-body', body)
    },
  )

  it.each(['sword', 'dagger', 'axe', 'bow', 'staff', 'mace', 'spear'] as const)(
    'draws the %s silhouette when equipped',
    (weapon) => {
      renderSprite({ weapon })
      expect(screen.getByTestId('sprite-weapon')).toHaveAttribute('data-weapon', weapon)
    },
  )

  it('flips horizontally when facing left', () => {
    const { container } = renderSprite({ facing: 'left' })
    const svg = container.querySelector('svg')
    expect(svg).toHaveStyle({ transform: 'scaleX(-1)' })
  })

  it('companion slot exists but renders nothing (no companion system exists)', () => {
    renderSprite()
    expect(screen.getByTestId('companion-slot')).toBeEmptyDOMElement()
  })

  it('renders a provided companion in the slot', () => {
    renderSprite({ companion: <span data-testid="future-companion" /> })
    expect(screen.getByTestId('companion-slot')).toContainElement(
      screen.getByTestId('future-companion'),
    )
  })

  it('asset override: probes the portraits slot and swaps in real art on load', () => {
    renderSprite({ archetype: 'Wizard' })
    const probe = screen.getByTestId('player-sprite-probe')
    expect(probe).toHaveAttribute('src', '/assets/sprites/portraits/player-wizard.png')
    fireEvent.load(probe)
    expect(screen.getByTestId('player-sprite-asset')).toBeInTheDocument()
  })

  it('no archetype → no probe, procedural figure only', () => {
    renderSprite()
    expect(screen.queryByTestId('player-sprite-probe')).not.toBeInTheDocument()
  })
})

describe('AdventureWorldPreview — real character drives the sprite (UI 4.2)', () => {
  function makeCharacter(archetype: string, weaponName?: string): CharacterRecord {
    return {
      id: 'char-1', userId: 'user-1', portraitUrl: null, bio: '', experience: 0,
      tempHp: 0, deathSavesSuccess: 0, deathSavesFailure: 0,
      conditions: [], features: [], inventory: [], spells: {},
      createdAt: '', updatedAt: '',
      sheet: {
        name: 'Test Hero', level: 1, archetype, ancestry: 'human', background: 'soldier',
        scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
        modifiers: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
        hitDie: 'd8', maxHp: 10, currentHp: 10, armorClass: 10, proficiencyBonus: 2,
        skillProficiencies: [], savingThrowProficiencies: [],
        equipment: weaponName
          ? [{ id: 'w1', name: weaponName, slot: 'weapon', equipped: true }]
          : [],
        conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0,
      },
    } as CharacterRecord
  }

  it('a wizard with a staff renders the caster build holding a staff', () => {
    render(
      <div style={{ position: 'relative' }}>
        <AdventureWorldPreview
          locationType="outdoor"
          character={makeCharacter('wizard', 'Gnarled Oak Staff')}
          facing="left"
        />
      </div>,
    )
    const sprite = screen.getByTestId('player-sprite')
    expect(sprite).toHaveAttribute('data-body', 'caster')
    expect(sprite).toHaveAttribute('data-weapon', 'staff')
    expect(sprite).toHaveAttribute('data-facing', 'left')
  })

  it('no character renders the generic traveler', () => {
    renderPreview('outdoor')
    expect(screen.getByTestId('player-sprite')).toHaveAttribute('data-body', 'traveler')
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

describe('AdventureWorldPreview — world camera planes (Presentation 2)', () => {
  it('renders sky/background/midground/player planes in depth order', () => {
    renderPreview('town')
    for (const depth of ['sky', 'background', 'midground', 'player'] as const) {
      expect(screen.getByTestId(`camera-plane-${depth}`)).toHaveAttribute('data-depth', depth)
    }
  })

  it('the sky plane is pinned — no parallax drift class', () => {
    renderPreview('town')
    expect(screen.getByTestId('camera-plane-sky').className).not.toContain('camera-drift')
    expect(screen.getByTestId('camera-plane-midground').className).toContain('camera-drift')
  })

  it('nearer planes drift with larger amplitude than distant ones', () => {
    renderPreview('town')
    const bg = screen.getByTestId('camera-plane-background')
    const player = screen.getByTestId('camera-plane-player')
    const amp = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--camera-amplitude'))
    expect(amp(player)).toBeGreaterThan(amp(bg))
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
