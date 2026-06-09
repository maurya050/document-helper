'use client'
import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import { Message } from '@/types'

interface Props {
  messages: Message[]
  isStreaming: boolean
  onSend: (query: string) => void
  onNewDocument: () => void
}

export default function ChatWindow({ messages, isStreaming, onSend, onNewDocument }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#d0d7de] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span className="font-bold text-[#0969da]">Document Helper</span>
        </div>
        <button
          onClick={onNewDocument}
          className="text-sm text-[#57606a] hover:text-[#0969da] border border-[#d0d7de] rounded-md px-3 py-1 transition-colors"
        >
          + New document
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 bg-[#f6f8fa]">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[#57606a] mt-12">
            Ask a question about the loaded documentation.
          </p>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={onSend} disabled={isStreaming} />
    </div>
  )
}
