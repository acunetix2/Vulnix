import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function Docs() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Documentation',
          accent: 'that gets you shipping',
          description:
            'Guides, API reference, and examples for integrating Vulnix into your workflow — from first scan to full automation.',
        },
        features: [
          { icon: 'radar', title: 'Getting started', description: 'Upload a project and read your first findings in minutes.' },
          { icon: 'zap', title: 'REST API', description: 'Full OpenAPI reference for every endpoint.' },
          { icon: 'lock', title: 'Integrations', description: 'Wire Vulnix into CI, Slack, and Jira.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Popular guides',
            items: [
              { title: 'Run your first scan', description: 'Upload a ZIP and interpret the results.' },
              { title: 'Automate with the API', description: 'Trigger scans and fetch findings from CI.' },
              { title: 'Set up Slack alerts', description: 'Get notified the moment critical findings appear.' },
              { title: 'Configure AI review', description: 'Point Vulnix at your model provider.' },
            ],
          },
        ],
        cta: {
          title: 'Start with the quickstart',
          description: 'Create an account and run a scan in under five minutes.',
          primary: { label: 'Start free', to: '/signup' },
          secondary: { label: 'See pricing', to: '/pricing' },
        },
      }}
    />
  )
}
