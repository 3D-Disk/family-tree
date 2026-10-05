import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  title: string
  /** When this changes (different person, view ↔ edit), scroll back to the top. */
  scrollKey?: string
  /** Back / forward through previously opened people (names of where they lead, or null). */
  nav?: { back: string | null; forward: string | null; onBack(): void; onForward(): void }
  onClose(): void
  children: ReactNode
}

/** Panel that slides in from the right over the tree; can expand to full screen. */
export default function SidePanel({ title, scrollKey, nav, onClose, children }: Props) {
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
        {nav && (
          <div className="panel-nav">
            <button
              type="button"
              className="icon-btn"
              onClick={nav.onBack}
              disabled={!nav.back}
              title={nav.back ? `Back to ${nav.back}` : 'Back'}
              aria-label={nav.back ? `Back to ${nav.back}` : 'Back'}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={nav.onForward}
              disabled={!nav.forward}
              title={nav.forward ? `Forward to ${nav.forward}` : 'Forward'}
              aria-label={nav.forward ? `Forward to ${nav.forward}` : 'Forward'}
            >
              ›
            </button>
          </div>
        )}
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
