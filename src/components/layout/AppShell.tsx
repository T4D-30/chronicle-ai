import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

/**
 * Root layout shell.
 * Provides the ambient background, skip link (WCAG 2.4.1), and base structure.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      {/* Skip to main content — WCAG 2.4.1 bypass block */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Ambient background glow — ember-warm (UI 3.0 atmosphere pass;
          the old cool indigo tint predated the dark-fantasy repaint) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(180,90,26,0.12) 0%, transparent 70%)',
        }}
      />
      <div id="main-content" className="relative z-10 flex flex-col flex-1">
        {children}
      </div>
    </div>
  )
}
