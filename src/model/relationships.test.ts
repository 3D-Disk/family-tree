import { describe, expect, it } from 'vitest'
import {
  addParentLink,
  addPartnership,
  checkParentLink,
  checkParentType,
  checkPartnership,
  childrenNeedingParent,
  hasNoRelations,
  isAncestor,
  parentLinksOf,
  removePerson,
  withoutDanglingLinks,
} from './relationships.ts'
import { couple, family } from './testFamily.ts'

const base = () =>
  couple(
    family([['gpa', 'male'], ['gma', 'female'], ['dad', 'male'], ['mom', 'female'], ['me', 'female'], ['loner', 'unknown']]),
    'gpa', 'gma', ['dad'],
  )

describe('relationship rules', () => {
  it('blocks being your own parent or partner', () => {
    const f = base()
    expect(checkParentLink(f, 'me', 'me', 'biological')).toMatch(/own parent/)
    expect(checkPartnership(f, 'me', 'me')).toMatch(/own partner/)
  })

  it('blocks duplicates', () => {
    const f = base()
    expect(checkParentLink(f, 'gpa', 'dad', 'adoptive')).toMatch(/already a parent/)
    expect(checkPartnership(f, 'gma', 'gpa')).toMatch(/already partners/)
  })

  it('blocks loops in the family line', () => {
    const f = addParentLink(base(), 'dad', 'me')
    expect(isAncestor(f, 'gpa', 'me')).toBe(true)
    expect(checkParentLink(f, 'me', 'gpa', 'biological')).toMatch(/descendant/)
    expect(checkPartnership(f, 'me', 'gpa')).toMatch(/can't be partners/)
  })

  it('blocks partners being parent and child', () => {
    const f = addPartnership(base(), 'dad', 'mom')
    expect(checkParentLink(f, 'dad', 'mom', 'biological')).toMatch(/partners/)
  })

  it('allows only two biological parents, but any number of others', () => {
    let f = addParentLink(addParentLink(base(), 'dad', 'me'), 'mom', 'me')
    expect(checkParentLink(f, 'loner', 'me', 'biological')).toMatch(/two biological parents/)
    expect(checkParentLink(f, 'loner', 'me', 'step')).toBeNull()
    f = addParentLink(f, 'loner', 'me', 'step')
    const stepLink = parentLinksOf(f, 'me').find((l) => l.parentId === 'loner')!
    expect(checkParentType(f, stepLink.id, 'biological')).toMatch(/two biological parents/)
    expect(checkParentType(f, stepLink.id, 'foster')).toBeNull()
  })

  it('removes a person together with their links', () => {
    const f = removePerson(base(), 'gpa')
    expect(f.people.gpa).toBeUndefined()
    expect(Object.values(f.parentLinks).map((l) => l.parentId)).toEqual(['gma'])
    expect(f.partnerships).toEqual({})
  })

  it('finds children who still need a second parent', () => {
    let f = family([['mom', 'female'], ['a', 'male'], ['b', 'female'], ['ex', 'male']])
    f = addParentLink(addParentLink(f, 'mom', 'a'), 'mom', 'b')
    f = addParentLink(f, 'ex', 'b')
    expect(childrenNeedingParent(f, 'mom')).toEqual(['a'])
    expect(childrenNeedingParent(f, 'ex')).toEqual([])
  })

  it('knows who has no relations', () => {
    const f = base()
    expect(hasNoRelations(f, 'loner')).toBe(true)
    expect(hasNoRelations(f, 'dad')).toBe(false)
  })

  it('drops links to missing people', () => {
    const f = { ...base(), people: { ...base().people } }
    delete f.people.gma
    const clean = withoutDanglingLinks(f)
    expect(Object.values(clean.parentLinks).every((l) => l.parentId !== 'gma')).toBe(true)
    expect(clean.partnerships).toEqual({})
  })
})
