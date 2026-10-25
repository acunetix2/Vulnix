import { LandingPageTemplate } from '../components/LandingPageTemplate'

export function BrandAssets() {
  return (
    <LandingPageTemplate
      content={{
        hero: {
          eyebrow: 'Resources',
          title: 'Brand',
          accent: 'Assets',
          description:
            'Everything you need to represent Vulnix correctly — logos, wordmark, color palette, and usage guidelines.',
        },
        features: [
          { icon: 'shield', title: 'Logos', description: 'Primary mark, wordmark, and favicon in SVG and PNG.' },
          { icon: 'zap', title: 'Color palette', description: 'Exact hex values for green, purple, and neutrals.' },
          { icon: 'lock', title: 'Usage rules', description: 'Clear do and do not guidelines for correct usage.' },
        ],
        sections: [
          {
            type: 'list',
            title: 'Brand guidelines',
            items: [
              'Keep clear space around the logo equal to the mark height.',
              'Do not stretch, recolor, or add effects to the logo.',
              'Use the primary green for calls to action and highlights.',
              'Use the purple for emphasis and the popular/featured state.',
              'When in doubt, use the full wordmark on a dark background.',
            ],
          },
        ],
        cta: {
          title: 'Building with Vulnix?',
          description: 'Reference the brand in your integrations and case studies.',
          primary: { label: 'Contact us', to: '/company' },
          secondary: { label: 'Read the docs', to: '/developers/docs' },
        },
      }}
    />
  )
}
