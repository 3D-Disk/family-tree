import { formatDate, shortYear } from './dates.ts'
import type { LifeEvent, Person, PhotoStore } from './types.ts'

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyPerson(): Person {
  const now = new Date().toISOString()
  return {
    id: newId(),
    firstName: '',
    middleName: '',
    lastName: '',
    birthSurname: '',
    nickname: '',
    gender: 'unknown',
    birth: { date: '', place: '' },
    living: true,
    death: { date: '', place: '' },
    photoId: null,
    photoCrop: null,
    avatarId: null,
    description: '',
    notes: '',
    biography: '',
    events: [],
    burial: { cemetery: '', place: '', plot: '', date: '', notes: '' },
    notable: [],
    links: [],
    gallery: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function fullName(p: Person): string {
  const name = [p.firstName, p.middleName, p.lastName].filter((s) => s.trim()).join(' ')
  return name || 'Unnamed person'
}

/** Short name for cards: first + last, with nickname in quotes if set. */
export function cardName(p: Person): string {
  const first = p.firstName.trim()
  const nick = p.nickname.trim() ? `"${p.nickname.trim()}"` : ''
  const name = [first, nick, p.lastName.trim()].filter(Boolean).join(' ')
  return name || 'Unnamed person'
}

/** e.g. "1890 – 1960", "b. 1990", "1890 – ?", "d. 1960". */
export function lifeSpan(p: Person): string {
  const born = shortYear(p.birth.date)
  const died = shortYear(p.death.date)
  if (p.living) return born ? `b. ${born}` : ''
  if (born && died) return `${born} – ${died}`
  if (born) return `${born} – ?`
  if (died) return `d. ${died}`
  return 'Deceased'
}

/** Wikipedia-style: "1/1/2000 (Manhattan, NY, USA)". */
export function formatLifeEvent(e: LifeEvent): string {
  const date = formatDate(e.date)
  const place = e.place.trim()
  if (date && place) return `${date} (${place})`
  return date || place
}

/** The image to show on a person's card: the framed avatar, else the original photo. */
export function cardPhoto(p: Person, photos: PhotoStore): Blob | undefined {
  return (p.avatarId && photos[p.avatarId]) || (p.photoId ? photos[p.photoId] : undefined)
}

/** Every photo-store id this person uses (profile, card image, gallery photos and thumbnails). */
export function photoIdsOf(p: Person | undefined): string[] {
  if (!p) return []
  return [p.photoId, p.avatarId, ...p.gallery.flatMap((g) => [g.photoId, g.thumbId])].filter((id): id is string => !!id)
}
