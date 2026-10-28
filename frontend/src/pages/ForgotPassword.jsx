import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { BackgroundBoxesDemo } from '../components/app/BackgroundBoxesDemo'
import { FloatingHelp } from '../components/app/FloatingHelp'
import { VulnixFooter } from '../components/app/VulnixFooter'
import { VulnixLegalGraphicBanner } from './landing/legal/VulnixLegalGraphicBanner'
import { API_BASE_URL } from '../lib/constants'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.detail || 'Could not send reset link. Please check the email and try again.')
      }

      setSubmitted(true)
      toast.success('Reset link dispatched', {
        description: `Check your inbox at ${email} for instructions.`,
      })
    } catch (err) {
      const message = err.message || 'Could not send reset link. Please check the email and try again.'
      setError(message)
      toast.error('Failed to send reset link', { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-[#06080e] text-slate-100 selection:bg-[#00dc82]/30 selection:text-[#00dc82]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <BackgroundBoxesDemo className="fixed inset-0 h-dvh bg-[#06080e]" />
      </div>

      <div className="pointer-events-none relative z-10 mx-auto flex min-h-dvh w-full max-w-[1440px] flex-1 flex-col px-5 py-4 sm:px-8 lg:px-12">
        <main className="flex flex-1 items-center justify-center py-8">
          <section
            aria-labelledby="reset-title"
            className="auth-copy-enter pointer-events-auto w-full max-w-[440px] rounded-3xl border border-slate-800/90 bg-[#0c121e]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-8"
          >
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

            <div className="mb-6 text-center">
              <span className="text-lg font-bold tracking-tight text-purple-500">Vulnix</span>
            </div>

            <div className="mb-6 text-center">
              <h1 id="reset-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {submitted ? 'Check your inbox' : 'Reset your password'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {submitted
                  ? 'If an account exists for this address, you’ll receive instructions to reset your password.'
                  : 'Enter the email address associated with your account and we’ll send you a reset link.'}
              </p>
            </div>

            {error && (
              <div
                className="mb-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300"
                role="alert"
              >
                <AlertCircle className="size-4 shrink-0 text-rose-400" aria-hidden />
                <span>{error}</span>
              </div>
            )}

            {submitted ? (
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-[#00dc82]/30 bg-[#00dc82]/10 p-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#00dc82]" aria-hidden />
                  <p className="text-sm leading-6 text-slate-300">
                    Follow the instructions sent to{' '}
                    <strong className="break-all font-semibold text-white">{email}</strong>.
                    If it doesn’t arrive, check your spam folder or try again.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="w-full text-center text-sm font-medium text-[#c084fc] transition-colors hover:text-white"
                >
                  Try another email address
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="mb-2 block text-sm font-medium text-slate-200">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500"
                      aria-hidden
                    />
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-700/80 bg-[#080d16] py-3 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-[#00dc82] focus:outline-none focus:ring-1 focus:ring-[#00dc82] disabled:opacity-50"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00dc82] px-4 py-3.5 text-sm font-bold text-[#042412] shadow-[0_0_25px_rgba(0,220,130,0.25)] transition-colors hover:bg-[#00c575] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Sending reset link…
                    </>
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="size-4" aria-hidden />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="mt-6 border-t border-slate-800 pt-5 text-center">
              <Link
                to="/signin"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white"
              >
                <ArrowLeft className="size-4" aria-hidden />
                Back to sign in
              </Link>
            </div>
          </section>
        </main>

        <div className="pointer-events-auto w-full max-w-4xl mx-auto">
          <VulnixLegalGraphicBanner />
        </div>
        <VulnixFooter dark className="pointer-events-auto mt-4 px-0" />
      </div>
      <FloatingHelp dark />
    </div>
  )
}
