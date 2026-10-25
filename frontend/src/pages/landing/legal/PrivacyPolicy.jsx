import { LegalDocumentView } from './LegalDocumentView'
import { PRIVACY_POLICY_DATA } from './legalContent'

export function PrivacyPolicy() {
  return <LegalDocumentView data={PRIVACY_POLICY_DATA} />
}
