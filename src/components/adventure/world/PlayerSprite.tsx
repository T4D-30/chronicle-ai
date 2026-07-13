/**
 * PlayerSprite — UI 4.1, extended UI 4.2 (Character Presence Pass)
 *
 * The party leader's presence in the world, now reflecting the ACTUAL
 * character — deterministically, from real state, with no bespoke
 * sprite system:
 *   - body build + palette accent from the real archetype
 *     (characterAppearance.bodyKindFor / ACCENT_FOR_BODY)
 *   - weapon silhouette from the actually-equipped weapon's name
 *     (weaponKindFor); nothing equipped → nothing drawn
 *   - facing (left/right) — stable per location
 *   - companion slot: a positioned mount point that renders nothing
 *     today (no companion system exists anywhere in the codebase);
 *     when one does, it slots in here without layout changes
 *   - ASSET OVERRIDE: probes public/assets/sprites/portraits/
 *     player-<archetype>.png (the sprites README's portraits slot) via
 *     the established hidden-img pattern — real commissioned art
 *     replaces the procedural figure with zero code changes.
 *
 * Idle only: breathing + occasional blink, pure CSS, reduced-motion
 * safe. All colors are existing palette tokens.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { BodyKind, WeaponKind, Facing } from './characterAppearance'
import { ACCENT_FOR_BODY } from './characterAppearance'

interface PlayerSpriteProps {
  body?: BodyKind
  /** Tunic/robe accent — defaults to the body's palette accent. */
  accent?: string
  weapon?: WeaponKind | null
  facing?: Facing
  /** Real archetype string, used only to name the asset-override slot. */
  archetype?: string | null
  /** Future companion/pet mount point — nothing renders today. */
  companion?: ReactNode
  className?: string
}

const SKIN = '#c9beb0'
const DARK = '#170f0b'
const CLOTH = '#241a16'
const IRON = '#322c28'
const WOOD = '#4a3423'
const GOLD = '#c89443'

function WeaponSilhouette({ kind }: { kind: WeaponKind }) {
  switch (kind) {
    case 'sword':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.4" y="4" width="1" height="6.6" fill={IRON} />
          <rect x="9.4" y="9.6" width="3" height="0.8" fill={GOLD} />
          <rect x="10.4" y="10.4" width="1" height="1.8" fill={WOOD} />
        </g>
      )
    case 'dagger':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.4" y="8" width="1" height="3" fill={IRON} />
          <rect x="9.8" y="10.6" width="2.2" height="0.7" fill={GOLD} />
          <rect x="10.4" y="11.3" width="1" height="1.4" fill={WOOD} />
        </g>
      )
    case 'axe':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.6" y="4.6" width="0.9" height="8" fill={WOOD} />
          <rect x="9" y="4.6" width="2" height="2.4" fill={IRON} />
        </g>
      )
    case 'bow':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <path d="M 11 4.5 Q 13.4 8.5 11 12.5" fill="none" stroke={WOOD} strokeWidth="0.9" />
          <line x1="11" y1="4.5" x2="11" y2="12.5" stroke="#9c9086" strokeWidth="0.35" />
        </g>
      )
    case 'staff':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.6" y="2.6" width="0.9" height="11" fill={WOOD} />
          <rect x="10.2" y="1.6" width="1.7" height="1.7" fill="#5e83d7" />
        </g>
      )
    case 'mace':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.6" y="5.8" width="0.9" height="6.6" fill={WOOD} />
          <rect x="9.8" y="4.2" width="2.5" height="2.5" fill={IRON} />
        </g>
      )
    case 'spear':
      return (
        <g data-testid="sprite-weapon" data-weapon={kind}>
          <rect x="10.6" y="2.8" width="0.8" height="11.4" fill={WOOD} />
          <polygon points="11,0.8 12,2.9 10,2.9" fill={IRON} />
        </g>
      )
  }
}

function BodyFigure({ body, accent }: { body: BodyKind; accent: string }) {
  const eyes = (
    <g className="sprite-blink">
      <rect x="4.6" y="4" width="0.9" height="0.9" fill="#141315" />
      <rect x="6.5" y="4" width="0.9" height="0.9" fill="#141315" />
    </g>
  )
  const boots = (
    <>
      <rect x="3.2" y="16" width="2.4" height="1.6" fill={DARK} />
      <rect x="6.4" y="16" width="2.4" height="1.6" fill={DARK} />
    </>
  )
  const legs = (
    <>
      <rect x="3.6" y="12" width="1.8" height="4" fill="#1b1a1e" />
      <rect x="6.6" y="12" width="1.8" height="4" fill="#1b1a1e" />
    </>
  )

  switch (body) {
    case 'caster':
      return (
        <>
          {/* pointed hat */}
          <polygon points="6,-2 9.4,3 2.6,3" fill={accent} opacity="0.85" />
          <rect x="2" y="2.6" width="8" height="0.9" fill={accent} />
          <rect x="4" y="3.5" width="4" height="2.5" fill={SKIN} />
          {eyes}
          {/* full robe down over the legs */}
          <rect x="2.4" y="6" width="7.2" height="10" fill={accent} opacity="0.75" />
          <rect x="3.2" y="6" width="5.6" height="9" fill={accent} />
          <rect x="3.2" y="10" width="5.6" height="0.9" fill={GOLD} opacity="0.6" />
          {boots}
        </>
      )
    case 'bruiser':
      return (
        <>
          <rect x="3" y="0" width="6" height="2" fill={CLOTH} />
          <rect x="4" y="2" width="4" height="4" fill={SKIN} />
          {eyes}
          {/* broad pauldrons */}
          <rect x="1.4" y="6" width="2.6" height="2.4" fill={IRON} />
          <rect x="8" y="6" width="2.6" height="2.4" fill={IRON} />
          <rect x="2.6" y="6" width="6.8" height="6" fill={accent} />
          <rect x="3" y="10" width="6" height="1" fill={WOOD} />
          {legs}
          {boots}
        </>
      )
    case 'devout':
      return (
        <>
          <rect x="3" y="0" width="6" height="2" fill={CLOTH} />
          <rect x="4" y="2" width="4" height="4" fill={SKIN} />
          {eyes}
          <rect x="2.6" y="6" width="6.8" height="6" fill={CLOTH} />
          {/* gold tabard stripe */}
          <rect x="5" y="6" width="2" height="6" fill={accent} />
          <rect x="3" y="10" width="6" height="1" fill={WOOD} />
          {legs}
          {boots}
        </>
      )
    case 'skirmisher':
      return (
        <>
          {/* deep hood */}
          <rect x="3" y="0" width="6" height="2.4" fill={accent} />
          <rect x="2.4" y="2" width="7.2" height="3.4" fill={accent} />
          <rect x="4.2" y="3.2" width="3.6" height="2.4" fill={SKIN} />
          {eyes}
          {/* slim leathers */}
          <rect x="3.2" y="6" width="5.6" height="5.6" fill={accent} />
          <rect x="3.4" y="9.8" width="5.2" height="0.9" fill={WOOD} />
          {legs}
          {boots}
        </>
      )
    case 'traveler':
    default:
      return (
        <>
          <rect x="3" y="0" width="6" height="2" fill="#2a201a" />
          <rect x="2" y="2" width="8" height="3" fill={accent} />
          <rect x="4" y="3" width="4" height="3" fill={SKIN} />
          {eyes}
          <rect x="2" y="6" width="8" height="6" fill={CLOTH} />
          <rect x="3" y="6" width="6" height="5" fill={accent} />
          <rect x="3" y="10" width="6" height="1" fill="#7a5630" />
          <rect x="5.4" y="10" width="1.2" height="1" fill={GOLD} />
          {legs}
          {boots}
        </>
      )
  }
}

export function PlayerSprite({
  body = 'traveler',
  accent,
  weapon = null,
  facing = 'right',
  archetype = null,
  companion = null,
  className,
}: PlayerSpriteProps) {
  const resolvedAccent = accent ?? ACCENT_FOR_BODY[body]
  const assetSrc = archetype
    ? `/assets/sprites/portraits/player-${archetype.toLowerCase().trim()}.png`
    : null
  const [assetReady, setAssetReady] = useState(false)

  return (
    <div
      className={['relative', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-testid="player-sprite"
      data-body={body}
      data-weapon={weapon ?? 'none'}
      data-facing={facing}
    >
      {/* Asset-override probe — real commissioned art replaces the
          procedural figure with zero code changes. */}
      {assetSrc && !assetReady && (
        <img
          src={assetSrc}
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={() => setAssetReady(true)}
          data-testid="player-sprite-probe"
        />
      )}

      {assetSrc && assetReady ? (
        <img
          src={assetSrc}
          alt=""
          className="w-full h-full object-contain pixel-crisp"
          style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined}
          data-testid="player-sprite-asset"
        />
      ) : (
        <svg
          viewBox="0 0 14 18"
          className="w-full h-full pixel-crisp"
          style={facing === 'left' ? { transform: 'scaleX(-1)' } : undefined}
        >
          <g className="sprite-breathe">
            <BodyFigure body={body} accent={resolvedAccent} />
            {weapon && <WeaponSilhouette kind={weapon} />}
          </g>
        </svg>
      )}

      {/* Companion mount point — no companion system exists yet; this
          renders nothing until one does. */}
      <div
        className="absolute -left-1/2 bottom-0 w-1/2 h-1/2"
        data-testid="companion-slot"
      >
        {companion}
      </div>
    </div>
  )
}
