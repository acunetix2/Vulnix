import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Blog() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'The Vulnix',
          accent: 'Blog',
          description:
            'Deep dives on application security, AI-assisted code review, and how modern teams ship secure code without slowing down.',
        },
        features: [
          { icon: 'shield', title: 'Security research', description: 'Walkthroughs of real vulnerabilities and how to fix them.' },
          { icon: 'zap', title: 'Engineering', description: 'How we build the scanning pipeline and AI review engine.' },
          { icon: 'users', title: 'Team practices', description: 'Playbooks for running security review that developers actually like.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Latest articles',
            items: [
              { title: 'How AI code review catches what linters miss', description: 'Why pattern-based scanners and LLMs are better together.' },
              { title: 'A practical guide to secret scanning', description: 'What to scan for, how to triage, and how to rotate safely.' },
              { title: 'Dependency CVEs without the noise', description: 'Prioritizing the vulnerabilities that are actually reachable.' },
              { title: 'Building a security champions program', description: 'Distribute security ownership without a huge security team.' },
            ],
          },
        ],
        cta: {
          title: 'Put the ideas to work',
          description: 'Scan your own codebase and see these principles in action.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
