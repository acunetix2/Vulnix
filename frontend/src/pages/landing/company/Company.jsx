import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Company() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Company',
          title: 'About',
          accent: 'Vulnix',
          description:
            'We are building the security review platform we always wanted — fast, clear, and something developers actually want to use.',
        },
        features: [
          { icon: 'users', title: 'Our team', description: 'Security engineers, developers, and designers.' },
          { icon: 'shield', title: 'Our mission', description: 'Make secure code the default, not the bottleneck.' },
          { icon: 'zap', title: 'Our approach', description: 'Signal over noise, clarity over checkbox compliance.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'What we believe',
            items: [
              'Security review should keep up with how fast teams ship.',
              'Developers ignore tools that bury them in noise.',
              'Good explanations turn findings into real fixes.',
              'You choose which repositories and code to connect for analysis.',
              'Compliance should be a byproduct of good engineering, not a separate scramble.',
            ],
          },
        ],
        cta: {
          title: 'Work with us',
          description: 'Explore open roles or talk to our team about your needs.',
          primary: { label: 'See open roles', to: '/company/careers' },
          secondary: { label: 'Contact us', to: '/resources/partners' },
        },
      }}
    />
  )
}
