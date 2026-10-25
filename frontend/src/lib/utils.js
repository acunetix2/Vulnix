import { cn } from 'cn'
import { API_BASE_URL } from './constants'

export { cn }

export function formatDate(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return formatDate(dateString)
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function getSeverityColor(severity) {
  const colors = {
    critical: 'var(--severity-critical)',
    high: 'var(--severity-high)',
    medium: 'var(--severity-medium)',
    low: 'var(--severity-low)',
    info: 'var(--severity-info)',
  }
  return colors[severity?.toLowerCase()] || colors.info
}

export function truncate(str, length = 50) {
  if (!str) return ''
  return str.length > length ? `${str.substring(0, length)}...` : str
}

/**
 * Monogram for an account with no picture. The name is what the owner edits, so
 * it decides the letters; the handle is tried next and the email last, because
 * an account signed up through a provider may have no name at all.
 */
export function initialsOf(person) {
  const name = (person?.display_name || '').trim()
  if (name) {
    const words = name.split(/\s+/)
    const first = words[0].charAt(0)
    const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
    return (first + last).toUpperCase()
  }
  const handle = (person?.username || person?.email || '').trim()
  return handle.replace(/^@/, '').slice(0, 2).toUpperCase() || '?'
}

/**
 * An account picture is either the sign-in provider's own URL or a path this API
 * serves, so the console has to resolve the second against the API origin while
 * leaving the first alone.
 */
export function assetUrl(url) {
  if (!url) return null
  if (/^https?:/i.test(url)) return url
  return `${API_BASE_URL.replace(/\/+$/, '')}${url}`
}
