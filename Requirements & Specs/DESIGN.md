# Design / UX Specification

## Product experience
A focused security workspace for developers. The interface should feel like a practical engineering tool, not a noisy AI chat application. Findings and evidence take priority over decorative visuals.

## Visual direction
- Default theme: clean light UI; optional dark theme.
- Every surface follows the selected theme, including the audit run console. That console is allowed its own emerald palette so it reads as one deliberate operations surface, but the palette is declared twice — light as the base, dark under `.dark` — and never pinned to one theme.
- Palette: Clean, readable, and suitable for long code reviews and detailed vulnerability reports.

#F8FAFC Background

#E2E8F0 Border

#166534 Forest

#7C3AED Purple

#1E293B Text

- Typography: readable sans-serif; compact but comfortable tables; clear hierarchy.
- Avoid: gradients everywhere, excessive cards, oversized headings, emoji, animated backgrounds, fake terminal effects, or AI-themed decoration.
- Use clear loading, empty, error, partial-scan, and permission-denied states.

## Navigation
Primary navigation:
- Overview
- Projects
- Scans
- Findings
- Settings

Within a project:
- Summary
- Scans
- Findings
- Project settings

## Key screens
### 1. Sign in
- Email and password or selected identity-provider flow.
- Password visibility toggle where relevant.
- Accessible validation and error states.
- Do not reveal whether an arbitrary email address is registered.

### 2. Overview
- Recent scans, active scans, unresolved high/critical findings, and recent activity.
- Metric cards must link to the filtered data behind each metric.
- Do not display fabricated sample metrics in production.

### 3. Projects
- Project name, source type, last scan, and unresolved finding count.
- Clear create-project and upload-source actions.
- Archive requires confirmation and explains the effect.

### 4. New scan
- Project selection, ZIP upload, file-size guidance, scanner options, privacy note.
- Show accepted formats and limits before upload.
- Explain that submitted code is analyzed but not executed.
- Show upload and scan progress separately.

### 5. Scan detail
- State, timestamps, tool status, duration, and high-level summary.
- Distinguish completed, completed-with-errors, failed, and cancelled.
- Explain which scanners ran or were skipped.

### 6. Findings
- Table columns: severity, finding title, category, file/line, confidence, status.
- Filters: severity, category, status, scanner.
- Default sort: critical/high first, then location.
- Avoid presenting AI confidence as a probability unless calibrated and defined.

### 7. Finding detail
- Title and severity.
- Evidence source and scanner rule.
- File path and line range.
- Escaped source excerpt with line numbers.
- Explanation, potential impact, remediation steps, and limitations.
- Actions: mark fixed, false positive, accepted risk; add triage note.
- AI explanation action is optional and visibly labelled.

### 8. Reports
- Preview before export.
- Markdown and JSON options.
- Include scan metadata and limitations.
- Do not include source code beyond the minimal evidence excerpt.

## Interaction rules
- Every asynchronous action has a pending state and recoverable error message.
- Confirm destructive actions.
- Preserve filters when navigating back from a finding.
- Keyboard-accessible dialogs, tables, and menus.
- Use text labels or icons with accessible names; never severity color alone.
- Display empty states that explain the next useful action.

## Control standards
The console has one control scale, expressed by the `Button`, `Input` and `SelectTrigger` primitives. A page picks a step; it does not set a height.

| Step | Button | Input / select | Use |
| --- | --- | --- | --- |
| `xs` | 24.5px, `text-xs` | — | dense inline actions (copy, row affordances) |
| `sm` | 28px | `size="sm"` 28px | toolbars, table actions, filter rows |
| `default` | 31.5px | `size="default"` 31.5px | every ordinary console control |
| `lg` | 35px | `size="lg"` 35px | page-level calls to action and auth form CTAs |

Heights are rem-based and the console root font is 14px, so the rendered pixels are these; do not read the class name as the pixel value.

- `block` makes a control full width. It replaces the per-page `className="w-full"` override, which fought the centered default.
- Icon steps mirror the same ladder: `icon-xs` 24.5px, `icon-sm` 28px, `icon` 31.5px, `icon-lg` 35px. Every icon-only trigger carries an `aria-label`.
- A control that composes a link (`render={<Link/>}`) keeps the same metrics as its step; navigation and action must not look like different systems.
- Anything that genuinely needs a non-standard surface — the copy control inside dark code chrome — keeps the step's metrics and overrides colour only, never geometry.
- A `variant="link"` control is a text affordance, not a control: it opts out of the height with `h-auto p-0`. It appears exactly once (`Clear filters` in the toolbar) and is not a substitute for a real button.

## Content tone
Clear, calm, precise, and non-alarmist. Prefer “Potential SQL injection” over definitive claims when context is incomplete. Separate observed evidence from inferred impact. Never promise that a scan proves code is secure.

## Responsive behavior
Desktop: findings table plus detail panel where space permits.  
Tablet: compact table with detail route/panel.  
Mobile: stacked finding cards with filter drawer; no horizontal overflow.
