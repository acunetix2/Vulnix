import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Shield, 
  ShieldCheck,
  Zap, 
  Lock, 
  Code, 
  Check,
  CheckCircle2, 
  ArrowRight,
  Play,
  Star,
  Users,
  TrendingUp,
  FileCode,
  AlertTriangle,
  Bot,
  ChevronRight,
  Quote,
  Terminal,
  Database,
  Cloud,
  Layers,
  Target,
  Award,
  BarChart3,
  Rocket,
  Eye,
  CheckSquare,
  XCircle,
  Loader2,
  Clock,
  Activity,
  Globe,
  Key,
  FileSearch,
  GitPullRequest,
  FolderKanban,
  ScanSearch,
  LayoutDashboard,
  Building2,
  KeyRound,
  Package,
  FileText,
  Workflow,
  Settings,
  BookOpen,
  ChevronDown,
  Pause,
  RotateCcw,
  Sparkles,
  GitBranch,
  GitCommit,
  ExternalLink,
  Copy
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card } from '../components/ui/card'
import { IconTile } from '../components/app/IconTile'
import { HoverBorderGradient } from '../components/ui/hover-border-gradient'
import { BackgroundBoxesDemo } from '../components/app/BackgroundBoxesDemo'
import { VulnixLegalGraphicBanner } from './landing/legal/VulnixLegalGraphicBanner'
import { GitHub, GitLab, Google, Slack, XformerlyTwitter, LinkedIn } from '../components/icons'
import {
  ReactIcon, Nextjs, Vue, Angular, Astro, TailwindCSS, FastAPI, Spring,
  ReactQuery, Vitest, Python, JavaScript, Dart,
} from '../components/icons/tech'

const TECH_STACK = [
  { Icon: ReactIcon, label: 'React' },
  { Icon: Nextjs, label: 'Next.js' },
  { Icon: Vue, label: 'Vue' },
  { Icon: Angular, label: 'Angular' },
  { Icon: Astro, label: 'Astro' },
  { Icon: TailwindCSS, label: 'Tailwind CSS' },
  { Icon: FastAPI, label: 'FastAPI' },
  { Icon: Spring, label: 'Spring' },
  { Icon: ReactQuery, label: 'TanStack Query' },
  { Icon: Vitest, label: 'Vitest' },
  { Icon: Python, label: 'Python' },
  { Icon: JavaScript, label: 'JavaScript' },
  { Icon: Dart, label: 'Dart' },
]

export function Landing() {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanningCode, setScanningCode] = useState(false)
  const [detectedVulns, setDetectedVulns] = useState([])
  const [openFaq, setOpenFaq] = useState(0)
  const [animatedStats, setAnimatedStats] = useState({
    scans: 0,
    vulns: 0,
    teams: 0,
    uptime: 0
  })
  const [visibleSections, setVisibleSections] = useState({})
  const sectionRefs = useRef({})

  // Typewriter animation
  const heroLines = [
    'Find vulnerabilities.',
    'Understand risk.',
    'Fix with confidence.',
  ]
  const [typedLine, setTypedLine] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const target = heroLines[typedLine]
    let timeout
    if (!isDeleting && typedText.length < target.length) {
      timeout = setTimeout(() => setTypedText(target.slice(0, typedText.length + 1)), 55)
    } else if (!isDeleting && typedText.length === target.length) {
      timeout = setTimeout(() => setIsDeleting(true), 1400)
    } else if (isDeleting && typedText.length > 0) {
      timeout = setTimeout(() => setTypedText(target.slice(0, typedText.length - 1)), 28)
    } else if (isDeleting && typedText.length === 0) {
      setIsDeleting(false)
      setTypedLine((prev) => (prev + 1) % heroLines.length)
    }
    return () => clearTimeout(timeout)
  }, [typedText, isDeleting, typedLine])
  
  // Dashboard preview animation states
  const [demoStep, setDemoStep] = useState(0) // 0: Projects, 1: Multi-Engine Scanners, 2: AI Review Agent, 3: Verified Diff Fix
  const [isPlaying, setIsPlaying] = useState(true)
  const [activeSidebarItem, setActiveSidebarItem] = useState('projects')
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0, visible: false })
  const [isClicking, setIsClicking] = useState(false)
  const [engineProgress, setEngineProgress] = useState({ semgrep: 0, gitleaks: 0, bandit: 0, trivy: 0 })
  const [scannedLoc, setScannedLoc] = useState(0)
  const [scannedFiles, setScannedFiles] = useState(0)
  const [aiTraceStep, setAiTraceStep] = useState(0)
  const [prCreated, setPrCreated] = useState(false)
  const [activeTabFinding, setActiveTabFinding] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observers = []
    Object.keys(sectionRefs.current).forEach(key => {
      const element = sectionRefs.current[key]
      if (element) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setVisibleSections(prev => ({ ...prev, [key]: true }))
            }
          },
          { threshold: 0.1 }
        )
        observer.observe(element)
        observers.push(observer)
      }
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  // Animated stats counter
  useEffect(() => {
    if (visibleSections.stats) {
      const duration = 2000
      const steps = 60
      const interval = duration / steps
      let step = 0

      const timer = setInterval(() => {
        step++
        const progress = step / steps
        setAnimatedStats({
          scans: Math.floor(10000000 * progress),
          vulns: Math.floor(50000 * progress),
          teams: Math.floor(2500 * progress),
          uptime: Math.min(99.9, (99.9 * progress))
        })
        if (step >= steps) clearInterval(timer)
      }, interval)

      return () => clearInterval(timer)
    }
  }, [visibleSections.stats])

  // Live scanning simulation
  useEffect(() => {
    if (visibleSections.codeDemo && !scanningCode) {
      setScanningCode(true)
      setScanProgress(0)
      setDetectedVulns([])

      const vulnList = [
        { line: 23, type: 'SQL Injection', severity: 'critical', file: 'auth.py', delay: 800 },
        { line: 45, type: 'Hardcoded Secret', severity: 'high', file: 'config.js', delay: 1500 },
        { line: 67, type: 'XSS Vulnerability', severity: 'high', file: 'app.tsx', delay: 2200 },
        { line: 89, type: 'Weak Crypto', severity: 'medium', file: 'utils.py', delay: 3000 }
      ]

      // Progress animation
      const progressTimer = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressTimer)
            return 100
          }
          return prev + 2
        })
      }, 60)

      // Show vulnerabilities
      vulnList.forEach(vuln => {
        setTimeout(() => {
          setDetectedVulns(prev => [...prev, vuln])
        }, vuln.delay)
      })

      return () => clearInterval(progressTimer)
    }
  }, [visibleSections.codeDemo, scanningCode])

  // Dashboard preview animation lifecycle
  useEffect(() => {
    if (!visibleSections.dashboard) return

    let timers = []
    let intervals = []

    const registerTimeout = (fn, delay) => {
      const id = setTimeout(fn, delay)
      timers.push(id)
      return id
    }

    const registerInterval = (fn, delay) => {
      const id = setInterval(fn, delay)
      intervals.push(id)
      return id
    }

    if (demoStep === 0) {
      // Step 0: Projects & Repositories
      setActiveSidebarItem('projects')
      setCursorPosition({ x: 0, y: 0, visible: false })
      setPrCreated(false)

      // Move cursor to "Run Deep Audit" button on myapp-backend
      registerTimeout(() => {
        setCursorPosition({ x: 84, y: 28, visible: true })
      }, 700)

      // Click "Run Deep Audit"
      registerTimeout(() => {
        setIsClicking(true)
        registerTimeout(() => setIsClicking(false), 250)
      }, 2300)

      // Transition to Step 1 if playing
      if (isPlaying) {
        registerTimeout(() => {
          setCursorPosition({ x: 0, y: 0, visible: false })
          setDemoStep(1)
        }, 3600)
      }
    } else if (demoStep === 1) {
      // Step 1: Multi-Scanner Orchestration Engine
      setActiveSidebarItem('audits')
      setCursorPosition({ x: 0, y: 0, visible: false })
      setEngineProgress({ semgrep: 0, gitleaks: 0, bandit: 0, trivy: 0 })
      setScannedLoc(0)
      setScannedFiles(0)

      // Smooth progress counters
      const start = Date.now()
      const totalLoc = 89240
      const totalFiles = 1247
      const duration = 2600

      registerInterval(() => {
        const elapsed = Date.now() - start
        const progress = Math.min(1, elapsed / duration)
        
        setScannedLoc(Math.floor(totalLoc * progress))
        setScannedFiles(Math.floor(totalFiles * progress))

        setEngineProgress({
          semgrep: Math.min(100, Math.floor(progress * 115)),
          gitleaks: Math.min(100, Math.floor(progress * 130)),
          bandit: Math.min(100, Math.floor(progress * 105)),
          trivy: Math.min(100, Math.floor(progress * 100))
        })
      }, 45)

      // Transition to Step 2 if playing
      if (isPlaying) {
        registerTimeout(() => {
          setDemoStep(2)
        }, 5000)
      }
    } else if (demoStep === 2) {
      // Step 2: AI Security Review Agent
      setActiveSidebarItem('agents')
      setCursorPosition({ x: 0, y: 0, visible: false })
      setAiTraceStep(0)

      // Reveal AI reasoning steps
      registerTimeout(() => setAiTraceStep(1), 500)
      registerTimeout(() => setAiTraceStep(2), 1200)
      registerTimeout(() => setAiTraceStep(3), 2000)
      registerTimeout(() => setAiTraceStep(4), 2800)
      registerTimeout(() => setAiTraceStep(5), 3600)

      // Transition to Step 3 if playing
      if (isPlaying) {
        registerTimeout(() => {
          setDemoStep(3)
        }, 5200)
      }
    } else if (demoStep === 3) {
      // Step 3: Finding Triage & Verified Git Diff Patch
      setActiveSidebarItem('bulk-triage')
      setCursorPosition({ x: 0, y: 0, visible: false })
      setPrCreated(false)

      // Move cursor to "Create Pull Request #142" button
      registerTimeout(() => {
        setCursorPosition({ x: 74, y: 92, visible: true })
      }, 1200)

      // Click "Create Pull Request #142"
      registerTimeout(() => {
        setIsClicking(true)
        registerTimeout(() => setIsClicking(false), 250)
        setPrCreated(true)
      }, 2500)

      // Loop back to Step 0 if playing
      if (isPlaying) {
        registerTimeout(() => {
          setCursorPosition({ x: 0, y: 0, visible: false })
          setDemoStep(0)
        }, 5800)
      }
    }

    return () => {
      timers.forEach(clearTimeout)
      intervals.forEach(clearInterval)
    }
  }, [demoStep, isPlaying, visibleSections.dashboard])

  const stats = [
    { value: animatedStats.scans, label: 'Lines of Code Scanned', suffix: '+', format: 'M' },
    { value: animatedStats.vulns, label: 'Vulnerabilities Found', suffix: '+', format: 'K' },
    { value: animatedStats.teams, label: 'Security Teams', suffix: '+', format: '' },
    { value: animatedStats.uptime, label: 'Uptime SLA', suffix: '%', format: 'decimal' },
  ]

  const integrations = [
    { name: 'GitHub', icon: GitHub, connected: true },
    { name: 'GitLab', icon: GitLab, connected: true },
    { name: 'Bitbucket', icon: GitLab, connected: true },
    { name: 'Jenkins', icon: Layers, connected: true },
    { name: 'Slack', icon: Slack, connected: true },
    { name: 'Jira', icon: Target, connected: true },
    { name: 'AWS', icon: Cloud, connected: true },
    { name: 'Azure', icon: Cloud, connected: false },
  ]

  const faqs = [
    {
      category: 'Platform',
      question: 'How does Vulnix differ from other security tools?',
      answer: 'Vulnix brings source review, optional static-analysis and dependency tools, findings triage, and reporting together in one workspace. Instead of switching between separate scanner dashboards, your team can review results and track remediation in one place.',
      details: ['See which analyzers ran for each audit.', 'Review findings with file and line context.', 'Track remediation with shared triage states.'],
    },
    {
      category: 'Scanning',
      question: 'What programming languages do you support?',
      answer: 'Vulnix can review source across common languages and frameworks, including Python, JavaScript, TypeScript, Java, Go, C#, PHP, Ruby, Rust, Kotlin, and Swift. Exact rule coverage depends on the language, project files, and analyzers enabled for your workspace.',
      details: ['Dependency checks use the manifests and lockfiles in your project.', 'Optional scanner availability can vary by deployment.'],
    },
    {
      category: 'Source & privacy',
      question: 'How is my source code handled during a scan?',
      answer: 'A scan needs access to a source snapshot. You can provide a ZIP archive or import a repository through a connected provider; the snapshot is processed by the Vulnix service for the audit. Avoid uploading secrets or data you are not authorized to share.',
      details: ['Uploads are quarantined and subject to configured size and archive-safety limits.', 'Snapshots expire according to the server retention setting (7 days by default).'],
    },
    {
      category: 'Scanning',
      question: 'How long does a scan take?',
      answer: 'Duration depends on repository size, queued work, enabled analyzers, and whether optional scanner tools are available. You can follow each audit from its run page and inspect the analyzer trace to see what completed or was skipped.',
      details: ['Large projects can take longer than small projects.', 'An unavailable optional scanner is reported as skipped and does not by itself fail the audit.'],
    },
    {
      category: 'Integrations',
      question: 'Can I integrate Vulnix into my CI/CD pipeline?',
      answer: 'Vulnix provides a REST API, signed webhooks, and workspace integrations such as GitHub, Slack, and Jira. Use these building blocks to trigger scans and route audit events through your existing CI/CD workflow.',
      details: ['Webhook deliveries include event names and signed request headers.', 'The API reference is available from the documentation pages.'],
    },
    {
      category: 'Account & plans',
      question: 'What happens after the free trial?',
      answer: 'Available plans, pricing, and current trial terms are listed on the pricing page. Review those details before signing up, since plan limits and included features can change.',
      details: ['Compare plans on the pricing page.', 'Contact support for help choosing a plan or managing your account.'],
    },
    {
      category: 'Findings',
      question: 'How do teams review and track findings?',
      answer: 'Each finding includes its severity and source location, with supporting evidence when available. Team members can update its triage status, add a note, and follow progress from the audit and findings views.',
      details: ['Triage states include open, accepted risk, false positive, and fixed.', 'Changes are recorded in workspace activity.'],
    },
  ]

  const features = [
    {
      icon: Shield,
      title: 'Multi-Scanner Engine',
      description: 'Combine Semgrep, Bandit, Gitleaks, ESLint Security, Safety, and npm audit in one unified platform. Each scanner runs in parallel for maximum coverage and speed.',
      color: 'var(--color-purple)',
      stats: '30+ Languages'
    },
    {
      icon: Bot,
      title: 'AI-Powered Analysis',
      description: 'GPT-4 powered explanations transform cryptic security findings into actionable insights. Get context-aware fix suggestions with code examples.',
      color: 'var(--color-purple)',
      stats: '95% Accuracy'
    },
    {
      icon: Zap,
      title: 'Lightning Fast Scans',
      description: 'Scan 100K lines of code in under 3 minutes. Parallel processing and optimized algorithms ensure you never wait. Perfect for CI/CD integration.',
      color: 'var(--color-green)',
      stats: '< 3min Average'
    },
    {
      icon: Lock,
      title: 'Zero-Trust Security',
      description: 'Your source code never leaves your infrastructure. On-premise deployment, air-gapped scanning, and SOC 2 Type II certified. All data encrypted at rest and in transit.',
      color: 'var(--color-green)',
      stats: 'SOC 2 Certified'
    },
    {
      icon: Code,
      title: 'Developer-First Design',
      description: 'IDE extensions, CLI tools, Git hooks, and REST APIs. Findings linked directly to code lines with one-click navigation. Built by developers who understand your workflow.',
      color: 'var(--color-slate)',
      stats: '15+ Integrations'
    },
    {
      icon: TrendingUp,
      title: 'Continuous Monitoring',
      description: 'Track security metrics over time with trend analysis. Automated compliance reporting for OWASP Top 10, CWE, PCI-DSS, and HIPAA requirements.',
      color: 'var(--color-slate)',
      stats: 'Real-time Tracking'
    },
    {
      icon: Target,
      title: 'Smart Prioritization',
      description: 'AI-powered risk scoring considers exploitability, business impact, and exposure. Focus on what matters most with intelligent triage recommendations.',
      color: 'var(--color-purple)',
      stats: 'AI Risk Scoring'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Assign findings, track remediation progress, and maintain audit logs. Slack notifications, Jira tickets, and webhook integrations keep everyone aligned.',
      color: 'var(--color-green)',
      stats: 'Built for Teams'
    },
    {
      icon: Database,
      title: 'Dependency Scanning',
      description: 'Detect vulnerable packages across npm, pip, Maven, and more. Get real-time alerts when new CVEs affect your dependencies with automated patch recommendations.',
      color: 'var(--color-slate)',
      stats: '180M+ Packages'
    },
  ]

  const testimonials = [
    {
      quote: "Vulnix reduced our security review time from weeks to hours. The AI explanations help junior devs understand complex vulnerabilities. We've caught 3 critical SQL injection bugs before they hit production.",
      author: "Sarah Chen",
      role: "VP of Engineering",
      company: "TechCorp",
      rating: 5,
      metric: "85% faster reviews"
    },
    {
      quote: "Best security tool we've used. The multi-scanner approach catches issues other tools miss. Found hardcoded secrets in legacy code that had been there for years. The Gitleaks integration alone paid for itself.",
      author: "Michael Rodriguez",
      role: "Security Lead",
      company: "FinanceApp",
      rating: 5,
      metric: "120+ secrets found"
    },
    {
      quote: "Integration was seamless. We went from manual reviews to automated scanning in one sprint. The GitHub Actions integration works flawlessly, and the Slack notifications keep the whole team informed.",
      author: "Emily Watson",
      role: "CTO",
      company: "StartupXYZ",
      rating: 5,
      metric: "1-day setup"
    },
    {
      quote: "The dependency scanning is phenomenal. We get alerted within minutes when new CVEs are published that affect our stack. The automated remediation suggestions have saved us countless hours.",
      author: "David Park",
      role: "Senior DevOps Engineer",
      company: "CloudScale Inc",
      rating: 5,
      metric: "Real-time CVE alerts"
    },
    {
      quote: "On-premise deployment was crucial for us due to compliance requirements. Vulnix team got us up and running in 2 days. The air-gapped scanning mode works perfectly for our classified projects.",
      author: "Jennifer Martinez",
      role: "CISO",
      company: "DefenseTech",
      rating: 5,
      metric: "100% compliance"
    },
    {
      quote: "AI-powered analysis is a game changer. Instead of cryptic OWASP codes, we get plain English explanations with actual fix code. Our remediation time dropped by 60%.",
      author: "Alex Thompson",
      role: "Lead Security Architect",
      company: "FinTech Solutions",
      rating: 5,
      metric: "60% faster fixes"
    },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-charcoal)' }}>
      {/* Navigation Bar */}
      <nav 
        className={`fixed inset-x-0 top-3 z-50 px-3 transition-all duration-200 sm:px-6 ${
          scrolled ? 'drop-shadow-[0_12px_30px_rgba(0,0,0,0.28)]' : ''
        }`}
      >
        <div className={`mx-auto flex h-14 max-w-7xl items-center justify-between rounded-full border px-4 transition-[background-color,border-color,box-shadow] duration-200 sm:px-6 ${
          scrolled
            ? 'border-slate-700/80 bg-[#06080e]/95 shadow-lg shadow-black/20 backdrop-blur-xl'
            : 'border-slate-700/60 bg-[#06080e]/80 shadow-md shadow-black/10 backdrop-blur-lg'
        }`}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img 
              src="/vulnix-logo.png" 
              alt="Vulnix" 
              className="size-7 rounded-md shrink-0"
            />
            <span className="text-white font-bold text-lg tracking-tight">Vulnix</span>
          </Link>

          {/* Center Nav Tabs */}
          <div className="hidden md:flex items-center gap-0.5 text-sm font-medium text-slate-300">

            {/* Products mega-menu */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3.5 py-2 rounded-md hover:text-white transition-colors group-hover:text-white">
                Products
                <svg className="size-3.5 opacity-50 transition-transform group-hover:rotate-180 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {/* Mega panel */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-[560px] bg-[#0b1120] border border-slate-700/60 rounded-2xl shadow-2xl p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3 px-1">Features</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[{icon:Shield,title:'Security Scanner',desc:'Multi-engine SAST & secret detection'},{icon:FileSearch,title:'Vulnerability Reports',desc:'Prioritised findings with CVSS scores'},{icon:BarChart3,title:'Compliance Dashboard',desc:'OWASP, CWE, SOC2 tracking'},{icon:Zap,title:'CI/CD Integration',desc:'Scan on every push automatically'},{icon:Lock,title:'Secret Detection',desc:'Gitleaks + custom pattern rules'},{icon:Layers,title:'Dependency Audit',desc:'npm, pip, Go module advisories'}].map(({icon:Icon,title,desc})=>(
                      <a key={title} href="#features" className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group/item">
                        <span className="size-8 rounded-lg bg-[#00dc82]/10 border border-[#00dc82]/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="size-4 text-[#00dc82]" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-white group-hover/item:text-[#00dc82] transition-colors">{title}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Solutions mega-menu */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3.5 py-2 rounded-md hover:text-white transition-colors group-hover:text-white">
                Solutions
                <svg className="size-3.5 opacity-50 transition-transform group-hover:rotate-180 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-[420px] bg-[#0b1120] border border-slate-700/60 rounded-2xl shadow-2xl p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3 px-1">By Team</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[{icon:Code,title:'For Developers',desc:'Shift security left — catch issues before they ship'},{icon:ShieldCheck,title:'For Security Teams',desc:'Centralised visibility, triage & compliance'},{icon:Users,title:'Enterprise',desc:'SSO, on-premise, dedicated support'}].map(({icon:Icon,title,desc})=>(
                      <a key={title} href="#features" className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group/item">
                        <span className="size-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="size-4 text-purple-400" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-white group-hover/item:text-purple-400 transition-colors">{title}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing — plain link */}
            <Link to="/pricing" className="px-3.5 py-2 rounded-md hover:text-white transition-colors">
              Pricing
            </Link>

            {/* Resources mega-menu */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3.5 py-2 rounded-md hover:text-white transition-colors group-hover:text-white">
                Resources
                <svg className="size-3.5 opacity-50 transition-transform group-hover:rotate-180 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-[360px] bg-[#0b1120] border border-slate-700/60 rounded-2xl shadow-2xl p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3 px-1">Resources</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[{icon:Award,title:'Case Studies',desc:'See how teams ship secure code faster'},{icon:FileSearch,title:'FAQ',desc:'Common questions answered'},{icon:Activity,title:'Changelog',desc:'Latest product updates & releases'}].map(({icon:Icon,title,desc,href=''})=>(
                      <a key={title} href={href||'#'} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group/item">
                        <span className="size-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="size-4 text-sky-400" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-white group-hover/item:text-sky-400 transition-colors">{title}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Developers mega-menu */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3.5 py-2 rounded-md hover:text-white transition-colors group-hover:text-white">
                Developers
                <svg className="size-3.5 opacity-50 transition-transform group-hover:rotate-180 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-[360px] bg-[#0b1120] border border-slate-700/60 rounded-2xl shadow-2xl p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3 px-1">Developer Tools</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[{icon:Terminal,title:'API Reference',desc:'REST API with full auth & scan endpoints'},{icon:GitPullRequest,title:'SDKs',desc:'Python, Node.js, Go client libraries'},{icon:Globe,title:'Webhooks',desc:'Push events to Slack, Jira, or any URL'}].map(({icon:Icon,title,desc})=>(
                      <Link key={title} to="/docs" className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group/item">
                        <span className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="size-4 text-amber-400" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-white group-hover/item:text-amber-400 transition-colors">{title}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Docs — plain link */}
            <Link to="/docs" className="px-3.5 py-2 rounded-md hover:text-white transition-colors">
              Docs
            </Link>

            {/* Blogs mega-menu */}
            <div className="relative group">
              <button className="flex items-center gap-1 px-3.5 py-2 rounded-md hover:text-white transition-colors group-hover:text-white">
                Blogs
                <svg className="size-3.5 opacity-50 transition-transform group-hover:rotate-180 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <div className="absolute right-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                <div className="w-[340px] bg-[#0b1120] border border-slate-700/60 rounded-2xl shadow-2xl p-5">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-3 px-1">Blog</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[{icon:ShieldCheck,title:'Security Insights',desc:'Deep dives on vulnerabilities & mitigations'},{icon:Code,title:'Engineering Blog',desc:'How we build Vulnix'},{icon:Rocket,title:'Release Notes',desc:'What\'s new in each version'}].map(({icon:Icon,title,desc})=>(
                      <a key={title} href="#" className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-800/60 transition-colors group/item">
                        <span className="size-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="size-4 text-rose-400" />
                        </span>
                        <span>
                          <span className="block text-xs font-semibold text-white group-hover/item:text-rose-400 transition-colors">{title}</span>
                          <span className="block text-[11px] text-slate-400 mt-0.5 leading-tight">{desc}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* CTA — shows Dashboard when logged in */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <Link
                to="/app/dashboard"
                className="rounded-full px-5 py-2 text-xs font-semibold bg-[#00dc82] text-[#042412] hover:bg-[#00c575] transition-all inline-flex items-center gap-1.5"
              >
                Go to Dashboard
                <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <Link
                to="/signup"
                className="rounded-full px-5 py-2 text-xs font-semibold border border-[#00dc82]/70 bg-[#032014]/60 text-slate-200 hover:text-white hover:border-[#00dc82] hover:bg-[#00dc82]/10 transition-all inline-flex items-center gap-1.5"
              >
                Start Free Trial
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#06080e] pt-20 pb-16 lg:pt-24 lg:pb-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <BackgroundBoxesDemo className="absolute inset-0 z-0 h-full bg-[#06080e]" />
        </div>

        <div className="pointer-events-none relative z-10 mx-auto max-w-5xl px-6 sm:px-10 lg:px-12">
          <div className="flex flex-col items-center text-center">
            
            {/* Center Content */}
            <div className="w-full max-w-3xl flex flex-col items-center">
              {/* Animated Headline */}
              <h1 className="text-4xl sm:text-6xl lg:text-[4.2rem] font-bold text-white tracking-tight leading-[1.1] mb-5 min-h-[5.5rem] lg:min-h-[8rem] text-center">
                <span
                  className={typedLine === 2 ? 'text-[#00dc82]' : 'text-white'}
                >
                  {typedText}
                  <span className="inline-block w-[3px] h-[1em] align-middle ml-1 bg-current animate-pulse" />
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-slate-200 text-base sm:text-lg max-w-2xl leading-relaxed mb-8 text-center mx-auto">
                Find issues earlier, fix them faster, and keep your stack secure without slowing your team down.
              </p>

              {/* Key benefits */}
              <div className="mb-9 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-100">
                {[
                  'Multi-scanner coverage',
                  'AI fix guidance',
                  'GitHub-first workflows',
                ].map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1.5"
                  >
                    <span className="size-2 rounded-full bg-[#00dc82]" />
                    {item}
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-9">
                <Link
                  to="/signup"
                  className="pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#00dc82] px-7 py-3.5 text-sm font-bold text-[#042412] shadow-[0_0_25px_rgba(0,220,130,0.35)] transition-colors hover:bg-[#00c575] active:scale-[0.99]"
                >
                  Start Scanning Free
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </Link>
              </div>

              {/* Social Proof Line */}
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-200 pt-3 border-t border-slate-700/80 w-full max-w-2xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#00dc82]" />
                  <span>Trusted by developers. Built for security.</span>
                </div>
                <div className="flex items-center gap-5 text-slate-200">
                  <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <GitHub className="size-4 text-white" />
                    <span className="text-xs font-medium">GitHub</span>
                  </div>
                  <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <GitLab className="size-4" />
                    <span className="text-xs font-medium">GitLab</span>
                  </div>
                  <div className="flex items-center gap-1.5 hover:text-white transition-colors">
                    <Google className="size-4" />
                    <span className="text-xs font-medium">Google</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Animated Dashboard Demo Section */}
      <section ref={el => sectionRefs.current.dashboard = el} className="py-20">
        <div className="w-full px-6 sm:px-10 lg:px-16">
          {/* Section Header */}
          <div className="text-center mb-10">
            <Badge
              className="mb-4"
              style={{
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--color-purple)',
                borderColor: 'var(--color-purple)'
              }}
            >
              <Eye className="w-3 h-3 mr-1" />
              Interactive Demo
            </Badge>
            <h2 className="text-4xl font-bold text-white mb-3">See Vulnix in Action</h2>
            <p className="text-lg text-gray-400 max-w-xl mx-auto">
              A faithful walkthrough of the actual Vulnix console — from repository audit to one-click verified fix
            </p>
          </div>

          {/* Step Pill Controls */}
          <div className="max-w-6xl mx-auto mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: '1 · Projects', step: 0 },
                { label: '2 · Scanner Engines', step: 1 },
                { label: '3 · AI Agent', step: 2 },
                { label: '4 · Verified Fix', step: 3 },
              ].map(({ label, step }) => (
                <button
                  key={step}
                  onClick={() => { setDemoStep(step); setIsPlaying(false) }}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200"
                  style={{
                    backgroundColor: demoStep === step ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                    borderColor: demoStep === step ? 'var(--color-purple)' : 'rgba(255,255,255,0.1)',
                    color: demoStep === step ? '#c4b5fd' : '#9ca3af'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setIsPlaying(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200"
              style={{
                backgroundColor: isPlaying ? 'rgba(0,220,130,0.12)' : 'rgba(255,255,255,0.04)',
                borderColor: isPlaying ? 'var(--color-green)' : 'rgba(255,255,255,0.15)',
                color: isPlaying ? 'var(--color-green)' : '#9ca3af'
              }}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>

          {/* Main Console Frame */}
          <div className="max-w-6xl mx-auto">
            <div
              className="rounded-2xl border overflow-hidden shadow-2xl"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              {/* macOS Browser Chrome */}
              <div
                className="h-11 flex items-center gap-3 px-4 border-b"
                style={{ backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <div
                  className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md text-xs text-gray-500 border"
                  style={{ backgroundColor: '#0a0f1a', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <span className="text-gray-600">🔒</span>
                  <span>
                    {demoStep === 0 && 'app.vulnix.dev/app/projects'}
                    {demoStep === 1 && 'app.vulnix.dev/app/audits/runs/active'}
                    {demoStep === 2 && 'app.vulnix.dev/app/ai-review'}
                    {demoStep === 3 && 'app.vulnix.dev/app/bulk-triage'}
                  </span>
                </div>
                {demoStep === 1 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
                    Audit Running
                  </div>
                )}
                {demoStep === 2 && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
                    AI Analyzing
                  </div>
                )}
              </div>

              {/* Console Body */}
              <div className="flex" style={{ height: '580px', backgroundColor: '#080d14' }}>

                {/* ─── Animated Cursor ─── */}
                {cursorPosition.visible && (
                  <div
                    className="absolute pointer-events-none z-50 transition-all duration-700 ease-out"
                    style={{
                      left: `${cursorPosition.x}%`,
                      top: `${cursorPosition.y}%`,
                      transform: 'translate(-50%, -50%)',
                      position: 'absolute'
                    }}
                  >
                    <div className="relative">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={`drop-shadow-lg transition-transform ${isClicking ? 'scale-75' : 'scale-100'}`}>
                        <path d="M5 3L19 12L12 13L9 21L5 3Z" fill="white" stroke="#1a0533" strokeWidth="1.5" />
                      </svg>
                      {isClicking && (
                        <div className="absolute top-0 left-0 w-7 h-7 rounded-full border-2 border-purple-400 animate-ping opacity-70"
                          style={{ transform: 'translate(-20%, -20%)' }} />
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Authentic Vulnix Sidebar ─── */}
                <aside
                  className="w-56 flex-none flex flex-col border-r"
                  style={{ backgroundColor: '#0a0f1a', borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  {/* Workspace Header */}
                  <div
                    className="h-14 flex items-center gap-2.5 px-4 border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-none"
                      style={{ backgroundColor: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}
                    >
                      <Building2 className="w-4 h-4" style={{ color: 'var(--color-purple)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">Acme Security</div>
                      <div className="text-[10px] text-gray-500 truncate">Production</div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-600 flex-none" />
                  </div>

                  {/* Navigation Groups */}
                  <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
                    {/* Workspace group */}
                    <div>
                      <div className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase px-2 mb-1.5">Workspace</div>
                      <div className="space-y-0.5">
                        {[
                          { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
                          { id: 'projects', label: 'Projects', Icon: FolderKanban },
                          { id: 'audits', label: 'Audits', Icon: ScanSearch, badge: demoStep === 1 ? '1' : null },
                          { id: 'bulk-triage', label: 'Bulk Triage', Icon: CheckSquare },
                        ].map(({ id, label, Icon, badge }) => {
                          const active = activeSidebarItem === id
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                              style={{
                                backgroundColor: active ? 'var(--color-purple)' : 'transparent',
                                color: active ? 'white' : '#9ca3af',
                              }}
                            >
                              <Icon className="w-3.5 h-3.5 flex-none" />
                              <span className="flex-1 truncate font-medium">{label}</span>
                              {badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{badge}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Security group */}
                    <div>
                      <div className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase px-2 mb-1.5">Security</div>
                      <div className="space-y-0.5">
                        {[
                          { id: 'agents', label: 'Agents', Icon: Bot, pulse: demoStep === 2 },
                          { id: 'secrets', label: 'Secrets', Icon: KeyRound },
                          { id: 'dependencies', label: 'Dependencies', Icon: Package },
                          { id: 'compliance', label: 'Compliance', Icon: ShieldCheck },
                          { id: 'reports', label: 'Reports', Icon: FileText },
                        ].map(({ id, label, Icon, pulse }) => {
                          const active = activeSidebarItem === id
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                              style={{
                                backgroundColor: active ? 'var(--color-purple)' : 'transparent',
                                color: active ? 'white' : '#9ca3af',
                              }}
                            >
                              <Icon className={`w-3.5 h-3.5 flex-none ${pulse && !active ? 'text-purple-400 animate-pulse' : ''}`} />
                              <span className="flex-1 truncate font-medium">{label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Tools group */}
                    <div>
                      <div className="text-[10px] font-semibold text-gray-600 tracking-wider uppercase px-2 mb-1.5">Tools</div>
                      <div className="space-y-0.5">
                        {[
                          { id: 'review', label: 'Review activity', Icon: Workflow },
                          { id: 'integrations', label: 'Integrations', Icon: Zap },
                        ].map(({ id, label, Icon }) => {
                          const active = activeSidebarItem === id
                          return (
                            <div
                              key={id}
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                              style={{
                                backgroundColor: active ? 'var(--color-purple)' : 'transparent',
                                color: active ? 'white' : '#9ca3af',
                              }}
                            >
                              <Icon className="w-3.5 h-3.5 flex-none" />
                              <span className="flex-1 truncate font-medium">{label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </nav>

                  {/* Utility + Profile Footer */}
                  <div className="px-2.5 pb-3 space-y-0.5 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {[
                      { id: 'settings', label: 'Settings', Icon: Settings },
                      { id: 'docs', label: 'Docs', Icon: BookOpen },
                    ].map(({ id, label, Icon }) => (
                      <div
                        key={id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 flex-none" />
                        <span className="font-medium">{label}</span>
                      </div>
                    ))}
                    {/* User Profile */}
                    <div className="flex items-center gap-2.5 px-2 py-2 rounded-md mt-1 cursor-pointer hover:bg-white/5 transition-colors">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-none"
                        style={{ backgroundColor: 'rgba(139,92,246,0.3)', color: '#c4b5fd' }}
                      >
                        AR
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate">Alex Rivera</div>
                        <div className="text-[10px] text-gray-500 truncate">Pro Plan</div>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* ─── Main Content Area ─── */}
                <div className="flex-1 flex flex-col min-w-0">

                  {/* ═══════════════════════════════════════════════════
                      STEP 0: Projects & Repositories
                  ════════════════════════════════════════════════════ */}
                  {demoStep === 0 && (
                    <div className="flex-1 overflow-y-auto p-5">
                      {/* Page header */}
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h2 className="text-base font-bold text-white">Projects</h2>
                          <p className="text-xs text-gray-500 mt-0.5">3 repositories connected · Last synced 2 min ago</p>
                        </div>
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold"
                          style={{ backgroundColor: 'var(--color-green)', color: '#000' }}
                        >
                          <GitPullRequest className="w-3.5 h-3.5" />
                          Connect Repo
                        </button>
                      </div>

                      {/* Projects table */}
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        {/* Table header */}
                        <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600 border-b"
                          style={{ backgroundColor: '#0d1117', borderColor: 'rgba(255,255,255,0.05)' }}>
                          <span className="col-span-4">Repository</span>
                          <span className="col-span-2">Language</span>
                          <span className="col-span-2">Branch</span>
                          <span className="col-span-2">Last Audit</span>
                          <span className="col-span-2 text-right">Action</span>
                        </div>

                        {[
                          {
                            name: 'myapp-backend',
                            lang: 'Python 3.12',
                            langColor: '#3b82f6',
                            branch: 'main',
                            commit: 'a3f91c2',
                            lastAudit: '12 min ago',
                            critical: 3, high: 5,
                            status: 'active',
                            highlight: true
                          },
                          {
                            name: 'payment-service',
                            lang: 'TypeScript',
                            langColor: '#22d3ee',
                            branch: 'release/v2',
                            commit: 'd7e44ab',
                            lastAudit: '1h ago',
                            critical: 0, high: 2,
                            status: 'clean',
                          },
                          {
                            name: 'auth-gateway',
                            lang: 'Go 1.22',
                            langColor: '#06b6d4',
                            branch: 'feature/oauth',
                            commit: 'f1c09de',
                            lastAudit: '3h ago',
                            critical: 1, high: 3,
                            status: 'warning',
                          },
                        ].map((repo, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-12 items-center px-4 py-3 border-b transition-colors group"
                            style={{
                              borderColor: 'rgba(255,255,255,0.04)',
                              backgroundColor: repo.highlight ? 'rgba(139,92,246,0.06)' : 'transparent'
                            }}
                          >
                            {/* Name + badges */}
                            <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-7 h-7 rounded-md flex items-center justify-center flex-none text-[10px] font-bold"
                                style={{
                                  backgroundColor: repo.highlight ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                                  color: repo.highlight ? '#c4b5fd' : '#9ca3af'
                                }}
                              >
                                {repo.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate">{repo.name}</div>
                                <div className="text-[10px] text-gray-600 flex items-center gap-1">
                                  <GitCommit className="w-2.5 h-2.5" />
                                  {repo.commit}
                                </div>
                              </div>
                              {repo.status === 'active' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-none"
                                  style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                                  {repo.critical}C · {repo.high}H
                                </span>
                              )}
                            </div>

                            {/* Language */}
                            <div className="col-span-2 flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: repo.langColor }} />
                              <span className="text-[11px] text-gray-400 truncate">{repo.lang}</span>
                            </div>

                            {/* Branch */}
                            <div className="col-span-2 flex items-center gap-1 text-[11px] text-gray-500">
                              <GitBranch className="w-3 h-3 flex-none" />
                              <span className="truncate">{repo.branch}</span>
                            </div>

                            {/* Last Audit */}
                            <div className="col-span-2 text-[11px] text-gray-500">
                              {repo.lastAudit}
                            </div>

                            {/* Action */}
                            <div className="col-span-2 flex justify-end">
                              <button
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all"
                                style={{
                                  backgroundColor: repo.highlight ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                                  color: repo.highlight ? '#c4b5fd' : '#6b7280',
                                  border: `1px solid ${repo.highlight ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                  boxShadow: repo.highlight && isClicking ? '0 0 12px rgba(139,92,246,0.4)' : 'none',
                                  transform: repo.highlight && isClicking ? 'scale(0.94)' : 'scale(1)'
                                }}
                              >
                                {repo.highlight ? 'Run Deep Audit' : 'View Findings'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary stats */}
                      <div className="grid grid-cols-4 gap-3 mt-4">
                        {[
                          { label: 'Total Findings', value: '12', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
                          { label: 'Critical', value: '4', color: '#f87171', bg: 'rgba(239,68,68,0.1)' },
                          { label: 'High', value: '8', color: '#fb923c', bg: 'rgba(249,115,22,0.1)' },
                          { label: 'Repositories', value: '3', color: 'var(--color-green)', bg: 'rgba(0,220,130,0.1)' },
                        ].map((s, i) => (
                          <div key={i} className="rounded-lg p-3 border" style={{ backgroundColor: s.bg, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════
                      STEP 1: Multi-Scanner Engine (Parallel Orchestration)
                  ════════════════════════════════════════════════════ */}
                  {demoStep === 1 && (
                    <div className="flex-1 overflow-y-auto p-5">
                      {/* Page header */}
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <h2 className="text-base font-bold text-white">Audit Run · myapp-backend</h2>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                              LIVE
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">main · commit a3f91c2 · started 0:14 ago</p>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Lines scanned</div>
                          <div className="text-lg font-bold" style={{ color: 'var(--color-green)' }}>
                            {scannedLoc.toLocaleString()} <span className="text-xs font-normal text-gray-500">/ 89,240</span>
                          </div>
                        </div>
                      </div>

                      {/* Scanner engine cards – 2×2 grid */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {[
                          {
                            key: 'semgrep',
                            name: 'Semgrep',
                            role: 'SAST · Static Analysis',
                            color: '#a855f7',
                            bg: 'rgba(168,85,247,0.08)',
                            border: 'rgba(168,85,247,0.2)',
                            rules: 312,
                            findings: 5,
                            detail: 'Analyzing control-flow graph…'
                          },
                          {
                            key: 'gitleaks',
                            name: 'Gitleaks',
                            role: 'Secrets · Git history',
                            color: '#ef4444',
                            bg: 'rgba(239,68,68,0.08)',
                            border: 'rgba(239,68,68,0.2)',
                            rules: 194,
                            findings: 2,
                            detail: 'Scanning 1,203 commits…'
                          },
                          {
                            key: 'bandit',
                            name: 'Bandit',
                            role: 'Python · Security Linter',
                            color: '#f59e0b',
                            bg: 'rgba(245,158,11,0.08)',
                            border: 'rgba(245,158,11,0.2)',
                            rules: 87,
                            findings: 4,
                            detail: 'Parsing AST nodes…'
                          },
                          {
                            key: 'trivy',
                            name: 'Trivy',
                            role: 'SCA · CVE & Dependencies',
                            color: '#06b6d4',
                            bg: 'rgba(6,182,212,0.08)',
                            border: 'rgba(6,182,212,0.2)',
                            rules: 28000,
                            findings: 6,
                            detail: 'Matching against NVD…'
                          },
                        ].map((eng) => {
                          const pct = engineProgress[eng.key] || 0
                          const done = pct >= 100
                          return (
                            <div key={eng.key} className="rounded-xl p-4 border"
                              style={{ backgroundColor: eng.bg, borderColor: eng.border }}>
                              {/* Header */}
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="text-sm font-bold text-white">{eng.name}</div>
                                  <div className="text-[10px] text-gray-500">{eng.role}</div>
                                </div>
                                {done ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                                ) : (
                                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: eng.color }} />
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="h-1.5 rounded-full bg-gray-800 mb-2 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%`, backgroundColor: done ? '#22c55e' : eng.color }}
                                />
                              </div>

                              {/* Stats row */}
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-500">{pct}% · {eng.rules.toLocaleString()} rules</span>
                                {done ? (
                                  <span className="font-bold" style={{ color: eng.findings > 3 ? '#f87171' : '#fb923c' }}>
                                    {eng.findings} findings
                                  </span>
                                ) : (
                                  <span className="text-gray-600 italic">{eng.detail}</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Live files counter */}
                      <div className="rounded-xl border p-4 flex items-center justify-between"
                        style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-xs text-gray-400">Files processed: <span className="text-white font-semibold">{scannedFiles.toLocaleString()}</span> / 1,247</span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-gray-500">
                          <span>Engines: <span className="text-white">4 parallel</span></span>
                          <span>Mode: <span style={{ color: 'var(--color-purple)' }}>Deep + AI</span></span>
                          <span>ETA: <span className="text-white">~32s</span></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════
                      STEP 2: AI Security Review Agent
                  ════════════════════════════════════════════════════ */}
                  {demoStep === 2 && (
                    <div className="flex-1 overflow-y-auto p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <Bot className="w-4 h-4" style={{ color: 'var(--color-purple)' }} />
                            <h2 className="text-base font-bold text-white">AI Security Review Agent</h2>
                          </div>
                          <p className="text-xs text-gray-500">Analyzing <code className="text-purple-400">src/auth/login.py</code> · call-graph trace active</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
                          Agent reasoning…
                        </div>
                      </div>

                      {/* Agent trace terminal */}
                      <div className="rounded-xl border overflow-hidden mb-4"
                        style={{ backgroundColor: '#0a0d13', borderColor: 'rgba(139,92,246,0.2)' }}>
                        <div className="flex items-center gap-2 px-4 py-2 border-b"
                          style={{ borderColor: 'rgba(139,92,246,0.15)', backgroundColor: 'rgba(139,92,246,0.05)' }}>
                          <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--color-purple)' }} />
                          <span className="text-xs font-semibold" style={{ color: '#c4b5fd' }}>Agent Reasoning Trace</span>
                        </div>
                        <div className="p-4 space-y-2 font-mono text-xs">
                          {[
                            { step: 1, type: 'info', icon: '→', text: 'Traversing call-graph from entry point: src/auth/login.py:42', color: '#9ca3af' },
                            { step: 2, type: 'found', icon: '⚡', text: 'Tainted input reaches cursor.execute() via email param (no sanitization)', color: '#f87171' },
                            { step: 3, type: 'cve', icon: '🔗', text: 'CVE-2023-44487 correlation: similar pattern in 3 upstream libs · CVSS 9.8', color: '#fb923c' },
                            { step: 4, type: 'context', icon: '🧠', text: 'AST node: BinOp(f-string) → SQL concat pattern confirmed (CWE-89, OWASP A03)', color: '#fbbf24' },
                            { step: 5, type: 'fix', icon: '✅', text: 'Parameterized query fix verified · safe in myapp-backend context · PR ready', color: '#22c55e' },
                          ].filter(t => t.step <= aiTraceStep).map((trace) => (
                            <div key={trace.step} className="flex items-start gap-3"
                              style={{ animation: 'fadeIn 0.4s ease-out' }}>
                              <span className="text-base leading-none mt-0.5">{trace.icon}</span>
                              <span style={{ color: trace.color }}>{trace.text}</span>
                            </div>
                          ))}
                          {aiTraceStep < 5 && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="inline-block w-1.5 h-3.5 bg-purple-500 animate-pulse" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Context evidence panel */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Vulnerable Code</div>
                          <div className="font-mono text-[11px] rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0d13' }}>
                            <div className="flex">
                              <div className="py-2 px-2 text-right text-gray-700 select-none border-r text-[10px]"
                                style={{ borderColor: 'rgba(255,255,255,0.05)', minWidth: '28px' }}>
                                {[40, 41, 42, 43].map(n => <div key={n}>{n}</div>)}
                              </div>
                              <div className="py-2 px-3 flex-1">
                                <div className="text-gray-500">def login(email, password):</div>
                                <div className="text-gray-500">{'  '}conn = get_db()</div>
                                <div className="text-red-400 bg-red-950/30 -mx-3 px-3">{'  '}query = f"SELECT * FROM users</div>
                                <div className="text-red-400 bg-red-950/30 -mx-3 px-3">{'  '}WHERE email='{'{email}'}'"</div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(0,220,130,0.15)', backgroundColor: 'rgba(0,220,130,0.04)' }}>
                          <div className="text-[10px] font-semibold text-green-500 uppercase tracking-wider mb-2">AI-Verified Fix</div>
                          <div className="font-mono text-[11px] rounded-lg overflow-hidden" style={{ backgroundColor: '#0a0d13' }}>
                            <div className="flex">
                              <div className="py-2 px-2 text-right text-gray-700 select-none border-r text-[10px]"
                                style={{ borderColor: 'rgba(255,255,255,0.05)', minWidth: '28px' }}>
                                {[40, 41, 42, 43].map(n => <div key={n}>{n}</div>)}
                              </div>
                              <div className="py-2 px-3 flex-1">
                                <div className="text-gray-500">def login(email, password):</div>
                                <div className="text-gray-500">{'  '}conn = get_db()</div>
                                <div className="text-green-400 bg-green-950/30 -mx-3 px-3">{'  '}query = "SELECT * FROM users</div>
                                <div className="text-green-400 bg-green-950/30 -mx-3 px-3">{'  '}WHERE email = %s"</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ═══════════════════════════════════════════════════
                      STEP 3: Triage & Verified Git Diff Fix
                  ════════════════════════════════════════════════════ */}
                  {demoStep === 3 && (
                    <div className="flex-1 overflow-y-auto p-5">
                      {/* Finding header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}>
                              CRITICAL · CVSS 9.8
                            </span>
                            <span className="text-[10px] text-gray-600">CWE-89 · OWASP A03 · Semgrep + Bandit</span>
                          </div>
                          <h2 className="text-sm font-bold text-white">SQL Injection in Authentication</h2>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <FileCode className="w-3 h-3" />
                            src/auth/login.py : 42 · myapp-backend
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="text-xs px-2.5 py-1 rounded-md border text-gray-400"
                            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            False Positive
                          </button>
                          <button className="text-xs px-2.5 py-1 rounded-md border text-gray-400"
                            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            Snooze 7d
                          </button>
                        </div>
                      </div>

                      {/* Git Diff */}
                      <div className="rounded-xl border overflow-hidden mb-4"
                        style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#070c12' }}>
                        {/* Diff header */}
                        <div className="flex items-center gap-2 px-4 py-2 border-b text-[11px]"
                          style={{ borderColor: 'rgba(255,255,255,0.06)', backgroundColor: '#0d1117' }}>
                          <GitPullRequest className="w-3.5 h-3.5 text-gray-500" />
                          <span className="text-gray-400 font-mono">src/auth/login.py</span>
                          <span className="ml-auto text-gray-600">−2 · +3</span>
                        </div>

                        {/* Diff lines */}
                        <div className="font-mono text-xs">
                          {/* Context lines */}
                          {[
                            { n: 39, type: 'ctx', text: 'def authenticate_user(email: str, password: str):' },
                            { n: 40, type: 'ctx', text: '    conn = get_db_connection()' },
                            { n: 41, type: 'ctx', text: '    cursor = conn.cursor()' },
                            { n: 42, type: 'del', text: '    query = f"SELECT * FROM users WHERE email=\'{email}\'"' },
                            { n: 43, type: 'del', text: '    cursor.execute(query)   # ⚠ tainted input' },
                            { n: 42, type: 'add', text: '    query = "SELECT * FROM users WHERE email = %s"' },
                            { n: 43, type: 'add', text: '    # Parameterized · CVE-2023-44487 mitigated' },
                            { n: 44, type: 'add', text: '    cursor.execute(query, (email,))' },
                            { n: 45, type: 'ctx', text: '    return cursor.fetchone()' },
                          ].map((line, i) => (
                            <div key={i}
                              className="flex items-start"
                              style={{
                                backgroundColor: line.type === 'del' ? 'rgba(239,68,68,0.1)' : line.type === 'add' ? 'rgba(34,197,94,0.08)' : 'transparent'
                              }}>
                              <div className="w-8 py-1.5 text-right px-2 text-[10px] select-none"
                                style={{ color: '#374151', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                                {line.n}
                              </div>
                              <div className="w-5 py-1.5 text-center text-[10px] select-none"
                                style={{ color: line.type === 'del' ? '#f87171' : line.type === 'add' ? '#4ade80' : '#374151' }}>
                                {line.type === 'del' ? '−' : line.type === 'add' ? '+' : ' '}
                              </div>
                              <div className="flex-1 py-1.5 px-2"
                                style={{ color: line.type === 'del' ? '#fca5a5' : line.type === 'add' ? '#86efac' : '#9ca3af' }}>
                                {line.text}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Approve + PR button row */}
                      <div className="flex items-center gap-3">
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
                          style={{
                            backgroundColor: prCreated ? 'rgba(34,197,94,0.15)' : 'var(--color-green)',
                            color: prCreated ? '#4ade80' : '#000',
                            border: prCreated ? '1px solid rgba(34,197,94,0.3)' : 'none',
                            transform: isClicking ? 'scale(0.95)' : 'scale(1)',
                            boxShadow: isClicking ? '0 0 20px rgba(0,220,130,0.4)' : 'none'
                          }}
                        >
                          {prCreated ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              PR #142 Created · Awaiting Review
                            </>
                          ) : (
                            <>
                              <GitPullRequest className="w-4 h-4" />
                              Approve & Create Pull Request #142
                            </>
                          )}
                        </button>
                        {!prCreated && (
                          <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-400 border transition-colors"
                            style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            <ExternalLink className="w-4 h-4" />
                            Preview in IDE
                          </button>
                        )}
                        {prCreated && (
                          <div className="flex items-center gap-1.5 text-xs text-green-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            Fix auto-applied to fix/sql-injection-42 branch
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      
      <section 
        ref={el => sectionRefs.current.stats = el}
        className="py-12 border-y" 
        style={{ borderColor: 'var(--color-slate)' }}
      >
        <div className="w-full px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div 
                className="text-5xl font-bold mb-2 transition-all duration-500"
                style={{ color: 'var(--color-green)' }}
              >
                {stat.format === 'M' && `${(stat.value / 1000000).toFixed(0)}M`}
                {stat.format === 'K' && `${(stat.value / 1000).toFixed(0)}K`}
                {stat.format === 'decimal' && stat.value.toFixed(1)}
                {stat.format === '' && stat.value.toLocaleString()}
                {stat.suffix}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>


      {/* Integrations Section */}
      <section className="py-16" style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
        <div className="w-full px-8">
          <div className="text-center mb-12">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: 'var(--color-green)',
                borderColor: 'var(--color-green)'
              }}
            >
              <Shield className="w-3 h-3 mr-1" />
              Integrations
            </Badge>
            <h2 className="text-5xl font-bold text-white mb-4">
              Works With Your Stack
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Seamless integration with your favorite tools and platforms
            </p>
          </div>

          {/* Continuous Scrolling Integrations Row */}
          <div className="relative overflow-hidden py-8 mb-16">
            <div className="flex gap-8 animate-scroll">
              {/* First set */}
              {[
                { icon: GitHub, name: 'GitHub' },
                { icon: GitLab, name: 'GitLab' },
                { name: 'Bitbucket', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
                  </svg>
                )},
                { name: 'Jenkins', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.474.002a2.388 2.388 0 00-1.674.701L7.758 2.69a.455.455 0 00.06.73l1.02.56a.446.446 0 00.59-.14l.68-.98a.908.908 0 011.49 0l2.03 2.93c.18.26.48.42.81.42h3.55l.62-1.77a.477.477 0 00-.31-.61l-5.45-1.99a2.471 2.471 0 00-1.38-.05zm5.38 5.52h-3.03l-2.15-3.11a.454.454 0 00-.74 0L8.788 5.522H5.758a.455.455 0 00-.45.52l.93 9.3c.04.4.38.7.78.7h9.95c.4 0 .74-.3.78-.7l.93-9.3a.455.455 0 00-.45-.52z"/>
                  </svg>
                )},
                { icon: Slack, name: 'Slack' },
                { name: 'Jira', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.487a.974.974 0 00-.004-0.974zm-1.195 7.95a3.39 3.39 0 01-3.404-3.384v-2.057h3.404a3.39 3.39 0 013.403 3.384 3.39 3.39 0 01-3.403 3.057z"/>
                  </svg>
                )},
                { name: 'Linear', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 0h24v24H0V0z" fill="none"/>
                    <path d="M2 2l20 20M2 22L22 2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )},
                { name: 'Datadog', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 4.5L18 9l-4.5 4.5V9h-9v4.5L0 9l4.5-4.5V9h9z"/>
                  </svg>
                )},
                { name: 'PostHog', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L0 12l12 12 12-12L12 0zm0 21.6L2.4 12 12 2.4 21.6 12 12 21.6z"/>
                  </svg>
                )},
                { name: 'VS Code', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z"/>
                  </svg>
                )},
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 flex-shrink-0"
                >
                  <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-charcoal/50">
                    {item.icon ? (
                      <item.icon className="w-12 h-12 text-gray-400" />
                    ) : item.IconComponent ? (
                      <item.IconComponent />
                    ) : null}
                  </div>
                  <span className="text-sm text-gray-400 font-medium">{item.name}</span>
                </div>
              ))}
              
              {/* Duplicate set for seamless loop */}
              {[
                { icon: GitHub, name: 'GitHub' },
                { icon: GitLab, name: 'GitLab' },
                { name: 'Bitbucket', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z"/>
                  </svg>
                )},
                { name: 'Jenkins', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.474.002a2.388 2.388 0 00-1.674.701L7.758 2.69a.455.455 0 00.06.73l1.02.56a.446.446 0 00.59-.14l.68-.98a.908.908 0 011.49 0l2.03 2.93c.18.26.48.42.81.42h3.55l.62-1.77a.477.477 0 00-.31-.61l-5.45-1.99a2.471 2.471 0 00-1.38-.05zm5.38 5.52h-3.03l-2.15-3.11a.454.454 0 00-.74 0L8.788 5.522H5.758a.455.455 0 00-.45.52l.93 9.3c.04.4.38.7.78.7h9.95c.4 0 .74-.3.78-.7l.93-9.3a.455.455 0 00-.45-.52z"/>
                  </svg>
                )},
                { icon: Slack, name: 'Slack' },
                { name: 'Jira', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 11.513H0a5.218 5.218 0 005.232 5.215h2.13v2.057A5.215 5.215 0 0012.575 24V12.487a.974.974 0 00-.004-0.974zm-1.195 7.95a3.39 3.39 0 01-3.404-3.384v-2.057h3.404a3.39 3.39 0 013.403 3.384 3.39 3.39 0 01-3.403 3.057z"/>
                  </svg>
                )},
                { name: 'Linear', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 0h24v24H0V0z" fill="none"/>
                    <path d="M2 2l20 20M2 22L22 2" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                )},
                { name: 'Datadog', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 4.5L18 9l-4.5 4.5V9h-9v4.5L0 9l4.5-4.5V9h9z"/>
                  </svg>
                )},
                { name: 'PostHog', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0L0 12l12 12 12-12L12 0zm0 21.6L2.4 12 12 2.4 21.6 12 12 21.6z"/>
                  </svg>
                )},
                { name: 'VS Code', IconComponent: () => (
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z"/>
                  </svg>
                )},
              ].map((item, i) => (
                <div
                  key={`dup-${i}`}
                  className="flex flex-col items-center gap-3 flex-shrink-0"
                >
                  <div className="w-20 h-20 rounded-lg flex items-center justify-center bg-charcoal/50">
                    {item.icon ? (
                      <item.icon className="w-12 h-12 text-gray-400" />
                    ) : item.IconComponent ? (
                      <item.IconComponent />
                    ) : null}
                  </div>
                  <span className="text-sm text-gray-400 font-medium">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto mb-16 max-w-6xl">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-white">Supported Stack</h3>
              <p className="mt-2 text-sm text-gray-400">
                Security analysis for the frameworks and languages you already use.
              </p>
            </div>
            <div
              className="relative mb-12 overflow-x-auto py-4 [scrollbar-width:none] motion-safe:overflow-hidden"
              aria-label="Technologies Vulnix analyzes"
            >
              <div className="flex w-max gap-2.5 animate-scroll motion-reduce:animate-none">
                {[...TECH_STACK, ...TECH_STACK].map(({ Icon, label }, index) => (
                  <div
                    key={`${label}-${index}`}
                    aria-hidden={index >= TECH_STACK.length}
                    className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl bg-charcoal/50 p-3 text-center transition-colors duration-150"
                  >
                    <span className="flex size-10 items-center justify-center rounded-lg bg-white">
                      <Icon className="size-7" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-white">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16">
        <div className="w-full px-8">
          <div className="text-center mb-12">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--color-purple)',
                borderColor: 'var(--color-purple)'
              }}
            >
              Features
            </Badge>
            <h2 className="text-5xl font-bold text-white mb-4">
              Everything You Need to
              <br />
              Secure Your Code
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Comprehensive security scanning with AI-powered insights. 
              No security expertise required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <Card
                key={i}
                className="gap-3 p-5 border transition-all hover:scale-105 hover:shadow-2xl cursor-pointer group"
                style={{ 
                  backgroundColor: 'rgba(17, 24, 39, 0.5)',
                  borderColor: 'var(--color-slate)'
                }}
              >
                <div className="flex items-start justify-between">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
                    style={{ backgroundColor: `${feature.color}20` }}
                  >
                    <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                  </div>
                  <Badge 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${feature.color}20`,
                      color: feature.color,
                      borderColor: feature.color
                    }}
                  >
                    {feature.stats}
                  </Badge>
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16" style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
        <div className="w-full px-8">
          <div className="text-center mb-12">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: 'var(--color-green)',
                borderColor: 'var(--color-green)'
              }}
            >
              How It Works
            </Badge>
            <h2 className="text-5xl font-bold text-white mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Three simple steps to comprehensive security scanning
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Code',
                description: 'Upload a ZIP archive, connect your Git repository (GitHub, GitLab, Bitbucket), or use our CLI tool. We support Python, JavaScript, TypeScript, Java, Go, C#, PHP, Ruby, Rust, Kotlin, Swift, and 20+ more languages.',
                icon: FolderKanban,
                details: ['Drag & drop ZIP files', 'Clones repos to isolated sandbox', 'CLI: vulnix scan ./src', 'IDE extensions available']
              },
              {
                step: '02',
                title: 'Scan & Analyze',
                description: 'Code is cloned into an isolated sandbox where our AI-powered engine runs 6+ security scanners in parallel: Semgrep for SAST, Bandit for Python, Gitleaks for secrets, ESLint Security for JavaScript, plus dependency checkers. AI analyzes results and eliminates false positives.',
                icon: ScanSearch,
                details: ['Scans in isolated sandbox', 'AI false positive reduction', 'OWASP Top 10 coverage', 'Custom rule support']
              },
              {
                step: '03',
                title: 'Fix & Deploy',
                description: 'Get detailed findings with severity scores, CWE mappings, and AI-generated fix code tested in sandbox. Assign to team members, track in Jira, or auto-create GitHub issues. Export compliance reports in PDF or JSON.',
                icon: ShieldCheck,
                details: ['AI fixes tested in sandbox', 'Team assignment & tracking', 'Jira/GitHub integration', 'Compliance report export']
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 2 && (
                  <div
                    className="hidden md:block absolute top-12 left-full w-8 h-0.5 z-10"
                    style={{ backgroundColor: 'var(--color-slate)' }}
                  />
                )}
                <div 
                  className="relative bg-charcoal border rounded-2xl p-8 transition-all hover:scale-105 hover:shadow-2xl"
                  style={{ borderColor: 'var(--color-slate)' }}
                >
                  <div 
                    className="text-6xl font-bold mb-4 opacity-20"
                    style={{ color: 'var(--color-green)' }}
                  >
                    {item.step}
                  </div>
                  <IconTile icon={item.icon} size="lg" className="mb-4" />
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 mb-6 leading-relaxed">
                    {item.description}
                  </p>
                  <ul className="space-y-2">
                    {item.details.map((detail, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-gray-400">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-green)' }} />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Additional process info */}
          <div className="mt-16 max-w-3xl mx-auto">
            <Card
              className="p-8 border"
              style={{ 
                backgroundColor: 'rgba(139, 92, 246, 0.05)',
                borderColor: 'var(--color-purple)'
              }}
            >
              <div className="flex items-start gap-4">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--color-purple)' }}
                >
                  <Rocket className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white mb-2">Automated CI/CD Integration</h4>
                  <p className="text-gray-300 mb-4 leading-relaxed">
                    Integrate Vulnix into your pipeline with GitHub Actions, GitLab CI, Jenkins, CircleCI, or any CI platform. 
                    Automatically block PRs with critical vulnerabilities, get inline code comments, and track security metrics over time.
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
                      <span className="text-sm text-gray-400">5-minute setup</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GitPullRequest className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
                      <span className="text-sm text-gray-400">Auto PR comments</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
                      <span className="text-sm text-gray-400">Block on critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
                      <span className="text-sm text-gray-400">Historical tracking</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-8 md:py-10">
        <div className="w-full px-8">
          <div className="text-center mb-8">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--color-purple)',
                borderColor: 'var(--color-purple)'
              }}
            >
              Testimonials
            </Badge>
            <h2 className="text-5xl font-bold text-white mb-4">
              Loved by Security Teams
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              See what developers and security professionals say about Vulnix
            </p>
          </div>

          <div
            className="relative motion-safe:overflow-hidden motion-reduce:overflow-x-auto"
            aria-label="Testimonials from Vulnix users"
            role="region"
          >
            <div className="flex w-max animate-scroll motion-reduce:animate-none">
              {[false, true].map((isDuplicate) => (
                <div
                  key={isDuplicate ? 'duplicate' : 'testimonials'}
                  className="flex shrink-0 gap-4 pr-4"
                  aria-hidden={isDuplicate}
                >
                  {testimonials.map((testimonial, i) => (
                    <Card
                      key={`${isDuplicate ? 'duplicate-' : ''}${i}`}
                      className="flex h-56 w-[min(82vw,300px)] shrink-0 flex-col gap-2.5 border p-3 transition-colors hover:border-purple-500/50 sm:w-[280px]"
                      style={{ 
                        backgroundColor: 'rgba(17, 24, 39, 0.5)',
                        borderColor: 'var(--color-slate)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          {[...Array(testimonial.rating)].map((_, j) => (
                            <Star 
                              key={j} 
                              className="size-3.5 fill-current" 
                              style={{ color: 'var(--color-green)' }}
                            />
                          ))}
                        </div>
                        <Badge 
                          className="text-[10px]"
                          style={{ 
                            backgroundColor: 'rgba(22, 163, 74, 0.1)',
                            color: 'var(--color-green)',
                            borderColor: 'var(--color-green)'
                          }}
                        >
                          {testimonial.metric}
                        </Badge>
                      </div>
                      <Quote className="size-4 text-gray-600" />
                      <p className="line-clamp-4 text-xs italic leading-relaxed text-gray-300">
                        "{testimonial.quote}"
                      </p>
                      <div className="mt-auto flex items-center gap-2.5 border-t pt-2" style={{ borderColor: 'var(--color-slate)' }}>
                        <div 
                          className="flex size-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: 'var(--color-purple)' }}
                        >
                          <span className="text-xs font-bold text-white">
                            {testimonial.author.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{testimonial.author}</div>
                          <div className="truncate text-[10px] text-gray-400">
                            {testimonial.role} · {testimonial.company}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-8 md:py-10" style={{ backgroundColor: 'rgba(17, 24, 39, 0.5)' }}>
        <div className="w-full px-8 max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(22, 163, 74, 0.1)',
                color: 'var(--color-green)',
                borderColor: 'var(--color-green)'
              }}
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Comparison
            </Badge>
            <h2 className="text-5xl font-bold text-white mb-4">
              Why Choose Vulnix?
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              See how we stack up against the competition
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderColor: 'var(--color-slate)' }}>
                  <th className="text-left p-3 text-gray-400 font-semibold">Feature</th>
                  <th className="text-center p-3">
                    <span className="text-white font-bold">Vulnix</span>
                  </th>
                  <th className="text-center p-3 text-gray-400">Snyk</th>
                  <th className="text-center p-3 text-gray-400">CodeRabbit</th>
                  <th className="text-center p-3 text-gray-400">SonarQube</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { 
                    feature: 'Multi-scanner engine (6+ tools)',
                    vulnix: true,
                    snyk: false,
                    coderabbit: false,
                    sonarqube: false
                  },
                  { 
                    feature: 'AI-powered analysis & fixes',
                    vulnix: true,
                    snyk: false,
                    coderabbit: true,
                    sonarqube: false
                  },
                  { 
                    feature: 'Unlimited scans (Pro plan)',
                    vulnix: true,
                    snyk: false,
                    coderabbit: false,
                    sonarqube: true
                  },
                  { 
                    feature: 'On-premise deployment',
                    vulnix: true,
                    snyk: true,
                    coderabbit: false,
                    sonarqube: true
                  },
                  { 
                    feature: 'Secret scanning (Gitleaks)',
                    vulnix: true,
                    snyk: false,
                    coderabbit: false,
                    sonarqube: false
                  },
                  { 
                    feature: 'Sandboxed fix testing',
                    vulnix: true,
                    snyk: false,
                    coderabbit: false,
                    sonarqube: false
                  },
                  { 
                    feature: 'Real-time CI/CD integration',
                    vulnix: true,
                    snyk: true,
                    coderabbit: true,
                    sonarqube: true
                  },
                  { 
                    feature: 'Dependency scanning',
                    vulnix: true,
                    snyk: true,
                    coderabbit: false,
                    sonarqube: true
                  },
                  { 
                    feature: 'Custom rule creation',
                    vulnix: true,
                    snyk: false,
                    coderabbit: false,
                    sonarqube: true
                  },
                  { 
                    feature: 'Starting price',
                    vulnix: '$10/mo',
                    snyk: '$99/mo',
                    coderabbit: '$75/mo',
                    sonarqube: '$150/mo'
                  },
                ].map((row, i) => (
                  <tr 
                    key={i}
                    className="border-b"
                    style={{ borderColor: 'var(--color-slate)' }}
                  >
                    <td className="p-3 text-sm text-gray-300">{row.feature}</td>
                    <td className="p-3 text-center">
                      {typeof row.vulnix === 'boolean' ? (
                        row.vulnix ? (
                          <CheckCircle2 className="w-6 h-6 mx-auto" style={{ color: 'var(--color-green)' }} />
                        ) : (
                          <XCircle className="w-6 h-6 mx-auto text-red-500" />
                        )
                      ) : (
                        <span className="text-white font-semibold">{row.vulnix}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {typeof row.snyk === 'boolean' ? (
                        row.snyk ? (
                          <CheckCircle2 className="w-6 h-6 mx-auto" style={{ color: 'var(--color-green)' }} />
                        ) : (
                          <XCircle className="w-6 h-6 mx-auto text-red-500" />
                        )
                      ) : (
                        <span className="text-gray-400">{row.snyk}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {typeof row.coderabbit === 'boolean' ? (
                        row.coderabbit ? (
                          <CheckCircle2 className="w-6 h-6 mx-auto" style={{ color: 'var(--color-green)' }} />
                        ) : (
                          <XCircle className="w-6 h-6 mx-auto text-red-500" />
                        )
                      ) : (
                        <span className="text-gray-400">{row.coderabbit}</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {typeof row.sonarqube === 'boolean' ? (
                        row.sonarqube ? (
                          <CheckCircle2 className="w-6 h-6 mx-auto" style={{ color: 'var(--color-green)' }} />
                        ) : (
                          <XCircle className="w-6 h-6 mx-auto text-red-500" />
                        )
                      ) : (
                        <span className="text-gray-400">{row.sonarqube}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 text-center">
            <Button size="lg" render={<Link to="/signin" />}>
              Start your free trial
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-8 md:py-10">
        <div className="w-full px-5 sm:px-8 max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <Badge 
              className="mb-4"
              style={{ 
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: 'var(--color-purple)',
                borderColor: 'var(--color-purple)'
              }}
            >
              FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-gray-400">
              Clear answers about scanning, integrations, findings, and your account.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i
              return (
                <article
                  key={faq.question}
                  className="overflow-hidden rounded-xl border transition-colors"
                  style={{
                    backgroundColor: 'rgba(17, 24, 39, 0.5)',
                    borderColor: isOpen ? 'rgba(139, 92, 246, 0.45)' : 'var(--color-slate)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5"
                  >
                    <span className="min-w-0">
                      <span className="mb-2 inline-flex rounded-full border border-purple-500/25 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-300">
                        {faq.category}
                      </span>
                      <span className="block text-sm font-semibold leading-relaxed text-white sm:text-base">
                        {faq.question}
                      </span>
                    </span>
                    <ChevronDown className={`mt-1 size-4 shrink-0 text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-700/70 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                      <p className="text-sm leading-relaxed text-gray-300">{faq.answer}</p>
                      {faq.details?.length > 0 && (
                        <ul className="mt-3 space-y-2">
                          {faq.details.map((detail) => (
                            <li key={detail} className="flex items-start gap-2 text-xs leading-relaxed text-gray-400">
                              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 text-center sm:flex-row">
            <p className="text-sm text-gray-400">Need help with something else?</p>
            <Button variant="outline" size="sm" render={<Link to="/resources/support" />}>
              Contact support
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </section>

      {/* Trust & Security Badges */}
      <section className="py-8 md:py-10 border-y" style={{ borderColor: 'var(--color-slate)' }}>
        <div className="w-full px-8">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              Enterprise-Grade Security & Compliance
            </h3>
            <p className="text-gray-400">
              Trusted by Fortune 500 companies and security teams worldwide
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-5 items-center">
            {[
              { name: 'SOC 2', icon: Award },
              { name: 'ISO 27001', icon: Shield },
              { name: 'GDPR', icon: Lock },
              { name: 'HIPAA', icon: FileSearch },
              { name: '99.9% SLA', icon: Activity },
            ].map((badge, i) => (
              <div key={i} className="text-center">
                <div 
                  className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'rgba(22, 163, 74, 0.1)' }}
                >
                  <badge.icon className="w-8 h-8" style={{ color: 'var(--color-green)' }} />
                </div>
                <div className="text-white font-semibold">{badge.name}</div>
                <div className="text-xs text-gray-500">Certified</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 md:py-10">
        <div className="w-full px-8 max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Secure Your Code?
          </h2>
          <p className="text-base sm:text-lg text-gray-400 mb-6">
            Join 2,500+ teams using Vulnix to catch vulnerabilities before production
          </p>
          <div className="mb-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link to="/signin" />}>
              Start free trial
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="lg" render={<Link to="/resources/support" />}>
              Schedule a demo
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 sm:text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
              <span>Free 14-day trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-green)' }} />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="border-t"
        style={{ 
          borderColor: 'var(--color-slate)',
          backgroundColor: 'rgba(17, 24, 39, 0.95)'
        }}
      >
        <div className="w-full px-8">
          {/* Main Footer Content */}
          <div className="py-16 grid md:grid-cols-12 gap-12">
            {/* Brand Column */}
            <div className="md:col-span-4">
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="/vulnix-logo.png" 
                  alt="Vulnix" 
                  className="w-10 h-10 rounded-full"
                />
                <span className="text-white font-bold text-2xl">Vulnix</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-xs">
                Get product updates and news from Vulnix.
              </p>
              {/* Newsletter Signup */}
              <div className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Your email"
                    className="flex-1 h-10 px-4 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                    style={{
                      backgroundColor: 'rgba(17, 24, 39, 0.8)',
                      borderColor: 'var(--color-slate)'
                    }}
                  />
                  <HoverBorderGradient
                    as="button"
                    containerClassName="rounded-lg"
                    className="bg-black dark:bg-black text-white h-10 px-5 font-medium whitespace-nowrap"
                    duration={0.8}
                  >
                    Subscribe
                  </HoverBorderGradient>
                </div>
              </div>
              {/* Social Icons */}
              <div className="flex items-center gap-3">
                <a 
                  href="https://github.com/vulnix" 
                  className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                  style={{ borderColor: 'var(--color-slate)' }}
                >
                  <GitHub className="w-5 h-5 text-gray-400 hover:text-green-500" />
                </a>
                <a 
                  href="https://twitter.com/vulnix" 
                  className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                  style={{ borderColor: 'var(--color-slate)' }}
                >
                  <XformerlyTwitter className="w-5 h-5 text-gray-400 hover:text-green-500" />
                </a>
                <a 
                  href="https://linkedin.com/company/vulnix" 
                  className="w-10 h-10 rounded-lg flex items-center justify-center border transition-all hover:border-green-500 hover:bg-green-500/10"
                  style={{ borderColor: 'var(--color-slate)' }}
                >
                  <LinkedIn className="w-5 h-5 text-gray-400 hover:text-green-500" />
                </a>
              </div>
            </div>

            {/* Links Grid */}
            <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              {/* Product */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">Product</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'Pricing', to: '/pricing' },
                    { label: 'Code Scanning', to: '/product/scanning' },
                    { label: 'AI Review', to: '/product/ai-review' },
                    { label: 'Secrets', to: '/product/secrets' },
                    { label: 'Dependencies', to: '/product/dependencies' },
                    { label: 'Compliance', to: '/product/compliance' },
                    { label: 'Integrations', to: '/product/integrations' },
                    { label: 'Reports', to: '/product/reports' },
                    { label: 'Feature Catalog', to: '/product/features' },
                  ].map((item, i) => (
                    <li key={i}>
                      <Link to={item.to} className="text-gray-400 text-sm hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Solutions */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">Solutions</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'AI Builders', to: '/solutions/ai-builders' },
                    { label: 'No Code', to: '/solutions/no-code' },
                    { label: 'Beginners', to: '/solutions/beginners' },
                    { label: 'Developers', to: '/solutions/developers' },
                    { label: 'Postgres Devs', to: '/solutions/postgres-devs' },
                    { label: 'Vibe Coders', to: '/solutions/vibe-coders' },
                    { label: 'Hackathon Contestants', to: '/solutions/hackathon-contestants' },
                    { label: 'Startups', to: '/solutions/startups' },
                    { label: 'Agencies', to: '/solutions/agencies' },
                    { label: 'Enterprise', to: '/solutions/enterprise' },
                  ].map((item, i) => (
                    <li key={i}>
                      <Link to={item.to} className="text-gray-400 text-sm hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">Resources</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'Blog', to: '/resources/blog' },
                    { label: 'Support', to: '/resources/support' },
                    { label: 'System Status', to: '/resources/status' },
                    { label: 'Become a Partner', to: '/resources/partners' },
                    { label: 'Partner Catalog', to: '/resources/partner-catalog' },
                    { label: 'Brand Assets', to: '/resources/brand' },
                    { label: 'Security & Compliance', to: '/resources/security' },
                    { label: 'Regions', to: '/resources/regions' },
                    { label: 'SOC2', to: '/resources/soc2' },
                    { label: 'Lawyers.txt', to: '/resources/lawyers' },
                    { label: 'Humans.txt', to: '/resources/humans' },
                  ].map((item, i) => (
                    <li key={i}>
                      <Link to={item.to} className="text-gray-400 text-sm hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Developers */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4">Developers</h4>
                <ul className="space-y-3">
                  {[
                    { label: 'Documentation', to: '/developers/docs' },
                    { label: 'Vulnix Library', to: '/developers/library' },
                    { label: 'Changelog', to: '/developers/changelog' },
                    { label: 'RSS', to: '/developers/rss' },
                    { label: 'Contributing', to: '/developers/contributing' },
                    { label: 'Open Source', to: '/developers/open-source' },
                    { label: 'DevTo', to: '/developers/devto' },
                  ].map((item, i) => (
                    <li key={i}>
                      <Link to={item.to} className="text-gray-400 text-sm hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li className="pt-4">
                    <h4 className="text-white font-semibold text-sm mb-3">Community</h4>
                    <ul className="space-y-3">
                      {[
                        { label: 'Events & Webinars', to: '/community/events' },
                        { label: 'Security Champions', to: '/community/champions' },
                        { label: 'Contributing', to: '/developers/contributing' },
                        { label: 'Open Source', to: '/developers/open-source' },
                      ].map((item, i) => (
                        <li key={i}>
                          <Link to={item.to} className="text-gray-400 text-sm hover:text-white transition-colors">
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 3D Isometric Purple Skyline Graphic Banner */}
          <div className="w-full overflow-hidden border-t border-slate-800/40 bg-[#06080e]">
            <VulnixLegalGraphicBanner />
          </div>

          {/* Footer Bottom */}
          <div 
            className="py-6 border-t flex flex-col md:flex-row items-center justify-between gap-4"
            style={{ borderColor: 'var(--color-slate)' }}
          >
            <p className="text-gray-500 text-xs">
              © 2026 Vulnix. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-xs">
              <Link to="/company" className="text-gray-500 hover:text-white transition-colors">Company</Link>
              <Link to="/company/careers" className="text-gray-500 hover:text-white transition-colors">Careers</Link>
              <Link to="/company/general-availability" className="text-gray-500 hover:text-white transition-colors">General Availability</Link>
              <Link to="/legal" className="text-gray-500 hover:text-white transition-colors">Legal Hub</Link>
              <Link to="/legal/terms" className="text-gray-500 hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/legal/privacy" className="text-gray-500 hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/legal/privacy-settings" className="text-gray-500 hover:text-white transition-colors">Privacy Settings</Link>
              <Link to="/legal/acceptable-use" className="text-gray-500 hover:text-white transition-colors">Acceptable Use Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
