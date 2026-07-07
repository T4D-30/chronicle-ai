import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { GoogleSignInButton } from '@/components/auth'
import { CinematicBackdrop } from '@/components/layout/CinematicBackdrop'
import { HeroPanel } from '@/components/layout/HeroPanel'
import { authService } from '@/lib/supabase'

export default function SignupPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authService.signUp({ email, password, displayName })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden bg-void-950">
      <CinematicBackdrop fireflyCount={8} />
      <HeroPanel className="relative z-10 w-full max-w-sm p-8 animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-gradient-arcane mb-2">Begin Your Journey</h1>
          <p className="text-void-400 text-sm">Create your chronicler account</p>
        </div>

        <GoogleSignInButton context="signup" />

        <div className="flex items-center gap-3 my-6" role="separator">
          <div className="flex-1 h-px bg-void-700/50" />
          <span className="text-void-500 text-xs uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-void-700/50" />
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
          <Input label="Display Name" type="text" placeholder="Aeron the Bold" value={displayName} onChange={(e) => setDisplayName(e.target.value)} hint="This is how you'll appear in the chronicle" autoComplete="username" />
          <Input label="Email" type="email" placeholder="hero@chronicle.ai" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required hint="Minimum 8 characters" autoComplete="new-password" />
          {error && <p className="text-harm-400 text-sm text-center">{error}</p>}
          <Button type="submit" variant="arcane" size="lg" loading={loading} className="mt-2 w-full">
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-void-400 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-arcane-400 hover:text-arcane-300 transition-colors">Sign in</Link>
        </p>
      </HeroPanel>
    </main>
  )
}
