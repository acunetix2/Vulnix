/**
 * Server-side integration errors arrive as stable codes. Mapping them to
 * sentences here keeps the integration pages from each inventing their own
 * explanation of the same refusal.
 */
const ERROR_HINTS = {
  INTEGRATIONS_DISABLED:
    'Outbound integrations are switched off on this server. An administrator sets VULNIX_INTEGRATIONS_ENABLED to turn them on.',
  INTEGRATION_KEY_MISSING:
    'This server has no integration secret key, so nothing can be stored. Set VULNIX_INTEGRATION_SECRET_KEY.',
  INTEGRATION_NOT_CONFIGURED: 'Connect this integration first.',
  INTEGRATION_CONFIG_INCOMPLETE: 'Some required settings are missing.',
  INVALID_WEBHOOK_URL: 'Only HTTPS URLs on port 443 or 8443, without credentials, are allowed.',
  TARGET_BLOCKED:
    'The target resolved to a private, loopback or link-local address, so Vulnix refused to send to it.',
  TARGET_UNREACHABLE: 'The target host could not be resolved or connected to.',
  TARGET_TIMEOUT: 'The target did not answer within the outbound timeout.',
  REDIRECT_REFUSED: 'Vulnix does not follow redirects: the target answered with a 3xx.',
  PAYLOAD_TOO_LARGE: 'The payload is larger than the outbound body cap.',
  DECRYPT_FAILED: 'The stored credential could not be decrypted, so this integration must be connected again.',
  CONFIG_INCOMPLETE: 'The stored configuration is missing a required value.',
  TARGET_MISSING: 'The target this delivery was queued for no longer exists.',

  // Consent window. The provider's own screen is where a credential is typed,
  // so these all describe the trip back rather than a form.
  OAUTH_APP_NOT_CONFIGURED:
    'This server has no OAuth app for that provider. An administrator sets its client id and secret in the environment.',
  GITHUB_APP_NOT_CONFIGURED:
    'The GitHub App is not configured. An administrator must set its App ID, slug, private key, and callback URL.',
  OAUTH_REDIRECT_NOT_CONFIGURED:
    'This server has no public callback address, so a provider has nowhere to return to. Set VULNIX_OAUTH_REDIRECT_BASE_URL.',
  OAUTH_STATE_INVALID: 'That approval link is not valid. Start the connection again.',
  OAUTH_STATE_EXPIRED: 'The approval window closed before it was used. Start the connection again.',
  OAUTH_CODE_MISSING: 'The provider returned no approval, so nothing was connected.',
  OAUTH_REJECTED: 'The provider refused the approval. Try again, and check the app settings there.',
  OAUTH_BAD_RESPONSE: 'The provider did not return a token.',
  OAUTH_TIMEOUT: 'The provider did not answer in time.',
  OAUTH_UNREACHABLE: 'The provider could not be reached from this server.',
  OAUTH_NOT_CONNECTED: 'Connect this integration before using its account data.',
  OAUTH_TOKEN_UNREADABLE:
    'The stored token cannot be decrypted with this server key, so the connection must be redone.',
  OAUTH_CONNECTION_EXPIRED: 'The approval has run out. Reconnect to continue.',
  OAUTH_TOKEN_REVOKED: 'Access was revoked at the provider. Reconnect to grant it again.',
  JIRA_SITE_NOT_GRANTED: 'This connection was not granted that Jira site.',
  GITHUB_REPO_NOT_AVAILABLE: 'GitHub does not show that repository to this connection.',
  GITHUB_INSTALLATION_INCOMPLETE:
    'The GitHub App installation did not finish. Start the connection again and complete the GitHub prompt.',
  GITHUB_INSTALLATION_MISSING:
    'GitHub did not return an installation. Start the connection again and finish installing the app.',
  GITHUB_INSTALLATION_UNAVAILABLE:
    'GitHub could not verify this installation. Check that the app is installed on this account, then reconnect.',
  GITHUB_REPO_INVALID: 'That repository name cannot be fetched.',
  GITHUB_REF_INVALID: 'That branch or tag name cannot be fetched.',
  OAUTH_RESOURCE_UNAVAILABLE: 'The provider could not answer this request. Try again in a moment.',
}

/**
 * Why a Connect button is missing, in the same voice as the errors above. The
 * reason code is the server's, so this is the honest version of "not available".
 */
const CAPABILITY_HINTS = {
  OAUTH_APP_NOT_CONFIGURED:
    'No OAuth app is registered for this provider on this server, so there is nothing to connect to yet.',
  OAUTH_REDIRECT_NOT_CONFIGURED:
    'This server has no public callback address, so a provider could not return to it. Connect becomes available once an administrator sets it.',
  GITHUB_APP_NOT_CONFIGURED:
    'The GitHub App installation credentials are missing on this server. An administrator needs to configure them before GitHub can be connected.',
}

const DELIVERY_LABELS = {
  'scan.completed': 'Audit completed',
  'scan.failed': 'Audit failed',
  'finding.triaged': 'Finding triaged',
  'integration.test': 'Test send',
}

export function integrationErrorText(error) {
  if (!error) return 'The request could not be completed.'
  return ERROR_HINTS[error.code] || error.message || 'The request could not be completed.'
}

export function eventLabel(eventType) {
  return DELIVERY_LABELS[eventType] || eventType
}

export function integrationErrorHint(code) {
  return ERROR_HINTS[code] || ''
}

export function capabilityReasonText(reason) {
  return CAPABILITY_HINTS[reason] || 'This server cannot connect to that provider.'
}
