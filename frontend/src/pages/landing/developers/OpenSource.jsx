import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function OpenSource() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Open',
          accent: 'Source',
          description:
            'We build in the open. Explore the scanner rules, SDKs, and tooling that power Vulnix — and contribute your own.',
        },
        features: [
          { icon: 'shield', title: 'Scanner rules', description: 'Detection logic for Semgrep, Bandit, and more.' },
          { icon: 'zap', title: 'SDKs', description: 'Open-source client libraries for every platform.' },
          { icon: 'users', title: 'Community', description: 'Issues, discussions, and PRs from security folks like you.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Repositories',
            items: [
              { title: 'vulnix-rules', description: 'Community-maintained scanner rules and signatures.' },
              { title: 'vulnix-client', description: 'Official SDKs for Python, TypeScript, and Go.' },
              { title: 'vulnix-cli', description: 'Cross-platform CLI for scripting and CI.' },
              { title: 'vulnix-action', description: 'GitHub Action for pull-request scanning.' },
            ],
          },
        ],
        cta: {
          title: 'Star us on GitHub',
          description: 'Follow along and help shape the roadmap.',
          primary: { label: 'View on GitHub', to: '/company' },
          secondary: { label: 'Contribute', to: '/developers/contributing' },
        },
      }}
    />
  )
}
