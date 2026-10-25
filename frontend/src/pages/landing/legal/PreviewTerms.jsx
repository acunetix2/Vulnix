import { LegalDocumentView } from './LegalDocumentView'
import { PREVIEW_TERMS_DATA } from './legalContent'

export function PreviewTerms() {
  return <LegalDocumentView data={PREVIEW_TERMS_DATA} />
}
