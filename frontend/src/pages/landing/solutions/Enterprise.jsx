import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Enterprise() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Enterprise',
          title: 'Code security that meets',
          accent: 'your compliance bar',
          description:
            'SSO/SAML, granular RBAC, complete audit trails and self-hosted deployment — backed by multi-scanner SAST and AI explanations that work at enterprise scale.',
        },
        features: [
          {
            icon: 'lock',
            title: 'SSO/SAML and RBAC',
            description:
              'Integrate with your identity provider and enforce least-privilege access by team, project and role across every business unit.',
          },
          {
            icon: 'file',
            title: 'Immutable audit trails',
            description:
              'Every scan, finding, assignment and fix is recorded with actor and timestamp — exportable evidence for SOC 2 and internal audit.',
          },
          {
            icon: 'globe',
            title: 'Self-hosted and on-prem',
            description:
              'Run Vulnix inside your own network or VPC so source code never leaves your security perimeter, with the same engine as cloud.',
          },
        ],
        stats: [
          { value: 'SOC 2', label: 'Aligned control set' },
          { value: 'SSO', label: 'SAML & SCIM ready', color: '#8b5cf6' },
          { value: '5', label: 'Scanners per run' },
          { value: '100%', label: 'Audit trail coverage', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Identity & access',
            title: 'RBAC that mirrors your org chart',
            description:
              'Enterprise codebases have contractors, offshore teams and rotating vendors. Vulnix scopes every action to a role and a project, and records it — so access reviews take minutes, not weeks.',
            points: [
              'SSO/SAML integration with your existing identity provider.',
              'Granular roles per project, team and business unit.',
              'Complete audit log of who scanned, viewed and fixed what.',
              'Evidence exports for SOC 2 and internal compliance reviews.',
            ],
            visual: 'team',
          },
          {
            eyebrow: 'Deployment',
            title: 'Your perimeter, your controls',
            description:
              'Deploy Vulnix self-hosted or on-prem so scanning runs inside your network. Multi-scanner coverage, AI explanations and reporting behave exactly as they do in cloud — data residency stays yours.',
            points: [
              'Self-hosted and on-prem options for regulated environments.',
              'Semgrep, Bandit, Gitleaks, pip-audit and Trivy run inside your perimeter.',
              'REST API and webhooks into existing enterprise CI/CD pipelines.',
              'SOC 2 aligned operational controls and retention policies.',
            ],
            visual: 'compliance',
          },
        ],
        cards: {
          eyebrow: 'Enterprise capabilities',
          title: 'Built for security and procurement review',
          items: [
            {
              title: 'Identity integration',
              description: 'SSO/SAML and SCIM so joiner-mover-leaver flows stay in your directory.',
            },
            {
              title: 'Compliance mapping',
              description: 'Findings tagged to OWASP Top 10 and CWE, with reports that map to SOC 2 evidence requests.',
            },
            {
              title: 'Portfolio visibility',
              description: 'Org-wide dashboards roll up risk by business unit, project and severity.',
            },
            {
              title: 'Programmable security',
              description: 'REST API and webhooks drive scans from your pipelines, ticketing and SIEM workflows.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'Our access review used to take a spreadsheet and three people. With Vulnix RBAC and audit logs, it took an afternoon.',
            name: 'Diane Okafor',
            role: 'Head of Application Security',
          },
          {
            quote:
              'Self-hosting was non-negotiable for us. Vulnix ran inside our VPC on day one with the same feature set as cloud.',
            name: 'Viktor Petrov',
            role: 'Security architecture lead',
          },
          {
            quote:
              'The SOC 2 evidence exports cut months off our audit prep. Auditors accepted the audit trail as-is.',
            name: 'Grace Liu',
            role: 'Compliance manager',
          },
        ],
        faq: [
          {
            q: 'Do you support SSO/SAML?',
            a: 'Yes. Vulnix integrates with major identity providers via SSO/SAML, with SCIM for automated provisioning where required.',
          },
          {
            q: 'Can Vulnix run on-premises?',
            a: 'Yes. Self-hosted and on-prem deployments run the full multi-scanner engine inside your network or VPC.',
          },
          {
            q: 'How does this support SOC 2?',
            a: 'RBAC, immutable audit trails, retention controls and exportable evidence map directly to common SOC 2 control requirements.',
          },
          {
            q: 'How does it fit our CI/CD?',
            a: 'Trigger scans via REST API and webhooks, route findings to Jira or Slack, and enforce checks in existing pipelines without new agents.',
          },
        ],
        cta: {
          title: 'Bring Vulnix into your security program',
          description: 'Talk to us about SSO, RBAC, self-hosted deployment and SOC 2 evidence — or start a scoped pilot today.',
          primary: { label: 'Request a demo', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
