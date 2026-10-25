import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Contributing() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Contributing',
          accent: 'to Vulnix',
          description:
            'Whether it is a scanner rule, a bug fix, or docs — we welcome contributions that make application security better for everyone.',
        },
        features: [
          { icon: 'users', title: 'Everyone welcome', description: 'First-time contributors get extra guidance.' },
          { icon: 'shield', title: 'Security research', description: 'Responsible disclosure with recognition.' },
          { icon: 'zap', title: 'Fast reviews', description: 'We aim to review PRs within a few days.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Ways to contribute',
            items: [
              { title: 'Scanner rules', description: 'Add detection logic for new vulnerability patterns.' },
              { title: 'Bug fixes', description: 'Pick up a good-first-issue and ship a fix.' },
              { title: 'Documentation', description: 'Improve guides and API reference.' },
              { title: 'Security research', description: 'Report vulnerabilities through our disclosure program.' },
            ],
          },
          {
            type: 'list',
            title: 'How it works',
            items: [
              'Fork the repo and open a feature branch.',
              'Add or update tests alongside your change.',
              'Open a PR with a clear description of the problem and fix.',
              'A maintainer will review and merge once CI is green.',
            ],
          },
        ],
        cta: {
          title: 'Find a place to start',
          description: 'Browse open issues labeled good-first-issue.',
          primary: { label: 'View open source', to: '/developers/open-source' },
          secondary: { label: 'Read the docs', to: '/developers/docs' },
        },
      }}
    />
  )
}
