import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Secrets() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Secret detection',
          accent: 'before they leak',
          description:
            'Gitleaks-powered scanning finds hardcoded API keys, tokens, passwords and private keys across your codebase — and tells you which ones are still live.',
          visual: 'secrets',
        },
        features: [
          { icon: 'key', title: 'High-signal detectors', description: 'Hundreds of built-in rules tuned to cut false positives.' },
          { icon: 'radar', title: 'History-aware', description: 'Scan working trees, branches and full commit history.' },
          { icon: 'check', title: 'One-click triage', description: 'Mark secrets resolved, false positive or acknowledged in bulk.' },
        ],
        stats: [
          { value: '300+', label: 'Detector rules', color: '#ef4444' },
          { value: 'AWS · GCP · Azure', label: 'Cloud keys covered' },
          { value: '< 1 min', label: 'Rotation guidance' },
          { value: 'History', label: 'Git-aware scanning', color: '#ef4444' },
        ],
        rows: [
          {
            eyebrow: 'Coverage',
            title: 'What we catch',
            description:
              'From cloud credentials to private keys buried in a commit from three years ago. We scan the working tree and the full history, then rank findings by whether the credential is still live.',
            points: [
              'AWS, GCP and Azure access keys and service-account JSON.',
              'GitHub, GitLab, Slack and Stripe API tokens.',
              'Private keys (RSA, EC, PGP) committed to the repo.',
              'Database connection strings with embedded passwords.',
              'Generic high-entropy strings that look like credentials.',
            ],
            visual: 'secrets',
          },
          {
            eyebrow: 'Detection to rotation',
            title: 'Know what is live, and fix it fast',
            description:
              'A committed key is only a crisis if it is still valid. We help you triage by liveness so you rotate what matters and dismiss the test fixtures with confidence.',
            points: [
              'Jump straight to the offending line with file and line context.',
              'Live production credentials rank above test fixtures.',
              'Bulk-resolve clusters of related secrets in a single action.',
              'Every secret finding and resolution logged for compliance.',
            ],
            visual: 'scan',
          },
        ],
        cards: {
          eyebrow: 'Built for incident speed',
          title: 'When a secret hits the repo',
          items: [
            { title: 'Instant liveness context', description: 'Separate a five-year-old test key from a live production credential.' },
            { title: 'Evidence on the line', description: 'See the exact file, line and surrounding code that leaked.' },
            { title: 'Rotation guidance', description: 'Step-by-step instructions for the specific provider that leaked.' },
            { title: 'Audit trail', description: 'Who found it, who resolved it, and when — fully logged.' },
          ],
        },
        testimonials: [
          { quote: 'A live AWS key had been in a fork for months. Vulnix flagged it in the first scan.', name: 'Priya Nair', role: 'Platform Engineer' },
          { quote: 'The liveness ranking saved us from rotating two hundred dead test keys.', name: 'Omar Haddad', role: 'DevOps Lead' },
          { quote: 'Bulk triage turned a day of secret cleanup into twenty minutes.', name: 'Elena Petrova', role: 'Security Analyst' },
        ],
        faq: [
          { q: 'How do you detect secrets?', a: 'Gitleaks rules plus entropy analysis. Every detector is tuned to minimize false positives while catching real credentials.' },
          { q: 'Do you scan git history?', a: 'Yes. We scan the working tree, branches and full commit history, so old leaks do not stay hidden.' },
          { q: 'How do you know a secret is live?', a: 'Where a provider allows safe verification we check liveness. Otherwise we rank by context — production paths rank above test fixtures.' },
          { q: 'What happens to a found secret?', a: 'It becomes a finding with file, line and evidence. You triage it, follow rotation guidance, and the resolution is logged.' },
        ],
        cta: {
          title: 'Find your secrets before someone else does',
          description: 'Start free — first scan takes under five minutes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
