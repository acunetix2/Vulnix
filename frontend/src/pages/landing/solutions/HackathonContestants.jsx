import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function HackathonContestants() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Hackathon Contestants',
          title: 'Scan before you submit',
          accent: 'win without the footgun',
          description:
            'Judges ask hard questions. Vulnix scans your hackathon project in under a minute so you can demo without a live vulnerability — and answer security questions like you planned it.',
        },
        features: [
          {
            icon: 'scan',
            title: 'One-minute pre-demo scan',
            description:
              'ZIP the repo, upload, and get prioritized findings while the judges are still setting up the projector.',
          },
          {
            icon: 'ai',
            title: 'Demo-defensible answers',
            description:
              'Each finding comes with a plain-language explanation so you can speak confidently about what you checked and why it matters.',
          },
          {
            icon: 'terminal',
            title: 'Fixes on the clock',
            description:
              'Copy-pasteable patches let you clear critical findings between pitches instead of reading long reports.',
          },
        ],
        stats: [
          { value: '< 60s', label: 'From ZIP to verdict' },
          { value: '5', label: 'Scanners per run', color: '#8b5cf6' },
          { value: 'Free', label: 'Plan for your whole team' },
          { value: '0', label: 'Config before you scan', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'The 48-hour reality',
            title: 'Security that fits between the caffeine and the demo',
            description:
              'You built the product in a weekend. Vulnix does not ask you to bolt on a security program — it gives you a ranked list and patches you can apply before the pitch.',
            points: [
              'Scan at hour 40, fix criticals at hour 44, demo clean at hour 48.',
              'Gitleaks catches the API key you committed at 3 a.m. on day one.',
              'pip-audit and Trivy flag the vulnerable package you grabbed from a tutorial.',
              'Semgrep and Bandit cover injection, XSS and unsafe deserialization.',
            ],
            visual: 'scan',
          },
          {
            eyebrow: 'Demo day',
            title: 'Walk in with answers, not hopes',
            description:
              'Judges increasingly ask about data handling and security posture. A Vulnix report gives you concrete talking points and a story of what you already fixed.',
            points: [
              'Export a clean findings summary to show due diligence in your deck.',
              'Explain each remaining risk in plain language if asked on stage.',
              'Cover the OWASP Top 10 basics without pulling an all-nighter on them.',
              'Keep the Free plan after the event — the project does not have to end Sunday.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Weekend checklist',
          title: 'Run this before you submit',
          items: [
            {
              title: 'Secret sweep',
              description: 'Gitleaks on the whole history so no demo-mode API key embarrasses you live.',
            },
            {
              title: 'Quick SAST pass',
              description: 'Semgrep and Bandit flag the injection and XSS issues judges love to probe.',
            },
            {
              title: 'Dependency check',
              description: 'pip-audit and Trivy catch the tutorial package with a known CVE.',
            },
            {
              title: 'Report export',
              description: 'Download a summary to attach to your submission or slide deck.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'Scanned our project 30 minutes before the pitch, fixed two criticals, and we still made the finals.',
            name: 'Nadia Chen',
            role: 'Hackathon team lead',
          },
          {
            quote:
              'A judge asked how we handled secrets. We had the Gitleaks results ready. That question became our best moment.',
            name: 'Felix Andersson',
            role: 'Student builder',
          },
          {
            quote:
              'Found a vulnerable dependency we copied from a 2019 tutorial. Fixed it before anyone else’s scanner ran.',
            name: 'Priya Nair',
            role: 'Solo hacker',
          },
        ],
        faq: [
          {
            q: 'How fast can I scan a hackathon repo?',
            a: 'Most project ZIPs return a full prioritized result in under a minute — fast enough to scan twice before you present.',
          },
          {
            q: 'Do we need to pay as a team?',
            a: 'No. The Free plan covers 1 project and 20 scans a month, which is plenty for a 48-hour build.',
          },
          {
            q: 'Will it work on messy weekend code?',
            a: 'That is exactly what it is for. Findings are ranked so you fix the demo-breaking issues first and ignore the noise.',
          },
          {
            q: 'Can I use it after the event?',
            a: 'Yes. Keep the project scanned, or start a new one — your history and audit trail come with you.',
          },
        ],
        cta: {
          title: 'Scan your hackathon project free',
          description: 'Upload a ZIP before the next submission deadline. Criticals first, fixes included.',
          primary: { label: 'Scan now', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
