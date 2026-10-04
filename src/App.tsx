import { useCallback, useEffect, useRef, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import ConfirmDialog from './components/ConfirmDialog.tsx'
import PeopleList from './components/PeopleList.tsx'
import PersonForm from './components/PersonForm.tsx'
import SidePanel from './components/SidePanel.tsx'
import StartScreen from './components/StartScreen.tsx'
import type { AddKind } from './components/family/FamilySection.tsx'
import TreeView from './components/tree/TreeView.tsx'
import { isFiltering, matchPeople, sortPeople, type PeopleSort } from './model/filters.ts'
import { emptyPerson, fullName } from './model/person.ts'
import type { Person } from './model/types.ts'
import { useTree } from './state/treeContext.ts'

type Editing = { person: Person; isNew: boolean; addRequest?: { kind: AddKind; n: number } } | null
type LeaveChoice = 'save' | 'discard' | 'stay'

export default function App() {
  const { state, save } = useTree()
  const [editing, setEditing] = useState<Editing>(null)
  const [formDirty, setFormDirty] = useState(false)
  const saveForm = useRef<(() => void) | null>(null)
  /** What to do after the "Save changes?" pop-up is answered. */
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)

  // People list (search & filters), shown on the left.
  const [listOpen, setListOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filterKeys, setFilterKeys] = useState<string[]>([])
  const [sort, setSort] = useState<PeopleSort>('name')
  /** Ask the tree to centre on someone. */
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null)
  const focusOn = (id: string) => setFocus({ id, n: Date.now() })

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
  const addRelative = (id: string, kind: AddKind) => {
    const addRequest = { kind, n: Date.now() }
    if (editing?.person.id === id) setEditing({ ...editing, addRequest })
    else requestLeave(() => open({ person: state.tree!.people[id], isNew: false, addRequest }))
  }
  const beforeFileAction = (action: () => void) =>
    requestLeave(() => {
      closePanel()
      action()
    })

  const matches = listOpen ? sortPeople(matchPeople(state.tree, query, filterKeys), sort) : []
  const highlightIds = listOpen && isFiltering(query, filterKeys) ? new Set(matches.map((p) => p.id)) : null

  return (
    <div className="app">
      <AppHeader
        onAddPerson={addPerson}
        beforeFileAction={beforeFileAction}
        query={query}
        onQueryChange={(q) => {
          setQuery(q)
          if (q.trim()) setListOpen(true)
        }}
        filterCount={filterKeys.length}
        onFilterClick={() => {
          if (listOpen && filtersOpen) setListOpen(false)
          else {
            setListOpen(true)
            setFiltersOpen(true)
          }
        }}
      />
      <div className={`workspace${listOpen ? ' with-list' : ''}`}>
        {listOpen && (
          <PeopleList
            people={matches}
            total={Object.keys(state.tree.people).length}
            query={query}
            onQueryChange={setQuery}
            filterKeys={filterKeys}
            onFilterKeysChange={setFilterKeys}
            sort={sort}
            onSortChange={setSort}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            selectedId={editing?.person.id ?? null}
            onSelect={(id) => {
              selectPerson(id)
              focusOn(id)
            }}
            onClose={() => setListOpen(false)}
          />
        )}
        <main className="canvas tree-canvas">
          <TreeView
            key={state.opened}
            highlightIds={highlightIds}
            selectedId={editing?.person.id ?? null}
            onSelect={selectPerson}
            onAddRelative={addRelative}
            onAdd={addPerson}
            focus={focus}
          />
        </main>
      </div>
      {editing && (
        <SidePanel title={editing.isNew ? 'Add a person' : fullName(editing.person)} onClose={leavePanel}>
          <PersonForm
            key={editing.person.id}
            person={editing.person}
            isNew={editing.isNew}
            onDone={() => {
              if (editing.isNew) focusOn(editing.person.id)
              closePanel()
            }}
            onCancel={leavePanel}
            onDirtyChange={setFormDirty}
            saveRef={saveForm}
            onOpenPerson={selectPerson}
            addRequest={editing.addRequest}
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
