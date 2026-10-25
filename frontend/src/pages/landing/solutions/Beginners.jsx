import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Beginners() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Beginners',
          title: 'Learn secure coding',
          accent: 'one finding at a time',
          description:
            'Vulnix turns every scan into a lesson. Plain-language explanations, guided fixes, and zero jargon help you build secure habits before bad ones form.',
        },
        features: [
          {
            icon: 'ai',
            title: 'Plain-language explanations',
            description:
              'Every finding comes with a short explanation of what the bug is, why it matters, and what an attacker could actually do with it.',
          },
          {
            icon: 'file',
            title: 'Guided, copy-pasteable fixes',
            description:
              'You never have to guess the patch. Each fix shows the exact before/after code so you can learn by reading, not by searching Stack Overflow.',
          },
          {
            icon: 'layers',
            title: 'Learn by severity',
            description:
              'Findings are grouped from critical to informational so you fix what matters first and build intuition for risk as you go.',
          },
        ],
        stats: [
          { value: '5', label: 'Scanners learning for you' },
          { value: '3 min', label: 'First scan to first lesson', color: '#8b5cf6' },
          { value: '0', label: 'Security background needed' },
          { value: 'Free', label: 'To start learning', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'How you learn',
            title: 'Every vulnerability becomes a lesson',
            description:
              'Semgrep, Bandit, Gitleaks, pip-audit and Trivy surface real issues in your code, and Vulnix rewrites each one into something a beginner can understand and act on.',
            points: [
              'See the vulnerable line highlighted with a short "what went wrong" summary.',
              'Read an attacker-style walkthrough so the risk feels real, not abstract.',
              'Apply the guided fix and rescan to watch the finding disappear.',
              'Track your streak of resolved findings to stay motivated.',
            ],
            visual: 'scan',
          },
          {
            eyebrow: 'Habits that stick',
            title: 'Build secure instincts before your first job',
            description:
              'Repeat the same mistake twice and Vulnix calls it out with a deeper explanation, so patterns become habits instead of one-off patches.',
            points: [
              'Recurring-miss nudges highlight habits like logging secrets or raw SQL.',
              'OWASP Top 10 and CWE references tie each fix to the wider security canon.',
              'A personal history page shows what you have learned and what is next.',
              'Works with Python, JavaScript, Go and more — the languages you learn on.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'What you will learn',
          title: 'Security fundamentals, made concrete',
          items: [
            {
              title: 'Secrets hygiene',
              description:
                'Gitleaks catches API keys and passwords in your commits and teaches you to use environment variables instead.',
            },
            {
              title: 'Injection basics',
              description:
                'See how unsanitized input becomes an exploit, and learn parameterized queries the right way.',
            },
            {
              title: 'Dependency safety',
              description:
                'pip-audit and Trivy flag vulnerable packages and explain what the CVE actually means for your app.',
            },
            {
              title: 'Safe defaults',
              description:
                'Bandit points out weak configs and risky functions so secure choices become second nature.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'I had never heard of SQL injection before Vulnix. After fixing my first one I finally get why everyone talks about it.',
            name: 'Jordan Lee',
            role: 'CS student',
          },
          {
            quote:
              'The explanations read like a patient teammate, not a lecture. I learned more in a week than in a semester of slides.',
            name: 'Aisha Rahman',
            role: 'Bootcamp graduate',
          },
          {
            quote:
              'I used to copy-paste code blindly. Now I scan it first and actually understand what I am pasting.',
            name: 'Diego Santos',
            role: 'Junior developer',
          },
        ],
        faq: [
          {
            q: 'Do I need security experience?',
            a: 'No. Vulnix is built for people writing their first real code. Every finding is explained in everyday language.',
          },
          {
            q: 'Which languages are supported?',
            a: 'Python, JavaScript, TypeScript, Go, Java, Ruby and more — driven by Semgrep, Bandit and the rest of the scanner stack.',
          },
          {
            q: 'Is there a free plan?',
            a: 'Yes. The Free plan gives you 1 project and 20 scans a month, with no credit card required.',
          },
          {
            q: 'Will it slow me down while I learn?',
            a: 'Scans return in under a minute, and you can start with a single pasted snippet instead of a full repo.',
          },
        ],
        cta: {
          title: 'Write your first secure commit today',
          description: 'Paste a file, get a plain-language verdict, and learn something new. Free forever for learners.',
          primary: { label: 'Start learning free', to: '/signup' },
          secondary: { label: 'See how it works', to: '/pricing' },
        },
      }}
    />
  )
}
