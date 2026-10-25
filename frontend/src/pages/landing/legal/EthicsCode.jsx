import { LegalDocumentView } from './LegalDocumentView'
import { ETHICS_CODE_DATA } from './legalContent'

export function EthicsCode() {
  return <LegalDocumentView data={ETHICS_CODE_DATA} />
}
