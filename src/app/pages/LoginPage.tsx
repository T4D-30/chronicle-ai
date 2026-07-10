import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { GoogleSignInButton } from '@/components/auth'
import { WorldRenderer } from '@/components/pixel'
import { authService } from '@/lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authService.signIn({ email, password })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 overflow-hidden">
      {/* Dawn on the ridge — the journey about to resume. Decorative
          menu scenery per UI_VISION.md Concept 7. */}
      <WorldRenderer scene="dawn-ridge" ambience="fog" />
      <div className="chr-panel-arcane relative z-10 w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-gradient-arcane mb-2">Welcome Back</h1>
          <p className="text-void-400 text-sm">Continue your chronicle</p>
        </div>

        <GoogleSignInButton context="login" />

        <div className="flex items-center gap-3 my-6" role="separator">
          <div className="flex-1 h-px bg-void-700/50" />
          <span className="text-void-500 text-xs uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-void-700/50" />
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="hero@chronicle.ai" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <p className="text-harm-400 text-sm text-center">{error}</p>}
          <Button type="submit" variant="arcane" size="lg" loading={loading} className="mt-2 w-full">
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
        <p className="mt-6 text-center text-void-400 text-sm">
          New to the realm?{' '}
          <Link to="/signup" className="text-arcane-400 hover:text-arcane-300 transition-colors">Create an account</Link>
        </p>
      </div>
    </main>
  )
}
