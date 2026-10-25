import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function CodeScanning() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Multi-scanner code review',
          accent: 'in one pass',
          description:
            'Upload a ZIP and we run Semgrep, Bandit, Gitleaks, pip-audit and Trivy together — then unify the findings into one deduplicated, severity-ranked view.',
          visual: 'pipeline',
        },
        features: [
          { icon: 'scan', title: 'Five scanners, one report', description: 'SAST, secrets, dependency CVEs and IaC misconfigurations in a single run.' },
          { icon: 'gauge', title: 'Results in minutes', description: 'Most scans finish in 2–5 minutes with parallel file processing.' },
          { icon: 'code', title: 'Language coverage', description: 'Python, JavaScript, TypeScript, Go, Java, Ruby, PHP and more.' },
        ],
        stats: [
          { value: '2–5 min', label: 'Average scan time' },
          { value: '5', label: 'Scanners per run' },
          { value: '15+', label: 'Languages supported' },
          { value: '99%', label: 'Fingerprint accuracy' },
        ],
        rows: [
          {
            eyebrow: 'Upload to findings',
            title: 'From a ZIP file to actionable results',
            description:
              'No agents, no pipeline changes, no waiting on a security team. Drop your source and get a ranked list of real issues with the exact line and the fix.',
            points: [
              'Archive-safe extraction — zip-slip, traversal and size limits enforced.',
              'Every finding stamped with the scanner that produced it.',
              'Deduplicated across tools so you never triage the same issue twice.',
              'Filter by tool, severity, CWE or file and triage in bulk.',
            ],
            visual: 'scan',
          },
          {
            eyebrow: 'Dedup & ranking',
            title: 'Shared fingerprints across every tool',
            description:
              'When Semgrep, Bandit and Trivy all flag the same vulnerable dependency or injection path, we merge them into a single finding with combined evidence — ranked by reachability and severity, not by tool count.',
            points: [
              'Cross-tool fingerprinting collapses duplicate findings.',
              'Severity blended from CVSS, CWE and reachability.',
              'Group by file, rule or CWE for faster triage.',
              'Full audit trail on every scan, finding and decision.',
            ],
            visual: 'code',
          },
        ],
        cards: {
          eyebrow: 'Built for real codebases',
          title: 'Everything the pipeline handles for you',
          items: [
            { title: 'Archive-safe uploads', description: 'Zip-slip, path traversal and size limits enforced before a single file is extracted.' },
            { title: 'Tool provenance', description: 'Each finding carries the scanner, rule and raw output that produced it.' },
            { title: 'Rate-limited & fair', description: 'Per-workspace limits keep scans predictable and prevent abuse.' },
            { title: 'Retention you control', description: 'Uploads expire automatically on the schedule you configure.' },
          ],
        },
        testimonials: [
          { quote: 'We replaced three separate scanners with one Vulnix upload. Triage time dropped by half in the first week.', name: 'Dana Okafor', role: 'Staff Engineer, Fintech' },
          { quote: 'The dedup across Semgrep and Trivy alone paid for the plan. No more triaging the same CVE from two tools.', name: 'Luis Mendes', role: 'Security Lead, SaaS' },
          { quote: 'Our junior devs run scans before opening a PR now. That never happened with our old tooling.', name: 'Rhea Kapoor', role: 'Engineering Manager' },
        ],
        faq: [
          { q: 'How long does a scan take?', a: 'Most projects finish in 2–5 minutes. Large monorepos can take longer; we process files in parallel to keep it fast.' },
          { q: 'Do you need access to my repo?', a: 'No. Upload a ZIP of your source. We do not require a connected repository or a persistent agent.' },
          { q: 'Which scanners are included?', a: 'Semgrep (SAST), Bandit (Python), Gitleaks (secrets), pip-audit (Python deps) and Trivy (deps + IaC). All run on every scan.' },
          { q: 'What languages are supported?', a: 'Python, JavaScript, TypeScript, Go, Java, Ruby, PHP, C#, Rust and more, with deeper coverage for the most common web stacks.' },
        ],
        cta: {
          title: 'Run your first scan free',
          description: 'No credit card required. Results in under five minutes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
