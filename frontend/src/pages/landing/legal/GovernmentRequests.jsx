import { LegalDocumentView } from './LegalDocumentView'
import { GOVERNMENT_REQUESTS_DATA } from './legalContent'

export function GovernmentRequests() {
  return <LegalDocumentView data={GOVERNMENT_REQUESTS_DATA} />
}
