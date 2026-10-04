import type { NodeProps, Node } from '@xyflow/react'
import { useLayoutEffect, useRef } from 'react'
import { cardName, lifeSpan } from '../../model/person.ts'
import type { Person } from '../../model/types.ts'
import Avatar from '../Avatar.tsx'
import type { AddKind } from '../family/FamilySection.tsx'
import { LAYOUT } from '../../layout/familyLayout.ts'


export type TreeCardData = {
  person: Person
  photo: Blob | undefined
  selected: boolean
  /** The person the tree is focused on. */
  focused?: boolean
  dimmed: boolean
  onAdd(id: string, kind: AddKind): void
}

export type TreeCardNode = Node<TreeCardData, 'person'>

const NAME_MAX_PX = 14.4
const NAME_MIN_PX = 9

/** The person's name, shrinking the text until the whole name fits on two lines. */
function FittedName({ name }: { name: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current!
    let size = NAME_MAX_PX
    el.style.fontSize = `${size}px`
    while (el.scrollHeight > el.clientHeight + 1 && size > NAME_MIN_PX) {
      size -= 0.5
      el.style.fontSize = `${size}px`
    }
  }, [name])
  return (
    <div ref={ref} className="tree-card-name">
      {name}
    </div>
  )
}

const ACTIONS: { kind: AddKind; label: string }[] = [
  { kind: 'parent', label: '+ Parent' },
  { kind: 'partner', label: '+ Partner' },
  { kind: 'child', label: '+ Child' },
  { kind: 'sibling', label: '+ Sibling' },
]

/** One person's card on the tree. Clicking it opens their panel; hovering shows quick "add" buttons. */
export default function TreeCard({ data }: NodeProps<TreeCardNode>) {
  const { person, photo, selected, focused, dimmed } = data
  const name = cardName(person)
  const span = lifeSpan(person)
  return (
    <div
      className={`tree-card gender-${person.gender}${selected ? ' selected' : ''}${focused ? ' focused' : ''}${dimmed ? ' dimmed' : ''}${person.living ? '' : ' deceased'}`}
      style={{ width: LAYOUT.cardWidth, height: LAYOUT.cardHeight }}
      title={name}
    >
      <Avatar photo={photo} gender={person.gender} size={56} alt={name} />
      <FittedName name={name} />
      {span && <div className="tree-card-dates">{span}</div>}
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
