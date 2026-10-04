import type { PhotoCrop } from './photoCrop.ts'

export type Gender = 'male' | 'female' | 'other' | 'unknown'

/** A date as the user typed it, e.g. "1/1/2000", "Mar 1890", "abt. 1890". */
export interface LifeEvent {
  date: string
  place: string
}

export type EventType =
  | 'residence'
  | 'immigration'
  | 'emigration'
  | 'military'
  | 'education'
  | 'occupation'
  | 'religious'
  | 'other'

/** Something that happened in a person's life (where they lived, a job, immigration…). */
export interface PersonEvent {
  id: string
  type: EventType
  /** Name for an "other" event, or extra detail like the job title. */
  title: string
  /** Start date (or the only date). */
  date: string
  /** End date, for things that lasted a while (e.g. lived there until…). */
  endDate: string
  place: string
  notes: string
}

export interface Burial {
  cemetery: string
  place: string
  plot: string
  date: string
  notes: string
}

export interface PersonLink {
  id: string
  label: string
  url: string
}

/** One photo in a person's gallery. */
export interface GalleryPhoto {
  id: string
  /** Full-size image (≤1600px) in the photo store. */
  photoId: string
  /** Small square-ish thumbnail for the grid. */
  thumbId: string
  caption: string
  date: string
}

export interface Person {
  id: string
  firstName: string
  middleName: string
  lastName: string
  /** Surname at birth, if different (e.g. maiden name). */
  birthSurname: string
  nickname: string
  gender: Gender
  birth: LifeEvent
  /** False when the person has died, even if no death date is known. */
  living: boolean
  death: LifeEvent
  /** Id of the original profile photo in the tree's photo store. */
  photoId: string | null
  /** How the profile photo is framed on the card. */
  photoCrop: PhotoCrop | null
  /** Id of the small framed square image shown on cards. */
  avatarId: string | null
  /** Short one-line summary. */
  description: string
  /** Private research notes. */
  notes: string
  /** Life story, as long as you like. */
  biography: string
  events: PersonEvent[]
  burial: Burial
  /** Interesting details and fun facts, one per entry. */
  notable: string[]
  /** Web links, e.g. a Facebook page or obituary. */
  links: PersonLink[]
  /** Extra photos, in display order. */
  gallery: GalleryPhoto[]
  createdAt: string
  updatedAt: string
}

export type ParentType = 'biological' | 'adoptive' | 'step' | 'foster' | 'guardian'

/** One parent → child link. */
export interface ParentLink {
  id: string
  parentId: string
  childId: string
  type: ParentType
}

export type PartnershipType = 'married' | 'engaged' | 'partner' | 'divorced' | 'separated' | 'widowed'

/** Two people in a couple (married, partners, divorced, …). */
export interface Partnership {
  id: string
  personIds: [string, string]
  type: PartnershipType
  /** Wedding / start of the relationship. */
  start: LifeEvent
  /** Divorce / separation / death of a partner. */
  end: LifeEvent
}

/** People and the links between them. Siblings, cousins etc. are worked out from these. */
export interface Family {
  people: Record<string, Person>
  parentLinks: Record<string, ParentLink>
  partnerships: Record<string, Partnership>
}

/** Everything saved in a .familytree file except the photo files themselves. */
export interface TreeData extends Family {
  name: string
}

/** Photo blobs keyed by photo id. */
export type PhotoStore = Record<string, Blob>
