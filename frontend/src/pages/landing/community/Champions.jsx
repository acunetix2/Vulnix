import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Champions() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Community',
          title: 'Security',
          accent: 'Champions',
          description:
            'A program for developers who want to own security in their team — with training, recognition, and early access to new features.',
        },
        features: [
          { icon: 'shield', title: 'Training', description: 'Curated paths on review, triage, and remediation.' },
          { icon: 'users', title: 'Peer network', description: 'Connect with champions at other companies.' },
          { icon: 'zap', title: 'Early access', description: 'Try new Vulnix features before general release.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'What champions get',
            items: [
              'Structured training on running effective security reviews.',
              'A private community of security-minded developers.',
              'Early access and direct feedback channels to our team.',
              'Recognition and a badge for your profile and talks.',
              'Templates and playbooks to scale security in your org.',
            ],
          },
        ],
        cta: {
          title: 'Apply to the program',
          description: 'Tell us about your team and we will get you set up.',
          primary: { label: 'Apply now', to: '/company' },
          secondary: { label: 'See events', to: '/community/events' },
        },
      }}
    />
  )
}
