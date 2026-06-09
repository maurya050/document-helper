'use client'
import { useState } from 'react'

const QUICK_PICKS = [
  { label: 'python.langchain.com', url: 'https://python.langchain.com/' },
  { label: 'docs.anthropic.com', url: 'https://docs.anthropic.com/' },
]

interface Props {
  onDone: () => void
}

export default function UrlInput({ onDone }: Props) {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || loading) return
    setError(null)
    setLoading(true)
    setStatus('Starting...')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
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
          let data: { type: string; message?: string; chunks?: number }
          try {
            data = JSON.parse(line.slice(6))
          } catch {
            continue
          }
          if (data.type === 'progress') {
            setStatus(data.message ?? '')
          } else if (data.type === 'done') {
            setStatus(`Indexed ${data.chunks} chunks — ready!`)
            setTimeout(() => onDone(), 800)
          } else if (data.type === 'error') {
            setError(data.message ?? 'Unknown error')
            setLoading(false)
            setStatus(null)
          }
        }
      }
      setLoading(false)
    } catch {
      setError('Network error. Is the backend running on port 8000?')
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f8fa] flex items-center justify-center p-4">
      <div className="bg-white border border-[#d0d7de] rounded-xl shadow-sm p-8 w-full max-w-lg">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">📄</span>
          <h1 className="text-lg font-bold text-[#0969da]">Document Helper</h1>
        </div>
        <p className="text-sm text-[#57606a] mb-6">
          Which docs do you want to explore?
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://docs.example.com/"
              disabled={loading}
              className="flex-1 border border-[#d0d7de] focus:border-[#0969da] rounded-md px-3 py-2 text-sm outline-none disabled:bg-[#f6f8fa] disabled:text-[#57606a]"
            />
            <button
              type="submit"
              disabled={!url.trim() || loading}
              className="bg-[#0969da] hover:bg-[#0757ba] disabled:bg-[#d0d7de] text-white rounded-md px-4 py-2 text-sm font-semibold transition-colors"
            >
              Go →
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {QUICK_PICKS.map(p => (
              <button
                key={p.url}
                type="button"
                onClick={() => setUrl(p.url)}
                disabled={loading}
                className="text-xs border border-[#d0d7de] rounded-md px-3 py-1 text-[#57606a] hover:border-[#0969da] hover:text-[#0969da] transition-colors disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {status && (
          <div className="mt-4 bg-[#fff8c5] border border-[#d4a72c] rounded-md px-3 py-2 text-sm text-[#7d4e00]">
            ⏳ {status}
          </div>
        )}
      </div>
    </div>
  )
}
