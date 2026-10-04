import { dateSortKey } from '../model/dates.ts'
import { cardPhoto } from '../model/person.ts'
import type { Person } from '../model/types.ts'
import { useTree } from '../state/treeContext.ts'
import PersonCard from './PersonCard.tsx'

interface Props {
  /** When set, people not in it are dimmed (they don't match the search/filters). */
  highlightIds: Set<string> | null
  selectedId: string | null
  onSelect(id: string): void
  onAdd(): void
}

function byBirth(a: Person, b: Person): number {
  const ka = dateSortKey(a.birth.date) ?? Infinity
  const kb = dateSortKey(b.birth.date) ?? Infinity
  return ka - kb || a.createdAt.localeCompare(b.createdAt)
}

/**
 * Temporary layout: everyone as a grid of cards, oldest first.
 * The real tree (with connecting lines) replaces this in a later phase.
 */
export default function PeopleBoard({ highlightIds, selectedId, onSelect, onAdd }: Props) {
  const { state } = useTree()
  const people = Object.values(state.tree?.people ?? {}).sort(byBirth)

  if (people.length === 0) {
    return (
      <div className="board-empty">
        <div className="empty-tree">
          <h1>Add your first person</h1>
          <p>Start with yourself or anyone you know well. You can add their details and a photo.</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + Add person
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="board">
      {people.map((p) => (
        <PersonCard
          key={p.id}
          person={p}
          photo={cardPhoto(p, state.photos)}
          selected={p.id === selectedId}
          dimmed={highlightIds !== null && !highlightIds.has(p.id)}
          onSelect={() => onSelect(p.id)}
        />
      ))}
    </div>
  )
}
