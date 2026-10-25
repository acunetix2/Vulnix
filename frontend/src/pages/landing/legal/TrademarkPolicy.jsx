import { LegalDocumentView } from './LegalDocumentView'
import { TRADEMARK_DATA } from './legalContent'

export function TrademarkPolicy() {
  return <LegalDocumentView data={TRADEMARK_DATA} />
}
