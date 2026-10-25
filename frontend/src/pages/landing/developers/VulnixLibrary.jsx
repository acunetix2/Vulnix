import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function VulnixLibrary() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Developers',
          title: 'Vulnix',
          accent: 'Library',
          description:
            'Client libraries and code examples for integrating Vulnix into your apps, scripts, and CI pipelines.',
        },
        features: [
          { icon: 'zap', title: 'Official SDKs', description: 'Typed clients for Python, TypeScript, and Go.' },
          { icon: 'radar', title: 'Code examples', description: 'Copy-paste snippets for common workflows.' },
          { icon: 'lock', title: 'Webhook helpers', description: 'Verify signatures and parse events easily.' },
        ],
        sections: [
          {
            type: 'cards',
            title: 'Available libraries',
            items: [
              { title: 'Python', description: 'vulnix-client on PyPI with async support.' },
              { title: 'TypeScript', description: '@vulnix/client for Node and the browser.' },
              { title: 'Go', description: 'Idiomatic Go client with context support.' },
              { title: 'CLI', description: 'Cross-platform binary for scripting and CI.' },
            ],
          },
        ],
        cta: {
          title: 'Install and start building',
          description: 'Grab an SDK and make your first API call.',
          primary: { label: 'Read the docs', to: '/developers/docs' },
          secondary: { label: 'Get an API key', to: '/signup' },
        },
      }}
    />
  )
}
