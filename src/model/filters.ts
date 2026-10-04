// Search and filters for the People list. Each filter is one entry in FILTERS,
// so adding a new one is a single line.

import { dateSortKey } from './dates.ts'
import { fullName } from './person.ts'
import { hasNoRelations, parentIds } from './relationships.ts'
import type { Family, Person } from './types.ts'

export interface FilterDef {
  key: string
  /** Shown next to the tick-box. */
  label: string
  /** Shown on each matching row, e.g. "No birth date". */
  reason: string
  test(f: Family, p: Person): boolean
}

const blank = (s: string) => !s.trim()

export const FILTERS: FilterDef[] = [
  { key: 'noBirthDate', label: 'No birth date', reason: 'No birth date', test: (_, p) => blank(p.birth.date) },
  { key: 'noBirthPlace', label: 'No birth place', reason: 'No birth place', test: (_, p) => blank(p.birth.place) },
  { key: 'noPhoto', label: 'No photo', reason: 'No photo', test: (_, p) => !p.photoId },
  {
    key: 'diedNoDeathDate',
    label: 'Died, but no death date',
    reason: 'No death date',
    test: (_, p) => !p.living && blank(p.death.date),
  },
  { key: 'noGender', label: 'Gender not set', reason: 'Gender not set', test: (_, p) => p.gender === 'unknown' },
  { key: 'noRelations', label: 'No relations (not linked to anyone)', reason: 'No relations', test: (f, p) => hasNoRelations(f, p.id) },
  { key: 'noParents', label: 'No parents', reason: 'No parents', test: (f, p) => parentIds(f, p.id).length === 0 },
]

const FILTER_BY_KEY = new Map(FILTERS.map((d) => [d.key, d]))

/** Lower-case, with accents removed, so "José" matches "jose". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function searchText(p: Person): string {
  return fold(
    [p.firstName, p.middleName, p.lastName, p.birthSurname, p.nickname, p.birth.place, p.death.place].join(' '),
  )
}

/** Every word typed must appear somewhere in the person's names or places. */
export function matchesSearch(p: Person, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const text = searchText(p)
  return words.every((w) => text.includes(w))
}

export function isFiltering(query: string, filterKeys: string[]): boolean {
  return query.trim() !== '' || filterKeys.length > 0
}

/** People matching the search and all of the chosen filters. */
export function matchPeople(f: Family, query: string, filterKeys: string[]): Person[] {
  const defs = filterKeys.map((k) => FILTER_BY_KEY.get(k)).filter((d): d is FilterDef => !!d)
  return Object.values(f.people).filter((p) => matchesSearch(p, query) && defs.every((d) => d.test(f, p)))
}

/** The reasons a person matched the chosen filters, e.g. ["No birth date"]. */
export function matchReasons(filterKeys: string[]): string[] {
  return filterKeys.map((k) => FILTER_BY_KEY.get(k)?.reason).filter((r): r is string => !!r)
}

export type PeopleSort = 'name' | 'birth'

export function sortPeople(people: Person[], sort: PeopleSort): Person[] {
  const byName = (a: Person, b: Person) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || fullName(a).localeCompare(fullName(b))
  const byBirth = (a: Person, b: Person) =>
    (dateSortKey(a.birth.date) ?? Infinity) - (dateSortKey(b.birth.date) ?? Infinity) || byName(a, b)
  return [...people].sort(sort === 'name' ? byName : byBirth)
}
