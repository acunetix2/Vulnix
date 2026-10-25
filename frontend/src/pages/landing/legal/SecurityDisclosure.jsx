import { LegalDocumentView } from './LegalDocumentView'
import { SECURITY_DISCLOSURE_DATA } from './legalContent'

export function SecurityDisclosure() {
  return <LegalDocumentView data={SECURITY_DISCLOSURE_DATA} />
}
