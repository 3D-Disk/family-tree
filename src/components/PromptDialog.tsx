import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

interface Props {
  title: string
  label: string
  initial?: string
  confirmLabel: string
  children?: ReactNode
  /** The typed text, or null if cancelled. */
  onDone(value: string | null): void
}

/** A pop-up asking for a short piece of text, such as a name. */
export default function PromptDialog({ title, label, initial = '', confirmLabel, children, onDone }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(initial)

  useEffect(() => {
    const d = ref.current!
    d.showModal()
    return () => d.close()
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (value.trim()) onDone(value.trim())
  }

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onDone(null)
      }}
    >
      <form onSubmit={submit}>
        <h2>{title}</h2>
        {children && <div className="confirm-dialog-body">{children}</div>}
        <label className="field prompt-field">
          <span>{label}</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus maxLength={60} />
        </label>
        <div className="confirm-dialog-buttons">
          <button type="button" className="btn" onClick={() => onDone(null)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
