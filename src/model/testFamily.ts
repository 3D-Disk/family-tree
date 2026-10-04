// A small made-up family for tests.
import { emptyPerson } from './person.ts'
import { addParentLink, addPartnership } from './relationships.ts'
import type { Family, Gender, PartnershipType } from './types.ts'

export function person(id: string, gender: Gender, birth = '') {
  return { ...emptyPerson(), id, firstName: id, gender, birth: { date: birth, place: '' } }
}

export function family(people: [string, Gender][]): Family {
  return {
    people: Object.fromEntries(people.map(([id, g]) => [id, person(id, g)])),
    parentLinks: {},
    partnerships: {},
  }
}

/** Link two parents to a list of children (and make the parents partners). */
export function couple(f: Family, a: string, b: string, children: string[], type: PartnershipType = 'married'): Family {
  f = addPartnership(f, a, b, type)
  for (const c of children) f = addParentLink(addParentLink(f, a, c), b, c)
  return f
}
