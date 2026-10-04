import { useCallback, useEffect, useRef, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import ConfirmDialog from './components/ConfirmDialog.tsx'
import PeopleBoard from './components/PeopleBoard.tsx'
import PersonForm from './components/PersonForm.tsx'
import SidePanel from './components/SidePanel.tsx'
import StartScreen from './components/StartScreen.tsx'
import { emptyPerson, fullName } from './model/person.ts'
import type { Person } from './model/types.ts'
import { useTree } from './state/treeContext.ts'

type Editing = { person: Person; isNew: boolean } | null
type LeaveChoice = 'save' | 'discard' | 'stay'

export default function App() {
  const { state, save } = useTree()
  const [editing, setEditing] = useState<Editing>(null)
  const [formDirty, setFormDirty] = useState(false)
  const saveForm = useRef<(() => void) | null>(null)
  /** What to do after the "Save changes?" pop-up is answered. */
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  const closePanel = useCallback(() => {
    setEditing(null)
    setFormDirty(false)
  }, [])

  /** Run `next` (which leaves the form), asking first if the form has unsaved edits. */
  const requestLeave = useCallback(
    (next: () => void) => {
      if (editing && formDirty) setPendingLeave(() => next)
      else next()
    },
    [editing, formDirty],
  )

  function onLeaveChoice(choice: LeaveChoice) {
    const next = pendingLeave!
    setPendingLeave(null)
    if (choice === 'stay') return
    if (choice === 'save') saveForm.current?.()
    setFormDirty(false)
    next()
  }

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

  // Warn before closing the tab while the form has unsaved edits.
  useEffect(() => {
    if (!formDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [formDirty])

  const leavePanel = useCallback(() => requestLeave(closePanel), [requestLeave, closePanel])

  if (!state.tree) return <StartScreen />

  const open = (next: Editing) => {
    setFormDirty(false)
    setEditing(next)
  }
  const addPerson = () => requestLeave(() => open({ person: emptyPerson(), isNew: true }))
  const selectPerson = (id: string) => {
    if (editing?.person.id === id) return
    requestLeave(() => open({ person: state.tree!.people[id], isNew: false }))
  }
  const beforeFileAction = (action: () => void) =>
    requestLeave(() => {
      closePanel()
      action()
    })

  return (
    <div className="app">
      <AppHeader onAddPerson={addPerson} beforeFileAction={beforeFileAction} />
      <main className="canvas">
        <PeopleBoard selectedId={editing?.person.id ?? null} onSelect={selectPerson} onAdd={addPerson} />
      </main>
      {editing && (
        <SidePanel title={editing.isNew ? 'Add a person' : fullName(editing.person)} onClose={leavePanel}>
          <PersonForm
            key={editing.person.id}
            person={editing.person}
            isNew={editing.isNew}
            onDone={closePanel}
            onCancel={leavePanel}
            onDirtyChange={setFormDirty}
            saveRef={saveForm}
            onOpenPerson={selectPerson}
          />
        </SidePanel>
      )}
      {pendingLeave && editing && (
        <ConfirmDialog<LeaveChoice>
          title={editing.isNew ? 'Save this new person?' : `Save changes to ${fullName(editing.person)}?`}
          buttons={[
            { label: 'Keep editing', value: 'stay' },
            { label: "Don't save", value: 'discard', kind: 'danger' },
            { label: 'Save', value: 'save', kind: 'primary' },
          ]}
          cancelValue="stay"
          onChoose={onLeaveChoice}
        >
          You've made changes that haven't been saved.
        </ConfirmDialog>
      )}
    </div>
  )
}
