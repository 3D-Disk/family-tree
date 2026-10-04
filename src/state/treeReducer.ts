import type { Person, PhotoStore, TreeData } from '../model/types.ts'

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
}

export const initialState: TreeState = {
  tree: null,
  photos: {},
  fileName: null,
  fileHandle: null,
  dirty: false,
  revision: 0,
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
  /** Add or update a person. `photo` replaces the profile photo; null removes it; omit to keep it. */
  | { type: 'savePerson'; person: Person; photo?: { id: string; blob: Blob } | null }
  | { type: 'deletePerson'; id: string }
  /** `revision` is the state's revision when the save started. */
  | { type: 'saved'; fileName: string; fileHandle: FileSystemFileHandle | null; revision: number }

function withoutKey<T>(record: Record<string, T>, key: string | null | undefined): Record<string, T> {
  if (!key || !(key in record)) return record
  const copy = { ...record }
  delete copy[key]
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
      return { ...initialState, tree: { name: action.name, people: {} }, dirty: true, revision: state.revision }

    case 'load':
      return {
        tree: action.tree,
        photos: action.photos,
        fileName: action.fileName,
        fileHandle: action.fileHandle,
        dirty: action.dirty,
        revision: state.revision,
      }

    case 'close':
      return { ...initialState, revision: state.revision }

    case 'renameTree':
      if (!state.tree) return state
      return { ...state, tree: { ...state.tree, name: action.name }, dirty: true }

    case 'savePerson': {
      if (!state.tree) return state
      const previous = state.tree.people[action.person.id]
      let photos = state.photos
      let photoId = action.person.photoId
      if (action.photo !== undefined) {
        photos = withoutKey(photos, previous?.photoId)
        photoId = action.photo?.id ?? null
        if (action.photo) photos = { ...photos, [action.photo.id]: action.photo.blob }
      }
      const person: Person = { ...action.person, photoId, updatedAt: new Date().toISOString() }
      return {
        ...state,
        tree: { ...state.tree, people: { ...state.tree.people, [person.id]: person } },
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
        tree: { ...state.tree, people: withoutKey(state.tree.people, action.id) },
        photos: withoutKey(state.photos, person.photoId),
        dirty: true,
      }
    }

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
