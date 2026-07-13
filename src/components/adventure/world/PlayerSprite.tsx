/**
 * PlayerSprite — UI 4.1 (World Presence Pass)
 *
 * A small hand-authored pixel figure representing the party leader's
 * presence in the world — the character genuinely exists at the
 * current location, so showing a figure standing there is
 * representation of real state, not decoration-as-fabrication.
 *
 * Idle only: breathing (a barely-there vertical settle anchored at the
 * feet) and an occasional blink. No movement controls, no gameplay —
 * those are future phases. Pure CSS animation, both keyframes in
 * pixel.css's reduced-motion kill-list (a reduced-motion player gets a
 * still figure).
 *
 * Generic hooded-traveler silhouette for now; a real per-character
 * sprite (equipment, class, damage states) is the portraits phase in
 * UI_VISION.md's roadmap — this component is the mount point it will
 * slot into.
 */

export function PlayerSprite({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 12 18"
      className={['pixel-crisp', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      data-testid="player-sprite"
    >
      <g className="sprite-breathe">
        {/* hood */}
        <rect x="3" y="0" width="6" height="2" fill="#2a201a" />
        <rect x="2" y="2" width="8" height="3" fill="#3a2b20" />
        {/* face */}
        <rect x="4" y="3" width="4" height="3" fill="#c9beb0" />
        {/* eyes (blink) */}
        <g className="sprite-blink">
          <rect x="4.6" y="4" width="0.9" height="0.9" fill="#141315" />
          <rect x="6.5" y="4" width="0.9" height="0.9" fill="#141315" />
        </g>
        {/* cloak/torso */}
        <rect x="2" y="6" width="8" height="6" fill="#241a16" />
        <rect x="3" y="6" width="6" height="5" fill="#3a2b20" />
        {/* belt */}
        <rect x="3" y="10" width="6" height="1" fill="#7a5630" />
        <rect x="5.4" y="10" width="1.2" height="1" fill="#c89443" />
        {/* legs */}
        <rect x="3.6" y="12" width="1.8" height="4" fill="#1b1a1e" />
        <rect x="6.6" y="12" width="1.8" height="4" fill="#1b1a1e" />
        {/* boots */}
        <rect x="3.2" y="16" width="2.4" height="1.6" fill="#170f0b" />
        <rect x="6.4" y="16" width="2.4" height="1.6" fill="#170f0b" />
      </g>
    </svg>
  )
}
