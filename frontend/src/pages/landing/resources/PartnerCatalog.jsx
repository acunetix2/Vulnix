import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function PartnerCatalog() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Partner',
          accent: 'Catalog',
          description:
            'A curated network of consultancies, MSPs, and integrators who help teams adopt Vulnix and improve their security posture.',
        },
        features: [
          { icon: 'users', title: 'Verified partners', description: 'Every partner is vetted and trained on Vulnix.' },
          { icon: 'globe', title: 'Global coverage', description: 'Partners across regions and time zones.' },
          { icon: 'shield', title: 'Specialized skills', description: 'From compliance programs to full security reviews.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Find the right partner',
            items: [
              { title: 'Implementation', description: 'Get Vulnix configured and integrated into your pipeline.' },
              { title: 'Security reviews', description: 'Ongoing code review and remediation support.' },
              { title: 'Compliance', description: 'SOC 2, ISO, and audit-readiness programs.' },
              { title: 'Training', description: 'Enable your team to run Vulnix day to day.' },
            ],
          },
        ],
        cta: {
          title: 'Become a listed partner',
          description: 'Join the catalog and reach teams looking for help.',
          primary: { label: 'Apply now', to: '/resources/partners' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
