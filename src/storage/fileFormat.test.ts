import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { emptyPerson } from '../model/person.ts'
import { readTreeFile, TreeFileError, writeTreeFile } from './fileFormat.ts'

describe('.familytree files', () => {
  it('round-trips people and photos', async () => {
    const person = { ...emptyPerson(), firstName: 'Ann', photoId: 'ph1' }
    const tree = { name: 'Lee Family', people: { [person.id]: person } }
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

    const file = await writeTreeFile(tree, { ph1: photo })
    const loaded = await readTreeFile(file)

    expect(loaded.tree).toEqual(tree)
    expect(Object.keys(loaded.photos)).toEqual(['ph1'])
    expect(loaded.photos.ph1.type).toBe('image/jpeg')
    expect(new Uint8Array(await loaded.photos.ph1.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('fills in fields missing from older files', async () => {
    const zip = new JSZip()
    zip.file('tree.json', JSON.stringify({ format: 'familytree', version: 1, tree: { name: 'Old', people: { x: { firstName: 'Bo' } } } }))
    const loaded = await readTreeFile(await zip.generateAsync({ type: 'blob' }))
    expect(loaded.tree.people.x).toMatchObject({ id: 'x', firstName: 'Bo', gender: 'unknown', living: true })
  })

  it('rejects files that are not family trees', async () => {
    await expect(readTreeFile(new Blob(['hello']))).rejects.toBeInstanceOf(TreeFileError)
    const zip = new JSZip()
    zip.file('other.txt', 'x')
    await expect(readTreeFile(await zip.generateAsync({ type: 'blob' }))).rejects.toBeInstanceOf(TreeFileError)
  })

  it('rejects files from a newer version', async () => {
    const zip = new JSZip()
    zip.file('tree.json', JSON.stringify({ format: 'familytree', version: 99, tree: { name: 'x', people: {} } }))
    await expect(readTreeFile(await zip.generateAsync({ type: 'blob' }))).rejects.toThrow(/newer version/)
  })
})
