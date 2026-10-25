import { LegalDocumentView } from './LegalDocumentView'
import { DPA_DATA } from './legalContent'

export function DPA() {
  return <LegalDocumentView data={DPA_DATA} />
}
