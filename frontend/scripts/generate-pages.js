// Script to generate placeholder pages for all Vulnix pages
// Run with: node scripts/generate-pages.js

const fs = require('fs');
const path = require('path');

const pageTemplate = (pageName, title, description) => `import { Construction } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'

export function ${pageName}() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          ${title}
        </h1>
        <p className="text-gray-600">
          ${description}
        </p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">Page Under Construction</h3>
          <p className="text-gray-600">
            This page is currently being developed and will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
`;

const pages = [
  // Public Pages
  { name: 'LandingPage', title: 'Welcome to Vulnix', description: 'AI-powered security analysis for your code' },
  { name: 'Features', title: 'Features', description: 'Discover what Vulnix can do for you' },
  { name: 'Pricing', title: 'Pricing', description: 'Choose the plan that fits your needs' },
  { name: 'Documentation', title: 'Documentation', description: 'Learn how to use Vulnix' },
  { name: 'SecurityPrivacy', title: 'Security & Privacy', description: 'How we protect your data' },
  { name: 'About', title: 'About Us', description: 'Learn more about Vulnix' },
  { name: 'Contact', title: 'Contact', description: 'Get in touch with us' },
  { name: 'Register', title: 'Create Account', description: 'Sign up for Vulnix' },
  { name: 'ForgotPassword', title: 'Forgot Password', description: 'Reset your password' },
  { name: 'ResetPassword', title: 'Reset Password', description: 'Create a new password' },
  { name: 'EmailVerification', title: 'Verify Email', description: 'Verify your email address' },
  { name: 'VerificationSuccess', title: 'Email Verified', description: 'Your email has been verified' },
  { name: 'TermsOfService', title: 'Terms of Service', description: 'Our terms and conditions' },
  { name: 'PrivacyPolicy', title: 'Privacy Policy', description: 'How we handle your privacy' },
  { name: 'CookiePolicy', title: 'Cookie Policy', description: 'How we use cookies' },
  
  // Scanning
  { name: 'RepositorySelection', title: 'Select Repository', description: 'Choose a repository to scan' },
  { name: 'ScanConfiguration', title: 'Scan Configuration', description: 'Configure your security scan' },
  { name: 'ScanProgress', title: 'Scan Progress', description: 'Monitor your scan in real-time' },
  { name: 'ScanResults', title: 'Scan Results', description: 'Review scan results' },
  { name: 'ScanHistory', title: 'Scan History', description: 'View past scans' },
  { name: 'ScanComparison', title: 'Scan Comparison', description: 'Compare scan results' },
  { name: 'FailedScans', title: 'Failed Scans', description: 'Review failed scans' },
  { name: 'ScanQueue', title: 'Scan Queue', description: 'Manage queued scans' },
  { name: 'ScheduledScans', title: 'Scheduled Scans', description: 'Manage scheduled scans' },
  { name: 'ScanConfigTemplates', title: 'Configuration Templates', description: 'Manage scan configuration templates' },
  
  // Security Findings
  { name: 'CriticalFindings', title: 'Critical Findings', description: 'Critical security issues requiring immediate attention' },
  { name: 'HighSeverityFindings', title: 'High-Severity Findings', description: 'High-priority security issues' },
  { name: 'NewFindings', title: 'New Findings', description: 'Recently discovered security issues' },
  { name: 'ResolvedFindings', title: 'Resolved Findings', description: 'Issues that have been fixed' },
  { name: 'RecurringFindings', title: 'Recurring Findings', description: 'Issues that keep appearing' },
  { name: 'SuppressedFindings', title: 'Suppressed Findings', description: 'Intentionally ignored findings' },
  { name: 'FalsePositiveReview', title: 'False Positive Review', description: 'Review potential false positives' },
  { name: 'TriageQueue', title: 'Triage Queue', description: 'Prioritize and assign findings' },
  { name: 'BulkFindingsReview', title: 'Bulk Review', description: 'Review multiple findings at once' },
  { name: 'FindingComments', title: 'Finding Comments', description: 'Team discussions on findings' },
  { name: 'FindingAssignment', title: 'Assign Finding', description: 'Assign findings to team members' },
  { name: 'FindingHistory', title: 'Finding History', description: 'Track finding changes over time' },
  { name: 'SavedFilters', title: 'Saved Filters', description: 'Manage your saved finding filters' },
  
  // AI Analysis
  { name: 'AICodeReview', title: 'AI Code Review', description: 'AI-powered code security review' },
  { name: 'AISecurityAssistant', title: 'AI Security Assistant', description: 'Chat with AI security expert' },
  { name: 'AIRiskPrioritization', title: 'AI Risk Prioritization', description: 'AI-assisted risk ranking' },
  { name: 'AIFalsePositiveAnalysis', title: 'AI False Positive Analysis', description: 'Identify false positives with AI' },
  { name: 'AIRemediationSuggestions', title: 'AI Remediation Suggestions', description: 'Get AI-powered fix suggestions' },
  { name: 'AIPatchReview', title: 'AI Patch Review', description: 'Review code fixes with AI' },
  { name: 'AIFixVerification', title: 'AI Fix Verification', description: 'Verify fixes with AI analysis' },
  { name: 'AIAnalysisHistory', title: 'AI Analysis History', description: 'Past AI analyses' },
  { name: 'AIModelConfiguration', title: 'AI Model Configuration', description: 'Configure AI models' },
  { name: 'AIUsageLimits', title: 'AI Usage & Limits', description: 'Monitor AI usage and quotas' },
  { name: 'AIEvaluationDashboard', title: 'AI Evaluation Dashboard', description: 'AI performance metrics' },
  
  // Remediation
  { name: 'RemediationDashboard', title: 'Remediation Dashboard', description: 'Track remediation progress' },
  { name: 'RemediationDetails', title: 'Remediation Details', description: 'Detailed remediation information' },
  { name: 'CodeDiffViewer', title: 'Code Diff Viewer', description: 'Compare code changes' },
  { name: 'SuggestedFixReview', title: 'Review Suggested Fix', description: 'Review AI-suggested code fixes' },
  { name: 'FixApproval', title: 'Fix Approval', description: 'Approve code fixes' },
  { name: 'FixVerificationResults', title: 'Fix Verification', description: 'Verification results' },
  { name: 'RemediationHistory', title: 'Remediation History', description: 'Past remediation efforts' },
  { name: 'RemediationTasks', title: 'Remediation Tasks', description: 'Manage fix tasks' },
  { name: 'RemediationProgress', title: 'Remediation Progress', description: 'Track fix progress' },
  
  // Security Engines
  { name: 'ScannerOverview', title: 'Scanner Overview', description: 'Security scanner status' },
  { name: 'ScannerConfiguration', title: 'Scanner Configuration', description: 'Configure security scanners' },
  { name: 'SemgrepConfig', title: 'Semgrep Configuration', description: 'Configure Semgrep scanner' },
  { name: 'GitleaksConfig', title: 'Gitleaks Configuration', description: 'Configure Gitleaks scanner' },
  { name: 'BanditConfig', title: 'Bandit Configuration', description: 'Configure Bandit scanner' },
  { name: 'DependencyScannerConfig', title: 'Dependency Scanner', description: 'Configure dependency scanner' },
  { name: 'TrivyConfig', title: 'Trivy Configuration', description: 'Configure Trivy scanner' },
  { name: 'ScannerRules', title: 'Scanner Rules', description: 'Manage scanner rules' },
  { name: 'ScannerHealth', title: 'Scanner Health', description: 'Monitor scanner health' },
  { name: 'ScannerExecutionLogs', title: 'Scanner Logs', description: 'View scanner execution logs' },
  { name: 'ScannerCoverage', title: 'Scanner Coverage', description: 'Scanner coverage analysis' },
  { name: 'ScannerErrorDetails', title: 'Scanner Error Details', description: 'Detailed scanner errors' },
  
  // Dependency Security
  { name: 'DependencyDashboard', title: 'Dependency Dashboard', description: 'Overview of dependency security' },
  { name: 'DependencyExplorer', title: 'Dependency Explorer', description: 'Explore project dependencies' },
  { name: 'VulnerableDependencies', title: 'Vulnerable Dependencies', description: 'Dependencies with known vulnerabilities' },
  { name: 'DependencyDetails', title: 'Dependency Details', description: 'Detailed dependency information' },
  { name: 'SBOM', title: 'Software Bill of Materials', description: 'Complete dependency inventory' },
  { name: 'DependencyRiskAnalysis', title: 'Dependency Risk Analysis', description: 'Assess dependency risks' },
  { name: 'DependencyUpdateRecommendations', title: 'Update Recommendations', description: 'Recommended dependency updates' },
  
  // Secret Detection
  { name: 'SecretsDashboard', title: 'Secrets Dashboard', description: 'Overview of detected secrets' },
  { name: 'DetectedSecrets', title: 'Detected Secrets', description: 'All detected secrets' },
  { name: 'SecretFindingDetails', title: 'Secret Details', description: 'Detailed secret information' },
  { name: 'SecretExposureHistory', title: 'Exposure History', description: 'Secret exposure timeline' },
  { name: 'SecretRemediationGuide', title: 'Secret Remediation Guide', description: 'How to remediate exposed secrets' },
  
  // Reports & Analytics
  { name: 'ReportsDashboard', title: 'Reports Dashboard', description: 'Security reports overview' },
  { name: 'GenerateReport', title: 'Generate Report', description: 'Create new security report' },
  { name: 'ReportDetails', title: 'Report Details', description: 'View report details' },
  { name: 'ExecutiveSummary', title: 'Executive Summary', description: 'High-level security summary' },
  { name: 'TechnicalSecurityReport', title: 'Technical Report', description: 'Detailed technical security report' },
  { name: 'VulnerabilityTrends', title: 'Vulnerability Trends', description: 'Vulnerability trends over time' },
  { name: 'RiskTrends', title: 'Risk Trends', description: 'Security risk trends' },
  { name: 'RemediationMetrics', title: 'Remediation Metrics', description: 'Track remediation effectiveness' },
  { name: 'ScanPerformanceAnalytics', title: 'Scan Performance', description: 'Scanner performance analytics' },
  { name: 'ExportHistory', title: 'Export History', description: 'Past report exports' },
  
  // Integrations
  { name: 'IntegrationsOverview', title: 'Integrations', description: 'Connected services and tools' },
  { name: 'GitHubIntegration', title: 'GitHub Integration', description: 'Connect with GitHub' },
  { name: 'GitLabIntegration', title: 'GitLab Integration', description: 'Connect with GitLab' },
  { name: 'BitbucketIntegration', title: 'Bitbucket Integration', description: 'Connect with Bitbucket' },
  { name: 'RepositoryConnections', title: 'Repository Connections', description: 'Manage connected repositories' },
  { name: 'RepositoryDetails', title: 'Repository Details', description: 'Repository connection details' },
  { name: 'CICDIntegration', title: 'CI/CD Integration', description: 'Integrate with CI/CD pipelines' },
  { name: 'GitHubActionsSetup', title: 'GitHub Actions Setup', description: 'Setup GitHub Actions integration' },
  { name: 'GitLabCISetup', title: 'GitLab CI Setup', description: 'Setup GitLab CI integration' },
  { name: 'Webhooks', title: 'Webhooks', description: 'Manage webhooks' },
  { name: 'APIIntegrationGuide', title: 'API Integration Guide', description: 'API integration documentation' },
  { name: 'IntegrationActivity', title: 'Integration Activity', description: 'Integration activity log' },
  { name: 'IntegrationPermissions', title: 'Integration Permissions', description: 'Manage integration permissions' },
  
  // Team & Collaboration
  { name: 'TeamDashboard', title: 'Team Dashboard', description: 'Team overview' },
  { name: 'TeamMembers', title: 'Team Members', description: 'Manage team members' },
  { name: 'InviteMember', title: 'Invite Member', description: 'Invite new team member' },
  { name: 'MemberDetails', title: 'Member Details', description: 'Team member details' },
  { name: 'RolesPermissions', title: 'Roles & Permissions', description: 'Manage roles and permissions' },
  { name: 'TeamsGroups', title: 'Teams & Groups', description: 'Organize team members' },
  { name: 'TeamActivity', title: 'Team Activity', description: 'Team activity log' },
  { name: 'SharedProjects', title: 'Shared Projects', description: 'Projects shared with team' },
  { name: 'CollaborationSettings', title: 'Collaboration Settings', description: 'Team collaboration settings' },
  
  // Notifications
  { name: 'NotificationsCenter', title: 'Notifications', description: 'All notifications' },
  { name: 'NotificationDetails', title: 'Notification Details', description: 'View notification details' },
  { name: 'NotificationPreferences', title: 'Notification Preferences', description: 'Configure notifications' },
  { name: 'EmailNotificationSettings', title: 'Email Notifications', description: 'Email notification settings' },
  { name: 'SecurityAlertRules', title: 'Security Alert Rules', description: 'Configure security alerts' },
  { name: 'AlertHistory', title: 'Alert History', description: 'Past security alerts' },
  
  // More pages... (continuing in next file due to length)
];

const pagesDir = path.join(__dirname, '..', 'src', 'pages');

// Create pages
pages.forEach(page => {
  const filePath = path.join(pagesDir, `${page.name}.jsx`);
  
  // Only create if doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, pageTemplate(page.name, page.title, page.description));
    console.log(`Created: ${page.name}.jsx`);
  } else {
    console.log(`Skipped: ${page.name}.jsx (already exists)`);
  }
});

console.log('\\nPage generation complete!');
