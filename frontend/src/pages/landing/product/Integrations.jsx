import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Integrations() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Product',
          title: 'Integrations that fit',
          accent: 'your stack',
          description:
            'Push findings into Slack and Jira, receive signed webhooks on every scan event, and wire Vulnix into CI with a full REST API.',
          visual: 'integrations',
        },
        features: [
          { icon: 'webhook', title: 'Signed webhooks', description: 'HMAC-signed payloads for every scan, finding and triage event.' },
          { icon: 'users', title: 'Slack & Jira', description: 'Route results to channels and turn findings into issues.' },
          { icon: 'terminal', title: 'REST API', description: 'Full API access to projects, scans, findings and triage.' },
        ],
        stats: [
          { value: 'Slack · Jira', label: 'Native integrations', color: '#0ea5e9' },
          { value: 'HMAC', label: 'Webhook signing' },
          { value: 'Retries', label: 'Delivery with backoff', color: '#0ea5e9' },
          { value: '100%', label: 'API feature parity' },
        ],
        rows: [
          {
            eyebrow: 'Delivery',
            title: 'Every event, where you already work',
            description:
              'Scan summaries land in Slack. Critical findings open Jira issues. Your SIEM receives signed webhooks. Delivery attempts, retries and failures are visible per endpoint so nothing silently disappears.',
            points: [
              'Slack: subscribe channels to scan summaries and critical alerts.',
              'Jira: bi-directional sync so issue status matches finding status.',
              'Webhooks: HMAC-signed payloads with automatic retries.',
              'Delivery logs: every attempt, response and retry visible per endpoint.',
            ],
            visual: 'integrations',
          },
          {
            eyebrow: 'Automation',
            title: 'A REST API with real parity',
            description:
              'Everything you can do in the dashboard you can do over the API — create projects, trigger scans, fetch findings, run triage. Wire it into CI to fail builds on critical findings.',
            points: [
              'Trigger scans from CI and fail the build on critical findings.',
              'Fetch findings, triage in bulk, export reports programmatically.',
              'Same role-based access control as the dashboard.',
              'Webhook secrets rotatable without downtime.',
            ],
            visual: 'pipeline',
          },
        ],
        cards: {
          eyebrow: 'Available now',
          title: 'Native integrations',
          items: [
            { title: 'Slack', description: 'Subscribe channels to scan summaries and critical alerts.' },
            { title: 'Jira', description: 'Bi-directional sync so issue status matches finding status.' },
            { title: 'Webhooks', description: 'Configurable endpoints with HMAC signing, retries and delivery logs.' },
            { title: 'REST API', description: 'Full API access to projects, scans, findings and triage.' },
          ],
        },
        testimonials: [
          { quote: 'We wired Vulnix into CI in an afternoon. Critical findings now block the merge.', name: 'Sam Whitfield', role: 'Platform Engineer' },
          { quote: 'The delivery logs caught a broken webhook our old tool silently dropped.', name: 'Ingrid Olsen', role: 'SRE Lead' },
          { quote: 'Jira sync means security and eng finally see the same status.', name: 'Raj Patel', role: 'Engineering Manager' },
        ],
        faq: [
          { q: 'Which integrations are available?', a: 'Slack, Jira and signed webhooks, plus a full REST API with dashboard parity.' },
          { q: 'Are webhooks signed?', a: 'Yes. Every payload is HMAC-signed and secrets can be rotated without downtime.' },
          { q: 'Do you retry failed deliveries?', a: 'Yes, with automatic backoff. Every attempt and response is visible in the delivery log.' },
          { q: 'Can I fail a CI build on findings?', a: 'Yes. Trigger a scan from CI over the API and gate on critical findings.' },
        ],
        cta: {
          title: 'Connect your stack',
          description: 'Start free and wire up Slack, Jira or CI in minutes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
