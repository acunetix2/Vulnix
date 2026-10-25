import { LegalDocumentView } from './LegalDocumentView'
import { TERMS_OF_SERVICE_DATA } from './legalContent'

export function TermsOfService() {
  return <LegalDocumentView data={TERMS_OF_SERVICE_DATA} />
}
