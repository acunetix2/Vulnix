import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function RSS() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'RSS',
          accent: 'Feed',
          description:
            'Subscribe to the Vulnix changelog and blog in your favorite reader and never miss a release.',
        },
        features: [
          { icon: 'zap', title: 'Changelog feed', description: 'Every release, delivered the moment it ships.' },
          { icon: 'radar', title: 'Blog feed', description: 'New articles on security and engineering.' },
          { icon: 'lock', title: 'No tracking', description: 'Plain RSS — no cookies, no analytics.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'Feed URLs',
            items: [
              'Changelog: /feed/changelog.xml',
              'Blog: /feed/blog.xml',
              'Security advisories: /feed/security.xml',
              'All combined: /feed/all.xml',
            ],
          },
        ],
        cta: {
          title: 'Prefer email?',
          description: 'Get release notes in your inbox instead.',
          primary: { label: 'Subscribe', to: '/resources/blog' },
          secondary: { label: 'View changelog', to: '/developers/changelog' },
        },
      }}
    />
  )
}
