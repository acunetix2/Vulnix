import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Dependencies() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Dependency scanning',
          accent: 'for known CVEs',
          description:
            'pip-audit and Trivy surface vulnerable packages in your lockfiles and manifests — with severity, reachability and the fixed version on every finding.',
          visual: 'deps',
        },
        features: [
          { icon: 'package', title: 'Manifest + lockfile', description: 'Detects direct and transitive dependencies across ecosystems.' },
          { icon: 'bug', title: 'CVE severity', description: 'CVSS scores and CWE mappings attached to every vulnerable package.' },
          { icon: 'branch', title: 'Fix availability', description: 'Shows the patched version when one exists upstream.' },
        ],
        stats: [
          { value: '10+', label: 'Package ecosystems' },
          { value: 'Direct + transitive', label: 'Dependency depth', color: '#eab308' },
          { value: 'Reachability', label: 'Import-aware triage' },
          { value: 'CVSS + CWE', label: 'Severity mapping', color: '#eab308' },
        ],
        rows: [
          {
            eyebrow: 'Coverage',
            title: 'Ecosystems we support',
            description:
              'From Python and JS lockfiles to Go modules and Java builds. We read your manifests, resolve the full dependency tree, and match it against known vulnerability databases.',
            points: [
              'Python: requirements.txt, poetry.lock, Pipfile.lock, pyproject.toml.',
              'JavaScript/TypeScript: package-lock.json, yarn.lock, pnpm-lock.yaml.',
              'Go: go.mod / go.sum.',
              'Java: pom.xml, build.gradle, gradle.lockfile.',
              'Ruby, Rust, .NET and more via Trivy.',
            ],
            visual: 'deps',
          },
          {
            eyebrow: 'Triage faster',
            title: 'Only fix what actually matters',
            description:
              'A vulnerable package is only urgent if your code reaches it. We pair CVEs with the code that imports the package so you can prioritize real exposure over theoretical risk.',
            points: [
              'One finding per vulnerable package, not per lockfile line.',
              'Reachability context from the code that imports the package.',
              'Bulk remediation across versions in a single action.',
              'Compliance mapping for SOC 2 and customer questionnaires.',
            ],
            visual: 'scan',
          },
        ],
        cards: {
          eyebrow: 'Remediation',
          title: 'From CVE to patched dependency',
          items: [
            { title: 'Fixed version shown', description: 'When an upgrade exists upstream we surface the exact safe version.' },
            { title: 'Grouped by package', description: 'One finding per package keeps the list short and actionable.' },
            { title: 'Reachability filtering', description: 'Separate reachable exposures from dormant transitive deps.' },
            { title: 'Exportable evidence', description: 'CSV and JSON exports for audits and customer questionnaires.' },
          ],
        },
        testimonials: [
          { quote: 'Reachability filtering cut our dependency backlog from 300 CVEs to the 12 that actually mattered.', name: 'Wei Zhang', role: 'Staff SRE' },
          { quote: 'Lockfile parsing just works across Python, JS and Go. Zero config.', name: 'Amara Diallo', role: 'Engineering Lead' },
          { quote: 'We closed a customer security review in a day using the CVE export.', name: 'Ben Carter', role: 'CTO' },
        ],
        faq: [
          { q: 'Which package formats are supported?', a: 'Python, JavaScript/TypeScript, Go, Java, Ruby, Rust and .NET across lockfiles and manifests.' },
          { q: 'Do you scan transitive dependencies?', a: 'Yes. We resolve the full dependency tree, not just your direct deps.' },
          { q: 'What is reachability?', a: 'We check whether your code actually imports the vulnerable package, so you can prioritize real exposure.' },
          { q: 'Do you show the fix?', a: 'Yes. When a patched version exists we show the exact safe version to upgrade to.' },
        ],
        cta: {
          title: 'Audit your dependencies free',
          description: 'No credit card required. First scan in minutes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
