import { useParams } from 'react-router-dom'
import { HELP_DOCUMENTS } from './help/helpContent'
import { HelpDocumentView } from './help/HelpDocumentView'
import { HelpHub } from './help/HelpHub'

export function HelpCenter() {
  const { topicId } = useParams()

  if (!topicId) {
    return <HelpHub />
  }

  const doc = HELP_DOCUMENTS[topicId]

  if (!doc) {
    return <HelpHub />
  }

  return <HelpDocumentView data={doc} />
}
