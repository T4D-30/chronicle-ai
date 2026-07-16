/**
 * SpeakerPortrait — Dialogue Cinematics v1 (B1)
 *
 * The asset-ready portrait slot for dialogue speakers. Resolution
 * order, most-real first — nothing here invents identity:
 *
 *   1. Real art probe: `/assets/sprites/portraits/npc-<entityId>.png`
 *      (the sprites README's portraits slot; PlayerSprite's exact
 *      probe pattern — commissioned art lands with zero code changes).
 *   2. Fixture glyph: overworld entities carry a real `glyph` — honest
 *      fixture content, shown large.
 *   3. Initial tile: any named speaker (including Director/NPC-memory
 *      identities) gets a deterministic tile — first letter on a hue
 *      seeded from the stable identity key — the same tile every time
 *      for the same NPC, fabricating nothing beyond the name we have.
 *   4. Generic silhouette for unnamed/unknown speakers.
 *
 * Decorative by design (`aria-hidden`): the ANNOUNCED identity is the
 * speaker-name text beside it, never the picture.
 */

import { useState } from 'react'

interface SpeakerPortraitProps {
  /** Display name — drives the initial-tile fallback. */
  name?: string | null
  /** Stable identity key (fixture entity id or npcMemory id); seeds
   *  the asset probe filename and the deterministic tile hue. */
  identityKey?: string | null
  /** Fixture entity glyph, when the speaker is a map entity. */
  glyph?: string | null
}

/** Deterministic hue from a stable identity string — same NPC, same
 *  tile, every session. Warm-palette band only (20°–60°: bronze/gold/
 *  ember territory) per the UI color philosophy. */
export function portraitHue(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return 20 + (h % 41)
}

export function SpeakerPortrait({ name = null, identityKey = null, glyph = null }: SpeakerPortraitProps) {
  const assetSrc = identityKey
    ? `/assets/sprites/portraits/npc-${identityKey.toLowerCase().trim()}.png`
    : null
  const [assetReady, setAssetReady] = useState(false)

  const seed = identityKey ?? name ?? ''
  const initial = name?.trim().charAt(0).toUpperCase() ?? ''

  return (
    <div
      className="dialogue-portrait-enter relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded border border-bronze-700/60 bg-void-900 overflow-hidden flex items-center justify-center"
      aria-hidden="true"
      data-testid="speaker-portrait"
      data-portrait-kind={assetReady ? 'asset' : glyph ? 'glyph' : initial ? 'initial' : 'silhouette'}
    >
      {/* Asset-override probe — real art replaces every fallback below
          with zero code changes (PlayerSprite's pattern). */}
      {assetSrc && !assetReady && (
        <img
          src={assetSrc}
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={() => setAssetReady(true)}
          data-testid="speaker-portrait-probe"
        />
      )}

      {assetSrc && assetReady ? (
        <img src={assetSrc} alt="" className="w-full h-full object-contain pixel-crisp" />
      ) : glyph ? (
        <span className="text-3xl leading-none" data-testid="portrait-glyph">{glyph}</span>
      ) : initial ? (
        <span
          className="w-full h-full flex items-center justify-center font-pixel-display text-xl text-void-950"
          style={{ backgroundColor: `hsl(${portraitHue(seed)} 45% 55%)` }}
          data-testid="portrait-initial"
        >
          {initial}
        </span>
      ) : (
        <span className="text-2xl text-void-600" data-testid="portrait-silhouette">👤</span>
      )}
    </div>
  )
}
