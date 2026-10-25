import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function GeneralAvailability() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Company',
          title: 'General',
          accent: 'Availability',
          description:
            'Vulnix is generally available. Here is what is live today, what is coming next, and how the rollout works.',
        },
        features: [
          { icon: 'shield', title: 'Available today', description: 'Scanning, triage, AI review, and integrations.' },
          { icon: 'zap', title: 'Rolling out', description: 'Advanced compliance and expanded language coverage.' },
          { icon: 'radar', title: 'On the roadmap', description: 'Deeper automation and more deployment options.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Availability by capability',
            items: [
              { title: 'Code scanning', description: 'GA — SAST, secrets, and dependency scanning.' },
              { title: 'AI review', description: 'GA — explanations and remediation on every finding.' },
              { title: 'Integrations', description: 'GA — Slack, Jira, and webhooks.' },
              { title: 'On-prem / VPC', description: 'Enterprise — contact us for access.' },
            ],
          },
        ],
        cta: {
          title: 'Start on the GA platform today',
          description: 'All core capabilities are available on every plan, including Free.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
