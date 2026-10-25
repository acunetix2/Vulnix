import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Startups() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Startups',
          title: 'Enterprise-grade security',
          accent: 'without the enterprise hire',
          description:
            'Vulnix gives a small team multi-scanner coverage, AI-written fixes and audit-ready reports — the security posture investors ask about, without a full-time security engineer.',
        },
        features: [
          {
            icon: 'users',
            title: 'No security hire required',
            description:
              'Semgrep, Bandit, Gitleaks, pip-audit and Trivy run as one engine, so a team of three gets the coverage that used to need a team of ten.',
          },
          {
            icon: 'ai',
            title: 'Fixes your engineers can apply',
            description:
              'Every finding ships with a plain-language risk summary and a concrete patch, so the person who wrote the code can close it the same day.',
          },
          {
            icon: 'check',
            title: 'Investor-ready evidence',
            description:
              'Exportable reports, full audit trails and SOC 2 aligned controls answer due-diligence questionnaires without a scramble.',
          },
        ],
        stats: [
          { value: '$0', label: 'Security headcount needed' },
          { value: '5', label: 'Scanners per scan', color: '#8b5cf6' },
          { value: 'SOC 2', label: 'Aligned controls' },
          { value: '< 1 day', label: 'To full coverage', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'From day one',
            title: 'Security that scales with your headcount',
            description:
              'Start with a single repo on the Free plan and grow into role-based access, multiple projects and compliance reporting — same engine, same workflow, no re-platforming.',
            points: [
              'Free plan covers your first project and 20 scans a month.',
              'Add projects, teammates and roles as the team grows.',
              'REST API and webhooks plug into whatever CI you already run.',
              'Slack and Jira integrations keep findings in tools you already live in.',
            ],
            visual: 'pipeline',
          },
          {
            eyebrow: 'Due diligence',
            title: 'Walk into the board meeting with answers',
            description:
              'When a lead investor or a big customer asks about your security program, Vulnix gives you a dated, exportable trail instead of a promise to look into it.',
            points: [
              'Full audit trail of every scan, finding and fix across the team.',
              'Role-based access control so contractors never see the wrong repo.',
              'OWASP Top 10 and CWE mapping for the checklist conversations.',
              'Reports you can attach directly to a due-diligence request.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Startup use cases',
          title: 'Where early teams get leverage',
          items: [
            {
              title: 'Pre-raise security story',
              description: 'A clean findings history and SOC 2 aligned posture for investor and customer questionnaires.',
            },
            {
              title: 'Pre-launch sweep',
              description: 'One ZIP scan catches secrets, injection bugs and vulnerable dependencies before public launch.',
            },
            {
              title: 'Contractor onboarding',
              description: 'RBAC lets external developers scan their work without owning the whole codebase.',
            },
            {
              title: 'CI guardrail',
              description: 'Trigger scans from the REST API so every merge gets checked without a security review meeting.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'We answered our first enterprise security questionnaire in an afternoon using Vulnix reports. The deal closed the same week.',
            name: 'Rachel Kim',
            role: 'CTO, seed-stage startup',
          },
          {
            quote:
              'I was the accidental security person. Vulnix made that role survivable until we could hire for it.',
            name: 'Omar Haddad',
            role: 'Founding engineer',
          },
          {
            quote:
              'Investors asked what our security process looked like. We had scan history and audit trails ready. That question used to scare me.',
            name: 'Sofia Martins',
            role: 'Co-founder & CEO',
          },
        ],
        faq: [
          {
            q: 'We have no security person. Can we still run this?',
            a: 'Yes. Findings are prioritized and fixes are written for engineers, not analysts. Most teams start without any security expertise.',
          },
          {
            q: 'How does this help with SOC 2?',
            a: 'Vulnix provides SOC 2 aligned controls — RBAC, audit trails and evidence exports — that map directly to the common checklist.',
          },
          {
            q: 'What does the Free plan include?',
            a: '1 project and 20 scans a month, with all five scanners and AI explanations. Upgrade when the team or repo count grows.',
          },
          {
            q: 'Can it integrate with our existing stack?',
            a: 'Yes — REST API, webhooks, Slack and Jira, plus ZIP upload for teams that want zero pipeline changes.',
          },
        ],
        cta: {
          title: 'Get a security posture you can show investors',
          description: 'Start free today. Full multi-scanner coverage, AI fixes, and reports ready for due diligence.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
