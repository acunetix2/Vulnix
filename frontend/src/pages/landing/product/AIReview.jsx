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
            eyebrow: 'Bring your own model',
            title: 'Runs where your code lives',
            description:
              'Start with Ollama on your own machine, point at any OpenAI-compatible endpoint, or turn AI off entirely and rely on scanner output alone. You choose the provider and the data boundary.',
            points: [
              'Ollama (default) — fully local, zero egress.',
              'OpenAI-compatible endpoints for hosted models.',
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
          { quote: 'Running it on Ollama meant security signed off in a day. Nothing left our network.', name: 'Sara Lindqvist', role: 'CISO' },
          { quote: 'The schema validation caught a hallucinated CVE before it ever hit a ticket. That earned our trust.', name: 'Kenji Watanabe', role: 'AppSec Engineer' },
        ],
        faq: [
          { q: 'Is my code used to train models?', a: 'No. Your code is never used for training. AI review runs against your configured provider with your data kept private.' },
          { q: 'Which model providers are supported?', a: 'Ollama (local, default) and any OpenAI-compatible endpoint. You can also disable AI entirely.' },
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
