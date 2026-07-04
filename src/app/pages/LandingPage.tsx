import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { AmbientOverlay, PixelPanel } from '@/components/pixel'

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center overflow-hidden bg-void-950">
      <AmbientOverlay kind="fireflies" count={14} />

      <div className="relative z-10 mb-8 animate-fade-in">
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

      <div className="flex items-center gap-4 mb-10 relative z-10" aria-hidden="true">
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-arcane-700" />
        <div className="h-1.5 w-1.5 rounded-full bg-arcane-500" />
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-arcane-700" />
      </div>

      {/* Title-screen menu — pixel-bordered like a GBA start menu */}
      <PixelPanel variant="arcane" glow className="relative z-10 p-4 mb-12 animate-slide-up">
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to="/signup">
            <Button variant="arcane" size="lg">Begin Your Chronicle</Button>
          </Link>
          <Link to="/login">
            <Button variant="ghost" size="lg">Sign In</Button>
          </Link>
        </div>
      </PixelPanel>

      {/* Value props — helps new players understand what the game is */}
      <ul className="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-12 text-center list-none p-0 m-0" aria-label="Features">
        {[
          { icon: '🎲', title: 'Real D&D Mechanics', desc: 'Dice, modifiers, conditions — by the rules.' },
          { icon: '🤖', title: 'AI Director', desc: 'A living world that reacts to every choice.' },
          { icon: '⚔️', title: 'Solo Adventure', desc: 'No DM required. Play anywhere, anytime.' },
        ].map(({ icon, title, desc }) => (
          <li key={title} className="flex flex-col items-center gap-1">
            <span className="text-3xl mb-1" aria-hidden="true">{icon}</span>
            <p className="font-pixel-body text-base font-semibold text-white">{title}</p>
            <p className="font-pixel-body text-sm text-void-400 max-w-[150px]">{desc}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
