import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Agencies() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Agencies',
          title: 'Consistent security across',
          accent: 'every client you deliver',
          description:
            'Vulnix gives agencies multi-client isolation, uniform multi-scanner coverage and client-ready reports — so every engagement ships with the same security bar, not the loudest engineer’s memory of one.',
        },
        features: [
          {
            icon: 'layers',
            title: 'True multi-client isolation',
            description:
              'Each client lives in its own project boundary with role-based access, so a contractor on Account A never sees Account B’s code.',
          },
          {
            icon: 'check',
            title: 'One coverage standard, every engagement',
            description:
              'Semgrep, Bandit, Gitleaks, pip-audit and Trivy run identically across all client repos — no per-project scanner drift.',
          },
          {
            icon: 'file',
            title: 'Client-ready reports',
            description:
              'Export prioritized findings, fixes and audit trails in a format you can hand straight to a client or attach to an invoice.',
          },
        ],
        stats: [
          { value: '1', label: 'Standard across all clients' },
          { value: '5', label: 'Scanners per engagement', color: '#8b5cf6' },
          { value: 'RBAC', label: 'Per-client access control' },
          { value: 'SOC 2', label: 'Aligned reporting', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Multi-client operations',
            title: 'Every client gets the same security bar',
            description:
              'Agencies lose contracts over inconsistent delivery, not just bad code. Vulnix makes security coverage a repeatable deliverable instead of a per-project negotiation.',
            points: [
              'Per-project boundaries keep client codebases fully separated.',
              'Same five scanners and same severity model on every engagement.',
              'Role-based access for account leads, contractors and client stakeholders.',
              'Full audit trail of who scanned what, when, for every client.',
            ],
            visual: 'team',
          },
          {
            eyebrow: 'Client reporting',
            title: 'Hand-offs that look professional',
            description:
              'At the end of an engagement, export a clean report showing what was scanned, what was found and what was fixed — evidence that supports retainers and referrals.',
            points: [
              'Prioritized findings export with plain-language risk summaries.',
              'AI-written fix notes your client’s next team can act on.',
              'OWASP Top 10 and CWE mapping for compliance-minded clients.',
              'History retained per client, ready for the next audit or hand-off.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Agency workflows',
          title: 'Built for how agencies actually run',
          items: [
            {
              title: 'New client kickoff',
              description: 'Drop the codebase in as a new project and get a baseline scan on day one of the engagement.',
            },
            {
              title: 'Contractor separation',
              description: 'RBAC scopes freelancers to their project so multi-client work stays clean.',
            },
            {
              title: 'Pre-delivery gate',
              description: 'Run a final scan before hand-off and attach the report to the delivery checklist.',
            },
            {
              title: 'Retainer evidence',
              description: 'Ongoing scan history proves the value of your security retainer month over month.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'We run 14 client projects through Vulnix. The isolation model is what let me stop worrying about cross-client access.',
            name: 'Claire Dubois',
            role: 'Agency founder',
          },
          {
            quote:
              'Clients used to ask what we did for security. Now I attach a scan report to every delivery. Retainer renewals got easier.',
            name: 'Andre Silva',
            role: 'Delivery director',
          },
          {
            quote:
              'A contractor finished their piece, I scanned their project, found two criticals, and fixed them before the client ever saw the build.',
            name: 'Yuki Tanaka',
            role: 'Technical project manager',
          },
        ],
        faq: [
          {
            q: 'How is client code kept separate?',
            a: 'Each client is an isolated project with its own RBAC scope. Access is granted per project, and the audit trail records every action.',
          },
          {
            q: 'Can clients get their own access?',
            a: 'Yes. Invite client stakeholders with a scoped role so they can view findings without seeing your other accounts.',
          },
          {
            q: 'What do the client reports contain?',
            a: 'Prioritized findings, plain-language explanations, fix recommendations, scanner coverage and a dated audit history — exportable per project.',
          },
          {
            q: 'Is there a free plan to try on one project?',
            a: 'Yes — 1 project and 20 scans a month on Free, no credit card required, so you can pilot before rolling out agency-wide.',
          },
        ],
        cta: {
          title: 'Standardize security across every client',
          description: 'Start with one project free. Add clients, roles and reports as your book of business grows.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
