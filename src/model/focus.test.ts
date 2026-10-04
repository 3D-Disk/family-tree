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
    expect(sorted(focusIds(fam(), 'me', { up: Infinity, down: Infinity }))).toEqual(
      ['bro', 'dad', 'gma', 'gpa', 'grandkid', 'hub', 'kid', 'kidwife', 'me', 'mom'],
    )
  })

  it('leaves out aunts, cousins, siblings’ partners and unrelated people', () => {
    const ids = focusIds(fam(), 'me', { up: Infinity, down: Infinity })
    for (const id of ['aunt', 'uncle', 'cousin', 'broWife', 'stranger']) expect(ids.has(id)).toBe(false)
  })

  it('limits generations up and down', () => {
    expect(sorted(focusIds(fam(), 'me', { up: 1, down: 1 }))).toEqual(['bro', 'dad', 'hub', 'kid', 'kidwife', 'me', 'mom'])
  })

  it('hides siblings when no parents are shown', () => {
    expect(sorted(focusIds(fam(), 'me', { up: 0, down: 0 }))).toEqual(['hub', 'me'])
  })

  it('copes with someone missing from the tree', () => {
    expect(sorted(focusIds(fam(), 'nobody', { up: Infinity, down: Infinity }))).toEqual(['nobody'])
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
