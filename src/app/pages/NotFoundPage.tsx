import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="stat-label text-void-600 mb-4 tracking-[0.3em]">404 — PATH NOT FOUND</p>
      <h1 className="font-display text-5xl font-black text-void-700 mb-4">Lost in the Void</h1>
      <p className="font-lore text-void-500 italic mb-8">"Even the most seasoned adventurer sometimes wanders from the map."</p>
      <Link to="/"><Button variant="ghost">Return to the Realm</Button></Link>
    </main>
  )
}
