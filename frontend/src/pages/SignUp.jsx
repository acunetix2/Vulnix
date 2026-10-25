import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Shield,
  Check,
  Users,
  Zap,
  Layers,
  Search,
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
const SIGNUP_HEADLINES = ['Find risk early.', 'Understand every finding.', 'Fix issues sooner.']

export function SignUp() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [error, setError] = useState(null)
  const [authStep, setAuthStep] = useState('options')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  })
  const typedLine = 0
  const typedText = 'Find vulnerabilities.'

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.agreeToTerms) {
      toast.error('Terms required', {
        description: 'You must agree to the Terms of Service and Privacy Policy.'
      })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      toast.error('Password mismatch', {
        description: 'Please ensure both passwords match.'
      })
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.')
      toast.error('Password too short', {
        description: 'Password must be at least 8 characters long.'
      })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await api.signup(
        formData.email,
        formData.password,
        formData.name,
        `${window.location.origin}/auth/callback`
      )

      if (response.access_token) {
        login(response.access_token, response.user)
        toast.success('Account created!', {
          description: 'Welcome to Vulnix.'
        })
        navigate('/app/dashboard')
      } else {
        toast.success('Check your email', {
          description: 'We sent a verification link to your email address.'
        })
        navigate('/signin')
      }
    } catch (err) {
      const message = err.message || 'Could not create account. Please try again.'
      setError(message)
      toast.error('Sign up failed', {
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

      {/* Main Content Container */}
      <div className="pointer-events-none relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 py-4 sm:px-8 lg:px-12">
        <div className="my-4 flex flex-1 items-center justify-center py-4">
          <div className="hidden">
            <p className="auth-copy-enter mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-[#00dc82]">
              Security for the way you build
            </p>
            <AuthTypewriterHeadline phrases={SIGNUP_HEADLINES} accent="Ship with confidence." />
            <p className="auth-copy-enter auth-copy-delay-2 mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Bring your code into one clear view, understand what needs attention, and move forward with practical guidance.
            </p>
            <div className="auth-copy-enter auth-copy-delay-3 mt-7 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-[#00dc82]" />
                Code and dependency reviews
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4 text-[#00dc82]" />
                Shared team workspace
              </span>
            </div>
          </div>

          {/* Left Column: Product Showcase */}
          {SHOW_LEGACY_AUTH_SHOWCASE && (
            <div className="hidden">
            
            {/* Header info */}
            <div>
              {/* Headline with Typewriter Animation */}
              <h1 className="text-4xl sm:text-5xl xl:text-[3.25rem] font-bold tracking-tight text-white leading-[1.15] mb-4 min-h-[4.5rem] sm:min-h-[5.5rem]">
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
                Get AI-assisted code security analysis, discover vulnerabilities, and remediate faster — all in one powerful platform.
              </p>

              {/* Bullet Features */}
              <div className="space-y-3 max-w-lg mb-4">
                <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                  <span className="size-5 rounded-full bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] flex items-center justify-center shrink-0">
                    <ShieldCheck className="size-3" />
                  </span>
                  <span>Multi-scanner integration (Semgrep, Gitleaks, Bandit, Trivy)</span>
                </div>

                <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                  <span className="size-5 rounded-full bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] flex items-center justify-center shrink-0">
                    <Layers className="size-3" />
                  </span>
                  <span>AI-powered analysis and risk prioritization</span>
                </div>

                <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                  <span className="size-5 rounded-full bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] flex items-center justify-center shrink-0">
                    <Shield className="size-3" />
                  </span>
                  <span>Dependency & secret detection</span>
                </div>

                <div className="flex items-center gap-3 text-slate-300 text-xs sm:text-sm">
                  <span className="size-5 rounded-full bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] flex items-center justify-center shrink-0">
                    <Users className="size-3" />
                  </span>
                  <span>Collaborate with your team</span>
                </div>
              </div>
            </div>

            {/* 3D Dashboard Mockup Graphic */}
            <div className="relative pt-2 pb-2">
              <div className="relative mx-auto max-w-[620px] w-full">
                
                {/* Floating "AI Analysis" Card (Top Right) */}
                <div className="absolute -top-6 right-2 sm:right-6 z-20 bg-[#120a26]/95 border border-purple-500/40 rounded-2xl p-3.5 shadow-[0_0_35px_rgba(168,85,247,0.3)] backdrop-blur-xl max-w-[230px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1 rounded-md bg-purple-500/20 text-[#c084fc]">
                      <Layers className="size-4 stroke-[2.2]" />
                    </div>
                    <span className="text-xs font-semibold text-white tracking-tight">AI Analysis</span>
                  </div>
                  <p className="text-[11px] text-purple-200/90 leading-tight mb-2.5">
                    2 critical vulnerabilities need immediate attention.
                  </p>
                  <button
                    type="button"
                    className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[10px] font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                  >
                    View suggestions
                    <ArrowRight className="size-3" />
                  </button>
                </div>

                {/* Dashboard Window */}
                <div className="relative z-10 bg-[#0a0f19]/90 border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden p-4 sm:p-5">
                  
                  {/* Top Bar inside mockup */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-white">Project Scan</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00dc82]/15 text-[#00dc82] text-[10px] font-medium border border-[#00dc82]/30">
                        <span className="size-1.5 rounded-full bg-[#00dc82]" />
                        Completed
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">Scan completed in 4m 32s</span>
                  </div>

                  {/* Findings Metrics Summary */}
                  <div className="grid grid-cols-5 gap-2 text-center p-3 rounded-xl bg-[#080d16]/70 border border-slate-800/80 mb-4">
                    <div>
                      <div className="text-[10px] text-slate-400">Total Findings</div>
                      <div className="text-lg font-bold text-white">32</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-rose-400">Critical</div>
                      <div className="text-lg font-bold text-rose-500">3</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-orange-400">High</div>
                      <div className="text-lg font-bold text-orange-400">7</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-amber-400">Medium</div>
                      <div className="text-lg font-bold text-amber-400">14</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-emerald-400">Low</div>
                      <div className="text-lg font-bold text-[#00dc82]">8</div>
                    </div>
                  </div>

                  {/* Scanners Status Rows */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { name: 'Semgrep' },
                      { name: 'Gitleaks' },
                      { name: 'Bandit' },
                      { name: 'Trivy' },
                    ].map((scanner) => (
                      <div
                        key={scanner.name}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#080d16]/50 border border-slate-800/60"
                      >
                        <span className="font-medium text-slate-300 text-xs">{scanner.name}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#00dc82]">
                          Completed
                          <Check className="size-3 stroke-[3]" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cyber Rings & Holographic Shield (Bottom Right) */}
                <div className="absolute -bottom-7 -right-5 z-20 pointer-events-none">
                  <div className="relative flex items-center justify-center w-36 h-36">
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,0.5)] transform -rotate-45 scale-y-50 animate-pulse" />
                    <div className="absolute inset-4 rounded-full border border-purple-500/80 shadow-[0_0_20px_rgba(168,85,247,0.6)] transform -rotate-45 scale-y-50" />
                    
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
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Search className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Detect</h4>
                  <p className="text-[11px] text-slate-400">faster</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Shield className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Reduce</h4>
                  <p className="text-[11px] text-slate-400">risk</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Users className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Secure</h4>
                  <p className="text-[11px] text-slate-400">together</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/30 text-[#00dc82] shrink-0">
                  <Zap className="size-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight">Build with</h4>
                  <p className="text-[11px] text-slate-400">confidence</p>
                </div>
              </div>
            </div>

            </div>
          )}

          {/* Right Column: Sign Up Card */}
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
                  {authStep === 'options' ? 'Create your account' : 'Continue with email'}
                </h2>
                <p className="text-slate-400 text-xs leading-relaxed sm:text-sm">
                  {authStep === 'options'
                    ? 'Join Vulnix and start securing your code with clear, practical insights.'
                    : 'Enter your details and create a password for your Vulnix account.'}
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
                  <p className="text-center text-xs leading-5 text-slate-400">
                    By continuing, you agree to the{' '}
                    <Link to="/legal/terms" className="text-[#c084fc] hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/legal/privacy" className="text-[#c084fc] hover:underline">Privacy Policy</Link>.
                  </p>
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
                    ← All sign-up options
                  </button>

              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="size-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Full name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      disabled={loading}
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Work email */}
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Work email
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
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                      disabled={loading}
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
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

                {/* Confirm password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      disabled={loading}
                      className="w-full bg-[#080d16] border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-[#00dc82] focus:ring-1 focus:ring-[#00dc82] transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Terms agreement */}
                <div className="pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-slate-300 leading-normal">
                    <input
                      type="checkbox"
                      name="agreeToTerms"
                      checked={formData.agreeToTerms}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span
                      className={`size-4 rounded border flex items-center justify-center transition-all mt-0.5 shrink-0 ${
                        formData.agreeToTerms
                          ? 'bg-[#00dc82] border-[#00dc82] text-[#052814]'
                          : 'border-slate-600 bg-[#080d16]'
                      }`}
                    >
                      {formData.agreeToTerms && <Check className="size-3 stroke-[3]" />}
                    </span>
                    <span>
                      I agree to the{' '}
                      <Link to="/legal/terms" className="text-[#a855f7] hover:text-[#c084fc] font-medium">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/legal/privacy" className="text-[#a855f7] hover:text-[#c084fc] font-medium">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00dc82] hover:bg-[#00c575] active:scale-[0.99] text-[#042412] font-bold text-sm py-3 px-4 rounded-xl shadow-[0_0_25px_rgba(0,220,130,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="size-4 stroke-[2.5]" />
                    </>
                  )}
                </button>
              </form>

                </>
              )}

              {/* Sign in link */}
              <p className="mt-5 text-center text-xs text-slate-400">
                Already have an account?{' '}
                <Link
                  to="/signin"
                  className="font-semibold text-[#a855f7] hover:text-[#c084fc] transition-colors ml-1"
                >
                  Sign in
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
