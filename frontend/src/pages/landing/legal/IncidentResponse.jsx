import { LegalDocumentView } from './LegalDocumentView'
import { INCIDENT_RESPONSE_DATA } from './legalContent'

export function IncidentResponse() {
  return <LegalDocumentView data={INCIDENT_RESPONSE_DATA} />
}
