import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function SecurityCompliance() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Security &',
          accent: 'Compliance',
          description:
            'How we protect your code, the standards we align to, and the controls you can rely on when your auditors ask.',
        },
        features: [
          { icon: 'lock', title: 'Your code stays yours', description: 'Never used for training, encrypted in transit and at rest.' },
          { icon: 'shield', title: 'SOC 2 aligned', description: 'Controls mapped to SOC 2 trust service criteria.' },
          { icon: 'radar', title: 'Audit ready', description: 'Exportable evidence for every scan, finding, and triage action.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'How we keep your code safe',
            items: [
              { title: 'Encryption', description: 'TLS 1.2+ in transit, AES-256 at rest.' },
              { title: 'Access control', description: 'Least-privilege RBAC across every workspace.' },
              { title: 'Retention', description: 'Uploads expire automatically on your schedule.' },
              { title: 'Isolation', description: 'Per-tenant isolation with no shared scan state.' },
            ],
          },
          {
            type: 'list',
            title: 'Compliance mapping',
            items: [
              'Findings mapped to OWASP Top 10 and CWE.',
              'SOC 2 aligned access, audit, and retention controls.',
              'On-prem and VPC deployment for strict data residency.',
              'Audit log export for your GRC tooling.',
            ],
          },
        ],
        cta: {
          title: 'Review our security posture',
          description: 'Talk to us about on-prem, VPC, or a security questionnaire.',
          primary: { label: 'Contact us', to: '/company' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
