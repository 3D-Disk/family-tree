import { useEffect, useState, type FormEvent } from 'react'
import { useTree } from '../state/treeContext.ts'
import { loadAutosave, type AutosaveSession } from '../storage/autosave.ts'

function timeAgo(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export default function StartScreen() {
  const { startNew, openFile, continueFromBrowser } = useTree()
  const [previous, setPrevious] = useState<AutosaveSession | null>(null)
  const [name, setName] = useState('')

  useEffect(() => {
    loadAutosave().then((saved) => setPrevious(saved?.session ?? null))
  }, [])

  const okToReplace = (what: string) =>
    !previous?.dirty ||
    window.confirm(`"${previous.tree.name}" has changes that were never saved to a file. ${what} will replace them. Continue?`)

  function onNew(e: FormEvent) {
    e.preventDefault()
    if (okToReplace('Starting a new tree')) startNew(name)
  }

  const peopleCount = previous ? Object.keys(previous.tree.people).length : 0

  return (
    <main className="start">
      <div className="start-card">
        <img src="./favicon.svg" alt="" width={56} height={56} />
        <h1>Family Tree</h1>
        <p className="start-sub">Your tree is saved to a file on your computer. Nothing is uploaded.</p>

        {previous && (
          <section className={`start-option start-continue${previous.dirty ? ' unsaved' : ''}`}>
            <h2>{previous.dirty ? 'Restore your unsaved work' : 'Continue where you left off'}</h2>
            <p>
              <strong>{previous.tree.name}</strong> · {peopleCount} {peopleCount === 1 ? 'person' : 'people'} · last
              edited {timeAgo(previous.updatedAt)}
            </p>
            {previous.dirty && (
              <p className="start-warn">
                Some changes weren't saved to a file. Restore them, then click Save.
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={continueFromBrowser}>
              {previous.dirty ? 'Restore unsaved work' : 'Continue'}
            </button>
          </section>
        )}

        <section className="start-option">
          <h2>Open a family tree file</h2>
          <p>Pick a <code>.familytree</code> file you saved before.</p>
          <button type="button" className="btn" onClick={() => okToReplace('Opening a file') && openFile()}>
            Open file…
          </button>
        </section>

        <form className="start-option" onSubmit={onNew}>
          <h2>Start a new tree</h2>
          <label className="field">
            <span>Tree name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Smith Family" />
          </label>
          <button type="submit" className="btn">
            Start new tree
          </button>
        </form>
      </div>
    </main>
  )
}
