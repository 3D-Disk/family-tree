import type { PhotoCrop } from '../model/photoCrop.ts'
import { photoIdsOf } from '../model/person.ts'
import { removePerson } from '../model/relationships.ts'
import type { Family, Person, PhotoStore, TreeData, TreeViewDef } from '../model/types.ts'

/** A new or re-framed profile photo: the original plus the small framed card image. */
export interface PhotoUpdate {
  id: string
  blob: Blob
  avatarId: string
  avatarBlob: Blob
  crop: PhotoCrop
}

export interface TreeState {
  /** null while on the start screen. */
  tree: TreeData | null
  photos: PhotoStore
  /** Name of the .familytree file this tree was opened from / saved to. */
  fileName: string | null
  /** Handle for saving straight back to the same file (Chrome/Edge only). */
  fileHandle: FileSystemFileHandle | null
  /** True when there are changes not yet saved to a file. */
  dirty: boolean
  /** Increases on every edit, so a save that finishes late can tell if it's stale. */
  revision: number
  /** Increases each time a different tree is started or opened. */
  opened: number
}

export const initialState: TreeState = {
  tree: null,
  photos: {},
  fileName: null,
  fileHandle: null,
  dirty: false,
  revision: 0,
  opened: 0,
}

export type TreeAction =
  | { type: 'newTree'; name: string }
  | {
      type: 'load'
      tree: TreeData
      photos: PhotoStore
      fileName: string | null
      fileHandle: FileSystemFileHandle | null
      dirty: boolean
    }
  | { type: 'close' }
  | { type: 'renameTree'; name: string }
  /**
   * Add or update a person. `photo` replaces the profile photo; null removes it; omit to keep it.
   * `family`, if given, replaces all people and links (used when the person's family links were edited too).
   * `newPhotos` adds images the person now uses (e.g. new gallery photos). Photos the person no longer
   * uses are removed from the store.
   */
  | { type: 'savePerson'; person: Person; photo?: PhotoUpdate | null; family?: Family; newPhotos?: PhotoStore }
  | { type: 'deletePerson'; id: string }
  /** Add a view, or replace the one with the same id. */
  | { type: 'saveView'; view: TreeViewDef }
  | { type: 'deleteView'; id: string }
  /** `revision` is the state's revision when the save started. */
  | { type: 'saved'; fileName: string; fileHandle: FileSystemFileHandle | null; revision: number }

function withoutKeys<T>(record: Record<string, T>, ...keys: (string | null | undefined)[]): Record<string, T> {
  const present = keys.filter((k): k is string => !!k && k in record)
  if (present.length === 0) return record
  const copy = { ...record }
  for (const k of present) delete copy[k]
  return copy
}

export function treeReducer(state: TreeState, action: TreeAction): TreeState {
  const next = reduce(state, action)
  const edited = next !== state && action.type !== 'saved'
  return edited ? { ...next, revision: state.revision + 1 } : next
}

function reduce(state: TreeState, action: TreeAction): TreeState {
  switch (action.type) {
    case 'newTree':
      return {
        ...initialState,
        tree: { name: action.name, people: {}, parentLinks: {}, partnerships: {}, views: [] },
        dirty: true,
        revision: state.revision,
        opened: state.opened + 1,
      }

    case 'load':
      return {
        tree: action.tree,
        photos: action.photos,
        fileName: action.fileName,
        fileHandle: action.fileHandle,
        dirty: action.dirty,
        revision: state.revision,
        opened: state.opened + 1,
      }

    case 'close':
      return { ...initialState, revision: state.revision, opened: state.opened }

    case 'renameTree':
      if (!state.tree) return state
      return { ...state, tree: { ...state.tree, name: action.name }, dirty: true }

    case 'savePerson': {
      if (!state.tree) return state
      const previous = state.tree.people[action.person.id]
      let photos = { ...state.photos, ...action.newPhotos }
      let { photoId, avatarId, photoCrop } = action.person
      if (action.photo !== undefined) {
        const ph = action.photo
        photoId = ph?.id ?? null
        avatarId = ph?.avatarId ?? null
        photoCrop = ph?.crop ?? null
        if (ph) photos = { ...photos, [ph.id]: ph.blob, [ph.avatarId]: ph.avatarBlob }
      }
      const person: Person = { ...action.person, photoId, avatarId, photoCrop, updatedAt: new Date().toISOString() }
      // Drop images this person no longer uses, so nothing is left orphaned.
      const stillUsed = new Set(photoIdsOf(person))
      photos = withoutKeys(photos, ...photoIdsOf(previous).filter((id) => !stillUsed.has(id)))
      const family = action.family ?? state.tree
      return {
        ...state,
        tree: {
          ...state.tree,
          people: { ...family.people, [person.id]: person },
          parentLinks: family.parentLinks,
          partnerships: family.partnerships,
        },
        photos,
        dirty: true,
      }
    }

    case 'deletePerson': {
      if (!state.tree) return state
      const person = state.tree.people[action.id]
      if (!person) return state
      return {
        ...state,
        tree: { ...state.tree, ...removePerson(state.tree, action.id) },
        photos: withoutKeys(state.photos, ...photoIdsOf(person)),
        dirty: true,
      }
    }

    case 'saveView': {
      if (!state.tree) return state
      const exists = state.tree.views.some((v) => v.id === action.view.id)
      const views = exists
        ? state.tree.views.map((v) => (v.id === action.view.id ? action.view : v))
        : [...state.tree.views, action.view]
      return { ...state, tree: { ...state.tree, views }, dirty: true }
    }

    case 'deleteView':
      if (!state.tree) return state
      return { ...state, tree: { ...state.tree, views: state.tree.views.filter((v) => v.id !== action.id) }, dirty: true }

    case 'saved':
      return {
        ...state,
        fileName: action.fileName,
        fileHandle: action.fileHandle,
        // Edits made while the file was being written still need saving.
        dirty: state.revision !== action.revision,
      }
  }
}
