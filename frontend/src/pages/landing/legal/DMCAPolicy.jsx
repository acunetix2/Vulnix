import { LegalDocumentView } from './LegalDocumentView'
import { DMCA_DATA } from './legalContent'

export function DMCAPolicy() {
  return <LegalDocumentView data={DMCA_DATA} />
}
