import { LegalDocumentView } from './LegalDocumentView'
import { SECURITY_OVERVIEW_DATA } from './legalContent'

export function SecurityOverview() {
  return <LegalDocumentView data={SECURITY_OVERVIEW_DATA} />
}
