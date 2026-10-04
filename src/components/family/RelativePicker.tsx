import { useState, type SyntheticEvent } from 'react'
import { dateSortKey } from '../../model/dates.ts'
import { emptyPerson, fullName } from '../../model/person.ts'
import type { Family, Gender, Person } from '../../model/types.ts'
import PersonChip from './PersonChip.tsx'

export type PickedRelative = { kind: 'existing'; id: string } | { kind: 'new'; person: Person }

interface Props {
  title: string
  family: Family
  /** Ids that can't be picked (the person themselves, people already linked…). */
  exclude: Set<string>
  /** Returns why someone can't be picked, or null if they can. */
  check(id: string): string | null
  /** Gender to pre-select for a new person. */
  defaultGender?: Gender
  /** Last name to pre-fill for a new person (e.g. a child's). */
  defaultLastName?: string
  /** Optional extra choice, e.g. "Also make them partners of Ann". */
  extra?: { label: string; defaultChecked: boolean }
  note?: string
  onPick(picked: PickedRelative, extraChecked: boolean): void
  onCancel(): void
}

const SHOW_MAX = 8

export default function RelativePicker(props: Props) {
  const { title, family, exclude, check, extra, note, onPick, onCancel } = props
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [query, setQuery] = useState('')
  const [extraChecked, setExtraChecked] = useState(extra?.defaultChecked ?? false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState(props.defaultLastName ?? '')
  const [gender, setGender] = useState<Gender>(props.defaultGender ?? 'unknown')
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const candidates = Object.values(family.people)
    .filter((p) => !exclude.has(p.id) && (!q || fullName(p).toLowerCase().includes(q)))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)) || (dateSortKey(a.birth.date) ?? 0) - (dateSortKey(b.birth.date) ?? 0))

  function pickExisting(id: string) {
    const problem = check(id)
    if (problem) setError(problem)
    else onPick({ kind: 'existing', id }, extraChecked)
  }

  function createNew(e: SyntheticEvent) {
    e.preventDefault()
    if (!first.trim() && !last.trim()) {
      setError('Enter at least a first or last name.')
      return
    }
    onPick({ kind: 'new', person: { ...emptyPerson(), firstName: first.trim(), lastName: last.trim(), gender } }, extraChecked)
  }

  return (
    <div
      className="relative-picker"
      role="group"
      aria-label={title}
      onKeyDown={(e) => {
        // Enter here shouldn't submit the whole person form.
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault()
          if (mode === 'new') createNew(e)
        }
      }}
    >
      <div className="relative-picker-head">
        <strong>{title}</strong>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
          ✕
        </button>
      </div>
      {note && <p className="picker-note">{note}</p>}

      <div className="picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'existing'} onClick={() => { setMode('existing'); setError(null) }}>
          Someone in the tree
        </button>
        <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => { setMode('new'); setError(null) }}>
          New person
        </button>
      </div>

      {mode === 'existing' ? (
        <div>
          <input
            className="picker-search"
            type="search"
            placeholder="Search by name…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setError(null) }}
            autoFocus
            aria-label="Search people"
          />
          {candidates.length === 0 ? (
            <p className="picker-empty">
              {q ? 'No one matches that name.' : 'No one else to choose yet.'}{' '}
              <button type="button" className="link-btn" onClick={() => setMode('new')}>
                Create a new person
              </button>
            </p>
          ) : (
            <ul className="picker-list">
              {candidates.slice(0, SHOW_MAX).map((p) => (
                <li key={p.id}>
                  <PersonChip person={p} onOpen={() => pickExisting(p.id)} />
                </li>
              ))}
              {candidates.length > SHOW_MAX && (
                <li className="picker-more">{candidates.length - SHOW_MAX} more. Type a name to narrow the list.</li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <div className="picker-new">
          <div className="form-row">
            <label className="field">
              <span>First name</span>
              <input value={first} onChange={(e) => setFirst(e.target.value)} autoFocus />
            </label>
            <label className="field">
              <span>Last name</span>
              <input value={last} onChange={(e) => setLast(e.target.value)} />
            </label>
          </div>
          <div className="radio-row">
            {(['male', 'female', 'other', 'unknown'] as const).map((g) => (
              <label key={g} className="radio">
                <input type="radio" name="picker-gender" checked={gender === g} onChange={() => setGender(g)} />
                {g[0].toUpperCase() + g.slice(1)}
              </label>
            ))}
          </div>
          <p className="field-hint">You can add their other details later by opening them.</p>
          <button type="button" className="btn btn-primary" onClick={createNew}>
            Add
          </button>
        </div>
      )}

      {extra && (
        <label className="checkbox picker-extra">
          <input type="checkbox" checked={extraChecked} onChange={(e) => setExtraChecked(e.target.checked)} />
          {extra.label}
        </label>
      )}
      {error && (
        <p className="picker-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
