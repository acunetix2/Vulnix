import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function PostgresDevs() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'For Postgres Devs',
          title: 'Keep your database layer',
          accent: 'out of the CVE feed',
          description:
            'Vulnix finds SQL injection, unsafe ORM usage, leaked connection strings and risky migrations in your Postgres-backed apps — with fixes written for the way you actually query.',
        },
        features: [
          {
            icon: 'code',
            title: 'SQL injection detection',
            description:
              'Semgrep and Bandit trace string-built queries across raw SQL, psycopg2, SQLAlchemy, ActiveRecord and Prisma, and show the parameterized rewrite.',
          },
          {
            icon: 'key',
            title: 'Connection string hygiene',
            description:
              'Gitleaks catches hardcoded DATABASE_URL values, passwords in migrations, and credentials sitting in .env files that got committed.',
          },
          {
            icon: 'branch',
            title: 'Migration-aware checks',
            description:
            'Risky schema changes — wide ALTER TABLE locks, unindexed foreign keys, open privileges — are flagged before they hit production.',
          },
        ],
        stats: [
          { value: '5', label: 'Scanners per database app' },
          { value: '< 1 min', label: 'Repo scan to first finding', color: '#8b5cf6' },
          { value: 'OWASP', label: 'A03 Injection covered' },
          { value: 'CWE-89', label: 'SQL injection tagged', color: '#8b5cf6' },
        ],
        rows: [
          {
            eyebrow: 'Query safety',
            title: 'From f-string to parameterized query',
            description:
              'The most common Postgres exploit is still the oldest one: user input concatenated into SQL. Vulnix spots the pattern and hands you the fix in the same style you already write.',
            points: [
              'Flags f-string, % and .format() query building across Python and Node.',
              'Catches ORM raw() and text() calls that bypass parameter binding.',
              'Suggests the exact parameterized rewrite for your driver — psycopg2, SQLAlchemy, Prisma.',
              'Tags each finding to CWE-89 and OWASP A03 so triage takes seconds.',
            ],
            visual: 'code',
          },
          {
            eyebrow: 'Credentials',
            title: 'Connection strings that never leak',
            description:
              'Real DATABASE_URL values end up in git history more often than anyone admits. Gitleaks and the AI layer find them and walk you through rotation.',
            points: [
              'Detects postgres:// and postgresql:// URIs with embedded passwords in code and config.',
              'Finds superuser credentials in seed scripts and docker-compose files.',
              'AI explanation covers the blast radius: what an attacker gains with your role.',
              'Rotation checklist included so the fix is more than a git rm.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Postgres attack surface',
          title: 'What Vulnix checks in your data layer',
          items: [
            {
              title: 'SQL injection paths',
              description: 'Raw SQL, ORM raw calls, and dynamic ORDER BY clauses that smuggle user input.',
            },
            {
              title: 'Leaked DSNs',
              description: 'Connection strings, role passwords and SSL keys hiding in code, .env files and history.',
            },
            {
              title: 'Risky migrations',
              description: 'Lock-heavy ALTER statements, missing indexes and GRANT ALL patterns flagged pre-merge.',
            },
            {
              title: 'Vulnerable drivers',
              description: 'pip-audit and Trivy flag outdated psycopg, node-postgres and Postgres container images.',
            },
          ],
        },
        testimonials: [
          {
            quote:
              'Found a f-string query buried in a report builder that three of us had reviewed. The fix was one line and the explanation was spot on.',
            name: 'Maya Kowalski',
            role: 'Data platform engineer',
          },
          {
            quote:
              'We had a superuser password in a seed script since the prototype days. Vulnix caught it and told us how to rotate safely.',
            name: 'Tomás Rivera',
            role: 'Backend lead',
          },
          {
            quote:
              'The migration checks caught an ALTER TABLE that would have locked our biggest table on deploy. That alone paid for the year.',
            name: 'Hannah Brooks',
            role: 'Senior Postgres developer',
          },
        ],
        faq: [
          {
            q: 'Which ORMs and drivers are supported?',
            a: 'SQLAlchemy, psycopg2, Django ORM, ActiveRecord, node-postgres, Prisma and raw SQL — with driver-specific fix suggestions.',
          },
          {
            q: 'Can it scan my migration history?',
            a: 'Yes. Point Vulnix at your migrations directory and it flags lock-heavy DDL, unsafe GRANTs and embedded credentials.',
          },
          {
            q: 'Does it catch secrets in git history?',
            a: 'Gitleaks runs as part of every scan, so a DATABASE_URL committed months ago still surfaces.',
          },
          {
            q: 'Is there a free plan?',
            a: 'Yes — 1 project and 20 scans a month on Free, no credit card required.',
          },
        ],
        cta: {
          title: 'Scan your Postgres app before the next deploy',
          description: 'Upload a ZIP and see injection paths, leaked DSNs and risky migrations in one prioritized list.',
          primary: { label: 'Start scanning free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
