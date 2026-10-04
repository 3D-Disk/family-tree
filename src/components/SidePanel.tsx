import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  title: string
  /** When this changes (different person, view ↔ edit), scroll back to the top. */
  scrollKey?: string
  onClose(): void
  children: ReactNode
}

/** Panel that slides in from the right over the tree; can expand to full screen. */
export default function SidePanel({ title, scrollKey, onClose, children }: Props) {
  const [expanded, setExpanded] = useState(false)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [scrollKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A pop-up on top handles Esc itself.
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return
      // Stop this same key press from also dismissing a pop-up that onClose opens.
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className={`side-panel${expanded ? ' expanded' : ''}`} aria-label={title}>
      <header className="side-panel-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setExpanded((x) => !x)}
          title={expanded ? 'Shrink panel' : 'Expand to full screen'}
          aria-label={expanded ? 'Shrink panel' : 'Expand to full screen'}
        >
          {expanded ? '⤡' : '⤢'}
        </button>
        <button type="button" className="icon-btn" onClick={onClose} title="Close" aria-label="Close panel">
          ✕
        </button>
      </header>
      <div className="side-panel-body" ref={body}>{children}</div>
    </aside>
  )
}
