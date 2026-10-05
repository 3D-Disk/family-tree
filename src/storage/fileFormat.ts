// A .familytree file is a zip containing:
//   tree.json      – people, relationships, views (plain JSON)
//   photos/<id>.*  – one image file per photo
// Keeping it as ordinary JSON + images means the data is never locked in.

import JSZip from 'jszip'
import type { PhotoStore, TreeData, TreeViewDef } from '../model/types.ts'
import { emptyPerson } from '../model/person.ts'
import { withoutDanglingLinks } from '../model/relationships.ts'

export const FILE_EXTENSION = '.familytree'
export const FILE_MIME = 'application/x-familytree'
const FORMAT = 'familytree'
const VERSION = 1

interface TreeJson {
  format: typeof FORMAT
  version: number
  savedAt: string
  tree: TreeData
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const TYPE_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]))

export async function writeTreeFile(tree: TreeData, photos: PhotoStore): Promise<Blob> {
  const zip = new JSZip()
  const json: TreeJson = { format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), tree }
  zip.file('tree.json', JSON.stringify(json, null, 2))
  for (const [id, blob] of Object.entries(photos)) {
    zip.file(`photos/${id}.${EXT_BY_TYPE[blob.type] ?? 'bin'}`, blob)
  }
  return zip.generateAsync({ type: 'blob', mimeType: FILE_MIME })
}

export class TreeFileError extends Error {}

export async function readTreeFile(file: Blob): Promise<{ tree: TreeData; photos: PhotoStore }> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new TreeFileError("This file isn't a family tree file.")
  }
  const entry = zip.file('tree.json')
  if (!entry) throw new TreeFileError("This file isn't a family tree file.")

  let json: TreeJson
  try {
    json = JSON.parse(await entry.async('string'))
  } catch {
    throw new TreeFileError('This family tree file is damaged and could not be read.')
  }
  if (json.format !== FORMAT || !json.tree) throw new TreeFileError("This file isn't a family tree file.")
  if (json.version > VERSION) {
    throw new TreeFileError('This file was saved by a newer version of the website. Refresh the page and try again.')
  }

  const photos: PhotoStore = {}
  const photoEntries = zip.file(/^photos\/[^/]+$/)
  await Promise.all(
    photoEntries.map(async (e) => {
      const base = e.name.slice('photos/'.length)
      const dot = base.lastIndexOf('.')
      const id = dot === -1 ? base : base.slice(0, dot)
      const type = TYPE_BY_EXT[base.slice(dot + 1)] ?? ''
      photos[id] = new Blob([await e.async('arraybuffer')], { type })
    }),
  )

  return { tree: normalizeTree(json.tree), photos }
}

/** Fill in fields added in later versions (so older files keep working) and drop broken links. */
export function normalizeTree(tree: Partial<TreeData>): TreeData {
  const people = Object.fromEntries(
    Object.entries(tree.people ?? {}).map(([id, p]) => [id, { ...emptyPerson(), ...p, id }]),
  )
  const family = withoutDanglingLinks({ people, parentLinks: tree.parentLinks ?? {}, partnerships: tree.partnerships ?? {} })
  return { ...tree, name: tree.name ?? 'My family tree', ...family, views: cleanViews(tree.views, family.people) }
}

/** Keep only well-formed views, and forget people who no longer exist. */
function cleanViews(views: unknown, people: Record<string, unknown>): TreeViewDef[] {
  if (!Array.isArray(views)) return []
  const clean = (orders: unknown) =>
    Object.fromEntries(
      Object.entries((orders ?? {}) as Record<string, unknown>)
        .filter(([, ids]) => Array.isArray(ids))
        .map(([key, ids]) => [key, (ids as string[]).filter((id) => id in people)]),
    )
  return views
    .filter((v): v is TreeViewDef => !!v && typeof v.id === 'string')
    .map((v) => ({ id: v.id, name: String(v.name ?? 'View'), siblingOrder: clean(v.siblingOrder), chainOrder: clean(v.chainOrder) }))
}
