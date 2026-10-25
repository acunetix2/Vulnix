import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Support() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Support that',
          accent: 'actually helps',
          description:
            'From community help to a dedicated engineer, get the answers you need to keep shipping secure code.',
        },
        features: [
          { icon: 'users', title: 'Community', description: 'Ask questions and learn from other Vulnix users.' },
          { icon: 'zap', title: 'Priority email', description: 'Faster response times on paid plans.' },
          { icon: 'shield', title: 'Dedicated engineer', description: 'Enterprise plans get a named point of contact.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Ways to get help',
            items: [
              { title: 'Documentation', description: 'Guides and API reference for every feature.' },
              { title: 'Email support', description: 'Reach the team directly from your dashboard.' },
              { title: 'Status page', description: 'Real-time availability for scanning and AI services.' },
              { title: 'Enterprise', description: 'SLAs, onboarding, and a dedicated success manager.' },
            ],
          },
        ],
        cta: {
          title: 'Get started with support in mind',
          description: 'Create an account and reach us any time.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'Read the docs', to: '/developers/docs' },
        },
      }}
    />
  )
}
