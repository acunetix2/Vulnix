import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function BecomePartner() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Become a',
          accent: 'Vulnix partner',
          description:
            'Consultancies, MSPs, and resellers use Vulnix to deliver application security to their clients. Join the partner program.',
        },
        features: [
          { icon: 'users', title: 'Consultancies', description: 'Add continuous code review to every engagement.' },
          { icon: 'radar', title: 'MSPs', description: 'Manage security across many client codebases.' },
          { icon: 'lock', title: 'Resellers', description: 'Offer Vulnix with deal protection and margin.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'What partners get',
            items: [
              'Deal registration and protection on qualified opportunities.',
              'Competitive margins and volume-based incentives.',
              'Co-branded reports and client-ready exports.',
              'Sandbox environments for demos and POCs.',
              'Dedicated partner support and enablement.',
            ],
          },
        ],
        cta: {
          title: 'Talk to our partnerships team',
          description: 'We will get you set up and selling fast.',
          primary: { label: 'Contact us', to: '/company' },
          secondary: { label: 'Partner catalog', to: '/resources/partner-catalog' },
        },
      }}
    />
  )
}
