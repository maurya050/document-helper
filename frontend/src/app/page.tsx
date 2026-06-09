'use client'
import { useState } from 'react'
import UrlInput from '@/components/UrlInput'
import ChatWindow from '@/components/ChatWindow'
import { Message } from '@/types'

export default function Home() {
  const [step, setStep] = useState<'ingest' | 'chat'>('ingest')
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  const handleIngestDone = () => setStep('chat')

  const handleNewDocument = () => {
    setMessages([])
    setStep('ingest')
  }

  const handleSend = async (query: string) => {
    if (isStreaming) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      sources: [],
      streaming: false,
    }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      sources: [],
      streaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value)
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let data: { type: string; content?: string; sources?: string[]; message?: string }
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }

          if (data.type === 'token') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + (data.content ?? '') } : m
              )
            )
          } else if (data.type === 'sources') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId ? { ...m, sources: data.sources ?? [] } : m
              )
            )
          } else if (data.type === 'done') {
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, streaming: false } : m))
            )
          } else if (data.type === 'error') {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: `Error: ${data.message}`, streaming: false }
                  : m
              )
            )
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Network error. Please try again.', streaming: false }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <main className="h-screen">
      {step === 'ingest' ? (
        <UrlInput onDone={handleIngestDone} />
      ) : (
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          onNewDocument={handleNewDocument}
        />
      )}
    </main>
  )
}
