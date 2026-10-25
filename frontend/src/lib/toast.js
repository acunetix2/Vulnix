import { toast } from 'sonner'

/**
 * Common toast notification patterns for Vulnix
 */

export const toastSuccess = (message, description) => {
  toast.success(message, {
    description,
    duration: 4000
  })
}

export const toastError = (message, description) => {
  toast.error(message, {
    description,
    duration: 5000
  })
}

export const toastInfo = (message, description) => {
  toast.info(message, {
    description,
    duration: 4000
  })
}

export const toastWarning = (message, description) => {
  toast.warning(message, {
    description,
    duration: 4000
  })
}

export const toastLoading = (message, description) => {
  return toast.loading(message, {
    description
  })
}

export const toastPromise = (promise, messages) => {
  return toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    duration: 4000
  })
}

// Common toast messages for Vulnix actions
export const commonToasts = {
  // Auth
  signInSuccess: () => toastSuccess('Welcome back!', 'You have been successfully signed in.'),
  signInError: (error) => toastError('Sign in failed', error || 'Invalid credentials. Please try again.'),
  signUpSuccess: () => toastSuccess('Account created!', 'Welcome to Vulnix!'),
  signUpError: (error) => toastError('Sign up failed', error || 'Unable to create account. Please try again.'),
  signOutSuccess: () => toastSuccess('Signed out', 'You have been successfully signed out.'),
  
  // OAuth
  oauthSuccess: (provider) => toastSuccess(`${provider} connected!`, `Successfully signed in with ${provider}.`),
  oauthError: (provider, error) => toastError(`${provider} sign in failed`, error || `Unable to sign in with ${provider}.`),
  
  // Projects
  projectCreated: () => toastSuccess('Project created', 'Your project has been created successfully.'),
  projectUpdated: () => toastSuccess('Project updated', 'Your changes have been saved.'),
  projectDeleted: () => toastSuccess('Project deleted', 'The project has been removed.'),
  projectError: (error) => toastError('Project action failed', error || 'Unable to complete the action.'),
  
  // Audits
  scanStarted: () => toastSuccess('Audit started', 'Your security audit is now running.'),
  scanCompleted: () => toastSuccess('Audit completed', 'Security audit finished successfully.'),
  scanFailed: (error) => toastError('Audit failed', error || 'The security audit encountered an error.'),
  scanCancelled: () => toastInfo('Audit cancelled', 'The security audit has been cancelled.'),
  
  // Findings
  findingTriaged: (status) => toastSuccess('Finding updated', `Status changed to ${status}.`),
  findingError: (error) => toastError('Finding action failed', error || 'Unable to update the finding.'),
  
  // AI
  aiExplanationGenerated: () => toastSuccess('AI explanation ready', 'Your security insight has been generated.'),
  aiError: (error) => toastError('AI action failed', error || 'Unable to generate AI insight.'),
  
  // Upload
  uploadStarted: () => toastInfo('Uploading...', 'Your file is being uploaded.'),
  uploadSuccess: () => toastSuccess('Upload complete', 'Your file has been uploaded successfully.'),
  uploadError: (error) => toastError('Upload failed', error || 'Unable to upload the file.'),
  
  // Generic
  saved: () => toastSuccess('Saved', 'Your changes have been saved.'),
  deleted: () => toastSuccess('Deleted', 'The item has been deleted.'),
  copied: () => toastInfo('Copied', 'Copied to clipboard.'),
  updateAvailable: () => toastInfo('Update available', 'A new version is available. Refresh to update.'),
  networkError: () => toastError('Network error', 'Unable to connect to the server. Please check your connection.'),
  permissionDenied: () => toastError('Permission denied', 'You do not have permission to perform this action.'),
  validationError: (error) => toastWarning('Validation error', error || 'Please check your input and try again.')
}
