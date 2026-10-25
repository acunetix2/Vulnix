import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function FeatureCatalog() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Every capability',
          accent: 'in one place',
          description:
            'A complete tour of what Vulnix does — from upload to audit trail — so you can evaluate the full platform before you sign up.',
          visual: 'pipeline',
        },
        features: [
          { icon: 'scan', title: 'Code scanning', description: 'SAST, secrets, dependencies and IaC in a single upload.' },
          { icon: 'ai', title: 'AI review', description: 'Explanations, risk assessment and remediation for each finding.' },
          { icon: 'lock', title: 'Governance', description: 'RBAC, audit trails and compliance exports built in.' },
        ],
        stats: [
          { value: '5', label: 'Scanners per run' },
          { value: 'AI', label: 'Review on every finding', color: '#8b5cf6' },
          { value: '4', label: 'RBAC roles' },
          { value: 'SOC 2', label: 'Aligned controls', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Core capabilities',
            title: 'Scan, understand, fix',
            description:
              'One upload fans out to five scanners, findings are deduplicated and ranked, and AI turns each one into a plain-language explanation with a concrete fix.',
            points: [
              'Multi-scanner engine: Semgrep, Bandit, Gitleaks, pip-audit, Trivy.',
              'AI security review: explanations and remediation on every finding.',
              'Bulk triage: resolve, escalate or dismiss in bulk with audit trail.',
              'Team collaboration: workspace, admin, member and viewer roles.',
            ],
            visual: 'scan',
          },
          {
            eyebrow: 'Platform & governance',
            title: 'Built for teams and auditors',
            description:
              'Everything security and compliance teams need to adopt Vulnix at scale — from least-privilege access to exportable evidence.',
            points: [
              'Audit trails: every scan, finding and triage decision logged.',
              'Compliance mapping: OWASP Top 10, CWE and SOC 2 out of the box.',
              'Integrations: Slack, Jira, signed webhooks and a full REST API.',
              'Self-hosted option: run on-premise or in your own cloud.',
            ],
            visual: 'team',
          },
        ],
        cards: {
          eyebrow: 'Platform capabilities',
          title: 'Everything included',
          items: [
            { title: 'Multi-scanner engine', description: 'Five scanners running together on every upload.' },
            { title: 'AI security review', description: 'Explanations, risk assessment and remediation per finding.' },
            { title: 'Bulk triage', description: 'Resolve, escalate or dismiss findings in bulk.' },
            { title: 'Team collaboration', description: 'RBAC with four roles across every workspace.' },
            { title: 'Audit trails', description: 'Every action logged and exportable for auditors.' },
            { title: 'Compliance mapping', description: 'OWASP, CWE and SOC 2 mapped automatically.' },
          ],
        },
        list: {
          eyebrow: 'Included in every plan',
          title: 'No feature gates on the fundamentals',
          items: [
            'Full REST API access with the same auth model as the dashboard.',
            'SOC 2 aligned audit logging across every workspace.',
            'Export to PDF, CSV and JSON for auditors and customers.',
            'Role-based access with least-privilege defaults.',
          ],
        },
        testimonials: [
          { quote: 'We evaluated four tools. Vulnix was the only one our developers actually kept using.', name: 'Clara Jensen', role: 'Director of Engineering' },
          { quote: 'The feature catalog matched what we needed on day one and scaled with us.', name: 'Michael Osei', role: 'Head of AppSec' },
          { quote: 'Self-hosted deployment closed the deal for our compliance team.', name: 'Yuki Tanaka', role: 'CISO' },
        ],
        faq: [
          { q: 'Which scanners are included?', a: 'Semgrep, Bandit, Gitleaks, pip-audit and Trivy — all run on every scan.' },
          { q: 'Is AI review on every plan?', a: 'AI review is included on Professional and Enterprise. Free and Starter include full scanning without AI.' },
          { q: 'How many roles are there?', a: 'Four: workspace owner, admin, member and viewer, with least-privilege defaults.' },
          { q: 'Can I self-host?', a: 'Yes. Enterprise supports on-premise and VPC deployment for full data control.' },
        ],
        cta: {
          title: 'Explore the full platform free',
          description: 'No credit card required. See every capability on your own code.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
