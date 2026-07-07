import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  removeAriaLabel?: (tag: string) => string
  id?: string
  disabled?: boolean
}

const defaultRemoveAriaLabel = (tag: string): string => `Remove ${tag}`

/**
 * Free-text tag/chip input. Enter or comma commits the trimmed value,
 * splitting on commas so a pasted "A, B" becomes two tags (ignoring empty
 * or case-insensitive duplicates); Backspace on an empty input removes the
 * last tag. Chips use neutral token styling — semantic coloring (e.g. alert
 * colors for allergies) belongs to display contexts, not this editable
 * control.
 *
 * The draft is also committed on blur: a doctor who types a value and then
 * clicks a submit button (without pressing Enter) would otherwise lose the
 * uncommitted draft, because the submit handler reads `value` before the
 * draft ever makes it into state. Blur fires (and React flushes the
 * resulting state update) before the submit button's click handler runs,
 * so committing on blur closes that gap.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  removeAriaLabel = defaultRemoveAriaLabel,
  id,
  disabled,
}: TagInputProps): JSX.Element {
  const [draft, setDraft] = useState('')

  function commitDraft(): void {
    const parts = draft
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
    if (parts.length === 0) {
      setDraft('')
      return
    }
    const next = [...value]
    for (const part of parts) {
      const isDuplicate = next.some((tag) => tag.toLowerCase() === part.toLowerCase())
      if (!isDuplicate) {
        next.push(part)
      }
    }
    if (next.length !== value.length) {
      onChange(next)
    }
    setDraft('')
  }

  function removeAt(index: number): void {
    onChange(value.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
      return
    }
    if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      removeAt(value.length - 1)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 w-full min-h-input-md px-3 py-1.5',
        'bg-n-0 border rounded-sm',
        'transition-[border-color,box-shadow] duration-[100ms]',
        'border-n-300 focus-within:border-p-500 focus-within:shadow-[0_0_0_3px_rgba(45,87,96,0.12)]',
        disabled && 'bg-n-50 border-n-200 cursor-not-allowed',
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 bg-n-50 border border-n-200 text-n-700 rounded-sm px-2 py-0.5 text-[12.5px] font-sans"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={removeAriaLabel(tag)}
              className="text-n-400 hover:text-n-700 leading-none"
            >
              <i className="ph ph-x" style={{ fontSize: 11 }} />
            </button>
          )}
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'flex-1 min-w-[80px] outline-none bg-transparent text-[13px] font-sans',
          'text-n-700 placeholder:text-n-400',
          'disabled:cursor-not-allowed',
        )}
      />
    </div>
  )
}
