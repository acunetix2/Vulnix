import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function NoCode() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For No-Code Builders',
          title: 'Secure the code your tools',
          accent: 'generate for you',
          description:
            'No-code and low-code platforms still produce real code under the hood. Vulnix reviews it so hidden vulnerabilities never slip through.',
          visual: 'scan',
        },
        features: [
          { icon: 'scan', title: 'Scan exports and snippets', description: 'Upload generated logic or exported functions for an instant review.' },
          { icon: 'ai', title: 'Plain-language results', description: 'Understand risk without needing a security background.' },
          { icon: 'users', title: 'Team-ready', description: 'Share findings with the developers who will apply the fixes.' },
        ],
        stats: [
          { value: 'No IDE', label: 'Required to start' },
          { value: '< 1 min', label: 'Snippet to verdict', color: '#8b5cf6' },
          { value: 'Plain English', label: 'Explanations' },
          { value: 'Shareable', label: 'Reports', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Why it matters',
            title: 'No-code does not mean no risk',
            description:
              'Generated glue code can still leak secrets or open injection paths. Vulnix reviews the code your tools produce so you stay secure without ever opening an IDE.',
            points: [
              'Get findings written for non-specialists, with clear next steps.',
              'Hand off actionable reports to the engineers who own the stack.',
              'Stay compliant even when you never open an IDE.',
              'Review exported functions and generated logic in seconds.',
            ],
            visual: 'scan',
          },
        ],
        cards: {
          eyebrow: 'Built for non-specialists',
          title: 'Security you can actually use',
          items: [
            { title: 'Upload anything', description: 'Exported functions, generated logic, snippets — all reviewable.' },
            { title: 'Understand the risk', description: 'Plain-language explanations, not raw scanner dumps.' },
            { title: 'Share with your team', description: 'Send reports to the developers who apply the fixes.' },
            { title: 'Stay compliant', description: 'Audit trails even when you never open an IDE.' },
          ],
        },
        testimonials: [
          { quote: 'I run every generated function through Vulnix before it goes live. It is my safety net.', name: 'Tara', role: 'No-code builder' },
          { quote: 'The explanations are clear enough that I understand the risk without Googling every term.', name: 'Ben', role: 'Ops manager' },
          { quote: 'I send reports straight to our dev team. They love the concrete fixes.', name: 'Carla', role: 'Automation lead' },
        ],
        faq: [
          { q: 'Do I need to write code?', a: 'No. Upload a snippet or exported function and get a plain-language report.' },
          { q: 'Is it free?', a: 'Yes. The Free plan gives you 1 project and 20 scans a month. No credit card required.' },
          { q: 'Can I share results with developers?', a: 'Yes. Every report is shareable and includes concrete fixes engineers can apply.' },
          { q: 'What if I do not understand a finding?', a: 'Every finding comes with a plain-language explanation and a suggested fix.' },
        ],
        cta: {
          title: 'Try a review free',
          description: 'Upload a snippet and see your first report in under a minute.',
          primary: { label: 'Get started', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
