import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function LawyersTxt() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Lawyers',
          accent: '.txt',
          description:
            'The plain-language version of our legal documents — what we collect, how we use it, and what we promise.',
        },
        features: [
          { icon: 'lock', title: 'Privacy first', description: 'We do not sell your data or use your code for training.' },
          { icon: 'shield', title: 'Clear terms', description: 'Straightforward acceptable use and service terms.' },
          { icon: 'users', title: 'Your rights', description: 'Access, export, and delete your data on request.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Legal documents',
            items: [
              { title: 'Privacy Policy', description: 'What we collect, why, and how long we keep it.' },
              { title: 'Acceptable Use', description: 'What you can and cannot do with Vulnix.' },
              { title: 'Terms of Service', description: 'The agreement governing your use of the platform.' },
              { title: 'Data Processing', description: 'How we handle data on your behalf as a processor.' },
            ],
          },
        ],
        cta: {
          title: 'Questions?',
          description: 'Reach our legal team directly for DPAs and questionnaires.',
          primary: { label: 'Contact us', to: '/company' },
          secondary: { label: 'Privacy policy', to: '/legal/privacy' },
        },
      }}
    />
  )
}
