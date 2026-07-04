import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="chr-panel w-full max-w-md p-8 text-center animate-fade-in">
        <p className="stat-label text-arcane-500 mb-2">CHRONICLE AI</p>
        <h1 className="font-display text-3xl font-bold mb-1">Welcome, Adventurer</h1>
        <p className="text-void-400 text-sm mb-2 font-mono">{user?.email}</p>
        <div className="chr-divider my-6" />
        <div className="chr-panel-spirit p-4 rounded-lg mb-6">
          <p className="stat-label text-spirit-400 mb-1">CHRONICLE AI</p>
          <p className="text-void-300 text-sm">
            Your adventures and campaigns are waiting below.
          </p>
        </div>
        <div className="flex flex-col gap-3 mb-4">
          <Link to="/campaigns" className="block">
            <Button variant="arcane" className="w-full">My Campaigns</Button>
          </Link>
          <Link to="/characters" className="block">
            <Button variant="ghost" className="w-full">My Characters</Button>
          </Link>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          Sign Out
        </Button>
      </div>
    </main>
  )
}
