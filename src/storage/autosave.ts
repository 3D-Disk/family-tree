// Safety-net copy of the open tree in the browser's IndexedDB, so work isn't
// lost if the tab closes before the user saves to a file.

import Dexie, { type EntityTable } from 'dexie'
import type { TreeData } from '../model/types.ts'

export interface AutosaveSession {
  key: 'current'
  tree: TreeData
  fileName: string | null
  fileHandle: FileSystemFileHandle | null
  /** True if this copy has changes that were never saved to a file. */
  dirty: boolean
  updatedAt: string
}

interface PhotoRow {
  id: string
  blob: Blob
}

const db = new Dexie('family-tree') as Dexie & {
  session: EntityTable<AutosaveSession, 'key'>
  photos: EntityTable<PhotoRow, 'id'>
}
db.version(1).stores({ session: 'key', photos: 'id' })

export async function loadAutosave(): Promise<{ session: AutosaveSession; photos: Record<string, Blob> } | null> {
  try {
    const session = await db.session.get('current')
    if (!session) return null
    const rows = await db.photos.toArray()
    return { session, photos: Object.fromEntries(rows.map((r) => [r.id, r.blob])) }
  } catch (e) {
    console.warn('Could not read the browser backup', e)
    return null
  }
}

export async function writeAutosave(
  session: Omit<AutosaveSession, 'key' | 'updatedAt'>,
  photos: Record<string, Blob>,
): Promise<void> {
  await db.transaction('rw', db.session, db.photos, async () => {
    const stored = new Set(await db.photos.toCollection().primaryKeys())
    // Photos never change once added, so only new ones need writing.
    const added = Object.entries(photos)
      .filter(([id]) => !stored.has(id))
      .map(([id, blob]) => ({ id, blob }))
    const removed = [...stored].filter((id) => !(id in photos))
    if (added.length) await db.photos.bulkPut(added)
    if (removed.length) await db.photos.bulkDelete(removed)
    const row: AutosaveSession = { ...session, key: 'current', updatedAt: new Date().toISOString() }
    try {
      await db.session.put(row)
    } catch (e) {
      // Some browsers can't store file handles; keep the backup without it.
      if (!(e instanceof Error && e.name === 'DataCloneError') || !row.fileHandle) throw e
      await db.session.put({ ...row, fileHandle: null })
    }
  })
}

export async function clearAutosave(): Promise<void> {
  await db.transaction('rw', db.session, db.photos, async () => {
    await db.session.clear()
    await db.photos.clear()
  })
}
