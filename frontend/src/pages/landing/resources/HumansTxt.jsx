import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function HumansTxt() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Humans',
          accent: '.txt',
          description:
            'The people behind Vulnix — a small team of security engineers, developers, and designers building tools they want to use.',
        },
        features: [
          { icon: 'users', title: 'Security engineers', description: 'Built by people who have run security programs.' },
          { icon: 'zap', title: 'Developers', description: 'Shaped by developers who hate noisy security tools.' },
          { icon: 'shield', title: 'Designers', description: 'Focused on clarity over checkbox compliance.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'What we value',
            items: [
              { title: 'Signal over noise', description: 'We cut false positives so real issues stand out.' },
              { title: 'Clarity', description: 'Explanations anyone on the team can understand.' },
              { title: 'Speed', description: 'Security that keeps up with how fast you ship.' },
              { title: 'Trust', description: 'Your code is yours. We treat it that way.' },
            ],
          },
        ],
        cta: {
          title: 'Want to join us?',
          description: 'We are hiring across engineering, security, and design.',
          primary: { label: 'See open roles', to: '/company/careers' },
          secondary: { label: 'About the company', to: '/company' },
        },
      }}
    />
  )
}
