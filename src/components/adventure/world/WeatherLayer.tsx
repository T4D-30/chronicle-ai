/**
 * WeatherLayer — UI 4.1 (World Presence Pass)
 *
 * Visualizes weather WHEN REAL WEATHER STATE EXISTS. WorldState has no
 * weather field today (Phase 10 Living World adds one), so every
 * current caller passes nothing and this renders nothing — clear
 * weather. The layer exists so that the moment a real field arrives,
 * wiring it is a one-line prop, not a redesign. Rendering rain or snow
 * without a real weather value is fabricated world state and is
 * deliberately impossible through the public component API
 * (no caller passes a weather value today).
 *
 * Presentation only; reuses the existing reduced-motion-safe particle
 * system.
 */

import { AmbientOverlay } from '@/components/pixel'

export type WorldWeather = 'clear' | 'rain' | 'snow' | 'fog' | 'cloudy'

export function WeatherLayer({ weather }: { weather: WorldWeather | null | undefined }) {
  if (!weather || weather === 'clear') return null

  if (weather === 'cloudy') {
    return (
      <div
        className="absolute inset-x-0 world-clouds"
        data-testid="weather-cloudy"
        aria-hidden="true"
        style={{
          top: '0%',
          height: '40%',
          ['--drift-duration' as string]: '90s',
          background:
            'radial-gradient(ellipse 32% 46% at 20% 40%, rgba(107, 98, 90, 0.16), transparent 70%),' +
            'radial-gradient(ellipse 28% 40% at 55% 25%, rgba(107, 98, 90, 0.12), transparent 70%),' +
            'radial-gradient(ellipse 30% 44% at 85% 45%, rgba(107, 98, 90, 0.14), transparent 70%)',
        }}
      />
    )
  }

  return <AmbientOverlay kind={weather} />
}
