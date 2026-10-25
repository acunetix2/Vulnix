import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function SOC2() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'SOC 2',
          accent: 'Type II',
          description:
            'Vulnix is built to help you pass your own SOC 2 audit — and our controls are mapped to the trust service criteria auditors check.',
        },
        features: [
          { icon: 'shield', title: 'Control mapping', description: 'Findings and logs mapped to relevant SOC 2 criteria.' },
          { icon: 'lock', title: 'Evidence exports', description: 'Download audit-ready evidence packs in one click.' },
          { icon: 'radar', title: 'Continuous readiness', description: 'Stay audit-ready between assessment windows.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'How Vulnix supports your SOC 2 program',
            items: [
              'Automated code review evidence for the security criterion.',
              'Audit logs of every scan, finding, and triage decision.',
              'Access control evidence via RBAC and workspace roles.',
              'Retention and disposal evidence for uploaded code.',
            ],
          },
        ],
        cta: {
          title: 'Strengthen your SOC 2 program',
          description: 'Start free and generate your first evidence pack.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'Talk to sales', to: '/company' },
        },
      }}
    />
  )
}
