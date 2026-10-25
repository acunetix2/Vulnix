import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Changelog() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Change',
          accent: 'log',
          description:
            'Every feature, improvement, and fix we ship — updated continuously so you always know what is new.',
        },
        features: [
          { icon: 'zap', title: 'New scanners', description: 'Coverage for more languages and vulnerability classes.' },
          { icon: 'sparkles', title: 'AI improvements', description: 'Better explanations and more accurate fixes.' },
          { icon: 'radar', title: 'Faster pipelines', description: 'Scan throughput and performance gains.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Recent releases',
            items: [
              { title: 'AI remediation diffs', description: 'Suggested fixes now come as reviewable diffs.' },
              { title: 'Dependency scanning', description: 'Reachability analysis for transitive dependencies.' },
              { title: 'Bulk triage', description: 'Resolve clusters of findings in a single action.' },
              { title: 'Webhook retries', description: 'Automatic retries with delivery logs.' },
            ],
          },
        ],
        cta: {
          title: 'Try the latest features',
          description: 'Create an account and see what shipped this month.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'Subscribe to RSS', to: '/developers/rss' },
        },
      }}
    />
  )
}
