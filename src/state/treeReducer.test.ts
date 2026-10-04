import { describe, expect, it } from 'vitest'
import { emptyPerson } from '../model/person.ts'
import { DEFAULT_CROP } from '../model/photoCrop.ts'
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
    expect(s.tree).toEqual({ name: 'Lee Family', people: {} })
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
