import { Link } from 'react-router-dom'
import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  ScanLine,
  Bot,
  KeyRound,
  Package,
  FileCheck2,
  Webhook,
  BarChart3,
  Layers,
  Terminal,
  Users,
  Lock,
  Globe,
  Gauge,
  Braces,
  Bug,
  GitBranch,
  Cpu,
  FileCode2,
  Blocks,
  Radar,
} from 'lucide-react'
import { LandingLayout, LandingHero, SectionHeading } from './LandingChrome'
import { FadeUp, FadeUpItem, Reveal, ScaleIn, SlideIn } from './Motion'
import { ProductVisual, GradientArt } from './ProductVisuals'

const ICONS = {
  scan: ScanLine,
  ai: Bot,
  key: KeyRound,
  package: Package,
  check: FileCheck2,
  webhook: Webhook,
  chart: BarChart3,
  layers: Layers,
  terminal: Terminal,
  users: Users,
  lock: Lock,
  globe: Globe,
  gauge: Gauge,
  code: Braces,
  bug: Bug,
  branch: GitBranch,
  cpu: Cpu,
  file: FileCode2,
  blocks: Blocks,
  radar: Radar,
}

function FeatureIcon({ name, className = 'w-5 h-5' }) {
  const Icon = ICONS[name] || ScanLine
  return <Icon className={className} />
}

const DEFAULT_FEATURES = [
  {
    icon: 'scan',
    title: 'Multi-scanner engine',
    description:
      'Semgrep, Bandit, Gitleaks, pip-audit and Trivy run together and unify into one prioritized view.',
  },
  {
    icon: 'ai',
    title: 'AI-powered insights',
    description:
      'Every finding comes with a plain-language explanation and a concrete fix you can apply in minutes.',
  },
  {
    icon: 'lock',
    title: 'Governed by default',
    description:
      'Role-based access, full audit trails and SOC 2 aligned controls keep security teams in the loop.',
  },
]

function CTASection({ cta }) {
  return (
    <section className="border-t" style={{ borderColor: 'var(--color-slate)' }}>
      <Reveal className="w-full px-8 py-24 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{cta.title}</h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-10">{cta.description}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to={cta.primary.to}
            className="inline-flex h-12 items-center px-7 rounded-lg text-base font-semibold bg-[#16a34a] hover:bg-[#059669] text-white transition-colors"
          >
            {cta.primary.label}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
          <Link
            to={cta.secondary.to}
            className="inline-flex h-12 items-center px-7 rounded-lg text-base font-semibold bg-transparent text-white border border-[#334155] hover:bg-white/5 transition-colors"
          >
            {cta.secondary.label}
          </Link>
        </div>
      </Reveal>
    </section>
  )
}

function StatsBand({ stats }) {
  if (!stats?.length) return null
  return (
    <section className="w-full px-8 py-16 border-t" style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.4)' }}>
      <FadeUp className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s) => (
          <FadeUpItem key={s.label} className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-1" style={{ color: s.color || '#10b981' }}>
              {s.value}
            </div>
            <div className="text-sm text-gray-400">{s.label}</div>
          </FadeUpItem>
        ))}
      </FadeUp>
    </section>
  )
}

function FeatureRows({ rows }) {
  if (!rows?.length) return null
  return (
    <>
      {rows.map((row, i) => {
        const flip = i % 2 === 1
        return (
          <section
            key={row.title}
            className="w-full px-8 py-20 border-t"
            style={{ borderColor: 'var(--color-slate)' }}
          >
            <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <SlideIn
                from={flip ? 'right' : 'left'}
                className={flip ? 'md:order-2' : ''}
              >
                {row.eyebrow && (
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#8b5cf6' }}>
                    {row.eyebrow}
                  </p>
                )}
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">{row.title}</h3>
                <p className="text-gray-400 leading-relaxed mb-6">{row.description}</p>
                {row.points && (
                  <ul className="space-y-3">
                    {row.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-gray-300 text-sm">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                        >
                          <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </SlideIn>
              <ScaleIn className={flip ? 'md:order-1' : ''} delay={0.1}>
                {row.visual ? <ProductVisual name={row.visual} /> : <GradientArt variant={i} />}
              </ScaleIn>
            </div>
          </section>
        )
      })}
    </>
  )
}

function Testimonials({ items }) {
  if (!items?.length) return null
  return (
    <section className="w-full px-8 py-20 border-t" style={{ borderColor: 'var(--color-slate)' }}>
      <SectionHeading eyebrow="Customers" title="Teams that ship secure code faster" />
      <FadeUp className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
        {items.map((t) => (
          <FadeUpItem
            key={t.quote}
            className="rounded-2xl p-6 border flex flex-col"
            style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.6)' }}
          >
            <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}
              >
                {t.name.split(' ').map((w) => w[0]).join('')}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{t.name}</div>
                <div className="text-xs text-gray-500">{t.role}</div>
              </div>
            </div>
          </FadeUpItem>
        ))}
      </FadeUp>
    </section>
  )
}

function FAQ({ items }) {
  const [open, setOpen] = useState(null)
  if (!items?.length) return null
  return (
    <section className="w-full px-8 py-20 border-t" style={{ borderColor: 'var(--color-slate)' }}>
      <SectionHeading title="Frequently asked questions" />
      <div className="max-w-3xl mx-auto space-y-3">
        {items.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.04}>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.5)' }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-white font-semibold text-sm">{item.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">{item.a}</div>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/**
 * Rich, image-heavy public landing page renderer.
 * content = { hero, features, stats, rows, cards, list, testimonials, faq, cta }
 */
export function LandingPageTemplate({ content }) {
  const {
    hero,
    features,
    sections = [],
    stats,
    rows,
    cards,
    list,
    testimonials,
    faq,
    cta,
  } = content
  const featureItems = features ?? (sections.length ? [] : DEFAULT_FEATURES)

  return (
    <LandingLayout>
      <LandingHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        accent={hero.accent}
        description={hero.description}
      />

      {hero.visual && (
        <section className="w-full px-8 -mt-8 pb-16 relative z-10">
          <ScaleIn className="max-w-4xl mx-auto">
            <ProductVisual name={hero.visual} />
          </ScaleIn>
        </section>
      )}

      {featureItems.length > 0 && (
        <section className="w-full px-8 py-20 border-t" style={{ borderColor: 'var(--color-slate)' }}>
          <FadeUp className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            {featureItems.map((feature) => (
              <FadeUpItem
                key={feature.title}
                className="rounded-2xl p-6 border transition-colors hover:border-emerald-500/40"
                style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.6)' }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(139,92,246,0.12)' }}
                >
                  <FeatureIcon name={feature.icon} className="w-5 h-5" style={{ color: '#a78bfa' }} />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </FadeUpItem>
            ))}
          </FadeUp>
        </section>
      )}

      <StatsBand stats={stats} />
      <FeatureRows rows={rows} />

      {sections.map((section) => (
        <section
          key={section.title}
          className="w-full border-t px-5 py-12 sm:px-8 sm:py-16"
          style={{ borderColor: 'var(--color-slate)' }}
        >
          <div className="mx-auto max-w-4xl">
            {section.title && (
              <h2 className="mb-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                {section.title}
              </h2>
            )}
            {section.type === 'prose' && (
              <div className="space-y-5 text-base leading-7 text-gray-300">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
            {section.type === 'list' && (
              <ul className="space-y-4 text-base leading-7 text-gray-300">
                {section.items?.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="mt-2 size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: '#10b981' }}
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.type === 'cards' && (
              <div className="grid gap-4 sm:grid-cols-2">
                {section.items?.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-xl border p-5"
                    style={{
                      borderColor: 'var(--color-slate)',
                      backgroundColor: 'rgba(17,24,39,0.6)',
                    }}
                  >
                    <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                    <p className="text-base leading-7 text-gray-400">{item.description}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}

      {cards?.length > 0 && (
        <section className="w-full px-8 py-20 border-t" style={{ borderColor: 'var(--color-slate)' }}>
          {cards.eyebrow || cards.title ? (
            <SectionHeading eyebrow={cards.eyebrow} title={cards.title} description={cards.description} />
          ) : null}
          <FadeUp className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
            {cards.items.map((item) => (
              <FadeUpItem
                key={item.title}
                className="rounded-2xl p-6 border"
                style={{ borderColor: 'var(--color-slate)', backgroundColor: 'rgba(17,24,39,0.6)' }}
              >
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
              </FadeUpItem>
            ))}
          </FadeUp>
        </section>
      )}

      {list?.length > 0 && (
        <section className="w-full px-8 py-20 border-t" style={{ borderColor: 'var(--color-slate)' }}>
          {list.title ? <SectionHeading eyebrow={list.eyebrow} title={list.title} description={list.description} /> : null}
          <FadeUp className="max-w-2xl mx-auto space-y-4">
            {list.items.map((item) => (
              <FadeUpItem key={item} className="flex items-start gap-3 text-gray-300">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                >
                  <Check className="w-3 h-3" style={{ color: '#10b981' }} />
                </span>
                <span>{item}</span>
              </FadeUpItem>
            ))}
          </FadeUp>
        </section>
      )}

      <Testimonials items={testimonials} />
      <FAQ items={faq} />
      {cta && <CTASection cta={cta} />}
    </LandingLayout>
  )
}
