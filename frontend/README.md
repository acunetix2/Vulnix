# Vulnix Frontend

🛡️ **AI-powered security analysis platform** - Professional security dashboard built with React, Vite, and Tailwind CSS.

![Vulnix](https://img.shields.io/badge/version-0.1.0-purple)
![React](https://img.shields.io/badge/React-19.2-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Overview

Vulnix is a comprehensive AI-assisted code security review platform that combines deterministic security scanners with AI-powered analysis. This frontend provides an intuitive, professional interface for developers and security teams to discover, understand, and remediate vulnerabilities.

**Tagline:** _Find vulnerabilities. Understand risk. Fix with confidence._

## ✨ Features

### 🔍 Core Security Features
- **Comprehensive Scanning**: Multi-scanner integration (Semgrep, Gitleaks, Bandit, Trivy)
- **AI-Powered Analysis**: Intelligent risk prioritization and remediation suggestions
- **Finding Management**: Advanced filtering, triage workflows, and bulk operations
- **Secret Detection**: Real-time credential exposure monitoring with remediation guides
- **Dependency Analysis**: Vulnerability tracking across npm, pip, maven, and gem ecosystems
- **Real-time Progress**: Live scan monitoring with tool-level execution details

### 📊 Analytics & Reporting
- **Visual Dashboards**: Charts and trends for vulnerability patterns
- **Custom Reports**: Generate executive summaries and technical reports
- **Historical Trends**: Track security improvements over time
- **Performance Metrics**: Scanner efficiency and success rates

### 👥 Team Collaboration
- **Role-Based Access**: Owner, Admin, Member, and Viewer permissions
- **Team Management**: Invite members, assign roles, track activity
- **Workspace Isolation**: Secure multi-tenant architecture
- **Audit Logging**: Complete activity tracking for compliance

### 🎨 Professional Design
- **Non-Generic UI**: Custom security-focused interface
- **Dark Sidebar**: Charcoal navigation with purple/green accents
- **Accessible**: Keyboard navigation and ARIA labels
- **Responsive**: Desktop, tablet, and mobile support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:5173`

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Vulnix
VITE_APP_VERSION=0.1.0
```

## 📁 Project Structure

```
src/
├── components/
│   ├── layout/          # Sidebar, Header, Layout
│   └── ui/              # shadcn/ui components (40+ components)
├── contexts/            # React contexts (Auth, etc.)
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and constants
│   ├── constants.js     # App-wide constants
│   └── utils.js         # Helper functions
├── pages/               # All route pages (25+)
│   ├── Dashboard.jsx
│   ├── Projects.jsx
│   ├── Findings.jsx
│   ├── AISecurityReview.jsx
│   ├── DependencyDashboard.jsx
│   ├── SecretsDashboard.jsx
│   ├── ScannerManagement.jsx
│   ├── TeamManagement.jsx
│   └── ...
├── services/            # API services
│   └── api.js           # API client with error handling
├── App.jsx              # Main app with routing
├── main.jsx             # Entry point
└── index.css            # Global styles & theme
```

## 🎨 Design System

### Color Palette

```css
--color-charcoal: #111827;  /* Navigation, headers */
--color-slate: #334155;      /* Borders, secondary */
--color-green: #16A34A;      /* Primary actions */
--color-purple: #8B5CF6;     /* AI features, accents */
--color-white: #F8FAFC;      /* Backgrounds */

/* Severity Colors */
--severity-critical: #DC2626;
--severity-high: #EA580C;
--severity-medium: #D97706;
--severity-low: #CA8A04;
--severity-info: #0284C7;
```

### Typography
- **Font**: Geist Variable (sans-serif)
- **Monospace**: Geist Mono (for code)

## 🛠️ Built With

- **React 19** - UI framework
- **Vite 8** - Build tool and dev server
- **React Router v6** - Client-side routing
- **Tailwind CSS 4** - Utility-first CSS
- **shadcn/ui** - Accessible component library
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **Geist Font** - Typography

## 📦 Available Pages

### ✅ Implemented (25+ pages)
1. **Authentication**: Sign In, Access Denied, Not Found
2. **Dashboard**: Security Overview with metrics
3. **Projects**: List, Detail, Create
4. **Scans**: List, Detail, New Scan, Progress
5. **Findings**: Explorer, Detail with AI explanations
6. **AI Features**: Security Review, Risk Analysis
7. **Reports**: Dashboard, Generate, History
8. **Dependencies**: Dashboard, Vulnerability tracking
9. **Secrets**: Dashboard, Detection, Remediation
10. **Scanners**: Management, Configuration
11. **Team**: Management, Invitations, Roles
12. **Notifications**: Center, Preferences
13. **Settings**: User Profile, Workspace
14. **Workspace**: Settings, Audit Log, Members

### 🚧 Coming Soon
- Repository integrations (GitHub, GitLab, Bitbucket)
- CI/CD pipeline setup
- Advanced analytics
- Compliance reports
- Public landing page
- API documentation viewer

## 🔑 Key Features Demonstrated

### Real-time Scan Monitoring
```jsx
// Live progress updates
<Progress value={scanProgress} />
// Tool-level execution status
// Scanner logs in real-time
```

### AI-Powered Analysis
```jsx
// AI security review with confidence scores
// Attack vector identification
// Risk prioritization
// Remediation suggestions
```

### Advanced Filtering
```jsx
// Multi-criteria filtering
// Saved filter presets
// Smart search across findings
```

### Data Visualization
```jsx
// Recharts integration
// Line, Bar, Area, Pie charts
// Historical trends
// Comparative analysis
```

## 🔐 Security Considerations

- **Client-side only**: No authentication stored in code
- **Environment variables**: Sensitive config externalized
- **XSS Protection**: All user input escaped
- **CORS**: Configured for API communication
- **Content Security**: Follows security best practices

## 🧪 Development

### Code Style
- ESLint configured
- Consistent component structure
- Functional components with hooks
- Props validation

### Best Practices
- Small, focused components
- Reusable UI components from shadcn/ui
- Centralized API calls
- Error boundaries
- Loading states
- Empty states

## 📈 Performance

- **Code splitting**: React lazy loading ready
- **Optimized builds**: Vite production optimization
- **Asset optimization**: Images and fonts optimized
- **Tree shaking**: Unused code elimination

## 🤝 Contributing

1. Follow existing code style
2. Use shadcn/ui components
3. Maintain color scheme consistency
4. Add proper error handling
5. Include loading states
6. Test responsiveness

## 📄 License

This project is part of the Vulnix security platform.

## 🙏 Acknowledgments

- **shadcn/ui** - Component library
- **Lucide** - Icon set
- **Recharts** - Charting library
- **Tailwind CSS** - Styling framework

## 📞 Support

For issues, questions, or contributions, please refer to the project documentation.

---

**Built with ❤️ for security professionals and developers**
