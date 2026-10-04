import type { PhotoCrop } from './photoCrop.ts'

export type Gender = 'male' | 'female' | 'other' | 'unknown'

/** A date as the user typed it, e.g. "1/1/2000", "Mar 1890", "abt. 1890". */
export interface LifeEvent {
  date: string
  place: string
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
  /** Short one-line description shown under the name. */
  description: string
  notes: string
  createdAt: string
  updatedAt: string
}

/** Everything saved in a .familytree file except the photo files themselves. */
export interface TreeData {
  name: string
  people: Record<string, Person>
}

/** Photo blobs keyed by photo id. */
export type PhotoStore = Record<string, Blob>
