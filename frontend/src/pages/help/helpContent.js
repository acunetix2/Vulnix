/**
 * Vulnix Help Center Content Registry
 * Structured articles, categories, and summary tables matching the Legal layout architecture.
 */

export const HELP_CATEGORIES = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    items: [
      { id: 'quickstart', name: 'Quickstart Guide', path: '/help/quickstart' },
      { id: 'workspace-setup', name: 'Workspace & Team Setup', path: '/help/workspace-setup' },
      { id: 'first-audit', name: 'Running Your First Audit', path: '/help/first-audit' },
    ],
  },
  {
    id: 'repositories-scanning',
    name: 'Repositories & Scanning',
    items: [
      { id: 'connecting-repositories', name: 'Connecting Git Repositories', path: '/help/connecting-repositories' },
      { id: 'scanner-engines', name: 'Multi-Scanner Engine Configuration', path: '/help/scanner-engines' },
      { id: 'scan-lifecycle', name: 'Audit States & Queueing Lifecycle', path: '/help/scan-lifecycle' },
      { id: 'archive-scans', name: 'ZIP Archive & Air-Gapped Uploads', path: '/help/archive-scans' },
    ],
  },
  {
    id: 'vulnerabilities-ai',
    name: 'Vulnerabilities & AI Review',
    items: [
      { id: 'findings-triage', name: 'Severity Scoring & Finding Triage', path: '/help/findings-triage' },
      { id: 'ai-review', name: 'AI Security Agent & Explanations', path: '/help/ai-review' },
      { id: 'false-positives', name: 'False Positives & Risk Acceptance', path: '/help/false-positives' },
      { id: 'evidence-inspection', name: 'Evidence Inspection & Line Range', path: '/help/evidence-inspection' },
    ],
  },
  {
    id: 'integrations-cicd',
    name: 'Integrations & CI/CD',
    items: [
      { id: 'github-actions', name: 'GitHub Actions & CI Gateways', path: '/help/github-actions' },
      { id: 'slack-jira', name: 'Slack Alerts & Jira Sync', path: '/help/slack-jira' },
      { id: 'webhooks-api', name: 'Webhooks & REST API Usage', path: '/help/webhooks-api' },
    ],
  },
  {
    id: 'compliance-reports',
    name: 'Compliance & Reports',
    items: [
      { id: 'reports-export', name: 'Exporting Audit Reports (PDF/JSON)', path: '/help/reports-export' },
      { id: 'compliance-frameworks', name: 'SOC 2, OWASP & ISO Frameworks', path: '/help/compliance-frameworks' },
    ],
  },
  {
    id: 'account-troubleshooting',
    name: 'Account & Troubleshooting',
    items: [
      { id: 'team-roles', name: 'User Roles & Access Permissions', path: '/help/team-roles' },
      { id: 'troubleshooting', name: 'Common Issues & Debugging', path: '/help/troubleshooting' },
    ],
  },
]

export const HELP_DOCUMENTS = {
  quickstart: {
    id: 'quickstart',
    title: 'Vulnix Quickstart Guide',
    category: 'Getting Started',
    effectiveDate: 'October 25, 2026',
    version: '2.1',
    readTime: '4 min read',
    description:
      'Learn how to register your workspace, connect your first repository, execute a multi-engine security audit, and inspect prioritized findings in under five minutes.',
    summary: [
      {
        section: '1. Workspace Initialization',
        anchor: '#workspace-init',
        summary: 'Create or join a Vulnix team workspace and configure default security posture preferences.',
      },
      {
        section: '2. Connecting Your First Project',
        anchor: '#connect-project',
        summary: 'Link a GitHub or GitLab repository or upload an ephemeral code archive without granting write permissions.',
        highlight: 'Zero code retention guarantee.',
      },
      {
        section: '3. Executing an Audit',
        anchor: '#executing-audit',
        summary: 'Trigger Semgrep, Gitleaks, Bandit, and Trivy simultaneously against your active branch.',
      },
      {
        section: '4. Triaging Findings',
        anchor: '#triaging-findings',
        summary: 'Review AI explanations, contextual diff fixes, and export an initial security health report.',
      },
    ],
    sections: [
      {
        id: 'workspace-init',
        number: 1,
        title: 'Workspace Initialization',
        content: [
          'Vulnix organizes security reviews, audit histories, scanner configs, and team access around Workspaces. When you sign up, an initial personal workspace is automatically prepared for you.',
          '• If your team already has an active Vulnix organization, accept the email invitation to join the shared workspace directly.',
          '• To configure organizational settings, navigate to Settings in the sidebar to define team name, member roles, and notification webhooks.',
        ],
        callout: {
          type: 'important',
          title: 'Organization Isolation',
          text: 'Every workspace maintains strict cryptographic isolation. Scanner jobs, finding tokens, and audit artifacts are never cross-accessible between different workspaces.',
        },
      },
      {
        id: 'connect-project',
        number: 2,
        title: 'Connecting Your First Project',
        content: [
          'Vulnix supports multiple ways to submit code for analysis while ensuring developer convenience and strict security:',
          '• GitHub App Integration: Choose an account and the repositories Vulnix may access in GitHub. Those repositories are available for audits automatically after you return.',
          '• GitLab / Bitbucket: Configure access tokens with read-only repository permissions.',
          '• ZIP Source Archive: Upload an encrypted archive (up to 50MB) directly from your workstation for quick ad-hoc code audits.',
        ],
      },
      {
        id: 'executing-audit',
        number: 3,
        title: 'Executing a Multi-Scanner Audit',
        content: [
          'Once a project is connected, click Start Audit on the project overview or the New Scan action bar. Choose your target branch (e.g., main or feature/auth) and select scanner engines.',
          '• Static Analysis (SAST): Evaluates AST semantics for injection, memory unsafety, and improper validation via Semgrep and language engines.',
          '• Secrets Detection: Scans git history and source files with Gitleaks for leaked API tokens, private keys, and cloud credentials.',
          '• Dependency Vulnerability Checks: Inspects package manifests (package-lock.json, requirements.txt, go.mod) against the global CVE/NVD database.',
        ],
      },
      {
        id: 'triaging-findings',
        number: 4,
        title: 'Triaging Findings & Applying Fixes',
        content: [
          'When the audit completes, open the Audit Run Detail page to see aggregated findings grouped by severity (Critical, High, Medium, Low).',
          '• Click any finding to inspect the exact file path, offending line range, rule identifier, and AI-generated remediation guidance.',
          '• Use the AI Fix button to inspect side-by-side git diff proposals that fix the issue without breaking surrounding business logic.',
          '• Export results to PDF or JSON for compliance reviews or share directly with developers via Slack or Jira.',
        ],
      },
    ],
  },

  'workspace-setup': {
    id: 'workspace-setup',
    title: 'Workspace & Team Setup',
    category: 'Getting Started',
    effectiveDate: 'October 25, 2026',
    version: '2.0',
    readTime: '3 min read',
    description:
      'Manage team members, configure role-based access control (RBAC), customize workspace branding, and set global security policies across projects.',
    summary: [
      {
        section: '1. Inviting Team Members',
        anchor: '#inviting-members',
        summary: 'Generate secure invitation links or email invites with defined role permissions.',
      },
      {
        section: '2. Role-Based Access Control',
        anchor: '#rbac',
        summary: 'Understand capabilities of Owner, Admin, Developer, and Viewer workspace roles.',
        highlight: 'Strict principle of least privilege.',
      },
      {
        section: '3. Workspace Security Defaults',
        anchor: '#security-defaults',
        summary: 'Enforce two-factor authentication and designate allowed scanner engines for all members.',
      },
    ],
    sections: [
      {
        id: 'inviting-members',
        number: 1,
        title: 'Inviting Team Members',
        content: [
          'Workspace Owners and Admins can invite team members by navigating to Settings → Members.',
          '• Enter the teammate’s work email address and select an initial role.',
          '• Invites expire after 7 days if unaccepted. You can resend or revoke pending invitations anytime.',
          '• For enterprise SSO/SAML integrations, members are provisioned automatically upon their first IdP login.',
        ],
      },
      {
        id: 'rbac',
        number: 2,
        title: 'Role-Based Access Control (RBAC)',
        content: [
          'Vulnix enforces four standard role tiers across workspace operations:',
          '• Owner: Full administrative rights, billing management, workspace deletion, and member role assignment.',
          '• Admin: Can add/delete projects, configure integrations and webhooks, and launch/cancel audits.',
          '• Developer: Can view all projects, launch audits, triage findings, and view AI fix proposals.',
          '• Viewer: Read-only access to audit summaries and compliance reports; cannot initiate scans or modify project configs.',
        ],
        callout: {
          type: 'info',
          title: 'Audit Logging',
          text: 'Every member role change, invitation dispatch, and permission update is irrevocably recorded in the Workspace Audit Trail accessible under Settings → Security Logs.',
        },
      },
      {
        id: 'security-defaults',
        number: 3,
        title: 'Workspace Security Defaults',
        content: [
          'Admins can enforce mandatory security baselines:',
          '• Mandatory Two-Factor Authentication (2FA) for all non-SSO accounts.',
          '• Ephemeral Audit Data Retention: Automatically purge raw scanned code archives 24 hours after audit completion.',
          '• Global Scanner Whitelist: Limit projects to pre-approved scanners to guarantee consistent CI/CD execution.',
        ],
      },
    ],
  },

  'first-audit': {
    id: 'first-audit',
    title: 'Running Your First Audit',
    category: 'Getting Started',
    effectiveDate: 'October 25, 2026',
    version: '1.9',
    readTime: '5 min read',
    description:
      'A deep dive into launching, monitoring, and interpreting security audits in Vulnix across multiple scanning engines and AI evaluation stages.',
    summary: [
      {
        section: '1. Scan Scope & Configuration',
        anchor: '#scope-config',
        summary: 'Targeting specific branches, pull requests, directories, or exclusion patterns.',
      },
      {
        section: '2. Live Execution Monitor',
        anchor: '#live-monitor',
        summary: 'Following worker allocation, scanner progress bars, and streaming thought logs.',
      },
      {
        section: '3. Interpreting Results',
        anchor: '#interpreting-results',
        summary: 'Navigating finding severity cards, scanner consensus, and code line citations.',
      },
    ],
    sections: [
      {
        id: 'scope-config',
        number: 1,
        title: 'Scan Scope & Configuration',
        content: [
          'Before starting an audit, customize the scanning profile according to your objective:',
          '• Full Repository Audit: Inspects the entire codebase across all supported languages and dependency trees.',
          '• Incremental PR Scan: Only inspects files modified in the active branch or pull request compared to the default base branch.',
          '• Exclusion Rules: Ignore generated build output (dist/, build/, node_modules/) and test fixtures by adding a .vulnixignore file to your repository root.',
        ],
      },
      {
        id: 'live-monitor',
        number: 2,
        title: 'Live Execution Monitor',
        content: [
          'When an audit begins, Vulnix provisions an isolated worker container. You can monitor progress in real-time:',
          '• Scanner Progress: Independent status tracks for Semgrep, Gitleaks, Bandit, and Trivy.',
          '• AI Thought Stream: Displays AST parsing actions, cross-reference analysis against CVE databases, and contextual relevance scoring.',
          '• Time Elapsed & ETA: Average audits complete in 90 to 180 seconds for medium-sized repositories.',
        ],
      },
      {
        id: 'interpreting-results',
        number: 3,
        title: 'Interpreting Results & Verification',
        content: [
          'Completed audits provide an executive scorecard:',
          '• Critical / High Findings: Highlight exploitable vulnerabilities requiring immediate triage prior to production deployment.',
          '• Clean Scanners: Scanners that found zero violations receive green badges with verified rule coverage statistics.',
          '• AI Explanation: Breaks down the vulnerability mechanism into plain English, explaining how an attacker could leverage the bug and why the proposed fix eliminates the vector.',
        ],
      },
    ],
  },

  'connecting-repositories': {
    id: 'connecting-repositories',
    title: 'Connecting Git Repositories',
    category: 'Repositories & Scanning',
    effectiveDate: 'October 25, 2026',
    version: '2.2',
    readTime: '4 min read',
    description:
      'Comprehensive guide for connecting GitHub, GitLab, Bitbucket, and custom Git providers to Vulnix with zero write access.',
    summary: [
      {
        section: '1. GitHub App Setup',
        anchor: '#github-setup',
        summary: 'Install the Vulnix GitHub application and configure fine-grained repository permissions.',
      },
      {
        section: '2. GitLab & Personal Access Tokens',
        anchor: '#gitlab-setup',
        summary: 'Authorize GitLab self-hosted or SaaS repositories using scoped read_repository tokens.',
      },
      {
        section: '3. Security & Permission Boundaries',
        anchor: '#permissions-boundary',
        summary: 'Explanation of read-only access guarantees and zero code retention architecture.',
      },
    ],
    sections: [
      {
        id: 'github-setup',
        number: 1,
        title: 'GitHub App Installation',
        content: [
          'The GitHub App integration is the recommended connection method for GitHub users:',
          '• Navigate to Integrations → GitHub in your Vulnix console and click Connect GitHub.',
          '• Select the GitHub organization or personal account where your repositories reside.',
          '• Choose all repositories or only the repositories you want Vulnix to access.',
          '• After GitHub returns you to Vulnix, the granted repositories are available for audits. You do not need to approve them again inside Vulnix.',
        ],
      },
      {
        id: 'gitlab-setup',
        number: 2,
        title: 'GitLab & Personal Access Tokens',
        content: [
          'For GitLab.com or self-managed GitLab Enterprise instances:',
          '• In GitLab, create a Personal Access Token or Project Deploy Token with the read_repository scope.',
          '• In Vulnix, select Integrations → GitLab and paste the token and instance URL.',
          '• Vulnix validates the token over TLS and lists accessible repositories without requesting admin or write privileges.',
        ],
      },
      {
        id: 'permissions-boundary',
        number: 3,
        title: 'Security & Permission Boundaries',
        content: [
          'Vulnix operates under strict least-privilege standards:',
          '• Zero Write Access: Vulnix will never ask for repo write permissions or push branches directly.',
          '• Ephemeral Clone: Repositories are cloned into RAM-backed ephemeral filesystems that are completely wiped after audit completion.',
          '• Webhook Security: Pull request webhooks are cryptographically validated using HMAC-SHA256 signatures.',
        ],
      },
    ],
  },

  'scanner-engines': {
    id: 'scanner-engines',
    title: 'Multi-Scanner Engine Configuration',
    category: 'Repositories & Scanning',
    effectiveDate: 'October 25, 2026',
    version: '2.0',
    readTime: '6 min read',
    description:
      'Details on Semgrep, Bandit, Gitleaks, Trivy, and ESLint Security integration, rule overrides, and custom security policies.',
    summary: [
      {
        section: '1. Scanner Architecture',
        anchor: '#scanner-arch',
        summary: 'How Vulnix orchestrates heterogeneous scanning engines in parallel without conflict.',
      },
      {
        section: '2. Supported Engines & Capabilities',
        anchor: '#supported-engines',
        summary: 'Deep dive into Semgrep, Gitleaks, Bandit, Trivy, and ESLint Security.',
      },
      {
        section: '3. Custom Rule Packs',
        anchor: '#custom-rules',
        summary: 'Upload proprietary Semgrep YAML rules and custom regex patterns.',
      },
    ],
    sections: [
      {
        id: 'scanner-arch',
        number: 1,
        title: 'Scanner Orchestration Architecture',
        content: [
          'Single-scanner tools suffer from blind spots. Vulnix executes specialized best-in-class engines concurrently:',
          '• SAST Engines parse syntax trees for deep code logic flaws and injection vulnerabilities.',
          '• Secret Scanners inspect file diffs, commits, and strings using entropy algorithms and known key patterns.',
          '• SCA (Software Composition Analysis) inspects manifests against public vulnerability advisories.',
          '• Normalization Engine consolidates duplicate alerts across scanners into single deduplicated findings.',
        ],
      },
      {
        id: 'supported-engines',
        number: 2,
        title: 'Supported Engines & Capabilities',
        content: [
          '• Semgrep: Fast, language-aware AST pattern matching for Python, JS/TS, Go, Java, Ruby, and PHP.',
          '• Gitleaks: Uncovers hardcoded credentials, AWS access keys, GitHub tokens, and private RSA keys across full git history.',
          '• Bandit: Python-specific security linter analyzing AST nodes for dangerous imports, eval(), and weak cryptographic ciphers.',
          '• Trivy: High-speed CVE vulnerability scanner for open-source dependencies and container base layers.',
          '• ESLint Security: Node.js and frontend security plugin detecting prototype pollution, eval expressions, and unsafe regex.',
        ],
      },
      {
        id: 'custom-rules',
        number: 3,
        title: 'Custom Rules & Policies',
        content: [
          'You can upload your own security rules to tailor scans to your company coding guidelines:',
          '• Add a .vulnix/rules.yaml file in your repository to inject custom Semgrep rules into every audit.',
          '• Specify custom regex patterns in Gitleaks configuration to catch internal proprietary token formats.',
          '• Configure severity overrides to elevate internal library deprecations to High or Critical.',
        ],
      },
    ],
  },

  'scan-lifecycle': {
    id: 'scan-lifecycle',
    title: 'Audit States & Queueing Lifecycle',
    category: 'Repositories & Scanning',
    effectiveDate: 'October 25, 2026',
    version: '1.8',
    readTime: '3 min read',
    description:
      'Understanding audit statuses (Queued, Running, Completed, Failed, Cancelled) and worker allocation mechanisms.',
    summary: [
      {
        section: '1. Status Definitions',
        anchor: '#status-definitions',
        summary: 'Breakdown of what each audit status means and expected worker behaviors.',
      },
      {
        section: '2. Timeout & Resource Limits',
        anchor: '#limits',
        summary: 'Repository size ceilings, concurrency slots, and maximum execution timeouts.',
      },
      {
        section: '3. Troubleshooting Stalled Audits',
        anchor: '#stalled-audits',
        summary: 'Diagnosing network interruptions, unreachable branches, and worker recovery.',
      },
    ],
    sections: [
      {
        id: 'status-definitions',
        number: 1,
        title: 'Audit Status Definitions',
        content: [
          'Every audit progresses through defined lifecycle states:',
          '• Queued: The audit request has been registered and is awaiting an available container worker slot.',
          '• Running: Worker has checked out the code and is actively executing scanner engines.',
          '• Analyzing: Scanners have finished; the Vulnix AI engine is synthesizing findings, CVSS scores, and fixes.',
          '• Completed: All scanners finished successfully and full reports are ready for review.',
          '• Completed with Errors: Certain optional scanners encountered syntax issues in specific files, but core results are available.',
          '• Failed: Critical execution failure (e.g. invalid branch name, authentication failure, or empty repository).',
        ],
      },
      {
        id: 'limits',
        number: 2,
        title: 'Resource Limits & Guardrails',
        content: [
          'To ensure fair multi-tenant reliability:',
          '• Default Audit Timeout: 15 minutes for cloud audits; configurable on self-hosted instances.',
          '• Maximum Codebase Size: 250MB uncompressed source code per audit run.',
          '• Concurrent Scans: 2 concurrent scans on Starter, 10 on Pro, and unlimited dedicated nodes on Enterprise.',
        ],
      },
      {
        id: 'stalled-audits',
        number: 3,
        title: 'Troubleshooting Stalled Audits',
        content: [
          'If an audit remains in Queued for more than 3 minutes, check System Status at /resources/status.',
          '• You can manually cancel a stalled audit by clicking the Cancel Audit button on the audit detail screen.',
          '• When an audit fails, a detailed diagnostic banner explains the root cause (e.g., git submodule timeout or unparseable lockfile).',
        ],
      },
    ],
  },

  'archive-scans': {
    id: 'archive-scans',
    title: 'ZIP Archive & Air-Gapped Uploads',
    category: 'Repositories & Scanning',
    effectiveDate: 'October 25, 2026',
    version: '1.7',
    readTime: '3 min read',
    description:
      'How to audit local source folders and proprietary archives without connecting any third-party Git provider.',
    summary: [
      {
        section: '1. Preparing Code Archives',
        anchor: '#preparing-archives',
        summary: 'Best practices for excluding build artifacts before packaging a ZIP archive.',
      },
      {
        section: '2. Upload & Ephemeral Storage',
        anchor: '#upload-storage',
        summary: 'End-to-end encrypted transfer and automatic cryptographic deletion after analysis.',
      },
      {
        section: '3. Air-Gapped Scanning Support',
        anchor: '#air-gapped',
        summary: 'Running Vulnix locally on on-premise infrastructure without external Internet access.',
      },
    ],
    sections: [
      {
        id: 'preparing-archives',
        number: 1,
        title: 'Preparing Your Code Archive',
        content: [
          'You can upload a .zip archive directly from your device:',
          '• Remove unnecessary build folders before compressing (e.g., node_modules, target, .git, venv).',
          '• Ensure the ZIP archive contains valid project manifests (package.json, requirements.txt, pom.xml) in the root or standard subdirectories.',
          '• Maximum single archive size is 50MB (compressed).',
        ],
      },
      {
        id: 'upload-storage',
        number: 2,
        title: 'Ephemeral Storage & Privacy',
        content: [
          'Uploaded archives are transferred over TLS 1.3 and stored in encrypted memory buffers.',
          '• Once all scanner engines finish parsing, the archive file is permanently unlinked and erased.',
          '• Only synthesized finding metadata and code excerpts relevant to security flaws are retained for your review.',
        ],
      },
      {
        id: 'air-gapped',
        number: 3,
        title: 'Air-Gapped Scanning Support',
        content: [
          'For defense, finance, and healthcare organizations requiring total air-gapped isolation:',
          '• Deploy the Vulnix On-Premise Docker/Kubernetes container package within your secure VPC.',
          '• All scanning engines and localized LLM inference engines run entirely inside your private network without external network telemetry.',
        ],
      },
    ],
  },

  'findings-triage': {
    id: 'findings-triage',
    title: 'Severity Scoring & Finding Triage',
    category: 'Vulnerabilities & AI Review',
    effectiveDate: 'October 25, 2026',
    version: '2.3',
    readTime: '5 min read',
    description:
      'How Vulnix rates vulnerability severity (Critical, High, Medium, Low), calculates CVSS 3.1 vectors, and prioritizes remediation.',
    summary: [
      {
        section: '1. Severity Matrix',
        anchor: '#severity-matrix',
        summary: 'Understanding the 4-tier severity model and when findings qualify as Critical.',
      },
      {
        section: '2. CVSS 3.1 & Exploitability',
        anchor: '#cvss-scores',
        summary: 'How attack vector, privileges required, and impact determine priority.',
      },
      {
        section: '3. Triage Workflow',
        anchor: '#triage-workflow',
        summary: 'Marking findings as Open, In Review, Resolved, False Positive, or Accepted Risk.',
      },
    ],
    sections: [
      {
        id: 'severity-matrix',
        number: 1,
        title: 'The Vulnix Severity Matrix',
        content: [
          'Every vulnerability is classified according to potential exploit impact and ease of execution:',
          '• Critical: Remote code execution (RCE), unauthenticated SQL injection, plaintext cloud master keys, or authentication bypass.',
          '• High: Stored XSS, broken access controls (IDOR), sensitive data leakage in public endpoints, or severe dependency CVEs.',
          '• Medium: Reflected XSS, CSRF without state change, weak password policies, or missing TLS configurations.',
          '• Low: Informational findings, missing HTTP security headers (CSP, HSTS), or verbose stack traces in non-production environments.',
        ],
      },
      {
        id: 'cvss-scores',
        number: 2,
        title: 'CVSS 3.1 Vector Mapping',
        content: [
          'Vulnix displays CVSS v3.1 base score vectors for all recognized vulnerability patterns.',
          '• Attack Vector (Network, Adjacent, Local, Physical)',
          '• Privileges Required (None, Low, High)',
          '• User Interaction (None, Required)',
          '• Scope & Impact (Confidentiality, Integrity, Availability)',
        ],
      },
      {
        id: 'triage-workflow',
        number: 3,
        title: 'Triage Workflow & Status Transitions',
        content: [
          'Manage vulnerability lifecycle through collaborative statuses:',
          '• Open: Default state for newly discovered issues.',
          '• In Review: Assigned to an engineer investigating a patch.',
          '• Resolved: Verified as patched in a subsequent audit.',
          '• False Positive: Marked as non-applicable with documented rationale.',
          '• Accepted Risk: Approved by a security lead with an expiration review date.',
        ],
      },
    ],
  },

  'ai-review': {
    id: 'ai-review',
    title: 'AI Security Agent & Explanations',
    category: 'Vulnerabilities & AI Review',
    effectiveDate: 'October 25, 2026',
    version: '2.4',
    readTime: '5 min read',
    description:
      'How the Vulnix AI security agent analyzes code paths, synthesizes explanations, generates verified diff fixes, and protects proprietary IP.',
    summary: [
      {
        section: '1. AI Analysis Mechanism',
        anchor: '#ai-mechanism',
        summary: 'How LLMs inspect AST evidence without hallucinations or blind assumptions.',
      },
      {
        section: '2. Context-Aware Code Fixes',
        anchor: '#code-fixes',
        summary: 'Generating ready-to-merge git diffs tailored to your framework and coding style.',
        highlight: '100% Zero-training code guarantee.',
      },
      {
        section: '3. Privacy & Intellectual Property',
        anchor: '#ai-privacy',
        summary: 'Customer code is never used to train foundational AI models.',
      },
    ],
    sections: [
      {
        id: 'ai-mechanism',
        number: 1,
        title: 'How the AI Security Agent Works',
        content: [
          'Generic AI assistants often hallucinate fake security risks. The Vulnix AI agent uses constrained static verification:',
          '• Scanner Output Grounding: The AI only inspects code excerpts that correspond to verified scanner rule matches.',
          '• Code Flow Tracing: Evaluates input sanitization routines between the source parameter and the target database or shell sink.',
          '• Plain-English Explanations: Translates obscure rule IDs into actionable descriptions of risk and blast radius.',
        ],
      },
      {
        id: 'code-fixes',
        number: 2,
        title: 'Context-Aware Code Fixes',
        content: [
          'On any finding detail page, click the AI Fix button to inspect a proposed remediation:',
          '• Side-by-side diff view showing exact lines to replace.',
          '• Language-native best practices (e.g., using parameterized queries with SQLAlchemy or prepared statements in Go).',
          '• Explanatory breakdown detailing why the change closes the vulnerability without breaking unit tests.',
        ],
      },
      {
        id: 'ai-privacy',
        number: 3,
        title: 'Strict AI Privacy Guarantee',
        content: [
          'Your intellectual property remains exclusively yours:',
          '• Zero Training: Customer source code is NEVER used to train, tune, or evaluate proprietary or third-party AI models.',
          '• Ephemeral Inference: LLM prompt contexts are processed in isolated memory and discarded immediately upon response completion.',
          '• Zero Data Retention Agreements: Vulnix maintains signed enterprise zero-retention agreements with LLM infrastructure partners.',
        ],
        callout: {
          type: 'important',
          title: 'Developer Trust Contract',
          text: 'Our zero-training policy is legally binding under Section 3 of the Vulnix Terms for AI & Additional Features.',
        },
      },
    ],
  },

  'false-positives': {
    id: 'false-positives',
    title: 'False Positives & Risk Acceptance',
    category: 'Vulnerabilities & AI Review',
    effectiveDate: 'October 25, 2026',
    version: '1.9',
    readTime: '4 min read',
    description:
      'Best practices for marking false positives, suppressing benign alerts, and managing documented risk acceptance exceptions.',
    summary: [
      {
        section: '1. When to Mark a False Positive',
        anchor: '#when-fp',
        summary: 'Criteria for distinguishing true security flaws from test fixtures or unreachable code.',
      },
      {
        section: '2. Required Documentation',
        anchor: '#documentation',
        summary: 'Ensuring audit compliance by providing engineering justification for suppression.',
      },
      {
        section: '3. Managing Accepted Risks',
        anchor: '#accepted-risk',
        summary: 'Setting expiration review periods and alerting teams when exceptions expire.',
      },
    ],
    sections: [
      {
        id: 'when-fp',
        number: 1,
        title: 'Identifying False Positives',
        content: [
          'Static analyzers occasionally alert on code patterns that are safely guarded by external context:',
          '• Mock or Test Data: API keys in test fixtures or mock HTTP servers.',
          '• Upstream Sanitization: Input that has already undergone strict validation prior to reaching the flagged helper function.',
          '• Internal Admin CLI: Code intended solely for local developer tools not exposed to the public Internet.',
        ],
      },
      {
        id: 'documentation',
        number: 2,
        title: 'Documenting the Triage Decision',
        content: [
          'When marking a finding as False Positive in Vulnix:',
          '• Select the False Positive action in the finding triage panel.',
          '• Provide a mandatory brief note explaining why the rule match is benign.',
          '• The finding will be suppressed in future audits for that specific file and rule signature.',
        ],
      },
      {
        id: 'accepted-risk',
        number: 3,
        title: 'Managing Accepted Risks',
        content: [
          'Some findings may be valid but low business risk compared to the cost of refactoring:',
          '• Choose Accepted Risk and set an expiration window (e.g. 30, 90, or 180 days).',
          '• When the expiration date arrives, Vulnix reopens the finding for re-evaluation automatically.',
        ],
      },
    ],
  },

  'evidence-inspection': {
    id: 'evidence-inspection',
    title: 'Evidence Inspection & Line Range',
    category: 'Vulnerabilities & AI Review',
    effectiveDate: 'October 25, 2026',
    version: '1.7',
    readTime: '3 min read',
    description:
      'How to inspect code snippets, syntax highlights, and line ranges linked directly to scanner rule definitions.',
    summary: [
      {
        section: '1. The Code Evidence Viewer',
        anchor: '#evidence-viewer',
        summary: 'Inspect syntax-highlighted code directly in the Vulnix web console.',
      },
      {
        section: '2. IDE & GitHub Deep Linking',
        anchor: '#deep-linking',
        summary: 'Jump directly to the affected line in GitHub or open in VS Code.',
      },
    ],
    sections: [
      {
        id: 'evidence-viewer',
        number: 1,
        title: 'The Code Evidence Viewer',
        content: [
          'Vulnix renders an isolated snippet of the affected code file:',
          '• Precise Line Highlights: The vulnerable statement is highlighted in rose/amber with numbered line context.',
          '• Surrounding Context: Several lines before and after are provided to help understand enclosing functions.',
          '• Scanner Rule Reference: Direct link to the official Semgrep, Bandit, or Gitleaks rule specification.',
        ],
      },
      {
        id: 'deep-linking',
        number: 2,
        title: 'GitHub & VS Code Deep Linking',
        content: [
          'Speed up investigation with external editor links:',
          '• Click "View on GitHub" to open the exact commit and line on GitHub.com.',
          '• Use the "vscode://" deep link button to jump immediately to the file and line number in your local Visual Studio Code editor.',
        ],
      },
    ],
  },

  'github-actions': {
    id: 'github-actions',
    title: 'GitHub Actions & CI Gateways',
    category: 'Integrations & CI/CD',
    effectiveDate: 'October 25, 2026',
    version: '2.1',
    readTime: '4 min read',
    description:
      'Integrate automated security reviews into GitHub Actions workflows to block pull requests containing Critical vulnerabilities.',
    summary: [
      {
        section: '1. GitHub Action Workflow Setup',
        anchor: '#workflow-setup',
        summary: 'Adding the vulnix-action workflow step to .github/workflows/security.yml.',
      },
      {
        section: '2. Pull Request Status Checks',
        anchor: '#pr-checks',
        summary: 'Displaying scan scorecards and inline annotations on pull request changes.',
      },
      {
        section: '3. Enforcement & Merge Gateways',
        anchor: '#merge-gateways',
        summary: 'Configuring GitHub branch protection rules to prevent merging high-risk code.',
      },
    ],
    sections: [
      {
        id: 'workflow-setup',
        number: 1,
        title: 'Adding Vulnix to GitHub Actions',
        content: [
          'Add a simple workflow step to your repository (.github/workflows/vulnix.yml):',
          '• Store your Vulnix API token in your GitHub repository secrets as VULNIX_API_TOKEN.',
          '• The action runs on every push and pull request, submitting changes to the Vulnix API and awaiting scan results.',
        ],
      },
      {
        id: 'pr-checks',
        number: 2,
        title: 'Pull Request Annotations & Comments',
        content: [
          'When an audit completes on a PR branch:',
          '• Vulnix posts an executive summary comment detailing new vulnerabilities introduced in the PR.',
          '• Annotations are added directly to the GitHub "Files Changed" tab at the exact lines of concern.',
        ],
      },
      {
        id: 'merge-gateways',
        number: 3,
        title: 'Enforcement & Branch Protection',
        content: [
          'To ensure vulnerabilities never reach production:',
          '• In GitHub repository settings, open Branches → Branch Protection Rules.',
          '• Require status check "vulnix/security-audit" to pass before merging.',
          '• Configure failure thresholds in Vulnix: block merges only on Critical or High issues while allowing Low/Medium warnings.',
        ],
      },
    ],
  },

  'slack-jira': {
    id: 'slack-jira',
    title: 'Slack Alerts & Jira Sync',
    category: 'Integrations & CI/CD',
    effectiveDate: 'October 25, 2026',
    version: '1.9',
    readTime: '3 min read',
    description:
      'Route real-time security alerts to designated Slack channels and automatically create engineering tickets in Jira.',
    summary: [
      {
        section: '1. Slack Notification Setup',
        anchor: '#slack-setup',
        summary: 'Connect your Slack workspace and filter alerts by project and severity.',
      },
      {
        section: '2. Jira Issue Synchronization',
        anchor: '#jira-sync',
        summary: 'Convert findings into Jira backlog issues with one click, including fix recommendations.',
      },
    ],
    sections: [
      {
        id: 'slack-setup',
        number: 1,
        title: 'Slack Notification Setup',
        content: [
          'Keep your security team informed without checking the dashboard constantly:',
          '• Navigate to Integrations → Slack and click Connect Slack.',
          '• Select the destination channel (e.g. #security-alerts or #dev-security).',
          '• Filter alerts: only notify for Critical/High findings, or receive daily digest summaries.',
        ],
      },
      {
        id: 'jira-sync',
        number: 2,
        title: 'Jira Issue Synchronization',
        content: [
          'Turn security findings into actionable sprint tasks:',
          '• Connect Jira via OAuth or API token under Integrations → Jira.',
          '• Select default project key and issue type (Bug or Task).',
          '• On any finding, click "Create Jira Issue" to export full evidence, rule references, and remediation code directly into the Jira ticket.',
        ],
      },
    ],
  },

  'webhooks-api': {
    id: 'webhooks-api',
    title: 'Webhooks & REST API Usage',
    category: 'Integrations & CI/CD',
    effectiveDate: 'October 25, 2026',
    version: '2.0',
    readTime: '4 min read',
    description:
      'Use the Vulnix REST API to launch audits programmatically and subscribe to webhook notifications with HMAC-SHA256 signatures.',
    summary: [
      {
        section: '1. API Token Management',
        anchor: '#api-tokens',
        summary: 'Generating personal and workspace service tokens under Settings → API Tokens.',
      },
      {
        section: '2. REST Endpoints Overview',
        anchor: '#rest-endpoints',
        summary: 'Key endpoints for listing projects, triggering audits, and querying findings.',
      },
      {
        section: '3. Webhook Payloads & Verification',
        anchor: '#webhooks',
        summary: 'Verifying X-Vulnix-Signature headers and parsing audit event payloads.',
      },
    ],
    sections: [
      {
        id: 'api-tokens',
        number: 1,
        title: 'API Token Management',
        content: [
          'Authenticate automated tools using bearer tokens:',
          '• Generate tokens under Settings → API Tokens.',
          '• Pass the token in HTTP request headers: Authorization: Bearer <YOUR_API_TOKEN>.',
          '• Rotate tokens periodically and revoke compromised credentials immediately.',
        ],
      },
      {
        id: 'rest-endpoints',
        number: 2,
        title: 'Core REST API Endpoints',
        content: [
          '• POST /api/v1/scans/start - Trigger a new audit for a project branch.',
          '• GET /api/v1/scans/{id} - Query audit progress, duration, and completion status.',
          '• GET /api/v1/findings - Filter findings by severity, project, status, and category.',
          '• Detailed API schema and interactive playground available at /docs.',
        ],
      },
      {
        id: 'webhooks',
        number: 3,
        title: 'Webhook Subscriptions & Signature Verification',
        content: [
          'Subscribe your backend services to real-time events (scan.completed, finding.detected):',
          '• Configure webhook destination URL and secret under Integrations → Webhooks.',
          '• Compute HMAC-SHA256 of the payload body using your webhook secret.',
          '• Verify that the computed hash matches the incoming X-Vulnix-Signature header before processing.',
        ],
      },
    ],
  },

  'reports-export': {
    id: 'reports-export',
    title: 'Exporting Audit Reports (PDF/JSON)',
    category: 'Compliance & Reports',
    effectiveDate: 'October 25, 2026',
    version: '2.1',
    readTime: '3 min read',
    description:
      'Generate branded PDF security executive summaries, machine-readable JSON exports, and Markdown audit packages.',
    summary: [
      {
        section: '1. Export Formats',
        anchor: '#export-formats',
        summary: 'Choosing between Executive PDF, Raw JSON, and Developer Markdown reports.',
      },
      {
        section: '2. Customizing Report Scope',
        anchor: '#report-scope',
        summary: 'Filtering reports by date range, specific projects, and severity thresholds.',
      },
    ],
    sections: [
      {
        id: 'export-formats',
        number: 1,
        title: 'Available Export Formats',
        content: [
          'Vulnix provides multiple export formats tailored to different audiences:',
          '• Executive PDF: Beautifully formatted summary complete with risk trends, severity charts, and methodology explanations for stakeholders.',
          '• Technical Markdown: Clean developer-friendly documentation suitable for committing into internal security wikis.',
          '• Machine-readable JSON: Full raw finding schemas with CVSS vectors, line citations, and rule metadata for external SIEM ingestion.',
        ],
      },
      {
        id: 'report-scope',
        number: 2,
        title: 'Customizing Scope & Filtering',
        content: [
          'Open Reports in the main console navigation to configure your export:',
          '• Select single project or multi-project organization overview.',
          '• Choose timeframes: Latest audit, Last 30 days, or Custom quarterly window.',
          '• Exclude resolved or false positive findings to present clean active posture.',
        ],
      },
    ],
  },

  'compliance-frameworks': {
    id: 'compliance-frameworks',
    title: 'SOC 2, OWASP & ISO Frameworks',
    category: 'Compliance & Reports',
    effectiveDate: 'October 25, 2026',
    version: '2.0',
    readTime: '4 min read',
    description:
      'Map automated code reviews and vulnerability findings to SOC 2 Type II, OWASP Top 10, CWE Top 25, and ISO 27001 requirements.',
    summary: [
      {
        section: '1. Supported Frameworks',
        anchor: '#frameworks',
        summary: 'OWASP Top 10 (2021), CWE Top 25, SOC 2 CC7.1, and ISO 27001 Annex A.14.',
      },
      {
        section: '2. Generating Auditor Evidence Packages',
        anchor: '#auditor-evidence',
        summary: 'Exporting timestamped scan histories and proof of regular automated vulnerability testing.',
      },
    ],
    sections: [
      {
        id: 'frameworks',
        number: 1,
        title: 'Supported Compliance Frameworks',
        content: [
          'Vulnix maps findings automatically to established regulatory standards:',
          '• OWASP Top 10: Categorizes findings across Injection (A03), Cryptographic Failures (A02), Broken Access Control (A01), and Insecure Design (A04).',
          '• CWE Top 25: Maps weaknesses directly to standard Common Weakness Enumeration identifiers.',
          '• SOC 2 Common Criteria 7.1: Provides evidence that technical vulnerabilities are identified and evaluated on an ongoing basis.',
          '• ISO/IEC 27001: Maps to Control A.14.2.8 (System security testing).',
        ],
      },
      {
        id: 'auditor-evidence',
        number: 2,
        title: 'Auditor Evidence Packages',
        content: [
          'When undergoing an annual SOC 2 or ISO audit:',
          '• Navigate to Compliance in the console.',
          '• Click "Export Auditor Evidence Package" to bundle full scan logs, remediation timestamps, and scanner coverage guarantees into a signed zip archive.',
        ],
      },
    ],
  },

  'team-roles': {
    id: 'team-roles',
    title: 'User Roles & Access Permissions',
    category: 'Account & Troubleshooting',
    effectiveDate: 'October 25, 2026',
    version: '1.9',
    readTime: '3 min read',
    description:
      'Detailed matrix of permissions across Owner, Admin, Developer, and Viewer roles in the Vulnix platform.',
    summary: [
      {
        section: '1. Permission Matrix Table',
        anchor: '#permission-matrix',
        summary: 'Granular comparison of user actions allowed per role tier.',
      },
      {
        section: '2. Modifying Roles',
        anchor: '#modifying-roles',
        summary: 'Step-by-step instructions for upgrading or revoking member permissions.',
      },
    ],
    sections: [
      {
        id: 'permission-matrix',
        number: 1,
        title: 'Granular Permission Matrix',
        content: [
          '• Launch Audits: Owner, Admin, Developer.',
          '• View Findings & Explanations: Owner, Admin, Developer, Viewer.',
          '• Modify Finding Status (Triage): Owner, Admin, Developer.',
          '• Add / Remove Repositories: Owner, Admin.',
          '• Manage Billing & Invoices: Owner only.',
          '• Manage Integrations (Slack/Jira/GitHub): Owner, Admin.',
          '• Export Compliance Reports: All roles.',
        ],
      },
      {
        id: 'modifying-roles',
        number: 2,
        title: 'Modifying Team Member Roles',
        content: [
          '1. Open Settings → Members in the console.',
          '2. Locate the team member in the table.',
          '3. Click the role dropdown selector and pick the new role.',
          '4. Changes take effect immediately without requiring the user to re-authenticate.',
        ],
      },
    ],
  },

  troubleshooting: {
    id: 'troubleshooting',
    title: 'Common Issues & Debugging',
    category: 'Account & Troubleshooting',
    effectiveDate: 'October 25, 2026',
    version: '2.2',
    readTime: '5 min read',
    description:
      'Diagnostic steps for resolving missing repositories, authentication failures, scanner parsing errors, and rate limits.',
    summary: [
      {
        section: '1. Missing Repositories in GitHub Picker',
        anchor: '#missing-repos',
        summary: 'Verify GitHub App permissions and organization approval settings.',
      },
      {
        section: '2. Audit Failed or Timed Out',
        anchor: '#audit-failed',
        summary: 'Common causes including large binary files and branch checkout issues.',
      },
      {
        section: '3. Scanner Syntax Errors',
        anchor: '#syntax-errors',
        summary: 'How to handle unparseable experimental syntax or malformed package manifests.',
      },
    ],
    sections: [
      {
        id: 'missing-repos',
        number: 1,
        title: 'Missing Repositories in GitHub Picker',
        content: [
          'If a repository does not appear in your project list:',
          '• Check GitHub Organization Approvals: If your repository belongs to an organization, an organization owner may need to approve the Vulnix GitHub App installation.',
          '• Check Repository Access: Open GitHub Settings → Applications → Installed GitHub Apps → Vulnix and confirm the repository is included under "Repository access".',
          '• If you changed access in GitHub, click "Reload repositories" in Vulnix to fetch the updated installation listing.',
        ],
      },
      {
        id: 'audit-failed',
        number: 2,
        title: 'Audit Failed or Timed Out',
        content: [
          'If an audit fails during execution:',
          '• Verify the selected branch still exists on the remote repository.',
          '• Ensure the repository does not contain large binary files (e.g., .iso, .zip, .tar, media assets) that exceed memory limits. Add these to .vulnixignore.',
          '• If scanning private submodules, ensure the submodule URLs are accessible or configure a personal access token.',
        ],
      },
      {
        id: 'syntax-errors',
        number: 3,
        title: 'Scanner Syntax & Parse Errors',
        content: [
          'If a scanner reports parse warnings:',
          '• The file may use brand-new experimental syntax not yet supported by that specific linter engine version.',
          '• Vulnix gracefully isolates errors: a failure in one scanner will not prevent other engines from delivering valid findings.',
          '• For assistance, reach out to our engineering support at support@vulnix.com or visit /resources/support.',
        ],
      },
    ],
  },
}
