import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Bot } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { HoverBorderGradient } from '../../../components/ui/hover-border-gradient'
import { GitHub, XformerlyTwitter, LinkedIn } from '../../../components/icons'

const productLinks = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'Code Scanning', to: '/product/scanning' },
  { label: 'AI Review', to: '/product/ai-review' },
  { label: 'Secrets', to: '/product/secrets' },
  { label: 'Dependencies', to: '/product/dependencies' },
  { label: 'Compliance', to: '/product/compliance' },
  { label: 'Integrations', to: '/product/integrations' },
  { label: 'Reports', to: '/product/reports' },
  { label: 'Feature Catalog', to: '/product/features' },
]

const solutionLinks = [
  { label: 'AI Builders', to: '/solutions/ai-builders' },
  { label: 'No Code', to: '/solutions/no-code' },
  { label: 'Beginners', to: '/solutions/beginners' },
  { label: 'Developers', to: '/solutions/developers' },
  { label: 'Postgres Devs', to: '/solutions/postgres-devs' },
  { label: 'Vibe Coders', to: '/solutions/vibe-coders' },
  { label: 'Hackathon Contestants', to: '/solutions/hackathon-contestants' },
  { label: 'Startups', to: '/solutions/startups' },
  { label: 'Agencies', to: '/solutions/agencies' },
  { label: 'Enterprise', to: '/solutions/enterprise' },
]

const resourceLinks = [
  { label: 'Blog', to: '/resources/blog' },
  { label: 'Support', to: '/resources/support' },
  { label: 'System Status', to: '/resources/status' },
  { label: 'Become a Partner', to: '/resources/partners' },
  { label: 'Partner Catalog', to: '/resources/partner-catalog' },
  { label: 'Brand Assets', to: '/resources/brand' },
  { label: 'Security & Compliance', to: '/resources/security' },
  { label: 'Regions', to: '/resources/regions' },
  { label: 'SOC2', to: '/resources/soc2' },
  { label: 'Lawyers.txt', to: '/resources/lawyers' },
  { label: 'Humans.txt', to: '/resources/humans' },
]

const developerLinks = [
  { label: 'Documentation', to: '/docs' },
  { label: 'Vulnix Library', to: '/developers/library' },
  { label: 'Changelog', to: '/developers/changelog' },
  { label: 'RSS', to: '/developers/rss' },
  { label: 'Contributing', to: '/developers/contributing' },
  { label: 'Open Source', to: '/developers/open-source' },
  { label: 'DevTo', to: '/developers/devto' },
]

const communityLinks = [
  { label: 'Events & Webinars', to: '/community/events' },
  { label: 'SupaSquad', to: '/community/supasquad' },
]

const companyLinks = [
  { label: 'Company', to: '/company' },
  { label: 'Careers', to: '/company/careers' },
  { label: 'General Availability', to: '/company/general-availability' },
  { label: 'Legal Hub', to: '/legal' },
  { label: 'Terms of Service', to: '/legal/terms' },
  { label: 'Privacy Policy', to: '/legal/privacy' },
  { label: 'Privacy Settings', to: '/legal/privacy-settings' },
  { label: 'Acceptable Use Policy', to: '/legal/acceptable-use' },
]

function FooterColumn({ title, links }) {
  return (
    <div>
      <h4 className="text-white font-semibold text-sm mb-4">{title}</h4>
      <ul className="space-y-3">
        {links.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="text-gray-400 text-sm hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LandingFooter() {
  return (
    <footer
      className="border-t"
      style={{
        borderColor: 'var(--color-slate)',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
      }}
    >
      <div className="w-full px-8">
        <div className="py-16 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-4">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src="/vulnix-logo.png" alt="Vulnix" className="w-10 h-10 rounded-full" />
              <span className="text-white font-bold text-2xl">Vulnix</span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
              AI-powered code security. Find vulnerabilities, understand risk, and fix with
              confidence.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/vulnix"
                className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                style={{ borderColor: 'var(--color-slate)' }}
              >
                <GitHub className="w-5 h-5 text-gray-400" />
              </a>
              <a
                href="https://twitter.com/vulnix"
                className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                style={{ borderColor: 'var(--color-slate)' }}
              >
                <XformerlyTwitter className="w-5 h-5 text-gray-400" />
              </a>
              <a
                href="https://linkedin.com/company/vulnix"
                className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                style={{ borderColor: 'var(--color-slate)' }}
              >
                <LinkedIn className="w-5 h-5 text-gray-400" />
              </a>
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            <FooterColumn title="Product" links={productLinks} />
            <FooterColumn title="Solutions" links={solutionLinks} />
            <FooterColumn title="Resources" links={resourceLinks} />
            <div>
              <FooterColumn title="Developers" links={developerLinks} />
              <div className="pt-4">
                <h4 className="text-white font-semibold text-sm mb-3">Community</h4>
                <ul className="space-y-3">
                  {communityLinks.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="text-gray-400 text-sm hover:text-white transition-colors"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div
          className="py-6 border-t flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderColor: 'var(--color-slate)' }}
        >
          <p className="text-gray-500 text-xs">© 2026 Vulnix Inc. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs">
            {companyLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-gray-500 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export function LandingHeader() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  const navLinks = [
    { label: 'Pricing', to: '/pricing' },
    { label: 'Solutions', to: '/solutions/developers' },
    { label: 'Resources', to: '/resources/blog' },
    { label: 'Docs', to: '/docs' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-charcoal/98 backdrop-blur-md border-b' : 'bg-charcoal/80 backdrop-blur-sm'
      }`}
      style={{
        backgroundColor: scrolled ? 'rgba(17, 24, 39, 0.98)' : 'rgba(17, 24, 39, 0.8)',
        borderColor: scrolled ? 'rgba(51, 65, 85, 0.3)' : 'transparent',
      }}
    >
      <div className="w-full px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img src="/vulnix-logo.png" alt="Vulnix Logo" className="w-12 h-12 rounded-full" />
          <span className="text-white font-bold text-xl">Vulnix</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`transition-colors px-4 py-2 rounded-lg hover:bg-white/5 ${
                location.pathname === link.to ? 'text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/signup">
            <HoverBorderGradient
              containerClassName="rounded-full"
              className="bg-black dark:bg-black text-white"
              duration={1}
            >
              <span className="flex h-9 items-center justify-center px-4 text-sm font-medium text-white">
                Start Free Trial
              </span>
            </HoverBorderGradient>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export function LandingLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0a0f1e' }}>
      <LandingHeader />
      <main className="flex-1 pt-16">{children}</main>
      <LandingFooter />
    </div>
  )
}

export function HeroCTA() {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Link to="/signup">
        <HoverBorderGradient
          containerClassName="rounded-full"
          className="bg-black dark:bg-black text-white"
          duration={1}
        >
          <span className="flex h-12 items-center justify-center gap-2 px-6 text-base font-medium text-white">
            Start scanning free
            <ArrowRight className="w-4 h-4" />
          </span>
        </HoverBorderGradient>
      </Link>
      <Link to="/pricing">
        <HoverBorderGradient
          containerClassName="rounded-full"
          className="bg-black dark:bg-black text-white"
          duration={1}
        >
          <span className="flex h-12 items-center justify-center px-6 text-base font-medium text-white">
            View pricing
          </span>
        </HoverBorderGradient>
      </Link>
    </div>
  )
}

export function LandingHero({ eyebrow, title, accent, description }) {
  return (
    <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--color-slate)' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 left-1/3 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: '#8b5cf6' }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-10"
          style={{ background: 'linear-gradient(to top, #10b981, transparent)' }}
        />
      </div>
      <div className="relative z-10 w-full px-8 py-24 md:py-32 max-w-4xl mx-auto text-center">
        {eyebrow && (
          <p
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-6 px-3 py-1 rounded-full border"
            style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.08)' }}
          >
            <Bot className="w-3.5 h-3.5" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          {title}
          {accent && (
            <>
              {' '}
              <span style={{ color: '#10b981' }}>{accent}</span>
            </>
          )}
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">{description}</p>
        <HeroCTA />
      </div>
    </section>
  )
}

export function FeatureGrid({ features }) {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {features.map((feature) => {
        const Icon = typeof feature.icon === 'string' ? null : feature.icon
        return (
          <div
            key={feature.title}
            className="rounded-2xl p-6 border transition-colors hover:border-green-500/40"
            style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.6)' }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            >
              {Icon ? (
                <Icon className="w-5 h-5" style={{ color: '#10b981' }} />
              ) : (
                <Bot className="w-5 h-5" style={{ color: '#10b981' }} />
              )}
            </div>
            <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
          </div>
        )
      })}
    </div>
  )
}

export function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      {eyebrow && (
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: '#8b5cf6' }}
        >
          {eyebrow}
        </p>
      )}
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{title}</h2>
      {description && <p className="text-gray-400 text-lg">{description}</p>}
    </div>
  )
}
