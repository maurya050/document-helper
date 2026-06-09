'use client'
import { useState, useRef } from 'react'

interface Props {
  onSend: (query: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`
  }

  return (
    <div className="flex gap-2 items-end p-4 border-t border-[#d0d7de] bg-white">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={1}
        placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
        className="flex-1 resize-none border border-[#d0d7de] focus:border-[#0969da] rounded-lg px-3 py-2 text-sm outline-none disabled:bg-[#f6f8fa] disabled:text-[#57606a] overflow-hidden"
      />
      <button
        onClick={submit}
        disabled={!value.trim() || disabled}
        className="bg-[#0969da] hover:bg-[#0757ba] disabled:bg-[#d0d7de] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors self-end"
      >
        →
      </button>
    </div>
  )
}
