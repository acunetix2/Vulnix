/**
 * Vulnix Site Policy & Legal Documents Registry
 * Contains structured sections, summary tables, and metadata for all policy pages.
 */

export const LEGAL_CATEGORIES = [
  {
    id: 'vulnix-terms',
    name: 'Vulnix Terms',
    items: [
      { id: 'terms', name: 'Vulnix Terms of Service', path: '/legal/terms' },
      { id: 'corporate-terms', name: 'Vulnix Corporate Terms of Service', path: '/legal/corporate-terms' },
      { id: 'ai-terms', name: 'Terms for AI & Additional Features', path: '/legal/ai-terms' },
      { id: 'preview-terms', name: 'Vulnix Pre-Release & Preview Terms', path: '/legal/preview-terms' },
    ],
  },
  {
    id: 'privacy-policies',
    name: 'Privacy Policies',
    items: [
      { id: 'privacy', name: 'Vulnix Privacy Statement', path: '/legal/privacy' },
      { id: 'dpa', name: 'Data Processing Addendum (DPA)', path: '/legal/dpa' },
      { id: 'subprocessors', name: 'Subprocessors & Infrastructure', path: '/legal/subprocessors' },
      { id: 'privacy-settings', name: 'Privacy Settings & Cookie Policy', path: '/legal/privacy-settings' },
    ],
  },
  {
    id: 'other-site-policies',
    name: 'Other Site Policies',
    items: [
      { id: 'acceptable-use', name: 'Vulnix Acceptable Use Policy', path: '/legal/acceptable-use' },
      { id: 'community-guidelines', name: 'Vulnix Community Guidelines', path: '/legal/community-guidelines' },
      { id: 'code-of-conduct', name: 'Community Code of Conduct', path: '/legal/code-of-conduct' },
    ],
  },
  {
    id: 'content-removal-policies',
    name: 'Content Removal Policies',
    items: [
      { id: 'dmca', name: 'DMCA Takedown Policy', path: '/legal/dmca' },
      { id: 'trademark-policy', name: 'Trademark & Brand Policy', path: '/legal/trademark-policy' },
      { id: 'government-requests', name: 'Government & Regulatory Inquiries', path: '/legal/government-requests' },
    ],
  },
  {
    id: 'security-policies',
    name: 'Security Policies',
    items: [
      { id: 'bug-bounty', name: 'Vulnix Bug Bounty Program', path: '/legal/bug-bounty' },
      { id: 'security-disclosure', name: 'Vulnerability Disclosure & Safe Harbor', path: '/legal/security-disclosure' },
      { id: 'security-overview', name: 'Security Overview & Encryption', path: '/legal/security-overview' },
      { id: 'incident-response', name: 'Incident Response & Customer Notice', path: '/legal/incident-response' },
    ],
  },
  {
    id: 'company-policies',
    name: 'Vulnix Company Policies',
    items: [
      { id: 'ethics-code', name: 'Code of Ethics & Business Conduct', path: '/legal/ethics-code' },
      { id: 'anti-corruption', name: 'Anti-Bribery & Corruption Policy', path: '/legal/anti-corruption' },
      { id: 'sla', name: 'Service Level Agreement (SLA)', path: '/legal/sla' },
      { id: 'hub', name: 'Site Policy Overview', path: '/legal' },
    ],
  },
]

export const TERMS_OF_SERVICE_DATA = {
  id: 'terms',
  title: 'Vulnix Terms of Service',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '3.4',
  description: 'These terms govern your access to and use of the Vulnix security scanning platform, APIs, command line tools, and web applications.',
  summary: [
    {
      section: 'A. Definitions & Scope',
      anchor: '#definitions',
      summary: 'We define the key terms used in this agreement, including Customer Content, Findings, Scans, and Workspaces.',
    },
    {
      section: 'B. Account Terms & Eligibility',
      anchor: '#account-terms',
      summary: 'You must be at least 18 years old. You are responsible for keeping your credentials safe and all activity under your account. Please choose strong credentials.',
    },
    {
      section: 'C. Code Scanning & Intellectual Property',
      anchor: '#code-scanning-ip',
      summary: 'You retain 100% ownership of your source code and repositories. Vulnix never trains machine learning models on your proprietary source code.',
      highlight: 'Zero-training guarantee.',
    },
    {
      section: 'D. Acceptable Use & Scanner Etiquette',
      anchor: '#acceptable-use',
      summary: 'You may only scan source code and systems you own or have explicit legal authorization to test. Do not use Vulnix for unlawful probing.',
    },
    {
      section: 'E. Plans, Billing, and Renewals',
      anchor: '#billing-renewal',
      summary: 'Subscriptions renew automatically each month or year. You can cancel at any time from your workspace settings before renewal.',
    },
    {
      section: 'F. AI-Assisted Security Review',
      anchor: '#ai-review',
      summary: 'Automated scan findings and AI remediation suggestions are advisory. You remain solely responsible for approving code changes before deploying.',
    },
    {
      section: 'G. Cancellation and Termination',
      anchor: '#cancellation-termination',
      summary: 'You may cancel this agreement and close your account at any time. We may suspend accounts that violate our terms.',
    },
    {
      section: 'H. Communications with Vulnix',
      anchor: '#communications',
      summary: 'We use email and in-app notifications for official communications, security alerts, and billing receipts.',
    },
    {
      section: 'I. Disclaimer of Warranties',
      anchor: '#disclaimer-warranties',
      summary: 'We provide our service as is, and we make no guarantees that every single vulnerability will be discovered. Please read this section carefully.',
      highlight: 'Limits warranty obligations.',
    },
    {
      section: 'J. Limitation of Liability',
      anchor: '#limitation-liability',
      summary: 'We will not be liable for indirect damages, lost profits, or data loss arising from your use of the service. Please read this section carefully; it limits our financial liability.',
      highlight: 'Crucial liability cap.',
    },
    {
      section: 'K. Governing Law & Dispute Resolution',
      anchor: '#governing-law',
      summary: 'Any disputes will be resolved through good faith negotiations followed by binding arbitration under Delaware law.',
    },
  ],
  sections: [
    {
      id: 'definitions',
      number: 'A',
      title: 'Definitions & Scope',
      content: [
        '“Vulnix” (the “Service”) refers to the cloud-hosted and self-hosted application security platform, web console, command line interface (CLI), scanning daemons, APIs, and documentation operated by Vulnix, Inc.',
        '“Customer Content” means any source code, configuration files, environment variables, git history, or application assets submitted, linked, or scanned via Vulnix.',
        '“Audit Findings” means the security alerts, vulnerability classifications, CVE/CWE mappings, severity scores, and automated remediation code snippets generated by the Service.',
        '“Workspace” means a collaborative security management container with assigned members, billing settings, and linked source code repositories.',
      ],
    },
    {
      id: 'account-terms',
      number: 'B',
      title: 'Account Terms & Eligibility',
      content: [
        'You must be a human being at least 18 years of age or possess legal authorization from an incorporated entity to create an account. Accounts registered by “bots” or automated scripts without human supervision are prohibited.',
        'You are strictly responsible for maintaining the confidentiality of your login credentials, API tokens, webhook secrets, and workspace invitation links. Vulnix is not liable for unauthorized access resulting from credential compromise.',
        'Each authorized user must have their own unique login. Sharing individual account credentials across multiple team members is prohibited; you must use workspace seat assignments or single sign-on (SSO).',
      ],
    },
    {
      id: 'code-scanning-ip',
      number: 'C',
      title: 'Code Scanning & Intellectual Property',
      content: [
        'You retain all right, title, and interest, including all intellectual property rights, in and to Customer Content. Vulnix claims no ownership over your code, repositories, or application logic.',
        'By connecting a repository or submitting code for analysis, you grant Vulnix a temporary, non-exclusive, worldwide license solely to access, copy, parse, and analyze your code to generate Audit Findings and security reports for your workspace.',
        'Vulnix guarantees that customer proprietary code is never used to train, fine-tune, or calibrate public machine learning models or third-party artificial intelligence engines. Ephemeral scanning containers are purged immediately after scan execution.',
      ],
      callout: {
        type: 'important',
        title: 'Zero-Code Training Guarantee',
        text: 'Vulnix does not train machine learning models on customer source code. Your private repositories remain strictly confidential to your workspace.',
      },
    },
    {
      id: 'acceptable-use',
      number: 'D',
      title: 'Acceptable Use & Scanner Etiquette',
      content: [
        'You may only initiate audits on codebases, repositories, container images, and software artifacts that you legally own, license, or have express written permission to test.',
        'You agree not to use Vulnix scanners, webhooks, or API endpoints to conduct unauthorized vulnerability scans against third-party software, networks, or infrastructure.',
        'You agree not to reverse engineer, decompile, extract source rulesets, benchmark for competitive intelligence, or circumvent security quotas and rate limits imposed on your plan tier.',
      ],
    },
    {
      id: 'billing-renewal',
      number: 'E',
      title: 'Plans, Billing, and Renewals',
      content: [
        'Paid subscriptions are billed in advance on a recurring monthly or annual basis. Billed fees are non-refundable except as required by mandatory consumer protection laws.',
        'Your subscription will automatically renew at the conclusion of each billing period unless you downgrade or cancel your subscription through the Workspace Settings dashboard prior to the renewal date.',
        'If payment fails, we provide a 14-day grace period with email alerts before suspending automated scan runs. Historical audit reports and findings remain accessible for 30 days after suspension.',
      ],
    },
    {
      id: 'ai-review',
      number: 'F',
      title: 'AI-Assisted Security Review & Remediation',
      content: [
        'Vulnix incorporates automated heuristic engines, deterministic rule analyzers, and AI models to provide remediation suggestions, severity scoring, and vulnerability explanations.',
        'AI-generated remediation patches and pull requests are provided as recommendations for your engineering team to review. You are solely responsible for testing, validating, and merging any code suggested by the Service.',
        'Vulnix does not guarantee that AI-assisted scans will discover all existing security weaknesses, nor that suggested code patches are error-free or free from regression defects.',
      ],
    },
    {
      id: 'cancellation-termination',
      number: 'G',
      title: 'Cancellation and Termination',
      content: [
        'You may cancel your subscription or terminate your account at any time through the workspace administration panel. Upon termination, active scans will cease and access tokens will be invalidated.',
        'You may request the immediate deletion of all workspace data, repository caches, and audit logs by submitting a request to privacy@vulnix.com or using the Data Deletion tool.',
        'Vulnix reserves the right to suspend or terminate accounts that breach this agreement, engage in abusive or malicious behavior, or fail to satisfy payment obligations after notice.',
      ],
    },
    {
      id: 'communications',
      number: 'H',
      title: 'Communications with Vulnix',
      content: [
        'For contractual purposes, you consent to receive communications from Vulnix in an electronic format via email to the address registered with your account or through notifications inside the Service.',
        'All formal legal notices to Vulnix must be sent in writing to legal@vulnix.com or to Vulnix Inc., Attn: Legal Department, 548 Market St, Suite 92000, San Francisco, CA 94104.',
      ],
    },
    {
      id: 'disclaimer-warranties',
      number: 'I',
      title: 'Disclaimer of Warranties',
      content: [
        'Vulnix provides the Service on an “as is” and “as available” basis without warranty of any kind, whether express, implied, statutory, or otherwise.',
        'Vulnix specifically disclaims all implied warranties of merchantability, fitness for a particular purpose, non-infringement, and quiet enjoyment. We do not warrant that the Service will be completely uninterrupted, timely, or 100% bug-free.',
      ],
      callout: {
        type: 'warning',
        title: 'Please Read Carefully',
        text: 'Software security is an adversarial and evolving field. Vulnix significantly reduces vulnerability risk but cannot warrant that your software will be immune from cyber attacks or zeroday exploits.',
      },
    },
    {
      id: 'limitation-liability',
      number: 'J',
      title: 'Limitation of Liability',
      content: [
        'To the maximum extent permitted by applicable law, neither Vulnix nor its suppliers or licensors will be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including damages for loss of profits, goodwill, data, or business interruption.',
        'Under no circumstances will Vulnix’s total aggregate liability arising out of or related to this agreement exceed the total amount paid by you to Vulnix in the twelve (12) months preceding the event giving rise to liability.',
      ],
    },
    {
      id: 'governing-law',
      number: 'K',
      title: 'Governing Law & Dispute Resolution',
      content: [
        'These Terms and any dispute arising from them are governed by the laws of the State of Delaware, without regard to conflict of law principles.',
        'Any unresolved dispute will be settled by confidential binding arbitration administered by JAMS in San Francisco, California, under its Comprehensive Arbitration Rules.',
      ],
    },
  ],
}

export const PRIVACY_POLICY_DATA = {
  id: 'privacy',
  title: 'Vulnix Privacy Statement',
  category: 'Privacy & Data Protection',
  effectiveDate: 'October 25, 2026',
  version: '2.8',
  description: 'How Vulnix collects, processes, protects, and handles your account data, repository metadata, and audit artifacts.',
  summary: [
    {
      section: 'A. Information We Collect',
      anchor: '#info-collected',
      summary: 'We collect account details (email, name), workspace membership, billing info, telemetry, and temporary code inputs.',
    },
    {
      section: 'B. Use of Customer Code',
      anchor: '#customer-code',
      summary: 'Your source code is strictly processed to execute vulnerability scans and generate security reports. We never sell or train AI models on your code.',
      highlight: 'Strict privacy fence.',
    },
    {
      section: 'C. Third-Party Service Providers',
      anchor: '#service-providers',
      summary: 'We use verified cloud infrastructure providers (AWS, GCP) and payment processors (Stripe) under strict data protection agreements.',
    },
    {
      section: 'D. Data Retention & Erasure',
      anchor: '#retention-erasure',
      summary: 'Source code is ephemeral during scanning. Findings and audit logs are retained according to your workspace settings and deleted on request.',
    },
    {
      section: 'E. Security Measures & Encryption',
      anchor: '#security-measures',
      summary: 'All data is encrypted in transit using TLS 1.3 and at rest with AES-256. Access is restricted through multi-factor authentication and role-based policies.',
    },
    {
      section: 'F. Your Privacy Rights (GDPR & CCPA)',
      anchor: '#privacy-rights',
      summary: 'You have the right to access, rectify, port, or erase your personal information at any time without discrimination.',
    },
    {
      section: 'G. Cookies & Tracking Technologies',
      anchor: '#cookies',
      summary: 'We use strictly necessary authentication cookies and optional aggregated product analytics. You can adjust your cookie settings at any time.',
    },
    {
      section: 'H. Contact & Data Protection Officer',
      anchor: '#contact-dpo',
      summary: 'Contact privacy@vulnix.com for data subject requests or inquiries regarding international data transfers.',
    },
  ],
  sections: [
    {
      id: 'info-collected',
      number: 'A',
      title: 'Information We Collect',
      content: [
        'Account Information: When you create a Vulnix account or sign in with GitHub, GitLab, or Google SSO, we collect your name, email address, avatar, and organization identity.',
        'Workspace & Repository Metadata: Repository identifiers, branch names, commit hashes, dependency manifests (package.json, requirements.txt, go.mod), and scanner configuration flags.',
        'Billing Details: Payment card information is tokenized and processed directly by our PCI-DSS Level 1 certified processor (Stripe). Vulnix never stores raw credit card numbers.',
        'Technical & Diagnostic Logs: IP addresses, browser user-agents, API response latencies, and scanner exit codes used for operational health and abuse prevention.',
      ],
    },
    {
      id: 'customer-code',
      number: 'B',
      title: 'Use of Customer Code & Repositories',
      content: [
        'Vulnix accesses customer source code exclusively when an authorized scan is triggered by a user, CI/CD pipeline, git webhook, or scheduled cron job.',
        'Source code files are retrieved over encrypted TLS channels into ephemeral, memory-isolated worker sandboxes. Once the SAST and dependency analysis finishes, source files are wiped from worker memory.',
        'We never sell your data, lease customer code, or share your proprietary source files with advertisers or external parties.',
      ],
      callout: {
        type: 'important',
        title: 'Zero-Retention Code Scanning Option',
        text: 'Enterprise workspaces can enable “Stateless Execution Mode”, ensuring zero disk writes of customer code on any Vulnix infrastructure.',
      },
    },
    {
      id: 'service-providers',
      number: 'C',
      title: 'Third-Party Service Providers',
      content: [
        'Vulnix partners with leading cloud infrastructure and platform providers to deliver high availability and compute power. All subprocessors undergo rigorous SOC 2 Type II audits and sign Data Processing Agreements with Standard Contractual Clauses (SCCs).',
        'Our core infrastructure operates across Amazon Web Services (AWS) and Google Cloud Platform (GCP) data centers located in the United States and European Union.',
      ],
    },
    {
      id: 'retention-erasure',
      number: 'D',
      title: 'Data Retention & Erasure',
      content: [
        'Audit findings, vulnerability histories, and scan metadata are retained for the lifetime of your active workspace unless configured to expire earlier (e.g. 30, 90, or 365 days).',
        'Upon workspace deletion, all associated findings, tokens, and audit trails are permanently purged within 30 days from active databases and 60 days from encrypted disaster recovery backups.',
      ],
    },
    {
      id: 'security-measures',
      number: 'E',
      title: 'Security Measures & Encryption',
      content: [
        'All communications with Vulnix web consoles, CLIs, and APIs enforce HTTPS with TLS 1.3 and HSTS preloading.',
        'Data at rest is secured using AES-256 encryption with automated key rotation managed through AWS KMS and HashiCorp Vault.',
        'Vulnix engineers operate under the principle of least privilege; production access requires hardware FIDO2 keys and just-in-time approval.',
      ],
    },
    {
      id: 'privacy-rights',
      number: 'F',
      title: 'Your Privacy Rights (GDPR, CCPA/CPRA)',
      content: [
        'Under the European General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA), you enjoy fundamental rights regarding your data.',
        'Right to Access: You may request a copy of all personal information we maintain concerning your account.',
        'Right to Erasure: You may request the deletion of your account and personal records at any time.',
        'Right to Portability: You can export your audit data in machine-readable JSON or CSV formats at any time.',
      ],
    },
    {
      id: 'cookies',
      number: 'G',
      title: 'Cookies & Tracking Technologies',
      content: [
        'Vulnix uses strictly necessary cookies to maintain secure sessions and authenticate API requests. We do not use third-party advertising cookies.',
        'You can manage non-essential analytics cookies through our Privacy Settings panel or your browser preferences.',
      ],
    },
    {
      id: 'contact-dpo',
      number: 'H',
      title: 'Contact & Data Protection Officer',
      content: [
        'If you have questions regarding this Privacy Statement or wish to exercise your legal rights, please contact our Data Protection Officer at privacy@vulnix.com.',
      ],
    },
  ],
}

export const ACCEPTABLE_USE_DATA = {
  id: 'acceptable-use',
  title: 'Vulnix Acceptable Use Policy',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '2.1',
  description: 'Rules and guidelines ensuring fair, legal, and responsible use of Vulnix scanning tools and computing infrastructure.',
  summary: [
    {
      section: 'A. Permitted Use',
      anchor: '#permitted-use',
      summary: 'You may test codebases and applications that you own or have explicit authorization to audit.',
      highlight: 'Authorized testing only.',
    },
    {
      section: 'B. Prohibited Activities',
      anchor: '#prohibited-activities',
      summary: 'You must not use Vulnix for unlawful probing, uploading malware, reverse engineering, or disrupting platform services.',
    },
    {
      section: 'C. Rate Limits & Fair Consumption',
      anchor: '#rate-limits',
      summary: 'Usage must conform to plan quotas. Automated flooding of API endpoints or CLI scanning triggers is prohibited.',
    },
    {
      section: 'D. Enforcement & Account Actions',
      anchor: '#enforcement',
      summary: 'Violations may result in immediate suspension, account termination, and notification to appropriate legal authorities.',
    },
  ],
  sections: [
    {
      id: 'permitted-use',
      number: 'A',
      title: 'Permitted Use',
      content: [
        'Vulnix is designed for developers, security engineers, DevOps teams, and security researchers seeking to detect, triage, and remediate software vulnerabilities.',
        'You may use the Service to scan public and private source code repositories, open source dependencies, container manifests, and infrastructure-as-code files belonging to you or your employer.',
        'Security consultants and MSPs may scan client repositories only if authorized in writing under an active consulting engagement.',
      ],
    },
    {
      id: 'prohibited-activities',
      number: 'B',
      title: 'Prohibited Activities',
      content: [
        'Unauthorized Target Scanning: Scanning codebases or applications belonging to third parties without authorization is strictly forbidden.',
        'Malicious Software Distribution: Uploading active worms, ransomware, keyloggers, or weaponized exploit payloads for malicious distribution.',
        'Platform Denial of Service: Initiating high-concurrency API loops or resource exhaustion attacks targeting Vulnix infrastructure.',
        'Circumvention of Quotas: Creating multiple free tier accounts to bypass monthly scan limits or seat restrictions.',
      ],
    },
    {
      id: 'rate-limits',
      number: 'C',
      title: 'Rate Limits & Fair Consumption',
      content: [
        'All API and CLI requests are subject to rate limiting to guarantee service quality and responsiveness for all users.',
        'If your CI/CD pipelines trigger automated scans on every commit, we recommend configuring path filtering or pull-request delta scans rather than full monolithic audits on trivial commits.',
      ],
    },
    {
      id: 'enforcement',
      number: 'D',
      title: 'Enforcement & Account Actions',
      content: [
        'Vulnix monitors system anomalies and unauthorized scan patterns. If an account is suspected of violating this policy, we may immediately suspend active scan jobs.',
        'Repeated or egregious violations will result in permanent termination of access without refund.',
      ],
    },
  ],
}

export const PRIVACY_SETTINGS_DATA = {
  id: 'privacy-settings',
  title: 'Privacy Settings & Cookie Policy',
  category: 'Privacy & Data Protection',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Understand how cookies, telemetry, and tracking technologies are utilized across the Vulnix platform.',
  summary: [
    {
      section: 'A. Cookie Categories',
      anchor: '#cookie-categories',
      summary: 'We distinguish between strictly necessary authentication cookies and optional aggregated telemetry.',
    },
    {
      section: 'B. Managing Your Preferences',
      anchor: '#managing-preferences',
      summary: 'You can customize your analytics choices and toggle non-essential cookies on or off at any time.',
      highlight: 'Granular controls.',
    },
    {
      section: 'C. Telemetry & Scanner Metrics',
      anchor: '#scanner-metrics',
      summary: 'Anonymized scanner diagnostic metrics (execution durations, scanner exit codes) help us identify engine regressions.',
    },
    {
      section: 'D. Data Subject Request Portal',
      anchor: '#request-portal',
      summary: 'How to request data exports, initiate GDPR erasure, or revoke third-party OAuth access tokens.',
    },
  ],
  sections: [
    {
      id: 'cookie-categories',
      number: 'A',
      title: 'Cookie Categories & Uses',
      content: [
        'Strictly Necessary Cookies: Essential for user authentication, session security, CSRF token validation, and workspace routing. These cannot be disabled.',
        'Functional Cookies: Remember your theme preference (dark/light mode), sidebar toggle state, and active workspace filter selections.',
        'Analytics Cookies: Help us measure user engagement, feature adoption rates, and documentation navigation flows without identifying individual developers.',
      ],
    },
    {
      id: 'managing-preferences',
      number: 'B',
      title: 'Managing Your Preferences',
      content: [
        'You can toggle analytics tracking on or off directly from your Workspace Settings -> Privacy & Compliance tab.',
        'Most modern web browsers allow you to block third-party cookies or send “Global Privacy Control” (GPC) signals, which Vulnix honors automatically.',
      ],
    },
    {
      id: 'scanner-metrics',
      number: 'C',
      title: 'Telemetry & Scanner Metrics',
      content: [
        'The Vulnix CLI and scanning daemons collect minimal telemetry by default (scanner version, execution duration, and OS architecture) to detect crashes and engine failures.',
        'You can completely disable CLI telemetry at any time by setting the environment variable `VULNIX_TELEMETRY=0` or adding `telemetry: false` in `.vulnix.yml`.',
      ],
    },
    {
      id: 'request-portal',
      number: 'D',
      title: 'Data Subject Request Portal',
      content: [
        'To submit a formal request for data access, correction, or deletion under GDPR or CCPA, email privacy@vulnix.com or visit the Data Export section in your account.',
        'Requests are verified through cryptographic challenge or registered email confirmation and completed within 30 days.',
      ],
    },
  ],
}

export const CORPORATE_TERMS_DATA = {
  id: 'corporate-terms',
  title: 'Vulnix Corporate Terms of Service',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '2.5',
  description: 'Enterprise master services agreement governing commercial organization licenses, dedicated runners, and custom SLAs.',
  summary: [
    {
      section: 'A. Master Services Agreement',
      anchor: '#msa-scope',
      summary: 'These terms supersede individual clickthrough agreements for organizations executing signed Order Forms.',
    },
    {
      section: 'B. Dedicated & Self-Hosted Runners',
      anchor: '#dedicated-runners',
      summary: 'Terms governing Vulnix agents deployed inside your VPC, private clouds, or on-premises Kubernetes clusters.',
      highlight: 'Zero egress architecture.',
    },
    {
      section: 'C. Enterprise Support & SLAs',
      anchor: '#enterprise-support',
      summary: '99.95% uptime guarantees, dedicated technical account managers (TAM), and 1-hour critical response windows.',
    },
    {
      section: 'D. Confidentiality & Mutual NDA',
      anchor: '#confidentiality',
      summary: 'Mutual non-disclosure obligations protecting proprietary source code, vulnerability findings, and roadmap data.',
    },
    {
      section: 'E. Audit Rights & SOC 2 Reports',
      anchor: '#audit-rights',
      summary: 'Annual access to third-party SOC 2 Type II audit reports, penetration test summaries, and security questionnaires.',
    },
  ],
  sections: [
    {
      id: 'msa-scope',
      number: 'A',
      title: 'Master Services Agreement Scope',
      content: [
        'These Corporate Terms govern any access to Vulnix services purchased via an enterprise Order Form signed by both parties.',
        'In the event of any conflict between these Corporate Terms and the standard Terms of Service, the signed Order Form and these Corporate Terms take legal precedence.',
      ],
    },
    {
      id: 'dedicated-runners',
      number: 'B',
      title: 'Dedicated & Self-Hosted Runners',
      content: [
        'Vulnix provides enterprise customers with containerized scanner daemon images designed to run directly inside customer-managed AWS VPCs, Azure VNets, or air-gapped on-premises Kubernetes environments.',
        'When utilizing self-hosted runners, customer source code never traverses Vulnix cloud servers; only encrypted metadata and vulnerability telemetry are transmitted to the management console.',
      ],
    },
    {
      id: 'enterprise-support',
      number: 'C',
      title: 'Enterprise Support & Service Levels',
      content: [
        'Enterprise accounts receive 24/7/365 priority support with a guaranteed 1-hour response time for Priority 1 (Service Outage) incidents.',
        'Vulnix commits to a 99.95% monthly uptime percentage for all cloud API and dashboard endpoints, backed by financial service credits.',
      ],
    },
    {
      id: 'confidentiality',
      number: 'D',
      title: 'Confidentiality & Mutual Non-Disclosure',
      content: [
        'Each party agrees to safeguard the confidential information of the other party with the same standard of care it uses for its own confidential assets.',
        'Vulnix treats all customer source code, branch topologies, and vulnerability audit reports as strictly confidential Customer Information.',
      ],
    },
    {
      id: 'audit-rights',
      number: 'E',
      title: 'Security Audits & Compliance Documentation',
      content: [
        'Upon written request, Vulnix will provide enterprise customers with current SOC 2 Type II attestation reports, ISO 27001 certifications, and independent annual network penetration test summaries under NDA.',
      ],
    },
  ],
}

export const AI_TERMS_DATA = {
  id: 'ai-terms',
  title: 'Terms for AI & Additional Features',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Specific terms governing Vulnix automated code remediation, vulnerability explanations, and AI security co-pilot features.',
  summary: [
    {
      section: 'A. AI Capabilities & Scope',
      anchor: '#ai-scope',
      summary: 'Details how Vulnix uses AI models to generate remediation patches, explain CVE impact, and suggest pull requests.',
    },
    {
      section: 'B. Zero Model Training Guarantee',
      anchor: '#zero-training',
      summary: 'Your proprietary code is never used to train or refine public or private foundation models.',
      highlight: 'Explicit privacy guarantee.',
    },
    {
      section: 'C. Human-in-the-Loop Requirement',
      anchor: '#human-in-the-loop',
      summary: 'You are responsible for reviewing and testing all AI-generated security fixes before merging to production branches.',
    },
    {
      section: 'D. Data Processing & API Isolation',
      anchor: '#api-isolation',
      summary: 'AI queries are transmitted via zero-data-retention enterprise API endpoints with prompt isolation.',
    },
  ],
  sections: [
    {
      id: 'ai-scope',
      number: 'A',
      title: 'AI Capabilities & Scope',
      content: [
        'Vulnix provides optional AI-assisted security features, including automatic code fix generation, CVE root-cause summaries, contextual false-positive explanations, and pull request draft generation.',
        'These features assist your security and development teams by accelerating triage, but are designed as engineering decision support rather than autonomous code deployments.',
      ],
    },
    {
      id: 'zero-training',
      number: 'B',
      title: 'Zero Model Training Guarantee',
      content: [
        'Vulnix guarantees that any code snippets, repository contexts, or scan findings sent to AI inference endpoints are strictly excluded from model training datasets.',
        'Customer prompts and contextual code snippets are discarded immediately following response completion.',
      ],
      callout: {
        type: 'important',
        title: 'Enterprise Model Isolation',
        text: 'All AI inference takes place through isolated enterprise APIs that enforce strict zero-day data retention and prompt confidentiality policies.',
      },
    },
    {
      id: 'human-in-the-loop',
      number: 'C',
      title: 'Human-in-the-Loop Review',
      content: [
        'Software security requires contextual business understanding. Vulnix requires that all AI-generated code modifications be validated through human code review and automated integration tests before deployment.',
        'Vulnix disclaims liability for application downtime or software regressions caused by unreviewed automated code merges.',
      ],
    },
    {
      id: 'api-isolation',
      number: 'D',
      title: 'Data Processing & API Isolation',
      content: [
        'Workspace administrators can disable AI features entirely at any time from Workspace Settings -> AI Security Review.',
      ],
    },
  ],
}

export const SECURITY_DISCLOSURE_DATA = {
  id: 'security-disclosure',
  title: 'Security & Vulnerability Disclosure',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '2.2',
  description: 'Our responsible disclosure policy and bug bounty guidelines for reporting security vulnerabilities in Vulnix.',
  summary: [
    {
      section: 'A. Safe Harbor Commitment',
      anchor: '#safe-harbor',
      summary: 'We commit not to pursue legal action against researchers acting in good faith according to these guidelines.',
      highlight: 'Full legal safe harbor.',
    },
    {
      section: 'B. Reporting a Vulnerability',
      anchor: '#reporting',
      summary: 'Email security@vulnix.com with a reproduction scenario and encrypted details via our PGP key.',
    },
    {
      section: 'C. Out of Scope Activities',
      anchor: '#out-of-scope',
      summary: 'Denial of service (DoS), social engineering, physical intrusion, and testing of third-party dependencies are prohibited.',
    },
    {
      section: 'D. Bounty Rewards & Triage Timelines',
      anchor: '#bounties-timelines',
      summary: 'Initial acknowledgment within 24 hours, triage within 3 business days, and bounty rewards based on CVSS severity.',
    },
  ],
  sections: [
    {
      id: 'safe-harbor',
      number: 'A',
      title: 'Safe Harbor Commitment',
      content: [
        'Vulnix considers security research conducted in compliance with this policy to be authorized. We will not pursue civil or criminal claims against researchers who discover and report issues in good faith.',
        'If legal action is initiated by a third party against you for research conducted strictly within this policy, we will make our authorization known.',
      ],
    },
    {
      id: 'reporting',
      number: 'B',
      title: 'Reporting a Vulnerability',
      content: [
        'Please report security findings to security@vulnix.com. Include a detailed description, step-by-step reproduction steps, proof-of-concept scripts, and affected components.',
        'You may encrypt sensitive submissions using our public PGP key available at https://vulnix.com/security.pgp.',
      ],
    },
    {
      id: 'out-of-scope',
      number: 'C',
      title: 'Out of Scope Activities',
      content: [
        'Distributed denial of service (DDoS) or high-volume automated fuzzing that causes service disruption.',
        'Phishing, social engineering, or physical intrusion against Vulnix employees or facilities.',
        'Accessing, modifying, or exfiltrating data belonging to other Vulnix customers.',
      ],
    },
    {
      id: 'bounties-timelines',
      number: 'D',
      title: 'Bounties & Response Timelines',
      content: [
        'Acknowledgment: Within 24 hours of receipt.',
        'Triage & Severity Assessment: Within 3 business days.',
        'Resolution & Disclosure: Within 30 days or as mutually agreed.',
        'Bounty awards range from $250 for Low severity issues up to $10,000 for Critical remote code execution vulnerabilities.',
      ],
    },
  ],
}

export const DPA_DATA = {
  id: 'dpa',
  title: 'Data Processing Addendum (DPA)',
  category: 'Privacy & Data Protection',
  effectiveDate: 'October 25, 2026',
  version: '3.0',
  description: 'Contractual terms governing the processing of personal data under GDPR, UK GDPR, and the Swiss FADP.',
  summary: [
    {
      section: 'A. Scope & Roles of Parties',
      anchor: '#dpa-scope',
      summary: 'Customer acts as Data Controller and Vulnix acts as Data Processor regarding Customer Personal Data.',
    },
    {
      section: 'B. Processing Instructions',
      anchor: '#instructions',
      summary: 'Vulnix processes personal data strictly according to customer instructions and only as required to provide the Service.',
    },
    {
      section: 'C. Security of Processing',
      anchor: '#security-processing',
      summary: 'Technical and organizational measures (TOMs) including encryption, pseudonymization, and resilience testing.',
      highlight: 'Standard GDPR TOMs.',
    },
    {
      section: 'D. Subprocessors & Notifications',
      anchor: '#subprocessors',
      summary: 'Requirements for appointing subprocessors and prior notification before onboarding new infrastructure providers.',
    },
    {
      section: 'E. Cross-Border Data Transfers',
      anchor: '#data-transfers',
      summary: 'Standard Contractual Clauses (EU SCCs 2021/914) and UK Addendum incorporated for transatlantic transfers.',
    },
  ],
  sections: [
    {
      id: 'dpa-scope',
      number: 'A',
      title: 'Scope & Roles of Parties',
      content: [
        'This Data Processing Addendum (“DPA”) supplements the Vulnix Terms of Service and applies where Vulnix processes Customer Personal Data subject to European or international data protection laws.',
        'The customer acts as the Data Controller (or Business under CCPA), and Vulnix acts as the Data Processor (or Service Provider).',
      ],
    },
    {
      id: 'instructions',
      number: 'B',
      title: 'Processing Instructions',
      content: [
        'Vulnix will process Customer Personal Data only on documented instructions from Customer, including with respect to transfers of personal data to a third country, unless required to do so by applicable law.',
      ],
    },
    {
      id: 'security-processing',
      number: 'C',
      title: 'Technical and Organizational Measures',
      content: [
        'Vulnix implements and maintains appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including encryption in transit (TLS 1.3), encryption at rest (AES-256), multi-factor authentication, and annual penetration testing.',
      ],
    },
    {
      id: 'subprocessors',
      number: 'D',
      title: 'Subprocessors & Notifications',
      content: [
        'Customer grants general authorization to Vulnix to engage subprocessors. Vulnix maintains a current list of subprocessors at /legal/subprocessors.',
        'Vulnix will notify customer at least 14 days prior to authorizing any new subprocessor to give customer reasonable opportunity to object.',
      ],
    },
    {
      id: 'data-transfers',
      number: 'E',
      title: 'Cross-Border Data Transfers',
      content: [
        'For transfers of personal data from the EEA, Switzerland, or the United Kingdom to countries without an adequacy decision, the EU Standard Contractual Clauses (Module 2: Controller to Processor) and UK Addendum are incorporated by reference.',
      ],
    },
  ],
}

export const SUBPROCESSORS_DATA = {
  id: 'subprocessors',
  title: 'Subprocessors & Infrastructure',
  category: 'Privacy & Data Protection',
  effectiveDate: 'October 25, 2026',
  version: '2.3',
  description: 'Authorized infrastructure, analytics, and service providers that process data on behalf of Vulnix.',
  summary: [
    {
      section: 'A. Infrastructure & Hosting',
      anchor: '#infrastructure',
      summary: 'Core cloud hosting, container compute, database clusters, and secure storage.',
      highlight: 'SOC 2 & ISO certified.',
    },
    {
      section: 'B. Integrations & Authentication',
      anchor: '#integrations',
      summary: 'OAuth connectors for GitHub, GitLab, and identity providers.',
    },
    {
      section: 'C. Communication & Support',
      anchor: '#communications',
      summary: 'Transactional email, ticket tracking, and security alerts.',
    },
    {
      section: 'D. Subprocessor Change Notification',
      anchor: '#notifications',
      summary: 'How to subscribe to email alerts for upcoming changes to our subprocessor list.',
    },
  ],
  sections: [
    {
      id: 'infrastructure',
      number: 'A',
      title: 'Core Infrastructure & Compute Subprocessors',
      content: [
        'Below are the verified third-party entities authorized to process customer data on behalf of Vulnix:',
        '• Amazon Web Services (AWS) – Cloud hosting, compute workers, database storage, and cryptographic key management (United States & Ireland).',
        '• Google Cloud Platform (GCP) – Secondary compute and container build runners (United States & Belgium).',
        '• Cloudflare, Inc. – Edge CDN, DDoS mitigation, and TLS termination (Global Anycast).',
        '• Stripe, Inc. – Billing tokenization and payment card processing (United States).',
      ],
    },
    {
      id: 'integrations',
      number: 'B',
      title: 'Integrations & External Services',
      content: [
        '• GitHub, Inc. – Repository sync and pull-request check run integration when configured by customer.',
        '• GitLab B.V. – Self-managed and SaaS repository webhooks when configured by customer.',
        '• Slack Technologies / Atlassian – Optional alerting integrations for Slack channels and Jira issue creation.',
      ],
    },
    {
      id: 'communications',
      number: 'C',
      title: 'Communication & Transactional Services',
      content: [
        '• Postmark / SendGrid – Delivery of critical security notification emails and account reset links.',
        '• Datadog – System health metrics, error tracking, and latency monitoring (no source code access).',
      ],
    },
    {
      id: 'notifications',
      number: 'D',
      title: 'Subprocessor Update Notifications',
      content: [
        'Workspace admins can subscribe to subprocessor notification alerts by emailing subprocessor-updates@vulnix.com. We publish new providers with a minimum 14-day notice window.',
      ],
    },
  ],
}

export const SLA_DATA = {
  id: 'sla',
  title: 'Service Level Agreement (SLA)',
  category: 'Compliance & Governance',
  effectiveDate: 'October 25, 2026',
  version: '2.1',
  description: 'Uptime commitments, incident severity definitions, response time benchmarks, and financial credit remedies.',
  summary: [
    {
      section: 'A. Service Availability Commitment',
      anchor: '#availability',
      summary: '99.95% monthly uptime for enterprise cloud endpoints and 99.9% for standard business tiers.',
      highlight: 'Backed by financial credits.',
    },
    {
      section: 'B. Incident Severity & Response Times',
      anchor: '#severity-response',
      summary: 'Severity 1 (Critical Outage): 1-hour response. Severity 2 (Major Degradation): 4-hour response.',
    },
    {
      section: 'C. Service Credits & Remedies',
      anchor: '#service-credits',
      summary: '10% to 50% monthly subscription credits if uptime targets are missed during a calendar month.',
    },
    {
      section: 'D. Maintenance & Exclusions',
      anchor: '#exclusions',
      summary: 'Scheduled maintenance announced at least 72 hours in advance and external third-party outages are excluded.',
    },
  ],
  sections: [
    {
      id: 'availability',
      number: 'A',
      title: 'Service Availability Commitment',
      content: [
        'Vulnix warrants that the cloud platform dashboard, scan coordinator API, and webhook ingestion endpoints will maintain an Uptime Percentage of not less than 99.95% during any calendar month.',
        'Uptime is calculated using external synthetic monitoring checks sampled at 60-second intervals across multiple geographic regions.',
      ],
    },
    {
      id: 'severity-response',
      number: 'B',
      title: 'Incident Severity Levels & Response Benchmarks',
      content: [
        '• Priority 1 (Critical Outage): The entire Vulnix Service or scanning pipeline is inaccessible. Initial response within 1 hour; continuous work until resolved.',
        '• Priority 2 (Major Impairment): Key features are impaired (e.g. dependency scan failures or webhook delay), but workarounds exist. Response within 4 hours.',
        '• Priority 3 (Minor Defect): Non-critical bugs, UI anomalies, or documentation inaccuracies. Response within 1 business day.',
        '• Priority 4 (General Inquiry): Feature requests or configuration questions. Response within 2 business days.',
      ],
    },
    {
      id: 'service-credits',
      number: 'C',
      title: 'Service Credit Schedule',
      content: [
        'Monthly Uptime < 99.95% but ≥ 99.0%: 10% credit of monthly billing.',
        'Monthly Uptime < 99.0% but ≥ 95.0%: 25% credit of monthly billing.',
        'Monthly Uptime < 95.0%: 50% credit of monthly billing.',
        'Credits are applied prospectively against future invoices upon request submitted within 30 days of the qualifying incident.',
      ],
    },
    {
      id: 'exclusions',
      number: 'D',
      title: 'SLA Exclusions',
      content: [
        'Downtime caused by customer-managed networks, self-hosted runner infrastructure failures, GitHub/GitLab API rate limits or outages, or scheduled maintenance windows announced at least 72 hours in advance via status.vulnix.com are excluded.',
      ],
    },
  ],
}

export const BUG_BOUNTY_DATA = {
  id: 'bug-bounty',
  title: 'Vulnix Bug Bounty Program',
  category: 'Security Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.5',
  description: 'Guidelines, scope, reward amounts, and safe harbor protections for ethical security researchers testing the Vulnix platform.',
  summary: [
    {
      section: 'A. Safe Harbor & Legal Authorization',
      anchor: '#safe-harbor',
      summary: 'Researchers operating within these rules are authorized. Vulnix will not pursue civil or criminal claims against you.',
      highlight: 'Full legal safe harbor.',
    },
    {
      section: 'B. Target Scope & Eligible Domains',
      anchor: '#bounty-scope',
      summary: 'In-scope: app.vulnix.com, api.vulnix.com, scanner CLI binaries, and ephemeral worker sandbox isolation.',
    },
    {
      section: 'C. Reward Schedule & Severity Matrix',
      anchor: '#bounty-rewards',
      summary: 'Critical: up to $15,000 | High: up to $5,000 | Medium: up to $1,500 | Low: up to $400.',
      highlight: 'Tiered cash bounties.',
    },
    {
      section: 'D. Prohibited Testing Techniques',
      anchor: '#prohibited-testing',
      summary: 'Denial of service (DoS), automated rate-limit flooding, social engineering, and customer data extraction are forbidden.',
    },
    {
      section: 'E. Submission Process & PGP Key',
      anchor: '#submission-process',
      summary: 'Submit reports to bounty@vulnix.com with step-by-step reproduction and optional PGP encryption.',
    },
  ],
  sections: [
    {
      id: 'safe-harbor',
      number: 'A',
      title: 'Safe Harbor & Authorization',
      content: [
        'Vulnix considers security research conducted strictly within this policy to be authorized under the Computer Fraud and Abuse Act (CFAA), DMCA safe harbor provisions, and relevant computer crime laws.',
        'We will not initiate legal action against you or contact law enforcement if you discover and report vulnerabilities in good faith without destroying or modifying customer data.',
      ],
      callout: {
        type: 'important',
        title: 'Researcher Protection Commitment',
        text: 'If a third party initiates legal action against you for activities conducted strictly within our Bug Bounty guidelines, we will confirm your authorization.',
      },
    },
    {
      id: 'bounty-scope',
      number: 'B',
      title: 'Scope of Targets',
      content: [
        'The following services and assets are eligible for cash bounty awards:',
        '• *.vulnix.com web console and workspace management APIs.',
        '• Vulnix CLI distribution binaries (code injection, privilege escalation, token extraction).',
        '• Scanner container sandboxes (container breakout, tenant-to-tenant leakage, host escape).',
        '• Webhook receivers and third-party authentication integrations (OAuth flow flaws).',
      ],
    },
    {
      id: 'bounty-rewards',
      number: 'C',
      title: 'Reward Schedule & Payout Benchmarks',
      content: [
        'Rewards are determined by CVSS v3.1 base score, business impact, and report reproducibility:',
        '• Critical (CVSS 9.0 – 10.0): $5,000 to $15,000 – Remote Code Execution (RCE) on backend infrastructure, cross-tenant data access, sandbox breakout.',
        '• High (CVSS 7.0 – 8.9): $2,000 to $5,000 – Stored XSS affecting other workspaces, privilege escalation, bypass of workspace token isolation.',
        '• Medium (CVSS 4.0 – 6.9): $500 to $1,500 – Sensitive information leakage, CSRF on sensitive endpoints, unauthorized scan invocation.',
        '• Low (CVSS 0.1 – 3.9): $150 to $400 – Minor security anomalies, subdomain takeovers without impact.',
      ],
    },
    {
      id: 'prohibited-testing',
      number: 'D',
      title: 'Out of Scope & Prohibited Testing',
      content: [
        '• Distributed denial-of-service (DDoS) or high-volume automated fuzzing that causes customer service degradation.',
        '• Phishing, pretexting, or social engineering targeting Vulnix staff or contractors.',
        '• Accessing, retaining, or exfiltrating another customer’s private source code or vulnerability reports.',
        '• Submitting scanner false-positive complaints as security bugs (please use support@vulnix.com).',
      ],
    },
    {
      id: 'submission-process',
      number: 'E',
      title: 'Reporting Guidelines & Triage SLAs',
      content: [
        'Submit vulnerability reports to bounty@vulnix.com. Include complete reproduction steps, proof-of-concept commands or HTTP requests, and the potential impact.',
        'First Response SLA: Within 24 hours of submission.',
        'Triage & Severity Confirmation: Within 3 business days.',
        'Bounty Payment: Processed via HackerOne, Bugcrowd, or direct bank transfer within 10 business days of report validation.',
      ],
    },
  ],
}

export const COMMUNITY_GUIDELINES_DATA = {
  id: 'community-guidelines',
  title: 'Vulnix Community Guidelines',
  category: 'Other Site Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Standards for collaborative discussions, security research sharing, public repository scanner badges, and developer forums.',
  summary: [
    {
      section: 'A. Constructive & Respectful Conduct',
      anchor: '#conduct',
      summary: 'Be welcoming, professional, and respectful in community forums, Discord channels, and pull request discussions.',
    },
    {
      section: 'B. Responsible Vulnerability Sharing',
      anchor: '#vuln-sharing',
      summary: 'Do not publicly drop zero-day exploits or active malware samples in public workspace comment threads.',
    },
    {
      section: 'C. Public Scanner Badges & Findings',
      anchor: '#public-badges',
      summary: 'Rules governing public repository security score badges and public vulnerability disclosure widgets.',
    },
  ],
  sections: [
    {
      id: 'conduct',
      number: 'A',
      title: 'Constructive & Respectful Conduct',
      content: [
        'The Vulnix community is dedicated to providing a harassment-free and empowering experience for developers and security researchers of all skill levels.',
        'We do not tolerate abusive language, discriminatory remarks, harassment, or personal attacks in any forum, support channel, or collaborative workspace.',
      ],
    },
    {
      id: 'vuln-sharing',
      number: 'B',
      title: 'Responsible Vulnerability Sharing',
      content: [
        'When discussing security vulnerabilities or sharing remediation suggestions, adhere to responsible disclosure principles.',
        'Never publish unpatched third-party exploit code or weaponized payloads without prior coordination with the affected vendor.',
      ],
    },
    {
      id: 'public-badges',
      number: 'C',
      title: 'Public Scanner Badges & Widgets',
      content: [
        'Vulnix provides repository badges indicating security health scores. You may display these badges on public README files provided they accurately reflect genuine scan results and are not manipulated.',
      ],
    },
  ],
}

export const CODE_OF_CONDUCT_DATA = {
  id: 'code-of-conduct',
  title: 'Community Code of Conduct',
  category: 'Other Site Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Our pledge to ensure a safe, diverse, and inclusive environment across all Vulnix open source projects and developer platforms.',
  summary: [
    {
      section: 'A. Our Pledge',
      anchor: '#pledge',
      summary: 'We pledge to make participation in our community a harassment-free experience for everyone.',
    },
    {
      section: 'B. Our Standards',
      anchor: '#standards',
      summary: 'Examples of positive behavior vs. unacceptable harassment and discriminatory conduct.',
    },
    {
      section: 'C. Enforcement Responsibilities',
      anchor: '#enforcement',
      summary: 'Community moderators are responsible for clarifying and enforcing our standards of acceptable behavior.',
    },
  ],
  sections: [
    {
      id: 'pledge',
      number: 'A',
      title: 'Our Pledge',
      content: [
        'We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, gender identity, experience level, nationality, personal appearance, race, religion, or sexual identity.',
      ],
    },
    {
      id: 'standards',
      number: 'B',
      title: 'Our Standards',
      content: [
        'Positive behavior includes using welcoming language, being respectful of differing viewpoints, gracefully accepting constructive feedback, and focusing on what is best for the overall community.',
        'Unacceptable behavior includes the use of sexualized language or imagery, trolling, insulting comments, personal attacks, publishing private information without explicit permission, and other conduct deemed inappropriate.',
      ],
    },
    {
      id: 'enforcement',
      number: 'C',
      title: 'Enforcement Responsibilities',
      content: [
        'Community leaders have the right and responsibility to remove, edit, or reject comments, commits, code, issues, and other contributions that do not align with this Code of Conduct.',
        'Instances of abusive behavior may be reported by contacting conduct@vulnix.com. All complaints will be reviewed and investigated promptly and fairly.',
      ],
    },
  ],
}

export const DMCA_DATA = {
  id: 'dmca',
  title: 'DMCA Takedown Policy',
  category: 'Content Removal Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Procedures for submitting copyright infringement notices and counter-notifications under 17 U.S.C. § 512.',
  summary: [
    {
      section: 'A. Submitting a DMCA Notice',
      anchor: '#dmca-notice',
      summary: 'Required legal elements for copyright owners to report infringing material hosted on Vulnix.',
    },
    {
      section: 'B. Counter-Notification Procedure',
      anchor: '#counter-notice',
      summary: 'How content owners can respond to dispute an erroneous copyright takedown.',
    },
    {
      section: 'C. Designated Copyright Agent',
      anchor: '#designated-agent',
      summary: 'Contact details for our registered DMCA Agent with the U.S. Copyright Office.',
    },
  ],
  sections: [
    {
      id: 'dmca-notice',
      number: 'A',
      title: 'Submitting a DMCA Takedown Notice',
      content: [
        'If you believe that material hosted on or transmitted through Vulnix infringes your copyright, you may submit a formal notification to our Designated Copyright Agent.',
        'Your notice must include: (1) physical or electronic signature; (2) identification of the copyrighted work; (3) identification of the infringing material with sufficient detail for removal; (4) your contact details; (5) a statement of good-faith belief; and (6) a statement under penalty of perjury that the information is accurate.',
      ],
    },
    {
      id: 'counter-notice',
      number: 'B',
      title: 'Counter-Notification Procedure',
      content: [
        'If you believe that your content was removed by mistake or misidentification, you may submit a counter-notice containing your consent to federal court jurisdiction and contact information.',
      ],
    },
    {
      id: 'designated-agent',
      number: 'C',
      title: 'Designated Copyright Agent Contact',
      content: [
        'Attn: Vulnix Copyright Agent, 548 Market St, Suite 92000, San Francisco, CA 94104. Email: copyright@vulnix.com.',
      ],
    },
  ],
}

export const TRADEMARK_DATA = {
  id: 'trademark-policy',
  title: 'Trademark & Brand Policy',
  category: 'Content Removal Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Guidelines for the authorized use of Vulnix logos, wordmarks, service marks, and badge assets.',
  summary: [
    {
      section: 'A. Authorized Use of Logos',
      anchor: '#authorized-use',
      summary: 'When and how you may use Vulnix wordmarks and logo badges in software repositories and media.',
    },
    {
      section: 'B. Prohibited Brand Uses',
      anchor: '#prohibited-use',
      summary: 'You may not use Vulnix marks to imply endorsement, sponsorship, or certification without written consent.',
    },
    {
      section: 'C. Trademark Violations Reporting',
      anchor: '#reporting-infringement',
      summary: 'How to report brand impersonation, deceptive domain names, or trademark infringement.',
    },
  ],
  sections: [
    {
      id: 'authorized-use',
      number: 'A',
      title: 'Authorized Use of Vulnix Marks',
      content: [
        'You may use the official Vulnix badge images to indicate that your repository is actively audited by Vulnix.',
        'You may use the Vulnix name in articles, reviews, and comparisons provided such use is truthful, descriptive, and does not suggest an official affiliation.',
      ],
    },
    {
      id: 'prohibited-use',
      number: 'B',
      title: 'Prohibited Brand Uses',
      content: [
        'Do not register domain names, social media handles, or business entities containing “Vulnix” or confusingly similar terms.',
        'Do not alter the colors, proportions, or typography of official Vulnix logo assets without written authorization.',
      ],
    },
    {
      id: 'reporting-infringement',
      number: 'C',
      title: 'Reporting Trademark Violations',
      content: [
        'To report trademark misuse or phishing attempts impersonating Vulnix, email trademark@vulnix.com.',
      ],
    },
  ],
}

export const GOVERNMENT_REQUESTS_DATA = {
  id: 'government-requests',
  title: 'Government & Regulatory Inquiries',
  category: 'Content Removal Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'How Vulnix evaluates and responds to law enforcement subpoenas, court orders, and government data requests.',
  summary: [
    {
      section: 'A. Strict Legal Standards',
      anchor: '#standards',
      summary: 'We require valid legal process (warrants, court orders) before disclosing any user or workspace information.',
    },
    {
      section: 'B. Customer Notification Policy',
      anchor: '#notification',
      summary: 'We notify affected customers before responding unless legally prohibited by a valid non-disclosure order.',
    },
    {
      section: 'C. Annual Transparency Reports',
      anchor: '#transparency',
      summary: 'Vulnix publishes annual summaries detailing the number and types of legal requests received.',
    },
  ],
  sections: [
    {
      id: 'standards',
      number: 'A',
      title: 'Strict Legal Process Requirements',
      content: [
        'Vulnix will not disclose customer data or proprietary source code to government entities without valid legal process, such as a search warrant issued under the Stored Communications Act upon a showing of probable cause.',
        'We scrutinize all requests for overbreadth and will challenge subpoenas that lack legal jurisdiction or clear specificity.',
      ],
    },
    {
      id: 'notification',
      number: 'B',
      title: 'Customer Notification',
      content: [
        'Our policy is to give affected customers notice before disclosing their data so they have an opportunity to challenge the request in court, unless prohibited by statutory gag order or imminent physical threat.',
      ],
    },
    {
      id: 'transparency',
      number: 'C',
      title: 'Transparency Reporting',
      content: [
        'Vulnix publishes regular transparency reports documenting the aggregate volume of law enforcement requests and national security letters received.',
      ],
    },
  ],
}

export const SECURITY_OVERVIEW_DATA = {
  id: 'security-overview',
  title: 'Security Overview & Encryption',
  category: 'Security Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.5',
  description: 'Technical architecture, cryptographic controls, sandbox isolation, and compliance certifications.',
  summary: [
    {
      section: 'A. Encryption in Transit & at Rest',
      anchor: '#encryption',
      summary: 'Enforced TLS 1.3 with HSTS and AES-256 GCM encryption across all databases, artifacts, and caches.',
    },
    {
      section: 'B. Ephemeral Worker Sandboxes',
      anchor: '#worker-sandboxes',
      summary: 'Scan execution runs in hardened, disposable microVMs with no persistent disk state.',
      highlight: 'Zero persistent disk.',
    },
    {
      section: 'C. SOC 2 Type II & ISO 27001',
      anchor: '#certifications',
      summary: 'Annual third-party audit reports and continuous security posture monitoring.',
    },
  ],
  sections: [
    {
      id: 'encryption',
      number: 'A',
      title: 'Cryptographic Standards & Key Management',
      content: [
        'All traffic between developer machines, CI/CD runners, and Vulnix cloud endpoints enforces HTTPS with TLS 1.3 and PFS.',
        'Customer scan findings, audit histories, and authentication tokens are encrypted at rest using AES-256 with keys managed through hardware security modules (HSMs).',
      ],
    },
    {
      id: 'worker-sandboxes',
      number: 'B',
      title: 'Ephemeral Worker Sandboxes',
      content: [
        'Code analysis occurs within isolated, ephemeral microVM containers. The worker filesystem is destroyed and sanitized immediately upon scan completion.',
        'Worker environments have strictly limited egress network access and cannot communicate with other active worker nodes.',
      ],
    },
    {
      id: 'certifications',
      number: 'C',
      title: 'Compliance Certifications & Pen Testing',
      content: [
        'Vulnix maintains annual SOC 2 Type II attestation (covering Security, Availability, and Confidentiality trust principles) and ISO/IEC 27001 certification.',
        'Independent third-party penetration tests are conducted biannually against our cloud infrastructure and scanning engine.',
      ],
    },
  ],
}

export const INCIDENT_RESPONSE_DATA = {
  id: 'incident-response',
  title: 'Incident Response & Customer Notice',
  category: 'Security Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Protocols for detecting, investigating, containing, and communicating security incidents affecting the platform.',
  summary: [
    {
      section: 'A. Incident Classification & Triage',
      anchor: '#triage',
      summary: 'Severity levels, on-call paging, and immediate containment protocols.',
    },
    {
      section: 'B. 72-Hour Breach Notification',
      anchor: '#breach-notice',
      summary: 'We commit to notifying affected workspace owners within 72 hours of confirming a security compromise.',
      highlight: '72-hour notice SLA.',
    },
    {
      section: 'C. Post-Incident Reviews & Remediation',
      anchor: '#post-mortem',
      summary: 'Transparent public post-mortems and preventative security engineering follow-ups.',
    },
  ],
  sections: [
    {
      id: 'triage',
      number: 'A',
      title: 'Incident Detection & Containment',
      content: [
        'Vulnix maintains a 24/7/365 Security Operations and Incident Response team with automated SIEM alerting on abnormal token access, sandbox anomalies, or elevated API error spikes.',
      ],
    },
    {
      id: 'breach-notice',
      number: 'B',
      title: '72-Hour Breach Notification Commitment',
      content: [
        'In the event of a verified security incident resulting in unauthorized access to Customer Content or Personal Data, Vulnix will notify affected account owners without undue delay and within 72 hours of confirmation.',
        'Notifications will detail the nature of the breach, affected repository identifiers, recommended mitigation actions, and our ongoing containment status.',
      ],
    },
    {
      id: 'post-mortem',
      number: 'C',
      title: 'Post-Mortems & Transparency',
      content: [
        'Following any major security or availability incident, Vulnix publishes a detailed technical post-mortem outlining the root cause, timeline of events, and preventative engineering changes implemented.',
      ],
    },
  ],
}

export const ETHICS_CODE_DATA = {
  id: 'ethics-code',
  title: 'Code of Ethics & Business Conduct',
  category: 'Vulnix Company Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Ethical standards and operational responsibilities guiding Vulnix directors, officers, employees, and contractors.',
  summary: [
    {
      section: 'A. Ethical Standards & Integrity',
      anchor: '#integrity',
      summary: 'Commitment to honesty, transparency, and accountability across all business practices.',
    },
    {
      section: 'B. Conflicts of Interest',
      anchor: '#conflicts',
      summary: 'Guidelines for preventing personal conflicts that compromise objective decision-making.',
    },
    {
      section: 'C. Whistleblower Protection',
      anchor: '#whistleblower',
      summary: 'Confidential reporting channels with zero retaliation for reporting suspected wrongdoing.',
    },
  ],
  sections: [
    {
      id: 'integrity',
      number: 'A',
      title: 'Ethical Standards & Integrity',
      content: [
        'Vulnix conducts its business with the highest standards of integrity, compliance, and ethical responsibility.',
        'Employees must comply with all applicable local, national, and international laws, including export control and trade compliance regulations.',
      ],
    },
    {
      id: 'conflicts',
      number: 'B',
      title: 'Conflicts of Interest',
      content: [
        'All personnel must avoid situations where personal interests conflict, or appear to conflict, with the interests of Vulnix or its customers.',
      ],
    },
    {
      id: 'whistleblower',
      number: 'C',
      title: 'Whistleblower Protections',
      content: [
        'Vulnix maintains an anonymous whistleblower reporting portal. We strictly prohibit retaliation of any kind against anyone who reports suspected violations in good faith.',
      ],
    },
  ],
}

export const ANTI_CORRUPTION_DATA = {
  id: 'anti-corruption',
  title: 'Anti-Bribery & Corruption Policy',
  category: 'Vulnix Company Policies',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Strict prohibition of bribery, kickbacks, and corrupt business payments under the FCPA and UK Bribery Act.',
  summary: [
    {
      section: 'A. Zero-Tolerance Policy',
      anchor: '#zero-tolerance',
      summary: 'Strict prohibition against offering, giving, or receiving bribes in any business dealings.',
    },
    {
      section: 'B. Gifts & Hospitality Guidelines',
      anchor: '#gifts',
      summary: 'Limits on business meals and promotional items to ensure transparency and compliance.',
    },
    {
      section: 'C. Third-Party Due Diligence',
      anchor: '#due-diligence',
      summary: 'Vetting of vendors, resellers, and international commercial partners.',
    },
  ],
  sections: [
    {
      id: 'zero-tolerance',
      number: 'A',
      title: 'Zero Tolerance for Bribery',
      content: [
        'Vulnix maintains zero tolerance for bribery and corruption in all jurisdictions where we operate, complying with the U.S. Foreign Corrupt Practices Act (FCPA) and UK Bribery Act 2010.',
      ],
    },
    {
      id: 'gifts',
      number: 'B',
      title: 'Gifts & Corporate Hospitality',
      content: [
        'Gifts, entertainment, or hospitality of value must never be offered to influence official actions, obtain commercial advantages, or induce improper performance.',
      ],
    },
    {
      id: 'due-diligence',
      number: 'C',
      title: 'Partner Due Diligence',
      content: [
        'All commercial resellers, channel partners, and suppliers must undergo anti-corruption compliance vetting before engagement.',
      ],
    },
  ],
}

export const PREVIEW_TERMS_DATA = {
  id: 'preview-terms',
  title: 'Vulnix Pre-Release & Preview Terms',
  category: 'Vulnix Terms',
  effectiveDate: 'October 25, 2026',
  version: '2.0',
  description: 'Terms governing early-access beta features, experimental scanners, and preview software releases.',
  summary: [
    {
      section: 'A. Beta Feature Designation',
      anchor: '#beta-features',
      summary: 'Features marked as Beta, Alpha, or Preview are provided for testing and evaluation purposes.',
    },
    {
      section: 'B. As-Is Availability & Feedback',
      anchor: '#as-is',
      summary: 'Preview features are provided as-is without standard SLA guarantees or uptime commitments.',
    },
    {
      section: 'C. Termination of Previews',
      anchor: '#termination-previews',
      summary: 'Vulnix may modify or discontinue beta features at any time without advance notice.',
    },
  ],
  sections: [
    {
      id: 'beta-features',
      number: 'A',
      title: 'Beta & Preview Feature Designation',
      content: [
        'Vulnix may offer experimental features labeled as “Beta”, “Preview”, or “Early Access”. These features allow users to evaluate upcoming security capabilities before general availability.',
      ],
    },
    {
      id: 'as-is',
      number: 'B',
      title: 'Experimental Status & No SLA',
      content: [
        'Preview features are provided “AS IS” and may contain bugs, defects, or incomplete detection heuristics. Standard SLA uptime commitments do not apply to preview features.',
      ],
    },
    {
      id: 'termination-previews',
      number: 'C',
      title: 'Feedback & Modifications',
      content: [
        'We welcome your feedback on preview features. Vulnix may modify, pause, or withdraw preview features at any time.',
      ],
    },
  ],
}

export const LEGAL_REGISTRY = {
  terms: TERMS_OF_SERVICE_DATA,
  'corporate-terms': CORPORATE_TERMS_DATA,
  'ai-terms': AI_TERMS_DATA,
  'preview-terms': PREVIEW_TERMS_DATA,
  'acceptable-use': ACCEPTABLE_USE_DATA,
  'community-guidelines': COMMUNITY_GUIDELINES_DATA,
  'code-of-conduct': CODE_OF_CONDUCT_DATA,
  dmca: DMCA_DATA,
  'trademark-policy': TRADEMARK_DATA,
  'government-requests': GOVERNMENT_REQUESTS_DATA,
  'bug-bounty': BUG_BOUNTY_DATA,
  'security-disclosure': SECURITY_DISCLOSURE_DATA,
  'security-overview': SECURITY_OVERVIEW_DATA,
  'incident-response': INCIDENT_RESPONSE_DATA,
  privacy: PRIVACY_POLICY_DATA,
  dpa: DPA_DATA,
  subprocessors: SUBPROCESSORS_DATA,
  'privacy-settings': PRIVACY_SETTINGS_DATA,
  'ethics-code': ETHICS_CODE_DATA,
  'anti-corruption': ANTI_CORRUPTION_DATA,
  sla: SLA_DATA,
}

