import { useCallback, useEffect, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import PeopleBoard from './components/PeopleBoard.tsx'
import PersonForm from './components/PersonForm.tsx'
import SidePanel from './components/SidePanel.tsx'
import StartScreen from './components/StartScreen.tsx'
import { emptyPerson, fullName } from './model/person.ts'
import type { Person } from './model/types.ts'
import { useTree } from './state/treeContext.ts'

type Editing = { person: Person; isNew: boolean } | null

export default function App() {
  const { state, save } = useTree()
  const [editing, setEditing] = useState<Editing>(null)
  const closePanel = useCallback(() => setEditing(null), [])

  // Ctrl+S / Cmd+S saves the tree.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (state.tree) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.tree, save])

  if (!state.tree) return <StartScreen />

  const addPerson = () => setEditing({ person: emptyPerson(), isNew: true })
  const selectPerson = (id: string) => setEditing({ person: state.tree!.people[id], isNew: false })

  return (
    <div className="app">
      <AppHeader onAddPerson={addPerson} />
      <main className="canvas">
        <PeopleBoard selectedId={editing?.person.id ?? null} onSelect={selectPerson} onAdd={addPerson} />
      </main>
      {editing && (
        <SidePanel title={editing.isNew ? 'Add a person' : fullName(editing.person)} onClose={closePanel}>
          <PersonForm key={editing.person.id} person={editing.person} isNew={editing.isNew} onDone={closePanel} />
        </SidePanel>
      )}
    </div>
  )
}
