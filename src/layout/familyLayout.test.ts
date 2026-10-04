import { describe, expect, it } from 'vitest'
import { addParentLink, addPartnership, updatePartnership } from '../model/relationships.ts'
import { couple, family } from '../model/testFamily.ts'
import type { Family } from '../model/types.ts'
import { isotonicPlace, LAYOUT, layoutFamily, type TreeLayout } from './familyLayout.ts'

const W = LAYOUT.cardWidth
const x = (t: TreeLayout, id: string) => t.people[id].x
const row = (t: TreeLayout, id: string) => t.people[id].generation
const centre = (t: TreeLayout, id: string) => x(t, id) + W / 2
const leftToRight = (t: TreeLayout, ids: string[]) => [...ids].sort((a, b) => x(t, a) - x(t, b))
const withBirth = (f: Family, dates: Record<string, string>): Family => ({
  ...f,
  people: Object.fromEntries(
    Object.entries(f.people).map(([id, p]) => [id, dates[id] !== undefined ? { ...p, birth: { date: dates[id], place: '' } } : p]),
  ),
})
const withAdded = (f: Family, order: string[]): Family => ({
  ...f,
  people: Object.fromEntries(
    Object.entries(f.people).map(([id, p]) => [id, { ...p, createdAt: new Date(2020, 0, 1 + order.indexOf(id)).toISOString() }]),
  ),
})

/** No two cards on the same row overlap. */
function expectNoOverlaps(t: TreeLayout) {
  const placed = Object.values(t.people)
  for (const a of placed) {
    for (const b of placed) {
      if (a === b || a.y !== b.y) continue
      expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(W)
    }
  }
}

describe('generations', () => {
  it('puts parents above children and partners on the same row', () => {
    let f = couple(family([['gpa', 'male'], ['gma', 'female'], ['dad', 'male'], ['mom', 'female'], ['kid', 'female']]), 'gpa', 'gma', ['dad'])
    f = couple(f, 'dad', 'mom', ['kid'])
    const t = layoutFamily(f)
    expect([row(t, 'gpa'), row(t, 'gma'), row(t, 'dad'), row(t, 'mom'), row(t, 'kid')]).toEqual([0, 0, 1, 1, 2])
    expect(t.people.dad.y).toBeGreaterThan(t.people.gpa.y)
  })

  it('places a married-in spouse with no parents on their partner’s row', () => {
    let f = couple(family([['a', 'male'], ['b', 'female'], ['son', 'male'], ['wife', 'female']]), 'a', 'b', ['son'])
    f = addPartnership(f, 'son', 'wife')
    expect(row(layoutFamily(f), 'wife')).toBe(1)
  })

  it('pulls a parent with no parents down to just above their child', () => {
    // dad's line goes back two generations; mom (no parents) should be on dad's row.
    let f = couple(family([['gg', 'male'], ['g', 'male'], ['dad', 'male'], ['mom', 'female'], ['kid', 'male']]), 'gg', 'g', [])
    f = addParentLink(addParentLink(f, 'gg', 'g'), 'g', 'dad')
    f = addParentLink(addParentLink(f, 'dad', 'kid'), 'mom', 'kid')
    const t = layoutFamily(f)
    expect(row(t, 'mom')).toBe(row(t, 'dad'))
  })
})

describe('ordering', () => {
  it('orders siblings oldest to youngest, unknown birth dates last in the order added', () => {
    let f = couple(family([['dad', 'male'], ['mom', 'female'], ['c1', 'male'], ['c2', 'female'], ['c3', 'male'], ['c4', 'female']]), 'dad', 'mom', ['c1', 'c2', 'c3', 'c4'])
    f = withAdded(withBirth(f, { c1: '1990', c2: '', c3: '1980', c4: '' }), ['dad', 'mom', 'c4', 'c1', 'c2', 'c3'])
    expect(leftToRight(layoutFamily(f), ['c1', 'c2', 'c3', 'c4'])).toEqual(['c3', 'c1', 'c4', 'c2'])
  })

  it('puts the man on the left and the woman on the right', () => {
    const f = addPartnership(family([['wife', 'female'], ['husband', 'male']]), 'wife', 'husband')
    const t = layoutFamily(f)
    expect(x(t, 'husband')).toBeLessThan(x(t, 'wife'))
  })

  it('puts the older partner on the left in a same-sex couple', () => {
    const f = withBirth(addPartnership(family([['young', 'female'], ['old', 'female']]), 'young', 'old'), { young: '1990', old: '1970' })
    const t = layoutFamily(f)
    expect(x(t, 'old')).toBeLessThan(x(t, 'young'))
  })

  it('puts someone with two partners between them, earlier partner on the left', () => {
    let f = family([['dad', 'male'], ['first', 'female'], ['second', 'female']])
    f = addPartnership(addPartnership(f, 'dad', 'second'), 'dad', 'first')
    const [p1, p2] = Object.values(f.partnerships)
    f = updatePartnership(f, p1.personIds.includes('second') ? p1.id : p2.id, { start: { date: '2000', place: '' } })
    f = updatePartnership(f, p1.personIds.includes('first') ? p1.id : p2.id, { start: { date: '1980', place: '' } })
    expect(leftToRight(layoutFamily(f), ['dad', 'first', 'second'])).toEqual(['first', 'dad', 'second'])
  })

  it('keeps half-siblings under the right parents', () => {
    let f = family([['dad', 'male'], ['first', 'female'], ['second', 'female'], ['a', 'male'], ['b', 'male']])
    f = couple(f, 'dad', 'first', ['a'])
    f = couple(f, 'dad', 'second', ['b'])
    const t = layoutFamily(f)
    const left = leftToRight(t, ['first', 'second'])[0]
    // The child of the left-hand wife is on the left.
    expect(leftToRight(t, ['a', 'b'])[0]).toBe(left === 'first' ? 'a' : 'b')
  })

  it('puts each side’s grandparents above the right parent', () => {
    let f = family([['pgf', 'male'], ['pgm', 'female'], ['mgf', 'male'], ['mgm', 'female'], ['dad', 'male'], ['mom', 'female'], ['me', 'female']])
    // Add the mother's parents first so a naive order would put them on the left.
    f = withAdded(f, ['mgf', 'mgm', 'pgf', 'pgm', 'dad', 'mom', 'me'])
    f = couple(f, 'mgf', 'mgm', ['mom'])
    f = couple(f, 'pgf', 'pgm', ['dad'])
    f = couple(f, 'dad', 'mom', ['me'])
    const t = layoutFamily(f)
    expect(x(t, 'dad')).toBeLessThan(x(t, 'mom'))
    expect(Math.max(x(t, 'pgf'), x(t, 'pgm'))).toBeLessThan(Math.min(x(t, 'mgf'), x(t, 'mgm')))
  })
})

describe('positions', () => {
  it('centres children under their parents', () => {
    const f = couple(family([['dad', 'male'], ['mom', 'female'], ['a', 'male'], ['b', 'female'], ['c', 'male']]), 'dad', 'mom', ['a', 'b', 'c'])
    const t = layoutFamily(f)
    const parentsMid = (centre(t, 'dad') + centre(t, 'mom')) / 2
    const kidsMid = (Math.min(...['a', 'b', 'c'].map((k) => centre(t, k))) + Math.max(...['a', 'b', 'c'].map((k) => centre(t, k)))) / 2
    expect(Math.abs(parentsMid - kidsMid)).toBeLessThan(2)
  })

  it('never overlaps cards in a bigger family', () => {
    let f = family([
      ['gpa', 'male'], ['gma', 'female'], ['dad', 'male'], ['mom', 'female'], ['aunt', 'female'], ['uncle', 'male'],
      ['me', 'female'], ['bro', 'male'], ['sis', 'female'], ['cous1', 'male'], ['cous2', 'female'], ['hubby', 'male'],
      ['k1', 'male'], ['k2', 'female'], ['ex', 'female'], ['half', 'male'],
    ])
    f = couple(f, 'gpa', 'gma', ['dad', 'aunt'])
    f = couple(f, 'dad', 'mom', ['me', 'bro', 'sis'])
    f = couple(f, 'aunt', 'uncle', ['cous1', 'cous2'])
    f = couple(f, 'me', 'hubby', ['k1', 'k2'])
    f = couple(f, 'dad', 'ex', ['half'], 'divorced')
    const t = layoutFamily(f)
    expectNoOverlaps(t)
    expect(Object.keys(t.people)).toHaveLength(16)
  })

  it('puts people not linked to anyone in a separate area with a heading', () => {
    const f = couple(family([['dad', 'male'], ['mom', 'female'], ['kid', 'male'], ['loner1', 'female'], ['loner2', 'male']]), 'dad', 'mom', ['kid'])
    const t = layoutFamily(f)
    expect(t.unlinkedLabel).not.toBeNull()
    expect(x(t, 'loner1')).toBeGreaterThan(x(t, 'kid'))
    expect(x(t, 'loner1')).toBe(t.unlinkedLabel!.x)
    expectNoOverlaps(t)
  })

  it('places separate families side by side without overlapping', () => {
    let f = family([['a', 'male'], ['b', 'female'], ['c', 'male'], ['d', 'male'], ['e', 'female'], ['g', 'female']])
    f = couple(f, 'a', 'b', ['c'])
    f = couple(f, 'd', 'e', ['g'])
    const t = layoutFamily(f)
    expectNoOverlaps(t)
    const fam1 = Math.max(...['a', 'b', 'c'].map((id) => x(t, id)))
    const fam2 = Math.min(...['d', 'e', 'g'].map((id) => x(t, id)))
    expect(fam2 - fam1).toBeGreaterThan(W)
  })

  it('handles an empty tree', () => {
    expect(layoutFamily(family([]))).toMatchObject({ people: {}, lines: [], unlinkedLabel: null })
  })
})

describe('lines', () => {
  it('draws a partner line and child lines, dashed for divorce and adoption', () => {
    let f = couple(family([['dad', 'male'], ['mom', 'female'], ['kid', 'male']]), 'dad', 'mom', [], 'divorced')
    f = addParentLink(addParentLink(f, 'dad', 'kid', 'adoptive'), 'mom', 'kid', 'adoptive')
    const t = layoutFamily(f)
    const partner = t.lines.filter((l) => l.kind === 'partner')
    expect(partner).toHaveLength(1)
    expect(partner[0].dashed).toBe(true)
    const child = t.lines.filter((l) => l.kind === 'child')
    expect(child.some((l) => l.dashed)).toBe(true)
    // The last child line ends at the top-centre of the child's card.
    expect(child.at(-1)!.points.at(-1)).toEqual([centre(t, 'kid'), t.people.kid.y])
  })

  it('draws a separate dashed line for a third (step) parent', () => {
    let f = couple(family([['dad', 'male'], ['mom', 'female'], ['step', 'male'], ['kid', 'male']]), 'dad', 'mom', ['kid'])
    f = addParentLink(f, 'step', 'kid', 'step')
    expect(layoutFamily(f).lines.filter((l) => l.kind === 'otherParent')).toHaveLength(1)
  })
})

describe('isotonicPlace', () => {
  it('keeps order and gaps while staying close to the desired spots', () => {
    expect(isotonicPlace([0, 50, 300], [10, 10, 10], [5, 5])).toEqual([0, 50, 300])
    // Two items wanting the same spot are spread evenly around it.
    expect(isotonicPlace([100, 100], [10, 10], [10])).toEqual([90, 110])
  })
})
