import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function VibeCoders() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Vibe Coders',
          title: 'Keep the vibe. Lose the',
          accent: 'vulnerabilities',
          description:
            'You move fast and ship by feel. Vulnix reviews your AI-assisted code in the background so the good vibes never turn into a breach.',
        },
        features: [
          { icon: 'scan', title: 'Zero-friction reviews', description: 'Drop a file or snippet and keep flowing. No setup, no pipeline wrestling.' },
          { icon: 'ai', title: 'Instant gut-check', description: 'Know if a vibe-coded function is safe before you paste it into production.' },
          { icon: 'lock', title: 'Private by default', description: 'Your code is never used to train models and is purged on schedule.' },
        ],
        stats: [
          { value: '< 1 min', label: 'Snippet to report' },
          { value: '0', label: 'Setup required' },
          { value: 'Copy-paste', label: 'Fixes included', color: '#8b5cf6' },
          { value: 'Free', label: 'Plan available', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'How it works',
            title: 'Snippet in, clear verdict out',
            description:
              'Paste the function your AI agent just wrote. We scan it with the same engines that protect enterprise codebases and hand back a plain-language verdict with a fix you can paste straight back in.',
            points: [
              'Paste a snippet or drop a file — no repo required.',
              'Same scanners that protect enterprise codebases.',
              'Verdict in seconds, not minutes.',
              'Fix you can copy back into your agent conversation.',
            ],
            visual: 'code',
          },
          {
            eyebrow: 'What we catch',
            title: 'The mistakes AI assistants love to make',
            description:
              'AI code is confident and often wrong in the same places. We catch the patterns that show up again and again in agent-generated code.',
            points: [
              'Hardcoded API keys and tokens your agent happily embedded.',
              'Injection risks from sketchy regexes or raw SQL.',
              'Unsafe deserialization and command execution patterns.',
              'Dependency CVEs hiding in your package manifest.',
            ],
            visual: 'scan',
          },
        ],
        cards: {
          eyebrow: 'Built for speed',
          title: 'Made for how you actually build',
          items: [
            { title: 'Snippet to report', description: 'Paste code straight from your agent and get findings in seconds.' },
            { title: 'No security PhD', description: 'Plain-language explanations tell you what actually matters.' },
            { title: 'Copy-paste fixes', description: 'Every finding ships with a fix you can drop right back in.' },
            { title: 'Works with your stack', description: 'Python, JS/TS, Go, Java, Ruby and more.' },
          ],
        },
        testimonials: [
          { quote: 'I paste every agent function through Vulnix now. Caught a hardcoded key my AI wrote twice.', name: 'Jules', role: 'Solo builder' },
          { quote: 'The fixes are short enough to paste straight back into my chat. Zero context switching.', name: 'Devin Park', role: 'Indie hacker' },
          { quote: 'I shipped a whole weekend app and it passed on the first scan.', name: 'Mira', role: 'Hackathon regular' },
        ],
        faq: [
          { q: 'Do I need to connect my repo?', a: 'No. Paste a snippet or upload a file. No pipeline, no agent, no setup.' },
          { q: 'Is it free?', a: 'Yes. The Free plan gives you 1 project and 20 scans a month. No credit card required.' },
          { q: 'What languages work?', a: 'Python, JavaScript, TypeScript, Go, Java, Ruby and more.' },
          { q: 'Is my code used for training?', a: 'Never. Your code is purged on a schedule you control.' },
        ],
        cta: {
          title: 'Scan your vibe-coded project free',
          description: 'No credit card. No setup. Just drop a file and go.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
