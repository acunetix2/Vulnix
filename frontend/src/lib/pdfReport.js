import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const SEVERITY_COLORS = {
  critical: [220, 38, 38], // #dc2626
  high: [234, 88, 12],    // #ea580c
  medium: [217, 119, 6],  // #d97706
  low: [37, 99, 235],     // #2563eb
  info: [100, 116, 139],  // #64748b
}

export function generateAuditPdf({ scan, project, findings = [] }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  // --- Header Banner ---
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('VULNIX', margin, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(148, 163, 184) // Slate 400
  doc.text('Security Audit & Vulnerability Report', margin + 30, 14)

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, 14, { align: 'right' })

  // --- Sub-header Metadata ---
  let y = 38
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Audit Overview', margin, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)

  const projectTitle = project?.name || 'Repository Audit'
  const scanId = scan?.id || '—'
  const status = (scan?.status || 'completed').toUpperCase()
  const completedAt = scan?.completed_at ? new Date(scan.completed_at).toLocaleString() : '—'

  doc.text(`Target / Project: ${projectTitle}`, margin, y)
  doc.text(`Status: ${status}`, margin + 80, y)
  y += 5
  doc.text(`Audit ID: ${scanId}`, margin, y)
  doc.text(`Completed: ${completedAt}`, margin + 80, y)

  // --- Executive Summary Box ---
  y += 9
  const summary = scan?.summary || {}
  const totalFindings = summary?.total_findings ?? findings.length
  const bySev = summary?.by_severity || {
    critical: findings.filter((f) => f.severity === 'critical').length,
    high: findings.filter((f) => f.severity === 'high').length,
    medium: findings.filter((f) => f.severity === 'medium').length,
    low: findings.filter((f) => f.severity === 'low').length,
    info: findings.filter((f) => f.severity === 'info').length,
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Severity', 'Count', 'Risk Level', 'Description']],
    body: [
      ['Critical', String(bySev.critical || 0), 'Severe', 'Immediate exploitability or data compromise'],
      ['High', String(bySev.high || 0), 'High', 'Significant security defect requiring prompt action'],
      ['Medium', String(bySev.medium || 0), 'Moderate', 'Conditionally exploitable vulnerability'],
      ['Low', String(bySev.low || 0), 'Low', 'Hardening or defense-in-depth opportunity'],
      ['Info', String(bySev.info || 0), 'Informational', 'Security notice or code best practice'],
    ],
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', width: 25 },
      1: { fontStyle: 'bold', width: 20 },
      2: { width: 28 },
      3: { width: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 0) {
        const sev = data.cell.raw.toLowerCase()
        if (SEVERITY_COLORS[sev]) {
          data.cell.styles.textColor = SEVERITY_COLORS[sev]
        }
      }
    },
  })

  // --- Tool Runs Table ---
  const toolRuns = scan?.tool_runs || []
  if (toolRuns.length > 0) {
    const nextY = doc.lastAutoTable.finalY + 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59)
    doc.text('Executed Scanners & Reviewers', margin, nextY)

    autoTable(doc, {
      startY: nextY + 3,
      margin: { left: margin, right: margin },
      head: [['Scanner Tool', 'Version', 'Status', 'Duration (ms)', 'Findings']],
      body: toolRuns.map((r) => [
        r.tool_name || 'Agent',
        r.tool_version || '1.0',
        (r.status || 'succeeded').toUpperCase(),
        r.duration_ms != null ? String(r.duration_ms) : '—',
        String(r.finding_count ?? 0),
      ]),
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
    })
  }

  // --- Findings Inventory Table ---
  const findingsY = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(`Findings Inventory (${totalFindings})`, margin, findingsY)

  const findingsRows = findings.map((f, i) => {
    const loc = f.file_path ? `${f.file_path}${f.start_line ? `:${f.start_line}` : ''}` : 'Unknown'
    const desc = f.scanner_message || f.evidence || f.remediation || '—'
    return [
      `#${i + 1}`,
      (f.severity || 'info').toUpperCase(),
      f.title || f.rule_id || 'Untitled Finding',
      f.category || 'General',
      loc,
      desc.length > 120 ? `${desc.slice(0, 117)}…` : desc,
    ]
  })

  autoTable(doc, {
    startY: findingsY + 3,
    margin: { left: margin, right: margin },
    head: [['#', 'Severity', 'Title', 'Category', 'Location', 'Evidence / Remediation']],
    body: findingsRows.length > 0 ? findingsRows : [['—', 'None', 'No vulnerabilities detected', '—', '—', '—']],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { width: 10, halign: 'center' },
      1: { width: 22, fontStyle: 'bold' },
      2: { width: 45, fontStyle: 'bold' },
      3: { width: 25 },
      4: { width: 35 },
      5: { width: 'auto' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 1) {
        const sev = data.cell.raw.toLowerCase()
        if (SEVERITY_COLORS[sev]) {
          data.cell.styles.textColor = SEVERITY_COLORS[sev]
        }
      }
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageNum = doc.internal.getNumberOfPages()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Vulnix Security Audit Report · Confidential · Page ${data.pageNumber}`,
        margin,
        pageHeight - 8
      )
      doc.text('https://vulnix.security', pageWidth - margin, pageHeight - 8, { align: 'right' })
    },
  })

  const filename = `vulnix-audit-${(scan?.id || 'report').slice(0, 8)}-${Date.now()}.pdf`
  doc.save(filename)
  return filename
}
