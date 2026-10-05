// Opening and saving .familytree files on the user's computer.
// Chrome/Edge support the File System Access API, so "Save" can write back to
// the same file. Other browsers fall back to a file picker and a download.

import { FILE_EXTENSION, FILE_MIME } from './fileFormat.ts'

interface PickerType {
  description: string
  accept: Record<string, string[]>
}
interface PickerWindow {
  showOpenFilePicker(options: { types: PickerType[]; multiple?: boolean }): Promise<FileSystemFileHandle[]>
  showSaveFilePicker(options: { types: PickerType[]; suggestedName?: string }): Promise<FileSystemFileHandle>
}
type PermissionHandle = FileSystemFileHandle & {
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>
}

const TYPES: PickerType[] = [{ description: 'Family tree', accept: { [FILE_MIME]: [FILE_EXTENSION] } }]

export const canSaveInPlace = typeof window !== 'undefined' && 'showSaveFilePicker' in window

function isCancel(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

/** Ask the user to pick a file. Returns null if they cancel. */
export async function pickTreeFile(): Promise<{ file: File; handle: FileSystemFileHandle | null } | null> {
  if (canSaveInPlace) {
    try {
      const [handle] = await (window as unknown as PickerWindow).showOpenFilePicker({ types: TYPES })
      return { file: await handle.getFile(), handle }
    } catch (e) {
      if (isCancel(e)) return null
      throw e
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    // No `accept` filter on purpose: iPhones/iPads grey out file types they don't
    // recognise (like .familytree), so they could never be picked. readTreeFile
    // checks the file instead and explains if it isn't a family tree.
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      resolve(file ? { file, handle: null } : null)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

function datedFileName(treeName: string): string {
  const safe = treeName.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Family tree'
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${safe} ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}${FILE_EXTENSION}`
}

async function ensureWritable(handle: PermissionHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted'
}

/**
 * Save the file. Writes back to `handle` when possible unless `saveAs` is set.
 * Returns the saved file's name and handle, or null if the user cancelled.
 */
export async function saveTreeFile(
  data: Blob,
  opts: { treeName: string; handle: FileSystemFileHandle | null; saveAs: boolean },
): Promise<{ fileName: string; handle: FileSystemFileHandle | null } | null> {
  if (canSaveInPlace) {
    try {
      let handle = opts.saveAs ? null : opts.handle
      if (handle && !(await ensureWritable(handle))) handle = null
      if (!handle) {
        const suggestedName = `${opts.treeName.trim() || 'Family tree'}${FILE_EXTENSION}`
        handle = await (window as unknown as PickerWindow).showSaveFilePicker({ types: TYPES, suggestedName })
      }
      const writable = await handle.createWritable()
      await writable.write(data)
      await writable.close()
      return { fileName: handle.name, handle }
    } catch (e) {
      if (isCancel(e)) return null
      throw e
    }
  }

  const fileName = datedFileName(opts.treeName)
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return { fileName, handle: null }
}
