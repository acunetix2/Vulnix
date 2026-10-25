import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Reports() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Reports your whole org',
          accent: 'can act on',
          description:
            'Dashboard-ready reports for developers, security engineers and executives — each tuned to the decisions that person needs to make.',
          visual: 'reports',
        },
        features: [
          { icon: 'chart', title: 'Role-tuned views', description: 'Developers see fixes; security sees posture; execs see risk trends.' },
          { icon: 'gauge', title: 'Live dashboards', description: 'Severity breakdowns, MTTR and scan coverage update in real time.' },
          { icon: 'file', title: 'Export anywhere', description: 'PDF, CSV and JSON exports for audits and questionnaires.' },
        ],
        stats: [
          { value: '4', label: 'Report types' },
          { value: 'Live', label: 'Real-time dashboards', color: '#8b5cf6' },
          { value: 'PDF · CSV · JSON', label: 'Export formats' },
          { value: 'Role-based', label: 'Tailored views', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Audiences',
            title: 'One dataset, three different views',
            description:
              'The same findings power a developer punch list, a security posture dashboard and an executive risk trend. Everyone sees what they need without a wall of noise.',
            points: [
              'Developers: findings grouped by file with concrete fixes.',
              'Security: posture, exposure and coverage across projects.',
              'Executives: risk trend and MTTR without the technical detail.',
              'All views driven by the same underlying scan data.',
            ],
            visual: 'reports',
          },
          {
            eyebrow: 'Built-in reports',
            title: 'Four reports, ready to export',
            description:
              'Generate any report on demand or on a schedule. Export as PDF for leadership, CSV for analysts, or JSON for your own tooling.',
            points: [
              'Security posture: open findings by severity, age and project.',
              'Trend lines: how exposure changes sprint over sprint.',
              'Project coverage: what is scanned, how often, what is stale.',
              'Compliance pack: OWASP, CWE and SOC 2 mapped for auditors.',
            ],
            visual: 'compliance',
          },
        ],
        cards: {
          eyebrow: 'Built-in report types',
          title: 'Ready-made, not DIY',
          items: [
            { title: 'Security posture', description: 'Open findings by severity, age and project.' },
            { title: 'Trend lines', description: 'How your exposure changes sprint over sprint.' },
            { title: 'Project coverage', description: 'Which projects are scanned, how often, and what is stale.' },
            { title: 'Compliance pack', description: 'OWASP, CWE and SOC 2 mapped reports for auditors.' },
          ],
        },
        testimonials: [
          { quote: 'The executive trend view ended our monthly security slide-deck scramble.', name: 'Hannah Brooks', role: 'VP Engineering' },
          { quote: 'Coverage report showed us three services nobody had scanned in a year.', name: 'Victor Nunes', role: 'Security Engineer' },
          { quote: 'Exports drop straight into our board pack. No reformatting.', name: 'Aisha Rahman', role: 'CISO' },
        ],
        faq: [
          { q: 'Who are the reports for?', a: 'Developers, security engineers and executives — each gets a view tuned to their decisions.' },
          { q: 'What formats can I export?', a: 'PDF, CSV and JSON.' },
          { q: 'Can reports run on a schedule?', a: 'Yes. Generate on demand or on a recurring schedule.' },
          { q: 'What is MTTR?', a: 'Mean time to resolution — how long findings take to go from open to resolved, tracked per project.' },
        ],
        cta: {
          title: 'See your first report',
          description: 'Start free and generate a report on your first scan.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
