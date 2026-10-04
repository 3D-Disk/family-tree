import { cardName, lifeSpan } from '../model/person.ts'
import type { Person } from '../model/types.ts'
import Avatar from './Avatar.tsx'

interface Props {
  person: Person
  photo: Blob | undefined
  selected: boolean
  dimmed?: boolean
  onSelect(): void
}

/** A tree card (node) for one person. The whole card is clickable. */
export default function PersonCard({ person, photo, selected, dimmed, onSelect }: Props) {
  const name = cardName(person)
  const span = lifeSpan(person)
  return (
    <button
      type="button"
      className={`person-card gender-${person.gender}${selected ? ' selected' : ''}${person.living ? '' : ' deceased'}${dimmed ? ' dimmed' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <Avatar photo={photo} gender={person.gender} size={64} alt={name} />
      <span className="person-card-text">
        <span className="person-card-name">{name}</span>
        {span && <span className="person-card-dates">{span}</span>}
        {person.description.trim() && <span className="person-card-desc">{person.description}</span>}
      </span>
    </button>
  )
}
