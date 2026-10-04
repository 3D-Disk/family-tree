import { describe, expect, it } from 'vitest'
import { FILTERS, isFiltering, matchesSearch, matchPeople, matchReasons, sortPeople } from './filters.ts'
import { addParentLink } from './relationships.ts'
import { family, person } from './testFamily.ts'
import type { Family } from './types.ts'

function sample(): Family {
  let f = family([['mom', 'female'], ['kid', 'male'], ['loner', 'unknown']])
  f.people.mom = { ...f.people.mom, firstName: 'Mary', lastName: 'Lee', birthSurname: 'Ó Briain', birth: { date: '1950', place: 'Cork, Ireland' }, photoId: 'p1' }
  f.people.kid = { ...f.people.kid, firstName: 'Robert', nickname: 'Bob', lastName: 'Lee', living: false, death: { date: '', place: 'Boston' } }
  f.people.loner = { ...f.people.loner, firstName: 'José', lastName: 'García', birth: { date: '', place: 'Madrid' } }
  f = addParentLink(f, 'mom', 'kid')
  return f
}
const ids = (f: Family, q: string, keys: string[]) => matchPeople(f, q, keys).map((p) => p.id).sort()

describe('search', () => {
  const f = sample()
  it('matches any part of names, nickname, maiden name and places, ignoring case and accents', () => {
    expect(matchesSearch(f.people.kid, 'bob')).toBe(true)
    expect(matchesSearch(f.people.mom, 'o briain')).toBe(true)
    expect(matchesSearch(f.people.mom, 'CORK')).toBe(true)
    expect(matchesSearch(f.people.loner, 'jose garcia')).toBe(true)
    expect(matchesSearch(f.people.kid, 'boston')).toBe(true)
    expect(matchesSearch(f.people.kid, 'mary')).toBe(false)
  })
  it('needs every word to match', () => {
    expect(ids(f, 'lee mary', [])).toEqual(['mom'])
    expect(ids(f, 'lee', [])).toEqual(['kid', 'mom'])
  })
  it('matches everyone when empty', () => {
    expect(ids(f, '  ', [])).toEqual(['kid', 'loner', 'mom'])
  })
})

describe('filters', () => {
  const f = sample()
  it.each([
    ['noBirthDate', ['kid', 'loner']],
    ['noBirthPlace', ['kid']],
    ['noPhoto', ['kid', 'loner']],
    ['diedNoDeathDate', ['kid']],
    ['noGender', ['loner']],
    ['noRelations', ['loner']],
    ['noParents', ['loner', 'mom']],
  ])('%s', (key, expected) => {
    expect(ids(f, '', [key])).toEqual(expected)
  })

  it('combines filters and search (all must match)', () => {
    expect(ids(f, '', ['noBirthDate', 'noParents'])).toEqual(['loner'])
    expect(ids(f, 'lee', ['noPhoto'])).toEqual(['kid'])
  })

  it('every filter has a label and reason', () => {
    for (const d of FILTERS) expect(d.label && d.reason).toBeTruthy()
    expect(matchReasons(['noPhoto', 'nope'])).toEqual(['No photo'])
  })

  it('knows when anything is being filtered', () => {
    expect(isFiltering('', [])).toBe(false)
    expect(isFiltering(' x', [])).toBe(true)
    expect(isFiltering('', ['noPhoto'])).toBe(true)
  })
})

describe('sortPeople', () => {
  it('sorts by last then first name, or by birth with unknown dates last', () => {
    const a = { ...person('a', 'male', '1960'), firstName: 'Zed', lastName: 'Adams' }
    const b = { ...person('b', 'male', ''), firstName: 'Amy', lastName: 'Brown' }
    const c = { ...person('c', 'male', '1900'), firstName: 'Bo', lastName: 'Adams' }
    expect(sortPeople([a, b, c], 'name').map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(sortPeople([a, b, c], 'birth').map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })
})
