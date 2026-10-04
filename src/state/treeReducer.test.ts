import { describe, expect, it } from 'vitest'
import { emptyPerson } from '../model/person.ts'
import { initialState, treeReducer, type TreeState } from './treeReducer.ts'

const started = (): TreeState => treeReducer(initialState, { type: 'newTree', name: 'Lee Family' })

describe('treeReducer', () => {
  it('starts a new, unsaved tree', () => {
    const s = started()
    expect(s.tree).toEqual({ name: 'Lee Family', people: {} })
    expect(s.dirty).toBe(true)
  })

  it('adds a person with a photo and marks the tree unsaved', () => {
    const saved = { ...started(), dirty: false }
    const person = { ...emptyPerson(), firstName: 'Ann' }
    const blob = new Blob(['x'])
    const s = treeReducer(saved, { type: 'savePerson', person, photo: { id: 'p1', blob } })
    expect(s.tree!.people[person.id].firstName).toBe('Ann')
    expect(s.tree!.people[person.id].photoId).toBe('p1')
    expect(s.photos).toEqual({ p1: blob })
    expect(s.dirty).toBe(true)
  })

  it('replaces and removes photos without leaving orphans', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: { id: 'a', blob: new Blob(['a']) } })
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: { id: 'b', blob: new Blob(['b']) } })
    expect(Object.keys(s.photos)).toEqual(['b'])
    s = treeReducer(s, { type: 'savePerson', person: s.tree!.people[person.id], photo: null })
    expect(s.photos).toEqual({})
    expect(s.tree!.people[person.id].photoId).toBeNull()
  })

  it('keeps the existing photo when editing other fields', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: { id: 'a', blob: new Blob(['a']) } })
    s = treeReducer(s, { type: 'savePerson', person: { ...s.tree!.people[person.id], lastName: 'Lee' } })
    expect(s.tree!.people[person.id].photoId).toBe('a')
    expect(Object.keys(s.photos)).toEqual(['a'])
  })

  it('deletes a person and their photo', () => {
    const person = emptyPerson()
    let s = treeReducer(started(), { type: 'savePerson', person, photo: { id: 'a', blob: new Blob(['a']) } })
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
