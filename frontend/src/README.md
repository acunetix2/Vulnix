# Frontend source layout

This project uses a feature-oriented structure. Keep code close to the feature
that owns it, and promote code to shared folders only when it is genuinely
reused.

```text
src/
  app/                 Application composition, providers, and route setup
  assets/              Existing application assets
  components/
    layout/            Shared page shells and navigation
    ui/                Reusable UI primitives; shadcn components go here
  features/
    auth/
    findings/
    projects/
    reports/
    scans/
    uploads/
    workspaces/
  hooks/               Cross-feature React hooks
  lib/                 Framework-independent helpers (for example, cn.js)
  services/
    api/               Shared API client and transport configuration
  styles/              Global styles and design tokens
```

Feature-specific components, hooks, API functions, and data types belong in
their feature folder. Put components in `components/` only when they are
intentionally shared. Keep route composition in `app/`, and keep API transport
details in `services/api/`. Use the `@/` alias for imports from `src/`.

The Vite starter entry files remain at the source root for now; move them into
`app/` when application routing and providers are introduced.
