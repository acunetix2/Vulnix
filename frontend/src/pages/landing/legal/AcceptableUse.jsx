import { LegalDocumentView } from './LegalDocumentView'
import { ACCEPTABLE_USE_DATA } from './legalContent'

export function AcceptableUse() {
  return <LegalDocumentView data={ACCEPTABLE_USE_DATA} />
}
