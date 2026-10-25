import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Developers() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Developers',
          title: 'Security feedback at',
          accent: 'the speed you code',
          description:
            'Upload a ZIP or paste a snippet and get prioritized findings with copy-pasteable fixes in under a minute. No pipeline rewrites, no security-team tickets, no context switching.',
          visual: 'scan',
        },
        features: [
          {
            icon: 'gauge',
            title: 'Minutes, not sprints',
            description:
              'Semgrep, Bandit, Gitleaks, pip-audit and Trivy run together and return a unified, deduplicated result before your coffee cools.',
          },
          {
            icon: 'ai',
            title: 'Fixes, not just flags',
            description:
              'Each finding ships with an AI-written explanation and a concrete patch you can paste straight into your editor.',
          },
          {
            icon: 'radar',
            title: 'Prioritized like a human would',
            description:
              'Findings are ranked by real exploitability and blast radius, so the top of the list is what you actually fix first.',
          },
        ],
        stats: [
          { value: '< 60s', label: 'ZIP upload to verdict' },
          { value: '5', label: 'Scanners in one pass', color: '#8b5cf6' },
          { value: '20/mo', label: 'Free scans, no card' },
          { value: '15+', label: 'Languages covered', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Workflow',
            title: 'Fits how you already ship',
            description:
              'Drop a ZIP when you are between tasks, wire Vulnix into CI when you are ready, or trigger scans from Slack and webhooks. The findings come back either way, ranked and explained.',
            points: [
              'ZIP upload for instant scans without touching your repo config.',
              'REST API and webhooks to plug scans into any CI or script.',
              'Slack and Jira notifications so findings land where you already work.',
              'Findings carry OWASP Top 10 and CWE tags you already know.',
            ],
            visual: 'pipeline',
          },
          {
            eyebrow: 'Findings',
            title: 'A list you can finish',
            description:
              'Instead of 400 raw warnings, you get a short prioritized queue: what is exploitable, where, and the exact diff that fixes it.',
            points: [
              'Deduplicated output across the five scanners — no duplicate tickets.',
              'Each finding shows the vulnerable line, an exploit narrative, and the patch.',
              'Secrets from Gitleaks, CVEs from pip-audit and Trivy, SAST from Semgrep and Bandit.',
              'Full audit history so you can prove what was fixed and when.',
            ],
            visual: 'code',
          },
        ],
        cards: {
          eyebrow: 'Daily use',
          title: 'Built for the developer loop',
          items: [
            {
              title: 'Pre-merge checks',
              description: 'Scan the branch ZIP before you open the PR and fix issues while the diff is still fresh.',
            },
            {
              title: 'Snippet mode',
              description: 'Paste a single function or file to check a Stack Overflow answer before you trust it.',
            },
            {
              title: 'Dependency triage',
              description: 'pip-audit and Trivy surface vulnerable packages with severity and a suggested upgrade path.',
            },
            {
              title: 'Secret sweep',
              description: 'Gitleaks scans your history so a key committed last month does not become next week’s incident.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'I scanned a ZIP on a Friday afternoon and had fixes, not a 200-line report. That never happens with our old scanner.',
            name: 'Sam Okafor',
            role: 'Backend engineer',
          },
          {
            quote:
              'The AI explanation told me why the SQL was injectable, not just which line to change. I fixed it and understood it.',
            name: 'Lena Vogt',
            role: 'Full-stack developer',
          },
          {
            quote:
              'Wired the REST API into our pipeline in an afternoon. Findings now land in Slack before standup.',
            name: 'Ravi Patel',
            role: 'Platform engineer',
          },
        ],
        faq: [
          {
            q: 'Do I have to change my pipeline?',
            a: 'No. ZIP upload works with zero config. When you are ready, the REST API and webhooks drop into any CI.',
          },
          {
            q: 'Which scanners run under the hood?',
            a: 'Semgrep, Bandit, Gitleaks, pip-audit and Trivy — results deduplicated and prioritized into one view.',
          },
          {
            q: 'What languages are covered?',
            a: 'Python, JavaScript, TypeScript, Go, Java, Ruby and more, with dependency scanning for pip and containers.',
          },
          {
            q: 'Is there a free tier for individuals?',
            a: 'Yes — 1 project and 20 scans a month on the Free plan, no credit card required.',
          },
        ],
        cta: {
          title: 'Scan your next branch in under a minute',
          description: 'Upload a ZIP or connect your repo. Prioritized findings with fixes, free to start.',
          primary: { label: 'Get started free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
