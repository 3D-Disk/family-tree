import { describe, expect, it } from 'vitest'
import { emptyPerson } from '../model/person.ts'
import { DEFAULT_CROP } from '../model/photoCrop.ts'
import { addParentLink } from '../model/relationships.ts'
import { initialState, treeReducer, type PhotoUpdate, type TreeState } from './treeReducer.ts'

const started = (): TreeState => treeReducer(initialState, { type: 'newTree', name: 'Lee Family' })

const photo = (id: string, crop = DEFAULT_CROP): PhotoUpdate => ({
  id,
  blob: new Blob([id]),
  avatarId: `${id}-card`,
  avatarBlob: new Blob([`${id}-card`]),
  crop,
})

describe('treeReducer', () => {
  it('starts a new, unsaved tree', () => {
    const s = started()
    expect(s.tree).toEqual({ name: 'Lee Family', people: {}, parentLinks: {}, partnerships: {} })
    expect(s.dirty).toBe(true)
  })

  it('adds a person with a photo, card image and framing', () => {
    const saved = { ...started(), dirty: false }
    const person = { ...emptyPerson(), firstName: 'Ann' }
    const crop = { ...DEFAULT_CROP, zoom: 2 }
    const s = treeReducer(saved, { type: 'savePerson', person, photo: photo('p1', crop) })
    const stored = s.tree!.people[person.id]
    expect(stored).toMatchObject({ firstName: 'Ann', photoId: 'p1', avatarId: 'p1-card', photoCrop: crop })
    expect(Object.keys(s.photos).sort()).toEqual(['p1', 'p1-card'])
    expect(s.dirty).toBe(true)
  })

  it('replaces and removes photos without leaving orphans', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: photo('a') })
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: photo('b') })
    expect(Object.keys(s.photos).sort()).toEqual(['b', 'b-card'])
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: null })
    expect(s.photos).toEqual({})
    expect(s.tree!.people[person.id]).toMatchObject({ photoId: null, avatarId: null, photoCrop: null })
  })

  it('re-framing the same photo keeps the original and swaps the card image', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: photo('a') })
    const original = s.photos.a
    const reframed: PhotoUpdate = { ...photo('a', { ...DEFAULT_CROP, x: 0.2 }), blob: original, avatarId: 'a-card2' }
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: reframed })
    expect(Object.keys(s.photos).sort()).toEqual(['a', 'a-card2'])
    expect(s.photos.a).toBe(original)
    expect(s.tree!.people[person.id].photoCrop!.x).toBe(0.2)
  })

  it('keeps the existing photo when editing other fields', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: photo('a') })
    s = treeReducer(s, { type: 'savePerson', person: { ...s.tree!.people[person.id], lastName: 'Lee' } })
    expect(s.tree!.people[person.id]).toMatchObject({ photoId: 'a', avatarId: 'a-card' })
    expect(Object.keys(s.photos).sort()).toEqual(['a', 'a-card'])
  })

  it('saves family link edits together with the person', () => {
    let s = started()
    const kid = { ...emptyPerson(), firstName: 'Kid' }
    s = treeReducer(s, { type: 'savePerson', person: kid })
    const mom = { ...emptyPerson(), firstName: 'Mom' }
    const family = addParentLink({ ...s.tree!, people: { ...s.tree!.people, [mom.id]: mom } }, mom.id, kid.id)
    s = treeReducer(s, { type: 'savePerson', person: { ...kid, lastName: 'Lee' }, family })
    expect(Object.keys(s.tree!.people)).toHaveLength(2)
    expect(s.tree!.people[kid.id].lastName).toBe('Lee')
    expect(Object.values(s.tree!.parentLinks)).toMatchObject([{ parentId: mom.id, childId: kid.id }])
  })

  it('deleting a person removes their links', () => {
    let s = started()
    const a = emptyPerson(), b = emptyPerson()
    s = treeReducer(s, { type: 'savePerson', person: a })
    s = treeReducer(s, { type: 'savePerson', person: b, family: addParentLink(s.tree!, a.id, b.id) })
    s = treeReducer(s, { type: 'deletePerson', id: a.id })
    expect(s.tree!.parentLinks).toEqual({})
  })

  it('adds gallery photos and removes the ones taken out of the gallery', () => {
    const person = emptyPerson()
    const g = (n: string) => ({ id: n, photoId: `${n}-full`, thumbId: `${n}-thumb`, caption: '', date: '' })
    const blobs = (...ns: string[]) => Object.fromEntries(ns.flatMap((n) => [[`${n}-full`, new Blob([n])], [`${n}-thumb`, new Blob([n])]]))
    let s = treeReducer(started(), { type: 'savePerson', person: { ...person, gallery: [g('a'), g('b')] }, newPhotos: blobs('a', 'b') })
    expect(Object.keys(s.photos).sort()).toEqual(['a-full', 'a-thumb', 'b-full', 'b-thumb'])
    s = treeReducer(s, { type: 'savePerson', person: { ...s.tree!.people[person.id], gallery: [g('b')] } })
    expect(Object.keys(s.photos).sort()).toEqual(['b-full', 'b-thumb'])
    // Changing the profile photo leaves the gallery alone.
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: photo('p') })
    expect(Object.keys(s.photos).sort()).toEqual(['b-full', 'b-thumb', 'p', 'p-card'])
    s = treeReducer(s, { type: 'deletePerson', id: person.id })
    expect(s.photos).toEqual({})
  })

  it('deletes a person and their photos', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: photo('a') })
    s = treeReducer(s, { type: 'deletePerson', id: person.id })
    expect(s.tree!.people).toEqual({})
    expect(s.photos).toEqual({})
  })

  it('clears the unsaved flag after saving', () => {
    const before = started()
    const s = treeReducer(before, { type: 'saved', fileName: 'Lee Family.familytree', fileHandle: null, revision: before.revision })
    expect(s.dirty).toBe(false)
    expect(s.fileName).toBe('Lee Family.familytree')
  })

  it('stays unsaved if edits happened while saving', () => {
    const before = started()
    const edited = treeReducer(before, { type: 'savePerson', person: emptyPerson() })
    const s = treeReducer(edited, { type: 'saved', fileName: 'x.familytree', fileHandle: null, revision: before.revision })
    expect(s.dirty).toBe(true)
  })
})
