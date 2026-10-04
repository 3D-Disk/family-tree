import { cardName, cardPhoto, lifeSpan } from '../../model/person.ts'
import type { Person } from '../../model/types.ts'
import { useTree } from '../../state/treeContext.ts'
import Avatar from '../Avatar.tsx'

interface Props {
  person: Person
  /** e.g. "Mother", shown above the name. */
  label?: string
  /** Opens this person; omitted for people not saved yet. */
  onOpen?(): void
}

/** Small photo + name + years, used in family lists. */
export default function PersonChip({ person, label, onOpen }: Props) {
  const { state } = useTree()
  const name = cardName(person)
  const span = lifeSpan(person)
  const body = (
    <>
      <Avatar photo={cardPhoto(person, state.photos)} gender={person.gender} size={36} alt={name} />
      <span className="chip-text">
        {label && <span className="chip-label">{label}</span>}
        <span className="chip-name">{name}</span>
        {span && <span className="chip-dates">{span}</span>}
      </span>
    </>
  )
  return onOpen ? (
    <button type="button" className="person-chip clickable" onClick={onOpen} title={`Open ${name}`}>
      {body}
    </button>
  ) : (
    <span className="person-chip">{body}</span>
  )
}
