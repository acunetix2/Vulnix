import { LegalDocumentView } from './LegalDocumentView'
import { CORPORATE_TERMS_DATA } from './legalContent'

export function CorporateTerms() {
  return <LegalDocumentView data={CORPORATE_TERMS_DATA} />
}
