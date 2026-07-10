/**
 * MainMenuPage — the Main Menu (UI 3.0, Pixel RPG Experience)
 *
 * Renamed from DashboardPage: the post-login surface is a JRPG main
 * menu at the traveler's camp, not a dashboard (UI_VISION.md Concept 2:
 * this screen's camera is "the world at rest"). The /dashboard route
 * path and all auth redirect targets are deliberately unchanged — the
 * player-facing mental model changes, the routing/auth scope does not
 * (a /menu alias is a later routing-cleanup phase).
 *
 * Menu semantics are presentation-only: "Continue" goes to the campaign
 * list — it is NOT a "load most recent session" data path (that would
 * be new game logic; see UI_VISION.md roadmap).
 */

import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui'
import { WorldRenderer, PixelPanel, SettingsModal } from '@/components/pixel'

const MENU_ITEMS = [
  { label: 'Continue', to: '/campaigns', hint: 'Return to your campaigns' },
  { label: 'New Chronicle', to: '/campaigns/new', hint: 'Begin a new adventure' },
  { label: 'My Characters', to: '/characters', hint: 'The heroes of your stories' },
]

export default function MainMenuPage() {
  const { user, signOut } = useAuth()
  const [selected, setSelected] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = (selected + 1) % MENU_ITEMS.length
      setSelected(next)
      itemRefs.current[next]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = (selected + MENU_ITEMS.length - 1) % MENU_ITEMS.length
      setSelected(prev)
      itemRefs.current[prev]?.focus()
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden bg-void-950">
      {/* The camp at dusk — the world at rest. */}
      <WorldRenderer scene="dusk-vale" ambience="fireflies" />

      <div className="relative z-10 w-full max-w-md text-center animate-fade-in">
        <p className="font-pixel-display text-[8px] text-arcane-500 mb-3 tracking-[0.3em] uppercase torch-flicker">
          Chronicle AI
        </p>
        <h1 className="font-display text-3xl font-bold text-bronze-300 mb-1">
          Welcome, Adventurer
        </h1>
        <p className="text-void-400 text-sm mb-6 font-mono">{user?.email}</p>

        <PixelPanel variant="arcane" glow className="p-4 mb-6 menu-enter text-left">
          <nav aria-label="Main menu" onKeyDown={onMenuKeyDown}>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {MENU_ITEMS.map((item, i) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    ref={(el) => { itemRefs.current[i] = el }}
                    onFocus={() => setSelected(i)}
                    onMouseEnter={() => setSelected(i)}
                    className="block focus-visible:outline-none"
                  >
                    <Button
                      variant="menuAction"
                      size="lg"
                      selected={selected === i}
                      className={['w-full', selected === i ? 'pixel-cursor' : ''].join(' ')}
                      tabIndex={-1}
                    >
                      <span className="flex-1 text-left">{item.label}</span>
                      <span className="font-pixel-body text-sm text-void-500">{item.hint}</span>
                    </Button>
                  </Link>
                </li>
              ))}
              <li>
                <Button
                  type="button"
                  variant="menuAction"
                  size="lg"
                  className="w-full"
                  onClick={() => setSettingsOpen(true)}
                >
                  <span className="flex-1 text-left">Settings</span>
                  <span className="font-pixel-body text-sm text-void-500">Audio &amp; options</span>
                </Button>
              </li>
            </ul>
          </nav>
        </PixelPanel>

        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign Out
        </Button>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}
