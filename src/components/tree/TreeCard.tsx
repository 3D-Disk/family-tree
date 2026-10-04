import type { NodeProps, Node } from '@xyflow/react'
import { cardName, lifeSpan } from '../../model/person.ts'
import type { Person } from '../../model/types.ts'
import Avatar from '../Avatar.tsx'
import type { AddKind } from '../family/FamilySection.tsx'


export type TreeCardData = {
  person: Person
  photo: Blob | undefined
  selected: boolean
  dimmed: boolean
  onAdd(id: string, kind: AddKind): void
}

export type TreeCardNode = Node<TreeCardData, 'person'>

const ACTIONS: { kind: AddKind; label: string }[] = [
  { kind: 'parent', label: '+ Parent' },
  { kind: 'partner', label: '+ Partner' },
  { kind: 'child', label: '+ Child' },
  { kind: 'sibling', label: '+ Sibling' },
]

/** One person's card on the tree. Clicking it opens their panel; hovering shows quick "add" buttons. */
export default function TreeCard({ data }: NodeProps<TreeCardNode>) {
  const { person, photo, selected, dimmed } = data
  const name = cardName(person)
  const span = lifeSpan(person)
  return (
    <div
      className={`tree-card gender-${person.gender}${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}${person.living ? '' : ' deceased'}`}
      title={`Open ${name}`}
    >
      <Avatar photo={photo} gender={person.gender} size={64} alt={name} />
      <div className="tree-card-name">{name}</div>
      {span && <div className="tree-card-dates">{span}</div>}
      {person.description.trim() && <div className="tree-card-desc">{person.description}</div>}
      <div className="tree-card-actions" role="group" aria-label={`Add a relative of ${name}`}>
        {ACTIONS.map((a) => (
          <button
            key={a.kind}
            type="button"
            className="nodrag"
            onClick={(e) => {
              e.stopPropagation()
              data.onAdd(person.id, a.kind)
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}
