import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function AIReview() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'AI security review',
          accent: 'that explains the risk',
          description:
            'Every finding comes with a plain-language explanation, a risk assessment and a concrete fix — from a model you configure, with your code never used for training.',
          visual: 'code',
        },
        features: [
          { icon: 'ai', title: 'Plain-language explanations', description: 'Turn raw scanner output into prose any developer can act on.' },
          { icon: 'lock', title: 'Secret redaction', description: 'Secrets are stripped from context before any prompt is sent.' },
          { icon: 'check', title: 'Validated output', description: 'Malformed or hallucinated responses are rejected, never rendered.' },
        ],
        stats: [
          { value: 'v1', label: 'Versioned prompts', color: '#8b5cf6' },
          { value: '< 5s', label: 'Explanation latency' },
          { value: '0', label: 'Code used for training', color: '#8b5cf6' },
          { value: '100%', label: 'Schema-validated output' },
        ],
        rows: [
          {
            eyebrow: 'How it works',
            title: 'AI that stays in its lane',
            description:
              'The model only ever sees the finding and its evidence. We wrap code in untrusted delimiters, strip secrets, and reject any answer that references evidence the finding does not contain.',
            points: [
              'Untrusted-code delimiters prevent prompt injection from your source.',
              'Secrets redacted from context before the prompt is built.',
              'Responses schema-validated — invalid output returns a typed error.',
              'Every explanation stamped with prompt version for reproducibility.',
            ],
            visual: 'code',
          },
          {
            eyebrow: 'Reviewer coverage',
            title: 'Reviews continue when a reviewer stops',
            description:
              'Vulnix reviews with the reviewers your deployment configures, and hands a file to the next one when a reviewer is throttling, unreachable, or too narrow to hold it. Turn AI off entirely and the deterministic checks still run. You choose the reviewers and the data boundary.',
            points: [
              'A reviewer that just failed is stepped past, not retried on every file.',
              'A file wider than one reviewer is sent to one that can hold it.',
              'Disable AI entirely with no loss of scanning capability.',
              'Per-finding regeneration whenever you want a second look.',
            ],
            visual: 'reports',
          },
        ],
        cards: {
          eyebrow: 'Guardrails',
          title: 'Why you can trust the output',
          items: [
            { title: 'No training on your code', description: 'Your source is never used to train or fine-tune any model.' },
            { title: 'Evidence-bound answers', description: 'The AI can only cite evidence already attached to the finding.' },
            { title: 'Reproducible', description: 'Prompt version stored with every explanation for audit and replay.' },
            { title: 'Cost-capped', description: 'Per-workspace quotas and rate limits keep spend predictable.' },
          ],
        },
        testimonials: [
          { quote: 'The explanations turned a wall of scanner noise into a punch list my team actually finished.', name: 'Tomás Rivera', role: 'Backend Lead' },
          { quote: 'A reviewer dropping out never stalled a release. The audit carried on and told us which one answered.', name: 'Sara Lindqvist', role: 'CISO' },
          { quote: 'The schema validation caught a hallucinated CVE before it ever hit a ticket. That earned our trust.', name: 'Kenji Watanabe', role: 'AppSec Engineer' },
        ],
        faq: [
          { q: 'Is my code used to train models?', a: 'No. Your code is never used for training. AI review runs against your configured provider with your data kept private.' },
          { q: 'Which reviewers does Vulnix use?', a: 'Whichever ones your deployment configures. When one is down, throttled, or cannot hold the file, the audit continues on the next. You can also disable AI entirely.' },
          { q: 'What if the AI output is wrong?', a: 'Responses are schema-validated. Malformed or out-of-scope answers are rejected and surfaced as typed errors, never rendered as fact.' },
          { q: 'Can I turn AI off?', a: 'Yes. Scanning works fully without AI. You can enable or disable AI per workspace at any time.' },
        ],
        cta: {
          title: 'See AI explanations on your code',
          description: 'Start free and turn scanner noise into clear fixes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
