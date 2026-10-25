import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Events() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Community',
          title: 'Events &',
          accent: 'Webinars',
          description:
            'Live sessions on application security, AI-assisted review, and how modern teams ship secure code faster.',
        },
        features: [
          { icon: 'zap', title: 'Live webinars', description: 'Monthly deep dives with our engineering and security team.' },
          { icon: 'users', title: 'Workshops', description: 'Hands-on sessions where you scan real code.' },
          { icon: 'radar', title: 'Office hours', description: 'Bring your questions and get answers live.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Upcoming sessions',
            items: [
              { title: 'Intro to AI code review', description: 'See how Vulnix finds and explains real vulnerabilities.' },
              { title: 'Secret scanning deep dive', description: 'What to scan for, how to triage, and how to rotate.' },
              { title: 'Dependency risk without the noise', description: 'Prioritize the CVEs that are actually reachable.' },
              { title: 'Building a security champions program', description: 'Distribute ownership without a huge security team.' },
            ],
          },
        ],
        cta: {
          title: 'Reserve your seat',
          description: 'Create an account to register for upcoming sessions.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'Join the community', to: '/community/champions' },
        },
      }}
    />
  )
}
