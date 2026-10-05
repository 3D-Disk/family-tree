import { useCallback, useEffect, useRef, useState } from 'react'
import AppHeader from './components/AppHeader.tsx'
import ConfirmDialog from './components/ConfirmDialog.tsx'
import PeopleList from './components/PeopleList.tsx'
import PersonDetails from './components/PersonDetails.tsx'
import PersonForm from './components/PersonForm.tsx'
import SidePanel from './components/SidePanel.tsx'
import StartScreen from './components/StartScreen.tsx'
import type { AddKind } from './components/family/FamilySection.tsx'
import FocusBar from './components/tree/FocusBar.tsx'
import TreeView, { type TreeFocus } from './components/tree/TreeView.tsx'
import { isFiltering, matchPeople, sortPeople, type PeopleSort } from './model/filters.ts'
import { emptyPerson, fullName } from './model/person.ts'
import type { Person } from './model/types.ts'
import { emptyHistory, step, visit, type PanelHistory } from './state/panelHistory.ts'
import { useTree } from './state/treeContext.ts'

/** What the side panel shows: someone's details (view) or the edit form. */
type Editing = {
  person: Person
  isNew: boolean
  mode: 'view' | 'edit'
  addRequest?: { kind: AddKind; n: number }
} | null
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
  /** "Focus on a person": show only their line of the family. */
  const [treeFocusState, setTreeFocus] = useState<TreeFocus | null>(null)
  /** People opened in the side panel, for its back / forward buttons. */
  const [history, setHistory] = useState<PanelHistory>(emptyHistory)

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
    // Remember who was opened, for the panel's back / forward buttons.
    if (next && !next.isNew) setHistory((h) => visit(h, next.person.id))
  }
  const exists = (id: string) => id in state.tree!.people
  const backTo = step(history, -1, exists)
  const forwardTo = step(history, 1, exists)
  /** Go back (-1) or forward (+1) through the people opened in the panel. */
  const goHistory = (to: number) => {
    if (to < 0) return
    const id = history.stack[to]
    requestLeave(() => {
      setFormDirty(false)
      setEditing({ person: state.tree!.people[id], isNew: false, mode: 'view' })
      setHistory((h) => ({ ...h, index: to }))
      focusOn(id)
    })
  }
  const addPerson = () => requestLeave(() => open({ person: emptyPerson(), isNew: true, mode: 'edit' }))
  /** Show someone's details (staying put if they're already open). */
  const selectPerson = (id: string) => {
    if (editing?.person.id === id) return
    requestLeave(() => open({ person: state.tree!.people[id], isNew: false, mode: 'view' }))
  }
  const editPerson = (id: string) => open({ person: state.tree!.people[id], isNew: false, mode: 'edit' })
  const addRelative = (id: string, kind: AddKind) => {
    const addRequest = { kind, n: Date.now() }
    if (editing?.person.id === id && editing.mode === 'edit') setEditing({ ...editing, addRequest })
    else requestLeave(() => open({ person: state.tree!.people[id], isNew: false, mode: 'edit', addRequest }))
  }
  const beforeFileAction = (action: () => void) =>
    requestLeave(() => {
      closePanel()
      action()
    })

  /** The person shown in the panel (in view mode always the latest saved version). */
  const panelPerson = editing ? (editing.mode === 'edit' ? editing.person : state.tree.people[editing.person.id]) : undefined

  // Drop the focus if that person has been deleted.
  const treeFocus = treeFocusState && state.tree.people[treeFocusState.personId] ? treeFocusState : null

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
          {treeFocus && (
            <FocusBar
              name={fullName(state.tree.people[treeFocus.personId])}
              options={treeFocus}
              onChange={(o) => setTreeFocus({ ...treeFocus, ...o })}
              onExit={() => setTreeFocus(null)}
            />
          )}
          <div className="tree-area">
            <TreeView
              key={`${state.opened}:${treeFocus ? `${treeFocus.personId}:${treeFocus.up}:${treeFocus.down}` : 'all'}`}
              treeFocus={treeFocus}
              highlightIds={highlightIds}
              selectedId={editing?.person.id ?? null}
              onSelect={selectPerson}
              onAddRelative={addRelative}
              onAdd={addPerson}
              focus={focus}
            />
          </div>
        </main>
      </div>
      {panelPerson && editing && (
        <SidePanel
          nav={{
            back: backTo >= 0 ? fullName(state.tree.people[history.stack[backTo]]) : null,
            forward: forwardTo >= 0 ? fullName(state.tree.people[history.stack[forwardTo]]) : null,
            onBack: () => goHistory(backTo),
            onForward: () => goHistory(forwardTo),
          }}
          title={editing.mode === 'view' ? fullName(panelPerson) : editing.isNew ? 'Add a person' : `Edit ${fullName(panelPerson)}`}
          scrollKey={`${panelPerson.id}:${editing.mode}`}
          onClose={leavePanel}
        >
          {editing.mode === 'view' ? (
            <PersonDetails
              personId={panelPerson.id}
              onEdit={() => editPerson(panelPerson.id)}
              onDeleted={closePanel}
              onFocus={() => setTreeFocus({ personId: panelPerson.id, up: Infinity, down: Infinity })}
              isFocused={treeFocus?.personId === panelPerson.id}
              onOpenPerson={(id) => {
                selectPerson(id)
                focusOn(id)
              }}
            />
          ) : (
            <PersonForm
              key={editing.person.id}
              person={editing.person}
              isNew={editing.isNew}
              onDone={() => {
                if (editing.isNew) focusOn(editing.person.id)
                // After saving, show their details; after deleting, the panel closes by itself.
                open({ person: editing.person, isNew: false, mode: 'view' })
              }}
              onCancel={() =>
                requestLeave(() => (editing.isNew ? closePanel() : open({ ...editing, mode: 'view', addRequest: undefined })))
              }
              onDirtyChange={setFormDirty}
              saveRef={saveForm}
              onOpenPerson={selectPerson}
              addRequest={editing.addRequest}
            />
          )}
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
