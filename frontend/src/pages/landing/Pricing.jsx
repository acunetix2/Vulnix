import { Link } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { LandingLayout } from './components/LandingChrome'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    blurb: 'For individuals exploring Vulnix',
    cta: 'Start free',
    to: '/signup',
    popular: false,
    features: [
      '1 project',
      '20 scans / month',
      'Semgrep + Bandit',
      'Community support',
      '7-day retention',
      '1 team member',
    ],
  },
  {
    name: 'Starter',
    price: '$10',
    period: '/month',
    blurb: 'For solo devs and small side projects',
    cta: 'Start free trial',
    to: '/signup',
    popular: false,
    features: [
      '3 projects',
      '100 scans / month',
      'All scanners (SAST, secrets, deps)',
      'Email support',
      '30-day retention',
      '3 team members',
      'Basic compliance reports',
    ],
  },
  {
    name: 'Professional',
    price: '$29',
    period: '/month',
    blurb: 'For growing teams that need AI review',
    cta: 'Start free trial',
    to: '/signup',
    popular: true,
    features: [
      '20 projects',
      '500 scans / month',
      'Everything in Starter',
      'AI security review',
      'Slack + Jira integrations',
      'Webhooks',
      'Priority support',
      '90-day retention',
      '10 team members',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    blurb: 'For orgs with compliance and scale needs',
    cta: 'Contact sales',
    to: '/company',
    popular: false,
    features: [
      'Unlimited projects & scans',
      'Everything in Professional',
      'SSO / SAML',
      'On-prem / VPC deploy',
      'Audit log export',
      'Dedicated success manager',
      'Custom SLAs',
      'Unlimited team members',
    ],
  },
]

const comparison = [
  { label: 'Projects', values: ['1', '3', '20', 'Unlimited'] },
  { label: 'Scans / month', values: ['20', '100', '500', 'Unlimited'] },
  { label: 'Scanners', values: ['SAST', 'All', 'All', 'All'] },
  { label: 'Secret scanning', values: [true, true, true, true] },
  { label: 'Dependency scanning', values: [false, true, true, true] },
  { label: 'AI security review', values: [false, false, true, true] },
  { label: 'Integrations', values: [false, false, 'Slack, Jira', 'Custom'] },
  { label: 'Webhooks', values: [false, false, true, true] },
  { label: 'Team members', values: ['1', '3', '10', 'Unlimited'] },
  { label: 'Data retention', values: ['7 days', '30 days', '90 days', 'Custom'] },
  { label: 'Support', values: ['Community', 'Email', 'Priority', 'Dedicated'] },
  { label: 'SSO / SAML', values: [false, false, false, true] },
]

function Cell({ value }) {
  if (value === true) return <Check className="w-4 h-4 mx-auto text-[#10b981]" />
  if (value === false) return <Minus className="w-4 h-4 mx-auto text-gray-600" />
  return <span className="text-sm text-gray-300">{value}</span>
}

export function Pricing() {
  return (
    <LandingLayout>
      <section className="w-full px-8 pt-16 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#10b981] mb-4">
            Pricing
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple pricing that <span className="text-[#10b981]">scales with you</span>
          </h1>
          <p className="text-lg text-gray-400">
            Start free. Upgrade when your team or scan volume grows. No hidden fees.
          </p>
        </div>
      </section>

      <section className="w-full px-8 pb-20">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl p-7 border ${
                tier.popular
                  ? 'border-[#10b981] bg-[#10b981]/5 relative'
                  : 'border-[#1e293b] bg-[#0f1729]'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-[#10b981] text-[#0a0f1e]">
                  Most popular
                </span>
              )}
              <h3 className="text-white font-semibold text-lg mb-1">{tier.name}</h3>
              <p className="text-gray-500 text-sm mb-5 min-h-[2.5rem]">{tier.blurb}</p>
              <div className="flex items-end gap-1 mb-6">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                {tier.period && <span className="text-gray-500 mb-1">{tier.period}</span>}
              </div>
              <Link
                to={tier.to}
                className={`h-11 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                  tier.popular
                    ? 'bg-[#10b981] hover:bg-[#059669] text-[#0a0f1e]'
                    : 'bg-transparent border border-[#334155] text-white hover:bg-white/5'
                }`}
              >
                {tier.cta}
              </Link>
              <ul className="mt-7 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 mt-0.5 text-[#10b981] shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full px-8 py-20 border-t border-[#1e293b]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Compare plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#1e293b]">
                  <th className="py-3 pr-4 text-sm font-medium text-gray-500">Feature</th>
                  {tiers.map((t) => (
                    <th key={t.name} className="py-3 px-4 text-sm font-medium text-white text-center">
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-[#1e293b]/60">
                    <td className="py-3 pr-4 text-sm text-gray-300">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="py-3 px-4 text-center">
                        <Cell value={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="w-full px-8 py-20 border-t border-[#1e293b]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              {
                q: 'What counts as a scan?',
                a: 'A scan is one full analysis of a project across the enabled scanners. Re-scanning the same project after changes counts as another scan.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes. You can downgrade or cancel at any time. Your plan stays active until the end of the current billing period.',
              },
              {
                q: 'Do you offer a free plan?',
                a: 'Yes. The Free plan gives you 1 project and 20 scans per month with the core SAST scanner — no credit card required.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'All major cards. Enterprise plans can invoice via net-30 terms.',
              },
              {
                q: 'Is my code used to train models?',
                a: 'No. Your code is never used for training. AI review runs against your configured provider with your data kept private.',
              },
            ].map((item) => (
              <div key={item.q} className="rounded-xl border border-[#1e293b] bg-[#0f1729] p-6">
                <h3 className="text-white font-semibold mb-2">{item.q}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingLayout>
  )
}
