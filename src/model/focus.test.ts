import { describe, expect, it } from 'vitest'
import { focusIds, subFamily } from './focus.ts'
import { addParentLink, addPartnership } from './relationships.ts'
import { couple, family } from './testFamily.ts'

// gpa+gma → dad, aunt(+uncle → cousin); dad+mom → me, bro; me+hub → kid(+kidwife → grandkid)
function fam() {
  let f = family([
    ['gpa', 'male'], ['gma', 'female'], ['dad', 'male'], ['mom', 'female'], ['aunt', 'female'], ['uncle', 'male'],
    ['cousin', 'male'], ['me', 'female'], ['bro', 'male'], ['hub', 'male'], ['kid', 'male'], ['kidwife', 'female'],
    ['grandkid', 'female'], ['stranger', 'male'], ['broWife', 'female'],
  ])
  f = couple(f, 'gpa', 'gma', ['dad', 'aunt'])
  f = couple(f, 'aunt', 'uncle', ['cousin'])
  f = couple(f, 'dad', 'mom', ['me', 'bro'])
  f = couple(f, 'me', 'hub', ['kid'])
  f = couple(f, 'kid', 'kidwife', ['grandkid'])
  f = addPartnership(f, 'bro', 'broWife')
  return f
}
const sorted = (s: Set<string>) => [...s].sort()

describe('focusIds', () => {
  it('shows all ancestors, descendants, partners and siblings', () => {
    expect(sorted(focusIds(fam(), 'me', { up: Infinity, down: Infinity, across: 0 }))).toEqual(
      ['bro', 'dad', 'gma', 'gpa', 'grandkid', 'hub', 'kid', 'kidwife', 'me', 'mom'],
    )
  })

  it('leaves out aunts, cousins, siblings’ partners and unrelated people', () => {
    const ids = focusIds(fam(), 'me', { up: Infinity, down: Infinity, across: 0 })
    for (const id of ['aunt', 'uncle', 'cousin', 'broWife', 'stranger']) expect(ids.has(id)).toBe(false)
  })

  it('limits generations up and down', () => {
    expect(sorted(focusIds(fam(), 'me', { up: 1, down: 1, across: 0 }))).toEqual(['bro', 'dad', 'hub', 'kid', 'kidwife', 'me', 'mom'])
  })

  it('hides siblings when no parents are shown', () => {
    expect(sorted(focusIds(fam(), 'me', { up: 0, down: 0, across: 0 }))).toEqual(['hub', 'me'])
  })

  it('copes with someone missing from the tree', () => {
    expect(sorted(focusIds(fam(), 'nobody', { up: Infinity, down: Infinity, across: 0 }))).toEqual(['nobody'])
  })
})

// Wider family for "across": ggpa → gpa, greatAunt → secondCousinsParent → secondCousin;
// the cousin has a child of their own.
function wide() {
  let f = fam()
  f = { ...f, people: { ...f.people, ...family([['ggpa', 'male'], ['greatAunt', 'female'], ['gaKid', 'male'], ['secondCousin', 'female'], ['cousinKid', 'male']]).people } }
  for (const kid of ['gpa', 'greatAunt']) f = addParentLink(f, 'ggpa', kid)
  f = addParentLink(f, 'greatAunt', 'gaKid')
  f = addParentLink(f, 'gaKid', 'secondCousin')
  f = addParentLink(f, 'cousin', 'cousinKid')
  return f
}

describe('focusIds across', () => {
  const all = { up: Infinity, down: Infinity }

  it('adds aunts, uncles, first cousins and their partners', () => {
    const ids = focusIds(wide(), 'me', { ...all, across: 1 })
    for (const id of ['aunt', 'uncle', 'cousin', 'cousinKid', 'broWife']) expect(ids.has(id)).toBe(true)
    for (const id of ['greatAunt', 'gaKid', 'secondCousin', 'stranger']) expect(ids.has(id)).toBe(false)
  })

  it('goes one step wider for great-aunts and second cousins', () => {
    const ids = focusIds(wide(), 'me', { ...all, across: 2 })
    for (const id of ['ggpa', 'greatAunt', 'gaKid', 'secondCousin', 'cousin']) expect(ids.has(id)).toBe(true)
  })

  it('shows the shared grandparents even when fewer generations up are chosen', () => {
    const ids = focusIds(wide(), 'me', { up: 0, down: 0, across: 1 })
    for (const id of ['gpa', 'gma', 'dad', 'mom', 'aunt', 'cousin']) expect(ids.has(id)).toBe(true)
    expect(ids.has('ggpa')).toBe(false)
  })

  it('stops cousins’ children at the chosen generations down', () => {
    expect(focusIds(wide(), 'me', { up: Infinity, down: 0, across: 1 }).has('cousinKid')).toBe(false)
    expect(focusIds(wide(), 'me', { up: Infinity, down: 1, across: 1 }).has('cousinKid')).toBe(true)
  })

  it('changes nothing when set to none', () => {
    expect(sorted(focusIds(wide(), 'me', { ...all, across: 0 }))).toEqual(
      sorted(new Set([...focusIds(fam(), 'me', { ...all, across: 0 }), 'ggpa'])),
    )
  })
})

describe('subFamily', () => {
  it('keeps only links between the chosen people', () => {
    let f = addParentLink(family([['a', 'male'], ['b', 'female'], ['c', 'male']]), 'a', 'b')
    f = addParentLink(f, 'b', 'c')
    const sub = subFamily(f, new Set(['a', 'b']))
    expect(Object.keys(sub.people).sort()).toEqual(['a', 'b'])
    expect(Object.values(sub.parentLinks)).toHaveLength(1)
  })
})
