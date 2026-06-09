import SourceCitation from './SourceCitation'
import { Message } from '@/types'

interface Props {
  message: Message
}

export default function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-[#0969da] text-white rounded-xl rounded-br-sm px-4 py-2 max-w-[75%] text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col max-w-[85%]">
      <div className="bg-white border border-[#d0d7de] rounded-xl rounded-bl-sm px-4 py-3 text-sm text-[#24292f] whitespace-pre-wrap">
        {message.content}
        {message.streaming && (
          <span className="inline-block w-0.5 h-4 bg-[#0969da] ml-1 animate-pulse align-middle" />
        )}
      </div>
      {!message.streaming && <SourceCitation sources={message.sources} />}
    </div>
  )
}
