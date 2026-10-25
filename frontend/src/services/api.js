import { API_BASE_URL } from '../lib/constants'

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

async function request(url, options) {
  return fetch(url, options)
}

/**
 * A caller that presented a credential and was told it is invalid has no session
 * left; every page under it would otherwise render its failed state. The router
 * layer registers what ending the session means.
 */
let endSession = null

export function setUnauthorizedHandler(handler) {
  endSession = handler
}

function noteUnauthorized(response) {
  // Only a request that carried a token can discover the token is dead.
  if (response.status === 401 && localStorage.getItem('auth_token')) endSession?.()
}

/**
 * A rejected request comes back with the field it broke, not why. Naming the
 * field is the difference between a form the user can fix and a dead end.
 */
function describeError(data) {
  const message =
    data?.detail || data?.error?.message || data?.message || null
  if (!message) return null
  const fields = Array.isArray(data?.error?.details)
    ? [...new Set(data.error.details.map((d) => String(d?.field || '').split('.').pop()).filter(Boolean))]
    : []
  if (!fields.length) return message
  return `${message} Check ${fields.join(' and ')}.`
}

async function handleResponse(response) {
  if (!response.ok) {
    noteUnauthorized(response)
    const data = await response.json().catch(() => null)

    throw new ApiError(
      // FastAPI: { detail: "..." } | Supabase-style: { error: { message, code, details } }
      describeError(data) || `Request failed with status ${response.status}`,
      response.status,
      data?.error?.code,
      data?.error?.details
    )
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }

  return response
}

export function getAuthHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/*
 * Read cache.
 *
 * Almost every page in the console asks for the same handful of rows on mount -
 * the workspace list, the projects, the reviewer roster - and each of those
 * mounts used to cost its own request. Two mechanisms fix that:
 *
 *   - requests for the same path that overlap in time share one promise, so a
 *     page that mounts three panels makes one call, and
 *   - a TTL lets a path be answered from memory while it is still fresh.
 *
 * Resources a page *polls* (a scan in flight, an unpacking upload) keep
 * ttl = 0: they still collapse concurrent duplicates, but they are never served
 * stale. Everything else that changes is dropped by prefix on the write that
 * changed it, so a mutation is visible on the next read rather than after a
 * timeout.
 */
const fresh = new Map() // path -> { at, value }
const pending = new Map() // path -> Promise

/** Longest a read may be answered from memory. */
const TTL = {
  none: 0,
  short: 15_000,
  list: 30_000,
  roster: 60_000,
}

function keyOf(path, query) {
  if (!query) return path
  const qs = typeof query === 'string' ? query : new URLSearchParams(query).toString()
  return qs ? `${path}?${qs}` : path
}

async function getJson(path, { ttl = TTL.list, query } = {}) {
  const key = keyOf(path, query)
  const inFlight = pending.get(key)
  if (inFlight) return inFlight

  if (ttl > 0) {
    const hit = fresh.get(key)
    if (hit && Date.now() - hit.at < ttl) return hit.value
  }

  const call = request(`${API_BASE_URL}${key}`, { headers: getAuthHeaders() })
    .then(handleResponse)
    .then((value) => {
      if (ttl > 0) fresh.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => pending.delete(key))

  pending.set(key, call)
  return call
}

/** Drop every cached read under these path prefixes. */
export function invalidate(...prefixes) {
  for (const key of fresh.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) fresh.delete(key)
  }
}

/** Used when the caller stops being the same person, or the token rotates. */
export function clearApiCache() {
  fresh.clear()
}

export const api = {
  // Server readiness (no auth): used to know whether outbound integrations are
  // switched on before offering a form that could only fail.
  getSystemStatus: () => getJson('/ready', { ttl: TTL.roster }),

  // Auth. A session change invalidates everything: every cached row below was
  // fetched for the account that just signed out.
  async login(email, password) {
    clearApiCache()
    const response = await request(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    return handleResponse(response)
  },

  async signup(email, password, displayName, redirectUri) {
    clearApiCache()
    const response = await request(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        display_name: displayName,
        redirect_uri: redirectUri || `${window.location.origin}/auth/callback`,
      }),
    })
    return handleResponse(response)
  },

  async resendConfirmation(email, redirectUri) {
    const response = await request(`${API_BASE_URL}/auth/resend-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        redirect_uri: redirectUri || `${window.location.origin}/auth/callback`,
      }),
    })
    return handleResponse(response)
  },

  async confirmEmail(code, redirectUri) {
    const response = await request(`${API_BASE_URL}/auth/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        redirect_uri: redirectUri || `${window.location.origin}/auth/callback`,
      }),
    })
    return handleResponse(response)
  },

  // Account: the profile row Vulnix owns. Credentials stay with the provider,
  // so the writes here are the display name, the handle and the picture.
  getMe: () => getJson('/auth/me', { ttl: TTL.roster }),

  checkUsername: (username) =>
    getJson(`/auth/check-username?username=${encodeURIComponent(username)}`, { ttl: TTL.none }),

  searchUsers: (query) =>
    getJson(`/auth/users/search?q=${encodeURIComponent(query)}`, { ttl: TTL.none }),

  async finishOnboarding() {
    const response = await request(`${API_BASE_URL}/auth/me/onboarding`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    const value = await handleResponse(response)
    invalidate('/auth/me')
    return value
  },

  async updateProfile(changes) {
    const response = await request(`${API_BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(changes),
    })
    const value = await handleResponse(response)
    invalidate('/auth/me')
    return value
  },

  async uploadAvatar(file) {
    const form = new FormData()
    form.append('file', file)
    const response = await request(`${API_BASE_URL}/auth/me/avatar`, {
      method: 'POST',
      // Only the Authorization header: FormData needs the browser to generate
      // the multipart boundary, which an explicit Content-Type would defeat.
      headers: getAuthHeaders(),
      body: form,
    })
    const value = await handleResponse(response)
    invalidate('/auth/me')
    return value
  },

  async changePassword(password) {
    const response = await request(`${API_BASE_URL}/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ password }),
    })
    return handleResponse(response)
  },

  // Workspaces
  getWorkspaces: () => getJson('/workspaces', { ttl: TTL.roster }),

  getWorkspace: (workspaceId) => getJson(`/workspaces/${workspaceId}`, { ttl: TTL.roster }),

  getMembers: (workspaceId) =>
    getJson(`/workspaces/${workspaceId}/members`, { ttl: TTL.list }),

  getAuditEvents: (workspaceId, params = {}) =>
    getJson(`/workspaces/${workspaceId}/audit-events`, { ttl: TTL.list, query: params }),

  async createWorkspace(name) {
    const response = await request(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ name }),
    })
    const value = await handleResponse(response)
    invalidate('/workspaces')
    return value
  },

  async updateWorkspace(workspaceId, data) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate('/workspaces')
    return value
  },

  async addMember(workspaceId, identifier, role = 'member') {
    const payload =
      typeof identifier === 'object' && identifier !== null
        ? { role, ...identifier }
        : { identifier, role }
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}`)
    return value
  },

  async setMemberRole(workspaceId, userId, role) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ role }),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}`)
    return value
  },

  async removeMember(workspaceId, userId) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}`)
    return value
  },

  // The confirmation is the workspace name, carried in the body because an
  // irreversible action should not be triggerable by a URL alone.
  async deleteWorkspace(workspaceId, confirmName) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ confirm_name: confirmName }),
    })
    const value = await handleResponse(response)
    clearApiCache()
    return value
  },

  // Projects
  getProjects: (workspaceId, params = {}) =>
    getJson(`/workspaces/${workspaceId}/projects`, { ttl: TTL.list, query: params }),

  getProject: (projectId) => getJson(`/projects/${projectId}`, { ttl: TTL.list }),

  async createProject(workspaceId, data) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/projects`, '/workspaces')
    return value
  },

  async updateProject(projectId, data) {
    const response = await request(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate('/projects/', '/workspaces')
    return value
  },

  async deleteProject(projectId, confirmName) {
    const response = await request(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm_name: confirmName }),
    })
    const value = await handleResponse(response)
    invalidate('/projects/', '/workspaces')
    return value
  },

  // Uploads. Intake is polled while an archive is checked and unpacked, so it
  // is never served from memory.
  async createUpload(projectId, file, idempotencyKey = null) {
    const formData = new FormData()
    formData.append('file', file)

    const headers = { ...getAuthHeaders() }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

    const response = await request(`${API_BASE_URL}/projects/${projectId}/uploads`, {
      method: 'POST',
      headers,
      body: formData,
    })
    const value = await handleResponse(response)
    invalidate('/projects/')
    return value
  },

  getUpload: (uploadId) => getJson(`/uploads/${uploadId}`, { ttl: TTL.none }),

  async deleteUpload(uploadId) {
    const response = await request(`${API_BASE_URL}/uploads/${uploadId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    return handleResponse(response)
  },

  // Audits. A run in flight is polled for its status, so the single-run read
  // stays uncached; the history list is the one worth remembering.
  getScans: (projectId, params = {}) =>
    getJson(`/projects/${projectId}/scans`, { ttl: TTL.short, query: params }),

  getScan: (scanId) => getJson(`/scans/${scanId}`, { ttl: TTL.none }),

  async createScan(projectId, data, idempotencyKey = null) {
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() }
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

    const response = await request(`${API_BASE_URL}/projects/${projectId}/scans`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate('/projects/', '/workspaces')
    return value
  },

  async cancelScan(scanId) {
    const response = await request(`${API_BASE_URL}/scans/${scanId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    const value = await handleResponse(response)
    invalidate('/projects/')
    return value
  },

  // Findings
  getFindings: (scanId, params = {}) =>
    getJson(`/scans/${scanId}/findings`, { ttl: TTL.short, query: params }),

  getFinding: (findingId) => getJson(`/findings/${findingId}`, { ttl: TTL.list }),

  async updateFinding(findingId, data) {
    const response = await request(`${API_BASE_URL}/findings/${findingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate('/findings/', '/scans/')
    return value
  },

  async explainFinding(findingId) {
    const response = await request(`${API_BASE_URL}/findings/${findingId}/explanation`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    const value = await handleResponse(response)
    // The row now carries the answer, and today's credit count moved.
    invalidate('/findings/', '/scans/', '/ai/usage', '/workspaces')
    return value
  },

  // AI reviewer: available reviewers, workspace selection, credit usage.
  // A selection is an opaque token from the list; a model name is never sent.
  getAiSettings: (workspaceId) =>
    getJson(`/workspaces/${workspaceId}/ai/settings`, { ttl: TTL.list }),

  async setAiModel(workspaceId, selection) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/ai/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ model_id: selection }),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/ai`)
    return value
  },

  getAiUsage: (workspaceId, params = {}) =>
    getJson(`/workspaces/${workspaceId}/ai/usage`, { ttl: TTL.list, query: params }),

  // OAuth connections: the consent window and the account data it unlocks.
  // No method here takes a token - the provider's own window is the only place
  // a credential is ever typed, and it is typed at the provider.
  getProviderCapabilities: (workspaceId) =>
    getJson(`/workspaces/${workspaceId}/integrations/providers`, { ttl: TTL.list }),

  getConnections: (workspaceId) =>
    getJson(`/workspaces/${workspaceId}/integrations/connections`, { ttl: TTL.list }),

  getGitHubRepositories: (workspaceId, page = 1, search = '') =>
    getJson(`/workspaces/${workspaceId}/integrations/github/repositories`, {
      ttl: TTL.none,
      query: { page, search },
    }),

  async startConnect(workspaceId, provider) {
    const response = await request(
      `${API_BASE_URL}/workspaces/${workspaceId}/integrations/${provider}/connect`,
      { method: 'POST', headers: getAuthHeaders() }
    )
    return handleResponse(response)
  },

  async disconnect(workspaceId, provider) {
    const response = await request(
      `${API_BASE_URL}/workspaces/${workspaceId}/integrations/${provider}/connection`,
      { method: 'DELETE', headers: getAuthHeaders() }
    )
    // 204: there is no body to read back.
    if (response.ok) {
      invalidate(`/workspaces/${workspaceId}/integrations`)
      return null
    }
    return handleResponse(response)
  },

  async importGitHubRepository(projectId, repoId, ref = '') {
    const response = await request(`${API_BASE_URL}/projects/${projectId}/uploads/github`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ repo_id: repoId, ref }),
    })
    const value = await handleResponse(response)
    invalidate('/projects/')
    return value
  },

  // Webhooks
  getWebhooks: (workspaceId) => getJson(`/workspaces/${workspaceId}/webhooks`, { ttl: TTL.list }),

  getDeliveries: (workspaceId, params = {}) =>
    getJson(`/workspaces/${workspaceId}/integrations/deliveries`, { ttl: TTL.short, query: params }),

  async createWebhook(workspaceId, data) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/webhooks`)
    return value
  },

  async updateWebhook(workspaceId, webhookId, data) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/webhooks/${webhookId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/webhooks`)
    return value
  },

  async deleteWebhook(workspaceId, webhookId) {
    const response = await request(`${API_BASE_URL}/workspaces/${workspaceId}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/webhooks`)
    return value
  },

  async testWebhook(workspaceId, webhookId) {
    const response = await request(
      `${API_BASE_URL}/workspaces/${workspaceId}/webhooks/${webhookId}/test`,
      { method: 'POST', headers: getAuthHeaders() }
    )
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/integrations/deliveries`)
    return value
  },

  async rotateWebhookSecret(workspaceId, webhookId) {
    const response = await request(
      `${API_BASE_URL}/workspaces/${workspaceId}/webhooks/${webhookId}/rotate-secret`,
      { method: 'POST', headers: getAuthHeaders() }
    )
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/webhooks`)
    return value
  },

  async redeliverDelivery(workspaceId, deliveryId) {
    const response = await request(
      `${API_BASE_URL}/workspaces/${workspaceId}/integrations/deliveries/${deliveryId}/redeliver`,
      { method: 'POST', headers: getAuthHeaders() }
    )
    const value = await handleResponse(response)
    invalidate(`/workspaces/${workspaceId}/integrations/deliveries`)
    return value
  },

  // Reports are a download, not JSON: nothing to cache, nothing to parse.
  async getReport(scanId, format = 'json') {
    const response = await request(`${API_BASE_URL}/scans/${scanId}/report?format=${format}`, {
      headers: getAuthHeaders(),
    })
    return response
  },

  async shareReport(scanId, data) {
    const response = await request(`${API_BASE_URL}/scans/${scanId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    })
    return handleResponse(response)
  },
}

export { ApiError }
