import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Compliance() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Compliance reporting',
          accent: 'out of the box',
          description:
            'Map findings to OWASP Top 10, CWE and SOC 2 controls automatically. Export auditor-ready reports without a spreadsheet in sight.',
          visual: 'compliance',
        },
        features: [
          { icon: 'check', title: 'OWASP & CWE mapping', description: 'Every finding tagged with the standards auditors ask about.' },
          { icon: 'lock', title: 'SOC 2 evidence', description: 'Scan history, triage decisions and access logs as audit evidence.' },
          { icon: 'chart', title: 'Point-in-time posture', description: 'Snapshot your security posture on any date for audits.' },
        ],
        stats: [
          { value: 'OWASP Top 10', label: 'Automatic mapping' },
          { value: 'CWE', label: 'Rule-level tagging', color: '#8b5cf6' },
          { value: 'SOC 2', label: 'Control evidence' },
          { value: '1-click', label: 'Report export', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Standards',
            title: 'Mapped to what auditors actually ask',
            description:
              'Findings are tagged against OWASP Top 10 categories and CWE identifiers the moment they are produced. No manual mapping, no spreadsheet reconciliation the week before your audit.',
            points: [
              'OWASP Top 10 category on every relevant finding.',
              'CWE identifier for precise vulnerability classification.',
              'SOC 2 trust-service criteria mapped to your controls.',
              'Point-in-time snapshots for any audit window.',
            ],
            visual: 'compliance',
          },
          {
            eyebrow: 'Evidence',
            title: 'Reports you can hand to an auditor',
            description:
              'Four report types cover everything from executive summaries to raw evidence exports. Generate them on demand or on a schedule and stop scrambling for screenshots.',
            points: [
              'Executive summary: risk posture, trends and top exposures.',
              'Technical findings: file, line, CWE, severity and remediation.',
              'Compliance matrix: control-by-control status.',
              'Audit trail: every scan, finding and triage with actors and timestamps.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Report types',
          title: 'Four exports for four audiences',
          items: [
            { title: 'Executive summary', description: 'Risk posture, trend lines and top exposures for leadership.' },
            { title: 'Technical findings', description: 'Full detail with file, line, CWE, severity and remediation.' },
            { title: 'Compliance matrix', description: 'Control-by-control status for OWASP, CWE and SOC 2.' },
            { title: 'Audit trail export', description: 'Every scan, finding and triage action with timestamps and actors.' },
          ],
        },
        testimonials: [
          { quote: 'Our SOC 2 auditor asked for scan evidence and we exported it in one click.', name: 'Rachel Kim', role: 'Head of Security' },
          { quote: 'The OWASP mapping saved our team a full week of manual tagging.', name: 'Diego Alvarez', role: 'Compliance Manager' },
          { quote: 'Leadership finally has a risk trend they understand, updated automatically.', name: 'Nadia Hassan', role: 'CISO' },
        ],
        faq: [
          { q: 'Which standards do you map to?', a: 'OWASP Top 10, CWE identifiers and SOC 2 trust service criteria.' },
          { q: 'Can I generate reports on a schedule?', a: 'Yes. Generate on demand or on a recurring schedule and export in PDF, CSV or JSON.' },
          { q: 'What is a point-in-time snapshot?', a: 'A frozen view of your security posture on a given date, useful for audit windows.' },
          { q: 'Is there an audit trail?', a: 'Yes. Every scan, finding and triage decision is logged with actor and timestamp, and exportable.' },
        ],
        cta: {
          title: 'Generate your first compliance report',
          description: 'Start free and see what auditors will ask for.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
