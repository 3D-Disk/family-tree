import { FILTERS, isFiltering, matchReasons, type PeopleSort } from '../model/filters.ts'
import { cardName, cardPhoto, lifeSpan } from '../model/person.ts'
import type { Person } from '../model/types.ts'
import { useTree } from '../state/treeContext.ts'
import Avatar from './Avatar.tsx'

interface Props {
  /** Matching people, already sorted. */
  people: Person[]
  total: number
  query: string
  onQueryChange(q: string): void
  filterKeys: string[]
  onFilterKeysChange(keys: string[]): void
  sort: PeopleSort
  onSortChange(sort: PeopleSort): void
  filtersOpen: boolean
  onFiltersOpenChange(open: boolean): void
  selectedId: string | null
  onSelect(id: string): void
  onClose(): void
}

/** Left-hand list of people with search and filters; stays open while people are edited on the right. */
export default function PeopleList(props: Props) {
  const { people, total, query, filterKeys, sort, selectedId } = props
  const { state } = useTree()
  const filtering = isFiltering(query, filterKeys)
  const reasons = matchReasons(filterKeys)

  const toggle = (key: string, on: boolean) =>
    props.onFilterKeysChange(on ? [...filterKeys, key] : filterKeys.filter((k) => k !== key))

  return (
    <aside className="people-list" aria-label="People list">
      <header className="people-list-header">
        <h2>People</h2>
        <button type="button" className="icon-btn" onClick={props.onClose} aria-label="Close people list" title="Close">
          ✕
        </button>
      </header>

      <div className="people-list-controls">
        {query.trim() && (
          <p className="people-list-query">
            Searching for “{query.trim()}”
          </p>
        )}
        <button
          type="button"
          className="filters-toggle"
          aria-expanded={props.filtersOpen}
          onClick={() => props.onFiltersOpenChange(!props.filtersOpen)}
        >
          {props.filtersOpen ? '▾' : '▸'} Filters
          {filterKeys.length > 0 && <span className="badge">{filterKeys.length}</span>}
        </button>
        {props.filtersOpen && (
          <div className="filters">
            <p className="field-hint">Show people who match all ticked boxes.</p>
            {FILTERS.map((d) => (
              <label key={d.key} className="checkbox">
                <input type="checkbox" checked={filterKeys.includes(d.key)} onChange={(e) => toggle(d.key, e.target.checked)} />
                {d.label}
              </label>
            ))}
          </div>
        )}

        <div className="people-list-summary">
          <span aria-live="polite">
            {filtering ? `${people.length} of ${total} ${total === 1 ? 'person' : 'people'} match` : `${total} ${total === 1 ? 'person' : 'people'}`}
          </span>
          <span className="spacer" />
          <label className="sort-select">
            <span>Sort</span>
            <select value={sort} onChange={(e) => props.onSortChange(e.target.value as PeopleSort)}>
              <option value="name">By name</option>
              <option value="birth">By birth date</option>
            </select>
          </label>
          {filtering && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                props.onQueryChange('')
                props.onFilterKeysChange([])
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <ul className="people-list-results">
        {people.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`people-row${p.id === selectedId ? ' selected' : ''}`}
              onClick={() => props.onSelect(p.id)}
              aria-current={p.id === selectedId || undefined}
            >
              <Avatar photo={cardPhoto(p, state.photos)} gender={p.gender} size={36} alt={cardName(p)} />
              <span className="chip-text">
                <span className="chip-name">{cardName(p)}</span>
                {lifeSpan(p) && <span className="chip-dates">{lifeSpan(p)}</span>}
                {reasons.length > 0 && <span className="people-row-reasons">{reasons.join(' · ')}</span>}
              </span>
            </button>
          </li>
        ))}
        {people.length === 0 && (
          <li className="people-list-empty">{total === 0 ? 'No one in the tree yet.' : 'No one matches. Try fewer filters.'}</li>
        )}
      </ul>
    </aside>
  )
}
