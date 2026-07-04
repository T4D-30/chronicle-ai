/**
 * AudioManager — Phase 9.0
 *
 * Manifest-driven audio framework. Ships with NO audio assets —
 * all tracks are declared in the manifest and resolved against
 * /audio/<category>/<file>. Missing files fail silently (logged once).
 *
 * Three channels, independently volume-controlled:
 *   music    — looping background tracks (menu, town, dungeon, combat, boss)
 *   ambience — looping environment loops (rain, wind, fire, birds, water)
 *   sfx      — one-shot effects (victory fanfare, thunder, UI clicks)
 *
 * Music selection is driven by game context via `setContext()`:
 *   combat=true          → combat (or boss) track
 *   location.kind        → town / dungeon / forest / default theme
 *
 * Crossfade between music tracks. All state observable for React via
 * a tiny subscribe API (no external state library needed).
 */

// ─── Manifest ─────────────────────────────────────────────────────────────────

export type MusicKey =
  | 'menu' | 'town' | 'dungeon' | 'forest' | 'combat' | 'boss' | 'victory'

export type AmbienceKey =
  | 'rain' | 'thunder' | 'fireplace' | 'wind' | 'birds' | 'water'

export interface AudioManifest {
  music: Record<MusicKey, string>
  ambience: Record<AmbienceKey, string>
}

/**
 * Default manifest — file paths relative to /audio/.
 * Drop royalty-free or original .ogg/.mp3 files at these paths to activate.
 * See public/audio/README.md for sourcing guidance.
 */
export const DEFAULT_MANIFEST: AudioManifest = {
  music: {
    menu:    'music/menu.ogg',
    town:    'music/town.ogg',
    dungeon: 'music/dungeon.ogg',
    forest:  'music/forest.ogg',
    combat:  'music/combat.ogg',
    boss:    'music/boss.ogg',
    victory: 'music/victory.ogg',
  },
  ambience: {
    rain:      'ambience/rain.ogg',
    thunder:   'ambience/thunder.ogg',
    fireplace: 'ambience/fireplace.ogg',
    wind:      'ambience/wind.ogg',
    birds:     'ambience/birds.ogg',
    water:     'ambience/water.ogg',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioContextState {
  /** Whether the player is currently in combat. */
  inCombat: boolean
  /** Whether the current encounter is a boss fight. */
  isBoss: boolean
  /** Location kind from world state ('town' | 'dungeon' | 'forest' | other). */
  locationKind: string | null
}

export interface AudioSettings {
  musicVolume: number      // 0–1
  ambienceVolume: number   // 0–1
  sfxVolume: number        // 0–1
  muted: boolean
}

const DEFAULT_SETTINGS: AudioSettings = {
  musicVolume: 0.6,
  ambienceVolume: 0.5,
  sfxVolume: 0.8,
  muted: false,
}

type Listener = () => void

// ─── Manager ──────────────────────────────────────────────────────────────────

const CROSSFADE_MS = 1200
const FADE_STEPS = 24

export class AudioManager {
  private manifest: AudioManifest
  private baseUrl: string
  private settings: AudioSettings = { ...DEFAULT_SETTINGS }
  private listeners = new Set<Listener>()

  private musicEl: HTMLAudioElement | null = null
  private ambienceEls = new Map<AmbienceKey, HTMLAudioElement>()
  private currentMusic: MusicKey | null = null
  private activeAmbience = new Set<AmbienceKey>()
  private failedSources = new Set<string>()
  private fadeTimer: ReturnType<typeof setInterval> | null = null

  constructor(manifest: AudioManifest = DEFAULT_MANIFEST, baseUrl = '/audio/') {
    this.manifest = manifest
    this.baseUrl = baseUrl
  }

  // ── Observable state ─────────────────────────────────────────────────────

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }

  getSettings(): AudioSettings {
    return { ...this.settings }
  }

  getCurrentMusic(): MusicKey | null {
    return this.currentMusic
  }

  getActiveAmbience(): AmbienceKey[] {
    return [...this.activeAmbience]
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  setMusicVolume(v: number) {
    this.settings.musicVolume = clamp01(v)
    if (this.musicEl) this.musicEl.volume = this.effectiveVolume('music')
    this.notify()
  }

  setAmbienceVolume(v: number) {
    this.settings.ambienceVolume = clamp01(v)
    this.ambienceEls.forEach((el) => { el.volume = this.effectiveVolume('ambience') })
    this.notify()
  }

  setSfxVolume(v: number) {
    this.settings.sfxVolume = clamp01(v)
    this.notify()
  }

  setMuted(muted: boolean) {
    this.settings.muted = muted
    if (this.musicEl) this.musicEl.volume = this.effectiveVolume('music')
    this.ambienceEls.forEach((el) => { el.volume = this.effectiveVolume('ambience') })
    this.notify()
  }

  toggleMute() {
    this.setMuted(!this.settings.muted)
  }

  private effectiveVolume(channel: 'music' | 'ambience' | 'sfx'): number {
    if (this.settings.muted) return 0
    if (channel === 'music') return this.settings.musicVolume
    if (channel === 'ambience') return this.settings.ambienceVolume
    return this.settings.sfxVolume
  }

  // ── Context-driven music selection ───────────────────────────────────────

  /**
   * Update the game context; the manager picks the right music track.
   * Combat overrides location. Boss overrides combat.
   */
  setContext(ctx: Partial<AudioContextState>) {
    const key = this.selectTrack(ctx)
    if (key) this.playMusic(key)
  }

  /** Pure selection logic — exported for tests. */
  selectTrack(ctx: Partial<AudioContextState>): MusicKey {
    if (ctx.inCombat) return ctx.isBoss ? 'boss' : 'combat'
    switch (ctx.locationKind) {
      case 'town':    return 'town'
      case 'dungeon': return 'dungeon'
      case 'forest':  return 'forest'
      default:        return 'menu'
    }
  }

  // ── Music playback (with crossfade) ─────────────────────────────────────

  playMusic(key: MusicKey) {
    if (key === this.currentMusic) return
    const src = this.resolve(this.manifest.music[key])
    if (!src) return

    const next = this.createAudio(src, true)
    if (!next) return

    const prev = this.musicEl
    this.musicEl = next
    this.currentMusic = key

    // Start next at 0 volume; fade in while fading prev out
    next.volume = 0
    this.safePlay(next, src)

    this.crossfade(prev, next)
    this.notify()
  }

  stopMusic() {
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    this.musicEl?.pause()
    this.musicEl = null
    this.currentMusic = null
    this.notify()
  }

  /** One-shot victory fanfare via the sfx channel volume. */
  playVictory() {
    const src = this.resolve(this.manifest.music.victory)
    if (!src) return
    const el = this.createAudio(src, false)
    if (!el) return
    el.volume = this.effectiveVolume('sfx')
    this.safePlay(el, src)
  }

  private crossfade(prev: HTMLAudioElement | null, next: HTMLAudioElement) {
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    const target = this.effectiveVolume('music')
    let step = 0
    this.fadeTimer = setInterval(() => {
      step++
      const t = step / FADE_STEPS
      next.volume = clamp01(target * t)
      if (prev) prev.volume = clamp01((prev.volume || target) * (1 - t))
      if (step >= FADE_STEPS) {
        if (this.fadeTimer) clearInterval(this.fadeTimer)
        this.fadeTimer = null
        prev?.pause()
      }
    }, CROSSFADE_MS / FADE_STEPS)
  }

  // ── Ambience (multiple simultaneous loops) ───────────────────────────────

  startAmbience(key: AmbienceKey) {
    if (this.activeAmbience.has(key)) return
    const src = this.resolve(this.manifest.ambience[key])
    if (!src) return
    const el = this.createAudio(src, true)
    if (!el) return
    el.volume = this.effectiveVolume('ambience')
    this.safePlay(el, src)
    this.ambienceEls.set(key, el)
    this.activeAmbience.add(key)
    this.notify()
  }

  stopAmbience(key: AmbienceKey) {
    const el = this.ambienceEls.get(key)
    el?.pause()
    this.ambienceEls.delete(key)
    this.activeAmbience.delete(key)
    this.notify()
  }

  stopAllAmbience() {
    this.ambienceEls.forEach((el) => el.pause())
    this.ambienceEls.clear()
    this.activeAmbience.clear()
    this.notify()
  }

  // ── Teardown ─────────────────────────────────────────────────────────────

  destroy() {
    this.stopMusic()
    this.stopAllAmbience()
    this.listeners.clear()
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private safePlay(el: HTMLAudioElement, src: string) {
    try {
      const result = el.play()
      // HTMLMediaElement.play() returns a Promise in spec-compliant browsers,
      // but test environments (jsdom) and some older engines return undefined.
      // Guard both shapes rather than assuming a Promise is always present.
      if (result && typeof result.catch === 'function') {
        result.catch(() => this.markFailed(src))
      }
    } catch {
      this.markFailed(src)
    }
  }

  private resolve(path: string | undefined): string | null {
    if (!path) return null
    const src = `${this.baseUrl}${path}`
    if (this.failedSources.has(src)) return null
    return src
  }

  private markFailed(src: string) {
    if (!this.failedSources.has(src)) {
      this.failedSources.add(src)
      // Log once — missing assets are expected until files are added
      console.info(`[audio] Asset not available: ${src} (add the file to enable)`)
    }
  }

  private createAudio(src: string, loop: boolean): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null   // SSR / test env safety
    const el = new Audio(src)
    el.loop = loop
    el.preload = 'auto'
    el.addEventListener('error', () => this.markFailed(src), { once: true })
    return el
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

// ─── Singleton (lazy) ─────────────────────────────────────────────────────────

let instance: AudioManager | null = null

export function getAudioManager(): AudioManager {
  if (!instance) instance = new AudioManager()
  return instance
}

/** Test-only: reset the singleton. */
export function __resetAudioManager() {
  instance?.destroy()
  instance = null
}
