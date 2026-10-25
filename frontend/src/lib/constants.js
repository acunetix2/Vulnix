export const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
}

export const SCAN_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  COMPLETED_WITH_ERRORS: 'completed_with_errors',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export const FINDING_STATUS = {
  OPEN: 'open',
  ACCEPTED_RISK: 'accepted_risk',
  FALSE_POSITIVE: 'false_positive',
  FIXED: 'fixed',
}

export const CONFIDENCE_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
}

// Relative by default so requests go through the Vite dev proxy (/api -> backend).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const UPLOAD_LIMITS = {
  MAX_SIZE_BYTES: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 10000,
  ACCEPTED_FORMATS: ['.zip'],
}
