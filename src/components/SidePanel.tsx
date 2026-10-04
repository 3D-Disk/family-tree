import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  title: string
  onClose(): void
  children: ReactNode
}

/** Panel that slides in from the right over the tree; can expand to full screen. */
export default function SidePanel({ title, onClose, children }: Props) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
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
      <div className="side-panel-body">{children}</div>
    </aside>
  )
}
