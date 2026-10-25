import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Careers() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Company',
          title: 'Open',
          accent: 'Roles',
          description:
            'We are a small team building tools we want to use. If you care about security, developer experience, and shipping fast, come build with us.',
        },
        features: [
          { icon: 'zap', title: 'High ownership', description: 'Own big surfaces end to end from day one.' },
          { icon: 'users', title: 'Small team', description: 'Work directly with founders and senior engineers.' },
          { icon: 'shield', title: 'Mission', description: 'Make secure code the default for every team.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Open positions',
            items: [
              { title: 'Security Engineer', description: 'Build detection logic and improve signal across scanners.' },
              { title: 'Full-Stack Engineer', description: 'Ship product across the scanning pipeline and dashboard.' },
              { title: 'AI Engineer', description: 'Push the boundary of AI-assisted code review and remediation.' },
              { title: 'Designer', description: 'Make security tooling clear and fast for developers.' },
            ],
          },
          {
            type: 'list',
            title: 'How we work',
            items: [
              'Remote-first with async written communication.',
              'Ship small, ship often — bias toward action.',
              'Everyone talks to customers, engineers included.',
              'Competitive equity and benefits.',
            ],
          },
        ],
        cta: {
          title: 'Do not see your role?',
          description: 'We are always looking for exceptional people. Reach out anyway.',
          primary: { label: 'Introduce yourself', to: '/company' },
          secondary: { label: 'About the company', to: '/company' },
        },
      }}
    />
  )
}
