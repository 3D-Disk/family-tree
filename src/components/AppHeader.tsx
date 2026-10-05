import { useRef } from 'react'
import { useTree } from '../state/treeContext.ts'
import { canSaveInPlace } from '../storage/fileAccess.ts'

interface Props {
  onAddPerson(): void
  query: string
  onQueryChange(q: string): void
  /** Number of filters ticked, shown on the Filter button. */
  filterCount: number
  onFilterClick(): void
  /** Runs a file action once any unsaved edits in the side panel are dealt with. */
  beforeFileAction(action: () => void): void
  /** Saved views and the one shown (null = Default). */
  views: { id: string; name: string }[]
  activeViewId: string | null
  onViewAction(action: ViewAction): void
}

export type ViewAction =
  | { type: 'select'; id: string | null }
  | { type: 'new' }
  | { type: 'rename' }
  | { type: 'delete' }

export default function AppHeader({ onAddPerson, beforeFileAction, query, onQueryChange, filterCount, onFilterClick, views, activeViewId, onViewAction }: Props) {
  const { state, dispatch, save, saveAs, openFile, close, confirmDiscard } = useTree()
  const menu = useRef<HTMLDetailsElement>(null)
  const tree = state.tree!

  const run = (action: () => void) => () => {
    if (menu.current) menu.current.open = false
    action()
  }

  function rename() {
    const name = window.prompt('Rename this family tree:', tree.name)
    if (name?.trim()) dispatch({ type: 'renameTree', name: name.trim() })
  }

  return (
    <header className="app-header">
      <div className="brand">
        <img src="./favicon.svg" alt="" width={28} height={28} />
        <button type="button" className="tree-name" onClick={rename} title="Rename tree">
          {tree.name}
        </button>
        <span className={`save-status${state.dirty ? ' unsaved' : ''}`} title={state.fileName ?? undefined}>
          {state.dirty ? '● Unsaved changes' : state.fileName ? `Saved · ${state.fileName}` : 'Saved'}
        </span>
      </div>

      <div className="header-controls">
        <details className="menu" ref={menu}>
          <summary className="btn">File ▾</summary>
          <div className="menu-items" role="menu">
            <button type="button" role="menuitem" onClick={run(save)}>
              Save <kbd>Ctrl/⌘ S</kbd>
            </button>
            <button type="button" role="menuitem" onClick={run(saveAs)}>
              {canSaveInPlace ? 'Save as…' : 'Download a copy'}
            </button>
            <button type="button" role="menuitem" onClick={run(() => beforeFileAction(() => confirmDiscard() && openFile()))}>
              Open file…
            </button>
            <button type="button" role="menuitem" onClick={run(() => beforeFileAction(() => confirmDiscard() && close()))}>
              Close tree
            </button>
          </div>
        </details>

        <button type="button" className={`btn save-btn${state.dirty ? ' btn-attention' : ''}`} onClick={save}>
          Save
        </button>

        <label className="views-select">
          <span>View</span>
          <select
            aria-label="Choose a view"
            value={activeViewId ?? 'default'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'default') onViewAction({ type: 'select', id: null })
              else if (v === '__new') onViewAction({ type: 'new' })
              else if (v === '__rename') onViewAction({ type: 'rename' })
              else if (v === '__delete') onViewAction({ type: 'delete' })
              else onViewAction({ type: 'select', id: v })
            }}
          >
            <option value="default">Default (automatic)</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
            <option disabled>──────────</option>
            <option value="__new">＋ New view…</option>
            {activeViewId && <option value="__rename">Rename view…</option>}
            {activeViewId && <option value="__delete">Delete view…</option>}
          </select>
        </label>

        <input
          className="search"
          type="search"
          placeholder="Search people…"
          aria-label="Search people"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button type="button" className="btn filter-btn" onClick={onFilterClick} title="Filter people (e.g. no birth date)">
          Filter{filterCount > 0 && <span className="badge">{filterCount}</span>}
        </button>

        <button type="button" className="btn btn-primary" onClick={onAddPerson}>
          + Add person
        </button>
      </div>
    </header>
  )
}
