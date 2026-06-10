import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
      <div className="bg-white border border-[#d0d7de] rounded-xl rounded-bl-sm px-4 py-3 text-sm text-[#24292f]">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
            h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#0969da] hover:underline">
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="bg-[#f6f8fa] border border-[#d0d7de] rounded px-1 py-0.5 text-xs font-mono">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="bg-[#f6f8fa] border border-[#d0d7de] rounded p-3 overflow-x-auto text-xs font-mono mb-2">
                {children}
              </pre>
            ),
            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            hr: () => <hr className="border-[#d0d7de] my-2" />,
          }}
        >
          {message.content}
        </ReactMarkdown>
        {message.streaming && (
          <span className="inline-block w-0.5 h-4 bg-[#0969da] ml-1 animate-pulse align-middle" />
        )}
      </div>
      {!message.streaming && <SourceCitation sources={message.sources} />}
    </div>
  )
}
