import { useState, type SyntheticEvent } from 'react'
import { dateSortKey } from '../../model/dates.ts'
import { emptyPerson, fullName } from '../../model/person.ts'
import type { Family, Gender, Person } from '../../model/types.ts'
import PersonChip from './PersonChip.tsx'

export type PickedRelative = { kind: 'existing'; id: string } | { kind: 'new'; person: Person }

/** An optional tick-box offered with the pick, e.g. "Also a parent of: ☑ Ann". */
export interface PickerExtra {
  key: string
  label: string
  defaultChecked: boolean
  /** Heading shown above a set of related tick-boxes. */
  group?: string
}

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
  /** Extra tick-boxes for the chosen person (`null` while creating a new person). */
  extrasFor?(id: string | null): PickerExtra[]
  note?: string
  /** `checked` holds the keys of the ticked extras. */
  onPick(picked: PickedRelative, checked: Set<string>): void
  onCancel(): void
}

const SHOW_MAX = 8

export default function RelativePicker(props: Props) {
  const { title, family, exclude, check, extrasFor, note, onPick, onCancel } = props
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [query, setQuery] = useState('')
  /** An existing person waiting for the extras to be confirmed. */
  const [selected, setSelected] = useState<string | null>(null)
  const extras = mode === 'new' ? (extrasFor?.(null) ?? []) : selected ? (extrasFor?.(selected) ?? []) : []
  /** Ticks the user changed from the default, by key. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const isChecked = (x: PickerExtra) => overrides[x.key] ?? x.defaultChecked
  const checkedKeys = () => new Set(extras.filter(isChecked).map((x) => x.key))
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
    if (problem) {
      setError(problem)
      return
    }
    // Pick straight away unless there are tick-boxes to confirm first.
    if ((extrasFor?.(id) ?? []).length === 0) onPick({ kind: 'existing', id }, new Set())
    else {
      setSelected(id)
      setOverrides({})
    }
  }

  const switchMode = (m: 'existing' | 'new') => {
    setMode(m)
    setSelected(null)
    setOverrides({})
    setError(null)
  }

  function createNew(e: SyntheticEvent) {
    e.preventDefault()
    if (!first.trim() && !last.trim()) {
      setError('Enter at least a first or last name.')
      return
    }
    onPick({ kind: 'new', person: { ...emptyPerson(), firstName: first.trim(), lastName: last.trim(), gender } }, checkedKeys())
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
        <button type="button" role="tab" aria-selected={mode === 'existing'} onClick={() => switchMode('existing')}>
          Someone in the tree
        </button>
        <button type="button" role="tab" aria-selected={mode === 'new'} onClick={() => switchMode('new')}>
          New person
        </button>
      </div>

      {mode === 'existing' && selected ? (
        <div className="picker-selected">
          <PersonChip person={family.people[selected]} />
          <button type="button" className="link-btn" onClick={() => setSelected(null)}>
            Choose someone else
          </button>
        </div>
      ) : mode === 'existing' ? (
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
              <button type="button" className="link-btn" onClick={() => switchMode('new')}>
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
        </div>
      )}

      {extras.length > 0 && (
        <div className="picker-extras">
          {extras.map((x, i) => (
            <div key={x.key}>
              {x.group && x.group !== extras[i - 1]?.group && <div className="picker-extras-group">{x.group}</div>}
              <label className={`checkbox picker-extra${x.group ? ' grouped' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked(x)}
                  onChange={(e) => setOverrides((o) => ({ ...o, [x.key]: e.target.checked }))}
                />
                {x.label}
              </label>
            </div>
          ))}
        </div>
      )}

      {(mode === 'new' || selected) && (
        <button
          type="button"
          className="btn btn-primary picker-add"
          onClick={(e) => (selected && mode === 'existing' ? onPick({ kind: 'existing', id: selected }, checkedKeys()) : createNew(e))}
        >
          Add
        </button>
      )}
      {error && (
        <p className="picker-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
