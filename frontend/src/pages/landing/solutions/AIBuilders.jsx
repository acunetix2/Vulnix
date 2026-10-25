import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function AIBuilders() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For AI Builders',
          title: 'Ship AI-generated code',
          accent: 'without shipping bugs',
          description:
            'Whether you build with an agent or autocomplete, Vulnix reviews every line for vulnerabilities before it reaches production.',
          visual: 'code',
        },
        features: [
          { icon: 'scan', title: 'Scan AI output instantly', description: 'Paste a snippet or drop a file and get findings in seconds.' },
          { icon: 'ai', title: 'Explanations you can read', description: 'AI turns raw scanner output into clear risk summaries and fixes.' },
          { icon: 'lock', title: 'Private by default', description: 'Your code is never used to train models and is purged on schedule.' },
        ],
        stats: [
          { value: '< 1 min', label: 'Snippet to verdict' },
          { value: '5', label: 'Scanners per run', color: '#8b5cf6' },
          { value: '15+', label: 'Languages covered' },
          { value: '0', label: 'Setup required', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Why it matters',
            title: 'AI writes fast. Review has to keep up.',
            description:
              'Agents generate working code in seconds — and security mistakes at scale. Vulnix sits between generation and merge so nothing risky slips through.',
            points: [
              'Catch hardcoded secrets and injection risks the moment they are generated.',
              'Get plain-language explanations instead of raw scanner noise.',
              'Turn findings into pull-request-ready fixes with AI suggestions.',
              'Keep a full audit trail of every review for compliance.',
            ],
            visual: 'scan',
          },
          {
            eyebrow: 'Workflow',
            title: 'Built for the way you build',
            description:
              'Review AI-generated diffs before you accept them, in the languages agents write most. No pipeline changes required.',
            points: [
              'Drop-in reviews: paste a snippet or upload a file.',
              'Agent-friendly: review generated diffs before you accept them.',
              'Language coverage: Python, JS, TS, Go, Java, Ruby and more.',
              'Fix suggestions: every finding ships with a concrete fix.',
            ],
            visual: 'pipeline',
          },
        ],
        cards: {
          eyebrow: 'Use cases',
          title: 'Where AI builders get value',
          items: [
            { title: 'Pre-merge review', description: 'Scan agent output before it ever reaches a pull request.' },
            { title: 'Snippet checks', description: 'Paste a single function and get a verdict in seconds.' },
            { title: 'Dependency hygiene', description: 'Catch vulnerable packages the agent just added.' },
            { title: 'Secret hygiene', description: 'Stop agents from committing real credentials.' },
          ],
        },
        testimonials: [
          { quote: 'My AI writes a function, I paste it into Vulnix, and I know in seconds if it is safe.', name: 'Priya', role: 'Full-stack builder' },
          { quote: 'Caught a hardcoded API key my agent embedded. Would have shipped it otherwise.', name: 'Marcus', role: 'Indie developer' },
          { quote: 'The explanations actually teach me why something is risky, not just that it is.', name: 'Elena', role: 'Product engineer' },
        ],
        faq: [
          { q: 'Do I need to connect my repo?', a: 'No. Paste a snippet or upload a file. No pipeline, no agent, no setup.' },
          { q: 'Is it free?', a: 'Yes. The Free plan gives you 1 project and 20 scans a month. No credit card required.' },
          { q: 'Which languages work?', a: 'Python, JavaScript, TypeScript, Go, Java, Ruby and more — the languages agents write most.' },
          { q: 'Is my code used for training?', a: 'Never. Your code is purged on a schedule you control.' },
        ],
        cta: {
          title: 'Review your first AI-generated file free',
          description: 'No credit card required. Start scanning in under a minute.',
          primary: { label: 'Get started', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
