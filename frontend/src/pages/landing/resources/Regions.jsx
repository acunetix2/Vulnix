import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Regions() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Deployment',
          accent: 'Regions',
          description:
            'Run Vulnix close to your code and your compliance boundary — multi-cloud SaaS, VPC, or fully on-premise.',
        },
        features: [
          { icon: 'globe', title: 'Multi-region SaaS', description: 'Hosted regions to match your data residency needs.' },
          { icon: 'lock', title: 'VPC deploy', description: 'Run inside your own cloud network.' },
          { icon: 'shield', title: 'On-premise', description: 'Fully air-gapped installs for strict environments.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Deployment options',
            items: [
              { title: 'SaaS', description: 'Fully managed, fastest to value, multi-region.' },
              { title: 'VPC', description: 'Single-tenant install inside your cloud network.' },
              { title: 'On-prem', description: 'Air-gapped install with no outbound data.' },
              { title: 'Hybrid', description: 'Managed control plane with local scan workers.' },
            ],
          },
        ],
        cta: {
          title: 'Choose your deployment',
          description: 'Talk to us about residency and compliance requirements.',
          primary: { label: 'Contact sales', to: '/company' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
