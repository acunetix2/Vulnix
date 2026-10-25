import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Spinner } from './components/app/Spinner'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { setUnauthorizedHandler } from './services/api'
import { Layout } from './components/layout/Layout'
import { Landing } from './pages/Landing'
import { SignIn } from './pages/SignIn'
import { SignUp } from './pages/SignUp'
import { ForgotPassword } from './pages/ForgotPassword'
import { AuthCallback } from './pages/AuthCallback'
import { Dashboard } from './pages/Dashboard'
import { Projects } from './pages/Projects'
import { ProjectDetail } from './pages/ProjectDetail'
import { AuditRuns } from './pages/AuditRuns'
import { AuditRunDetail } from './pages/AuditRunDetail'
import { NewScan } from './pages/NewScan'
import { AuditFindings } from './pages/AuditFindings'
import { FindingDetail } from './pages/FindingDetail'
import { Settings } from './pages/Settings'
import { AISecurityReview } from './pages/AISecurityReview'
import { ReportsDashboard } from './pages/ReportsDashboard'
import { DependencyDashboard } from './pages/DependencyDashboard'
import { SecretsDashboard } from './pages/SecretsDashboard'
import { NotificationsCenter } from './pages/NotificationsCenter'
import { ScannerManagement } from './pages/ScannerManagement'
import { Integrations } from './pages/Integrations'
import { SlackIntegration } from './pages/SlackIntegration'
import { JiraIntegration } from './pages/JiraIntegration'
import { GitHubIntegration } from './pages/GitHubIntegration'
import { WebhooksConfig } from './pages/WebhooksConfig'
import { BulkTriage } from './pages/BulkTriage'
import { FindingHistory } from './pages/FindingHistory'
import { ComplianceDashboard } from './pages/ComplianceDashboard'
import { ApiDocs } from './pages/ApiDocs'
import { NotFound } from './pages/NotFound'
import { AccessDenied } from './pages/AccessDenied'
import { HelpCenter } from './pages/HelpCenter'

// Landing (public marketing) pages
import { Pricing } from './pages/landing/Pricing'
import { CodeScanning } from './pages/landing/product/CodeScanning'
import { AIReview } from './pages/landing/product/AIReview'
import { Secrets } from './pages/landing/product/Secrets'
import { Dependencies } from './pages/landing/product/Dependencies'
import { Compliance } from './pages/landing/product/Compliance'
import { Integrations as IntegrationsLanding } from './pages/landing/product/Integrations'
import { Reports } from './pages/landing/product/Reports'
import { FeatureCatalog } from './pages/landing/product/FeatureCatalog'
import { AIBuilders } from './pages/landing/solutions/AIBuilders'
import { NoCode } from './pages/landing/solutions/NoCode'
import { Beginners } from './pages/landing/solutions/Beginners'
import { Developers } from './pages/landing/solutions/Developers'
import { PostgresDevs } from './pages/landing/solutions/PostgresDevs'
import { VibeCoders } from './pages/landing/solutions/VibeCoders'
import { HackathonContestants } from './pages/landing/solutions/HackathonContestants'
import { Startups } from './pages/landing/solutions/Startups'
import { Agencies } from './pages/landing/solutions/Agencies'
import { Enterprise } from './pages/landing/solutions/Enterprise'
import { Blog } from './pages/landing/resources/Blog'
import { Support } from './pages/landing/resources/Support'
import { SystemStatus } from './pages/landing/resources/SystemStatus'
import { BecomePartner } from './pages/landing/resources/BecomePartner'
import { PartnerCatalog } from './pages/landing/resources/PartnerCatalog'
import { BrandAssets } from './pages/landing/resources/BrandAssets'
import { SecurityCompliance } from './pages/landing/resources/SecurityCompliance'
import { Regions } from './pages/landing/resources/Regions'
import { SOC2 } from './pages/landing/resources/SOC2'
import { LawyersTxt } from './pages/landing/resources/LawyersTxt'
import { HumansTxt } from './pages/landing/resources/HumansTxt'
import { Docs } from './pages/landing/developers/Docs'
import { VulnixLibrary } from './pages/landing/developers/VulnixLibrary'
import { Changelog } from './pages/landing/developers/Changelog'
import { RSS } from './pages/landing/developers/RSS'
import { Contributing } from './pages/landing/developers/Contributing'
import { OpenSource } from './pages/landing/developers/OpenSource'
import { DevTo } from './pages/landing/developers/DevTo'
import { Events } from './pages/landing/community/Events'
import { Champions } from './pages/landing/community/Champions'
import { Company } from './pages/landing/company/Company'
import { Careers } from './pages/landing/company/Careers'
import { GeneralAvailability } from './pages/landing/company/GeneralAvailability'
import { LegalHub } from './pages/landing/legal/LegalHub'
import { PrivacyPolicy } from './pages/landing/legal/PrivacyPolicy'
import { TermsOfService } from './pages/landing/legal/TermsOfService'
import { AcceptableUse } from './pages/landing/legal/AcceptableUse'
import { PrivacySettings } from './pages/landing/legal/PrivacySettings'
import { CorporateTerms } from './pages/landing/legal/CorporateTerms'
import { AITerms } from './pages/landing/legal/AITerms'
import { SecurityDisclosure } from './pages/landing/legal/SecurityDisclosure'
import { DPA } from './pages/landing/legal/DPA'
import { Subprocessors } from './pages/landing/legal/Subprocessors'
import { SLA } from './pages/landing/legal/SLA'
import { BugBounty } from './pages/landing/legal/BugBounty'
import { SecurityOverview } from './pages/landing/legal/SecurityOverview'
import { IncidentResponse } from './pages/landing/legal/IncidentResponse'
import { CommunityGuidelines } from './pages/landing/legal/CommunityGuidelines'
import { CodeOfConduct } from './pages/landing/legal/CodeOfConduct'
import { DMCAPolicy } from './pages/landing/legal/DMCAPolicy'
import { TrademarkPolicy } from './pages/landing/legal/TrademarkPolicy'
import { GovernmentRequests } from './pages/landing/legal/GovernmentRequests'
import { EthicsCode } from './pages/landing/legal/EthicsCode'
import { AntiCorruption } from './pages/landing/legal/AntiCorruption'
import { PreviewTerms } from './pages/landing/legal/PreviewTerms'

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

/**
 * One guard-loading state for both route guards. It fills the viewport because
 * it can render before `Layout` exists.
 */
function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-5">
      <div className="flex flex-col items-center gap-3 text-center" role="status" aria-live="polite">
        <Spinner className="size-6" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <RouteLoading />
  }

  return isAuthenticated ? children : <Navigate to="/signin" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <RouteLoading />
  }

  return isAuthenticated ? <Navigate to="/app/dashboard" replace /> : children
}

/**
 * Runs and findings moved under Audits. The destination is rebuilt from the
 * pathname so a link made before the rename still lands on the same record.
 */
function LegacyAuditRedirect() {
  const { pathname, search } = useLocation()
  const to = pathname
    .replace('/app/scans', '/app/audits/runs')
    .replace('/app/findings', '/app/audits/findings')

  return <Navigate to={`${to}${search}`} replace />
}

/**
 * A 401 against a token the console actually sent means the session is over, not
 * that one panel failed. It has to be said from inside the router, which is why
 * it is not in the auth provider.
 */
function SessionGuard() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      navigate('/signin', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [logout, navigate])

  return null
}

function ThemeToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="top-right" richColors duration={4000} />
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <SessionGuard />
          <ThemeToaster />
          <ScrollToTop />
          <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/help/:topicId" element={<HelpCenter />} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUp />
              </PublicRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPassword />
              </PublicRoute>
            }
          />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/pricing" element={<Pricing />} />

          {/* Product */}
          <Route path="/product/scanning" element={<CodeScanning />} />
          <Route path="/product/ai-review" element={<AIReview />} />
          <Route path="/product/secrets" element={<Secrets />} />
          <Route path="/product/dependencies" element={<Dependencies />} />
          <Route path="/product/compliance" element={<Compliance />} />
          <Route path="/product/integrations" element={<IntegrationsLanding />} />
          <Route path="/product/reports" element={<Reports />} />
          <Route path="/product/features" element={<FeatureCatalog />} />

          {/* Solutions */}
          <Route path="/solutions/ai-builders" element={<AIBuilders />} />
          <Route path="/solutions/no-code" element={<NoCode />} />
          <Route path="/solutions/beginners" element={<Beginners />} />
          <Route path="/solutions/developers" element={<Developers />} />
          <Route path="/solutions/postgres-devs" element={<PostgresDevs />} />
          <Route path="/solutions/vibe-coders" element={<VibeCoders />} />
          <Route path="/solutions/hackathon-contestants" element={<HackathonContestants />} />
          <Route path="/solutions/startups" element={<Startups />} />
          <Route path="/solutions/agencies" element={<Agencies />} />
          <Route path="/solutions/enterprise" element={<Enterprise />} />

          {/* Resources */}
          <Route path="/resources/blog" element={<Blog />} />
          <Route path="/resources/support" element={<Support />} />
          <Route path="/resources/status" element={<SystemStatus />} />
          <Route path="/resources/partners" element={<BecomePartner />} />
          <Route path="/resources/partner-catalog" element={<PartnerCatalog />} />
          <Route path="/resources/brand" element={<BrandAssets />} />
          <Route path="/resources/security" element={<SecurityCompliance />} />
          <Route path="/resources/regions" element={<Regions />} />
          <Route path="/resources/soc2" element={<SOC2 />} />
          <Route path="/resources/lawyers" element={<LawyersTxt />} />
          <Route path="/resources/humans" element={<HumansTxt />} />

          {/* Documentation - open public routes */}
          <Route path="/docs" element={<Navigate to="/docs/overview" replace />} />
          <Route path="/docs/:docId" element={<ApiDocs />} />
          <Route path="/api-docs" element={<Navigate to="/docs/overview" replace />} />

          {/* Developers */}
          <Route path="/developers/docs" element={<Docs />} />
          <Route path="/developers/library" element={<VulnixLibrary />} />
          <Route path="/developers/changelog" element={<Changelog />} />
          <Route path="/developers/rss" element={<RSS />} />
          <Route path="/developers/contributing" element={<Contributing />} />
          <Route path="/developers/open-source" element={<OpenSource />} />
          <Route path="/developers/devto" element={<DevTo />} />

          {/* Community */}
          <Route path="/community/events" element={<Events />} />
          <Route path="/community/champions" element={<Champions />} />

          {/* Company */}
          <Route path="/company" element={<Company />} />
          <Route path="/company/careers" element={<Careers />} />
          <Route path="/company/general-availability" element={<GeneralAvailability />} />

          {/* Legal */}
          <Route path="/legal" element={<LegalHub />} />
          <Route path="/legal/terms" element={<TermsOfService />} />
          <Route path="/legal/corporate-terms" element={<CorporateTerms />} />
          <Route path="/legal/ai-terms" element={<AITerms />} />
          <Route path="/legal/preview-terms" element={<PreviewTerms />} />
          <Route path="/legal/acceptable-use" element={<AcceptableUse />} />
          <Route path="/legal/community-guidelines" element={<CommunityGuidelines />} />
          <Route path="/legal/code-of-conduct" element={<CodeOfConduct />} />
          <Route path="/legal/dmca" element={<DMCAPolicy />} />
          <Route path="/legal/trademark-policy" element={<TrademarkPolicy />} />
          <Route path="/legal/government-requests" element={<GovernmentRequests />} />
          <Route path="/legal/bug-bounty" element={<BugBounty />} />
          <Route path="/legal/security-disclosure" element={<SecurityDisclosure />} />
          <Route path="/legal/security-overview" element={<SecurityOverview />} />
          <Route path="/legal/incident-response" element={<IncidentResponse />} />
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/dpa" element={<DPA />} />
          <Route path="/legal/subprocessors" element={<Subprocessors />} />
          <Route path="/legal/privacy-settings" element={<PrivacySettings />} />
          <Route path="/legal/ethics-code" element={<EthicsCode />} />
          <Route path="/legal/anti-corruption" element={<AntiCorruption />} />
          <Route path="/legal/sla" element={<SLA />} />

          {/* Protected routes - using /app prefix */}
          <Route
            path="/app"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:projectId/scan" element={<NewScan />} />
            <Route path="audits" element={<Navigate to="/app/audits/runs" replace />} />
            <Route path="audits/runs" element={<AuditRuns />} />
            <Route path="audits/runs/:id" element={<AuditRunDetail />} />
            <Route path="audits/findings" element={<AuditFindings />} />
            <Route path="audits/findings/:id" element={<FindingDetail />} />
            <Route path="audits/findings/:id/history" element={<FindingHistory />} />
            {/* Runs and findings used to be two top-level destinations. Old
                bookmarks and notification payloads keep their path and query. */}
            <Route path="scans" element={<LegacyAuditRedirect />} />
            <Route path="scans/*" element={<LegacyAuditRedirect />} />
            <Route path="findings" element={<LegacyAuditRedirect />} />
            <Route path="findings/*" element={<LegacyAuditRedirect />} />
            <Route path="bulk-triage" element={<BulkTriage />} />
            <Route path="compliance" element={<ComplianceDashboard />} />
            <Route path="ai-review" element={<AISecurityReview />} />
            <Route path="reports" element={<ReportsDashboard />} />
            <Route path="dependencies" element={<DependencyDashboard />} />
            <Route path="secrets" element={<SecretsDashboard />} />
            <Route path="notifications" element={<NotificationsCenter />} />
            <Route path="scanners" element={<ScannerManagement />} />
            <Route path="team" element={<Navigate to="/app/settings/members" replace />} />
            <Route path="integrations" element={<Integrations />} />
            <Route path="integrations/slack" element={<SlackIntegration />} />
            <Route path="integrations/jira" element={<JiraIntegration />} />
            <Route path="integrations/github" element={<GitHubIntegration />} />
            <Route path="integrations/webhooks" element={<WebhooksConfig />} />
            <Route path="settings" element={<Navigate to="/app/settings/account" replace />} />
            <Route path="settings/:tab" element={<Settings />} />
            {/* One settings surface; the old destinations carry you to the tab they were. */}
            <Route path="profile" element={<Navigate to="/app/settings/account" replace />} />
            <Route path="workspace" element={<Navigate to="/app/settings/workspace" replace />} />
            <Route path="api-docs" element={<ApiDocs />} />
            <Route path="docs" element={<ApiDocs />} />
            <Route path="access-denied" element={<AccessDenied />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
