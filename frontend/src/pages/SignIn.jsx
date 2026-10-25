import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Check,
  AlertTriangle,
  Users,
  BarChart3,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { GitHub, GitLab, Google } from '../components/icons'
import { BackgroundBoxesDemo } from '../components/app/BackgroundBoxesDemo'
import { FloatingHelp } from '../components/app/FloatingHelp'
import { VulnixFooter } from '../components/app/VulnixFooter'
import { VulnixLegalGraphicBanner } from './landing/legal/VulnixLegalGraphicBanner'
import { AuthTypewriterHeadline } from '../components/app/AuthTypewriterHeadline'

const API_BASE = '/api/v1'
const SHOW_LEGACY_AUTH_SHOWCASE = false
const SIGNIN_HEADLINES = ['Review what changed.', 'Prioritize what matters.', 'Pick up where you left off.']

export function SignIn() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [error, setError] = useState(null)
  const [authStep, setAuthStep] = useState('options')
  const typedLine = 0
  const typedText = 'Find vulnerabilities.'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await api.login(formData.email, formData.password)
      login(response.access_token, response.user)
      toast.success('Welcome back!', {
        description: 'You have been successfully signed in.'
      })
      navigate('/app/dashboard')
    } catch (err) {
      const message = err.message || 'Invalid email or password. Please try again.'
      setError(message)
      toast.error('Sign in failed', {
        description: message
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider) => {
    setOauthLoading(provider)
    setError(null)

    try {
      const redirectUri = `${window.location.origin}/auth/callback`

      const response = await fetch(`${API_BASE}/auth/oauth/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          redirect_uri: redirectUri
        })
      })

      if (!response.ok) {
        throw new Error(`OAuth initialization failed: ${response.statusText}`)
      }

      const data = await response.json()
      sessionStorage.setItem('oauth_provider', provider)
      sessionStorage.setItem('oauth_redirect_uri', redirectUri)
      window.location.href = data.authorization_url
    } catch (err) {
      const message = err.message || `Failed to sign in with ${provider}. Please try again.`
      setError(message)
      toast.error(`${provider.charAt(0).toUpperCase() + provider.slice(1)} sign in failed`, {
        description: message
      })
      setOauthLoading(null)
    }
  }

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: value,
    }))
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col justify-between overflow-x-hidden overflow-y-auto bg-[#06080e] text-slate-100 selection:bg-[#00dc82]/30 selection:text-[#00dc82]">
      <div className="fixed inset-0 overflow-hidden" aria-hidden="true">
        <BackgroundBoxesDemo className="fixed inset-0 h-screen bg-[#06080e]" />
      </div>

      {/* Main Container */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-4 sm:px-8 lg:px-12">
        <div className="my-4 flex flex-1 items-center justify-center py-4">
          <div className="hidden">
            <p className="auth-copy-enter mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#00dc82]">
              Security, with clarity
            </p>
            <AuthTypewriterHeadline phrases={SIGNIN_HEADLINES} accent="Ship safer releases." />
            <p className="auth-copy-enter auth-copy-delay-2 mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Pick up where your team left off. See the risks that matter and the next steps to resolve them.
            </p>
            <div className="auth-copy-enter auth-copy-delay-3 mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#00dc82]" />
                Prioritized findings
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers className="size-4 text-[#00dc82]" />
                Clear review history
              </span>
            </div>
          </div>

          {/* Left Column: Product Showcase */}
          {SHOW_LEGACY_AUTH_SHOWCASE && (
            <div className="hidden">
            
            {/* Headline with Typewriter Animation */}
            <div>
              <h1 className="text-4xl sm:text-5xl xl:text-[3.35rem] font-bold tracking-tight text-white leading-[1.15] mb-4 min-h-[4.5rem] sm:min-h-[5.5rem]">
                <span
                  className={
                    typedLine === 2
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#b366ff] via-[#d07aff] to-[#a855f7]'
                      : 'text-white'
                  }
                >
                  {typedText}
                  <span className="inline-block w-[3px] h-[0.9em] align-middle ml-1 bg-current animate-pulse" />
                </span>
              </h1>

              <p className="text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed mb-6">
                AI-powered security analysis for modern development teams. Scan, analyze, and remediate — all in one place.
              </p>
            </div>

            {/* 3D Holographic Graphic / Scan Mockup */}
            <div className="relative pt-4 pb-2">
              <div className="relative mx-auto max-w-[620px] w-full">
                
                {/* Floating "AI Analysis" Card (Top Right) */}
                <div className="absolute -top-6 right-2 sm:right-6 z-20 bg-[#120a26]/95 border border-purple-500/40 rounded-2xl p-3.5 shadow-[0_0_35px_rgba(168,85,247,0.3)] backdrop-blur-xl max-w-[210px]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1 rounded-md bg-purple-500/20 text-[#c084fc]">
                      <Layers className="size-4 stroke-[2.2]" />
                    </div>
                    <span className="text-xs font-semibold text-white tracking-tight">AI Analysis</span>
                  </div>
                  <p className="text-[11px] text-purple-200/80 leading-snug">
                    Smarter insights.<br />Faster remediation.
                  </p>
                </div>

                {/* Console Window */}
                <div className="relative z-10 bg-[#0a0f19]/90 border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden">
                  {/* Titlebar */}
                  <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-800/80 bg-[#080d16]/70">
                    <span className="size-2.5 rounded-full bg-rose-500/80" />
                    <span className="size-2.5 rounded-full bg-amber-500/80" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80" />
                  </div>

                  {/* Window Grid */}
                  <div className="grid grid-cols-12 text-xs">
                    {/* Left Pane: Scan Results */}
                    <div className="col-span-5 border-r border-slate-800/80 p-4 bg-[#080d16]/40">
                      <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 mb-3">
                        Scan Results
                      </div>
                      <div className="space-y-2.5">
                        {[
                          { name: 'Semgrep' },
                          { name: 'Gitleaks' },
                          { name: 'Bandit' },
                          { name: 'Trivy' },
                        ].map((scanner) => (
                          <div key={scanner.name} className="flex items-center justify-between text-slate-300">
                            <span className="font-medium text-slate-200">{scanner.name}</span>
                            <span className="size-4 rounded-full bg-[#00dc82]/15 text-[#00dc82] flex items-center justify-center">
                              <Check className="size-3 stroke-[3]" />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Pane: Code + Finding */}
                    <div className="col-span-7 p-4 bg-[#070b13]/60 font-mono text-[11px] flex flex-col justify-between">
                      <div className="space-y-1 text-slate-400">
                        <div><span className="text-slate-600 mr-3">1</span><span className="text-purple-400">import</span> os</div>
                        <div><span className="text-slate-600 mr-3">2</span><span className="text-purple-400">def</span> <span className="text-cyan-400">get_secret</span>():</div>
                        <div className="mt-1 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                          <span className="text-rose-300">
                            <span className="text-slate-600 mr-3">3</span>return os.environ.get("API_KEY")
                          </span>
                          <AlertTriangle className="size-3.5 text-rose-400 shrink-0 ml-1" />
                        </div>
                      </div>

                      {/* Hardcoded secret alert box */}
                      <div className="mt-3 p-3 rounded-xl bg-[#111726]/90 border border-slate-700/60 font-sans">
                        <div className="flex items-center gap-1.5 text-white font-semibold text-xs mb-1">
                          <span className="size-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">!</span>
                          Hardcoded secret detected
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                          Use environment variables instead of hardcoding sensitive data.
                        </p>
                        <button
                          type="button"
                          className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[11px] font-medium px-3 py-1 rounded-lg flex items-center gap-1 transition-all"
                        >
                          View fix suggestion
                          <ArrowRight className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3D Holographic Cyber Platform & Shield (Bottom Left) */}
                <div className="absolute -bottom-8 -left-8 z-20 pointer-events-none">
                  <div className="relative flex items-center justify-center w-36 h-36">
                    {/* Outer Glowing Cyan Ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.5)] transform -rotate-45 scale-y-50 animate-pulse" />
                    {/* Inner Glowing Purple Ring */}
                    <div className="absolute inset-4 rounded-full border border-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.6)] transform -rotate-45 scale-y-50" />
                    {/* Glowing Platform Center */}
                    <div className="absolute inset-8 rounded-full bg-gradient-to-t from-cyan-500/30 to-emerald-400/20 blur-sm transform -rotate-45 scale-y-50" />
                    
                    {/* Holographic Shield with Green Lock */}
                    <div className="relative z-30 flex items-center justify-center p-3.5 rounded-2xl bg-[#091524]/90 border-2 border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.6)] backdrop-blur-md">
                      <ShieldCheck className="size-10 text-cyan-400" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="size-4 text-[#00dc82] drop-shadow-[0_0_8px_#00dc82]" />
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Bottom 4 Feature Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/60">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Multi-Scanner</h4>
                  <p className="text-[11px] text-slate-400">Integration</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Layers className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">AI-Powered</h4>
                  <p className="text-[11px] text-slate-400">Analysis</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Users className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Team</h4>
                  <p className="text-[11px] text-slate-400">Collaboration</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <BarChart3 className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Actionable</h4>
                  <p className="text-[11px] text-slate-400">Reports</p>
                </div>
              </div>
            </div>

            </div>
          )}

          {/* Right Column: Sign In Card */}
          <div className="flex w-full justify-center">
            <div className="auth-copy-enter pointer-events-auto w-full max-w-[420px] rounded-3xl border border-slate-800/90 bg-[#0c121e]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
              
              {/* Back to home */}
              <div className="mb-4">
                <Link
                  to="/"
                  className="group inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
                >
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span>Back to home</span>
                </Link>
              </div>

              <div className="mb-4 text-center">
                <span className="text-lg font-bold tracking-tight text-purple-500">Vulnix</span>
              </div>

              {/* Header */}
              <div className="mb-5 text-center">
                <h2 className="mb-1.5 text-2xl font-bold tracking-tight text-white">
                  {authStep === 'options' ? 'Welcome back' : 'Continue with email'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {authStep === 'options'
                    ? 'Sign in securely with your preferred account.'
                    : 'Enter your email and password to continue to Vulnix.'}
                </p>
              </div>

              {authStep === 'options' ? (
                <div className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">
                      <AlertCircle className="size-4 shrink-0 text-rose-400" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      disabled={oauthLoading !== null}
                      onClick={() => handleOAuthLogin('github')}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0e1422] px-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-[#141d30] hover:text-white disabled:opacity-50"
                    >
                      <GitHub className="size-6 text-white" />
                      GitHub
                    </button>
                    <button
                      type="button"
                      disabled={oauthLoading !== null}
                      onClick={() => handleOAuthLogin('gitlab')}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0e1422] px-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-[#141d30] hover:text-white disabled:opacity-50"
                    >
                      <GitLab className="size-6" />
                      GitLab
                    </button>
                    <button
                      type="button"
                      disabled={oauthLoading !== null}
                      onClick={() => handleOAuthLogin('google')}
                      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#0e1422] px-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-[#141d30] hover:text-white disabled:opacity-50"
                    >
                      <Google className="size-6" />
                      Google
                    </button>
                  </div>
                  {oauthLoading && (
                    <p className="text-center text-sm text-slate-400" role="status">
                      Connecting to {oauthLoading}…
                    </p>
                  )}
                  <div className="relative py-1 text-center">
                    <div className="absolute inset-x-0 top-1/2 border-t border-slate-800" />
                    <span className="relative bg-[#0c121e] px-3 text-xs text-slate-500">or</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthStep('email')}
                    className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-700 bg-transparent px-4 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-white/5"
                  >
                    Continue with email
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep('options')
                      setError(null)
                    }}
                    className="mb-4 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                  >
                    ← All sign-in options
                  </button>

              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@company.com"
                      disabled={loading}
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter your password"
                      disabled={loading}
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-3 pl-10 pr-10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span
                      className={`size-4 rounded border flex items-center justify-center transition-all ${
                        formData.rememberMe
                          ? 'bg-[#00dc82] border-[#00dc82] text-[#052814]'
                          : 'border-slate-600 bg-[#080d16]'
                      }`}
                    >
                      {formData.rememberMe && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <span>Remember me</span>
                  </label>

                  <Link
                    to="/forgot-password"
                    className="text-[#a855f7] hover:text-[#c084fc] font-medium transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00dc82] hover:bg-[#00c575] active:scale-[0.99] text-[#042412] font-bold text-sm py-3.5 px-4 rounded-xl shadow-[0_0_25px_rgba(0,220,130,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="size-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

                </>
              )}

              {/* Sign Up Link */}
              <p className="mt-6 text-center text-xs text-slate-400">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-[#a855f7] hover:text-[#c084fc] transition-colors ml-1"
                >
                  Sign up
                </Link>
              </p>

            </div>
          </div>

        </div>

        <div className="pointer-events-auto w-full max-w-4xl mx-auto">
          <VulnixLegalGraphicBanner />
        </div>
        <VulnixFooter dark className="pointer-events-auto mt-4 px-0" />
      </div>
      <FloatingHelp dark />
    </div>
  )
}
