'use client'
import { useState } from 'react'

interface Props {
  sources: string[]
}

export default function SourceCitation({ sources }: Props) {
  const [open, setOpen] = useState(false)
  if (!sources.length) return null

  return (
    <div className="mt-2 border border-[#2da44e] rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#1a7f37] bg-[#dafbe1] hover:bg-[#c8f0d4] transition-colors text-left"
      >
        <span>📎 {sources.length} source{sources.length !== 1 ? 's' : ''}</span>
        <span className="ml-auto">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-3 py-2 bg-white flex flex-col gap-1">
          {sources.map(src => (
            <li key={src}>
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0969da] hover:underline break-all"
              >
                {src}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
