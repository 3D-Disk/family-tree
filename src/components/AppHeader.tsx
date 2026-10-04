import { useRef } from 'react'
import { useTree } from '../state/treeContext.ts'
import { canSaveInPlace } from '../storage/fileAccess.ts'

const COMING_SOON = 'Coming in a later phase'

export default function AppHeader({ onAddPerson }: { onAddPerson(): void }) {
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
            <button type="button" role="menuitem" onClick={run(() => confirmDiscard() && openFile())}>
              Open file…
            </button>
            <button type="button" role="menuitem" onClick={run(() => confirmDiscard() && close())}>
              Close tree
            </button>
          </div>
        </details>

        <button type="button" className={`btn save-btn${state.dirty ? ' btn-attention' : ''}`} onClick={save}>
          Save
        </button>

        <label className="views-select">
          <span>View</span>
          <select defaultValue="default" aria-label="Choose a view">
            <option value="default">Default</option>
          </select>
        </label>

        <input
          className="search"
          type="search"
          placeholder="Search people…"
          aria-label="Search people"
          disabled
          title={COMING_SOON}
        />

        <button type="button" className="btn btn-primary" onClick={onAddPerson}>
          + Add person
        </button>
      </div>
    </header>
  )
}
