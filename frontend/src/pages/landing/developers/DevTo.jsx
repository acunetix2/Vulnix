import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function DevTo() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Vulnix on',
          accent: 'Dev.to',
          description:
            'Follow our engineering and security writing on Dev.to for deep dives, tutorials, and release notes.',
        },
        features: [
          { icon: 'zap', title: 'Tutorials', description: 'Step-by-step guides you can follow along with.' },
          { icon: 'radar', title: 'Deep dives', description: 'How we built the scanning and AI review pipeline.' },
          { icon: 'users', title: 'Community', description: 'Join the conversation in the comments.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Popular on Dev.to',
            items: [
              { title: 'Building an AI code reviewer', description: 'Architecture notes from our review engine.' },
              { title: 'False positive tuning', description: 'How we keep scanner output high-signal.' },
              { title: 'Scanning monorepos', description: 'Strategies for large multi-language codebases.' },
              { title: 'Secure CI pipelines', description: 'Wiring Vulnix into pull-request checks.' },
            ],
          },
        ],
        cta: {
          title: 'Follow along',
          description: 'Get new posts in your Dev.to feed.',
          primary: { label: 'Read the blog', to: '/resources/blog' },
          secondary: { label: 'See changelog', to: '/developers/changelog' },
        },
      }}
    />
  )
}
