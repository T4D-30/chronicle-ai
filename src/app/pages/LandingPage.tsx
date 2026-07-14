/**
 * LandingPage — the Title Screen (UI 3.0, Pixel RPG Experience)
 *
 * Classic JRPG boot sequence, driven by the UI State Machine
 * (src/store/uiSceneStore.ts — UI_VISION.md Concept 1) instead of ad
 * hoc reveal flags:
 *
 *   title-vista   → the world alone (WorldRenderer night-camp + embers)
 *   title-logo    → the Chronicle AI logo fades in
 *   title-prompt  → "PRESS ANY KEY" blinks
 *   title-menu    → the start menu rises (Begin Your Chronicle / Sign In)
 *
 * Any keypress or click skips ahead to the menu at any point — the same
 * transition the machine defines for reduced-motion players, who start
 * at the full menu with no timed sequence (a still painting, not a
 * broken screen). Keyboard focus entering the page also reveals the
 * menu, so no user can be stranded staring at scenery (Law 1).
 *
 * Menu music: setContext() on mount selects the menu track via the
 * existing AudioManager — silent until real files land in public/audio/
 * (silent-fail by design; see UI_VISION.md audio philosophy).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { WorldRenderer, PixelPanel, useAudio } from '@/components/pixel'
import { useUiSceneStore } from '@/store/uiSceneStore'

const LOGO_DELAY_MS = 700
const PROMPT_DELAY_MS = 1600

const MENU_ITEMS = [
  { label: 'Begin Your Chronicle', to: '/signup', variant: 'arcane' as const },
  { label: 'Sign In', to: '/login', variant: 'ghost' as const },
]

export default function LandingPage() {
  const scene = useUiSceneStore((s) => s.scene)
  const { setContext } = useAudio()
  const [selected, setSelected] = useState(0)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  const logoVisible = scene !== 'title-vista'
  const promptVisible = scene === 'title-prompt'
  const menuVisible = scene === 'title-menu'

  // Boot sequence. Reduced-motion players skip straight to the menu.
  useEffect(() => {
    const store = useUiSceneStore.getState()
    store.reset()

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      store.transition('title-menu')
      return
    }

    const logoTimer = window.setTimeout(() => useUiSceneStore.getState().advance(), LOGO_DELAY_MS)
    const promptTimer = window.setTimeout(() => useUiSceneStore.getState().advance(), PROMPT_DELAY_MS)
    return () => {
      window.clearTimeout(logoTimer)
      window.clearTimeout(promptTimer)
      useUiSceneStore.getState().reset()
    }
  }, [])

  // Menu music (silent until audio files exist — AudioManager silent-fail).
  useEffect(() => {
    setContext({ inCombat: false, isBoss: false, locationKind: null })
  }, [setContext])

  // "Press any key" — keydown/click anywhere skips to the menu.
  const reveal = useCallback(() => {
    useUiSceneStore.getState().transition('title-menu')
  }, [])

  useEffect(() => {
    if (menuVisible) return
    const onKeyDown = () => reveal()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onKeyDown)
    }
  }, [menuVisible, reveal])

  // Arrow-key selection between menu items, JRPG style.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (selected + 1) % MENU_ITEMS.length
      setSelected(next)
      itemRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (selected + MENU_ITEMS.length - 1) % MENU_ITEMS.length
      setSelected(prev)
      itemRefs.current[prev]?.focus()
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center overflow-hidden bg-void-950"
      onFocusCapture={() => { if (!menuVisible) reveal() }}
    >
      {/* The world comes first (UI_VISION.md layout principle 1). */}
      <WorldRenderer scene="night-camp" ambience="fireflies" />

      {/* Logo */}
      {logoVisible && (
        <div className="relative z-10 mb-8 animate-fade-in" data-testid="title-logo">
          <p className="font-pixel-display text-[8px] text-arcane-500 mb-4 tracking-[0.3em] uppercase torch-flicker">
            AI-Powered Tabletop RPG
          </p>
          <h1 className="font-pixel-display text-3xl md:text-5xl leading-relaxed text-gradient-arcane mb-4 pixel-crisp">
            Chronicle AI
          </h1>
          <p className="font-lore text-lg text-void-300 max-w-md italic">
            "Every hero's story begins with a single choice."
          </p>
        </div>
      )}

      {/* Press Any Key */}
      {promptVisible && (
        <button
          type="button"
          onClick={reveal}
          className="relative z-10 pixel-cursor font-pixel-display text-[10px] text-bronze-300 uppercase tracking-[0.25em] py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400"
          data-testid="press-any-key"
        >
          Press Any Key
        </button>
      )}

      {/* Start menu */}
      {menuVisible && (
        <div className="relative z-10 flex flex-col items-center" data-testid="title-menu">
          <div className="flex items-center gap-4 mb-8" aria-hidden="true">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-arcane-700" />
            <div className="h-1.5 w-1.5 rounded-full bg-arcane-500" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-arcane-700" />
          </div>

          <PixelPanel variant="arcane" glow className="p-4 mb-12 menu-enter">
            <nav aria-label="Title menu" onKeyDown={onMenuKeyDown}>
              <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {MENU_ITEMS.map((item, i) => (
                  <li key={item.to} className="flex justify-center">
                    <Link
                      to={item.to}
                      ref={(el) => { itemRefs.current[i] = el }}
                      onFocus={() => setSelected(i)}
                      onMouseEnter={() => setSelected(i)}
                      className="focus-visible:outline-none"
                    >
                      <Button
                        variant={item.variant}
                        size="lg"
                        selected={selected === i}
                        className={selected === i ? 'pixel-cursor' : undefined}
                        tabIndex={-1}
                      >
                        {item.label}
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </PixelPanel>

          {/* Value props — helps new players understand what the game is */}
          <ul
            className="flex flex-col sm:flex-row gap-6 sm:gap-12 text-center list-none p-0 m-0 animate-fade-in"
            aria-label="Features"
          >
            {[
              { icon: '🎲', title: 'Real D&D Mechanics', desc: 'Dice, modifiers, conditions — by the rules.' },
              { icon: '🤖', title: 'AI Director', desc: 'A living world that reacts to every choice.' },
              { icon: '⚔️', title: 'Solo Adventure', desc: 'No DM required. Play anywhere, anytime.' },
            ].map(({ icon, title, desc }) => (
              <li key={title} className="flex flex-col items-center gap-1">
                <span className="text-3xl mb-1" aria-hidden="true">{icon}</span>
                <p className="font-pixel-body text-base font-semibold text-void-50">{title}</p>
                <p className="font-pixel-body text-sm text-void-400 max-w-[150px]">{desc}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  )
}
