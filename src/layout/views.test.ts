import { describe, expect, it } from 'vitest'
import { addParentLink } from '../model/relationships.ts'
import { couple, family } from '../model/testFamily.ts'
import type { Family } from '../model/types.ts'
import { applyOrder, groupKeyOf, LAYOUT, layoutFamily, type TreeLayout } from './familyLayout.ts'
import { emptyViewOrder, reorderByDrop } from './viewEdits.ts'

const W = LAYOUT.cardWidth
const leftToRight = (t: TreeLayout, ids: string[]) => [...ids].sort((a, b) => t.people[a].x - t.people[b].x)
const centre = (t: TreeLayout, id: string) => t.people[id].x + W / 2
const withBirth = (f: Family, dates: Record<string, string>): Family => ({
  ...f,
  people: Object.fromEntries(Object.entries(f.people).map(([id, p]) => [id, { ...p, birth: { date: dates[id] ?? '', place: '' } }])),
})

// dad+mom → a (1980, m), b (1982, f), c (1984, m); a is married to aw.
function fam() {
  let f = couple(family([['dad', 'male'], ['mom', 'female'], ['a', 'male'], ['b', 'female'], ['c', 'male'], ['aw', 'female']]), 'dad', 'mom', ['a', 'b', 'c'])
  f = couple(f, 'a', 'aw', [])
  return withBirth(f, { a: '1980', b: '1982', c: '1984' })
}
const kids = groupKeyOf(['dad', 'mom'])

describe('applyOrder', () => {
  it('puts listed people in the saved order and keeps others in place', () => {
    expect(applyOrder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'b', 'a', 'd'])
    expect(applyOrder(['a', 'b'], undefined)).toEqual(['a', 'b'])
    expect(applyOrder(['a', 'b'], ['ghost', 'b', 'a'])).toEqual(['b', 'a'])
  })
})

describe('views in the layout', () => {
  it('changes nothing without a view', () => {
    expect(layoutFamily(fam(), LAYOUT, emptyViewOrder())).toEqual(layoutFamily(fam()))
  })

  it('applies a saved sibling order (spouse moves with them)', () => {
    const t = layoutFamily(fam(), LAYOUT, { siblingOrder: { [kids]: ['b', 'c', 'a'] }, chainOrder: {} })
    expect(leftToRight(t, ['a', 'b', 'c'])).toEqual(['b', 'c', 'a'])
    expect(Math.abs(t.people.aw.x - t.people.a.x)).toBe(W + LAYOUT.partnerGap)
  })

  it('still places a sibling added later by birth date', () => {
    const base = fam()
    const d = { ...base.people.a, id: 'd', firstName: 'd', birth: { date: '1981', place: '' } }
    const f = addParentLink(addParentLink({ ...base, people: { ...base.people, d } }, 'dad', 'd'), 'mom', 'd')
    const t = layoutFamily(f, LAYOUT, { siblingOrder: { [kids]: ['c', 'b', 'a'] }, chainOrder: {} })
    // The saved three swap places among themselves; d (born 1981) keeps its birth slot.
    expect(leftToRight(t, ['a', 'b', 'c', 'd'])).toEqual(['c', 'd', 'b', 'a'])
  })

  it('applies a saved couple order', () => {
    const t = layoutFamily(fam(), LAYOUT, { siblingOrder: {}, chainOrder: { [groupKeyOf(['dad', 'mom'])]: ['mom', 'dad'] } })
    expect(leftToRight(t, ['dad', 'mom'])).toEqual(['mom', 'dad'])
  })

  it('reports chains and sibling groups for dragging', () => {
    const t = layoutFamily(fam())
    expect(t.siblingGroups.find((g) => g.key === kids)!.ids).toEqual(['a', 'b', 'c'])
    expect(t.chains).toContainEqual(['a', 'aw'])
  })
})

describe('reorderByDrop', () => {
  const t = layoutFamily(fam())
  const v = emptyViewOrder()

  it('moves a sibling to where it was dropped', () => {
    const next = reorderByDrop(t, v, 'c', centre(t, 'a') - W)
    expect(next!.siblingOrder[kids]).toEqual(['c', 'a', 'b'])
  })

  it('compares against a married sibling’s own card, not the couple’s middle', () => {
    // Just left of a's card (a sits beside his wife) → before a.
    const next = reorderByDrop(t, v, 'c', centre(t, 'a') - 20)
    expect(next!.siblingOrder[kids][0]).toBe('c')
  })

  it('moves a married sibling (with their spouse) when dragging the spouse past the others', () => {
    const next = reorderByDrop(t, v, 'aw', centre(t, 'c') + W * 2)
    expect(next!.siblingOrder[kids]).toEqual(['b', 'c', 'a'])
  })

  it('swaps a couple when dropped over the partner', () => {
    const next = reorderByDrop(t, v, 'mom', centre(t, 'dad') - 10)
    expect(next!.chainOrder[groupKeyOf(['dad', 'mom'])]).toEqual(['mom', 'dad'])
  })

  it('does nothing when dropped where it was (e.g. only moved up or down)', () => {
    expect(reorderByDrop(t, v, 'b', centre(t, 'b'))).toBeNull()
    expect(reorderByDrop(t, v, 'b', centre(t, 'b') + 20)).toBeNull()
  })

  it('does nothing for someone without brothers or sisters or partner', () => {
    const single = layoutFamily(family([['x', 'male'], ['y', 'female']]))
    expect(reorderByDrop(single, v, 'x', 500)).toBeNull()
  })
})
