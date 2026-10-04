// The two stored relationship kinds (parent → child, partners): lookups,
// rules that keep the tree sensible, and edits. Every function is pure.

import { fullName, newId } from './person.ts'
import type { Family, LifeEvent, ParentLink, ParentType, Partnership, PartnershipType } from './types.ts'

export const PARENT_TYPES: { value: ParentType; label: string }[] = [
  { value: 'biological', label: 'Biological' },
  { value: 'adoptive', label: 'Adoptive' },
  { value: 'step', label: 'Step' },
  { value: 'foster', label: 'Foster' },
  { value: 'guardian', label: 'Guardian' },
]

export const PARTNERSHIP_TYPES: { value: PartnershipType; label: string }[] = [
  { value: 'married', label: 'Married' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'partner', label: 'Partners' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
  { value: 'widowed', label: 'Widowed' },
]

/** Partnership types that have an end (divorce date, etc.). */
export const ENDED_TYPES: PartnershipType[] = ['divorced', 'separated', 'widowed']

const emptyEvent = (): LifeEvent => ({ date: '', place: '' })

// ---- Lookups ----

export function parentLinksOf(f: Family, childId: string): ParentLink[] {
  return Object.values(f.parentLinks).filter((l) => l.childId === childId)
}

export function childLinksOf(f: Family, parentId: string): ParentLink[] {
  return Object.values(f.parentLinks).filter((l) => l.parentId === parentId)
}

export function parentIds(f: Family, childId: string): string[] {
  return parentLinksOf(f, childId).map((l) => l.parentId)
}

export function childIds(f: Family, parentId: string): string[] {
  return childLinksOf(f, parentId).map((l) => l.childId)
}

export function partnershipsOf(f: Family, personId: string): Partnership[] {
  return Object.values(f.partnerships).filter((p) => p.personIds.includes(personId))
}

export function otherPartner(p: Partnership, personId: string): string {
  return p.personIds[0] === personId ? p.personIds[1] : p.personIds[0]
}

export function partnerIds(f: Family, personId: string): string[] {
  return partnershipsOf(f, personId).map((p) => otherPartner(p, personId))
}

export function findPartnership(f: Family, a: string, b: string): Partnership | undefined {
  return partnershipsOf(f, a).find((p) => otherPartner(p, a) === b)
}

/** True if `ancestorId` is a parent, grandparent, … of `personId`. */
export function isAncestor(f: Family, ancestorId: string, personId: string): boolean {
  const seen = new Set<string>()
  const queue = parentIds(f, personId)
  while (queue.length) {
    const id = queue.shift()!
    if (id === ancestorId) return true
    if (seen.has(id)) continue
    seen.add(id)
    queue.push(...parentIds(f, id))
  }
  return false
}

/** True if the person has no parents, children or partners. */
export function hasNoRelations(f: Family, personId: string): boolean {
  return (
    !Object.values(f.parentLinks).some((l) => l.parentId === personId || l.childId === personId) &&
    partnershipsOf(f, personId).length === 0
  )
}

// ---- Rules: each returns a message explaining the problem, or null if it's fine ----

const name = (f: Family, id: string) => fullName(f.people[id])

export function checkParentLink(f: Family, parentId: string, childId: string, type: ParentType): string | null {
  if (parentId === childId) return "A person can't be their own parent."
  if (parentLinksOf(f, childId).some((l) => l.parentId === parentId)) {
    return `${name(f, parentId)} is already a parent of ${name(f, childId)}.`
  }
  if (parentId in f.people && childId in f.people) {
    if (isAncestor(f, childId, parentId)) {
      return `${name(f, parentId)} is a descendant of ${name(f, childId)}, so they can't also be their parent.`
    }
    if (findPartnership(f, parentId, childId)) {
      return `${name(f, parentId)} and ${name(f, childId)} are partners, so one can't be the other's parent.`
    }
  }
  if (type === 'biological') {
    const bio = parentLinksOf(f, childId).filter((l) => l.type === 'biological')
    if (bio.length >= 2) return `${name(f, childId)} already has two biological parents.`
  }
  return null
}

export function checkPartnership(f: Family, a: string, b: string): string | null {
  if (a === b) return "A person can't be their own partner."
  if (findPartnership(f, a, b)) return `${name(f, a)} and ${name(f, b)} are already partners.`
  if (isAncestor(f, a, b) || isAncestor(f, b, a)) {
    return `${name(f, a)} and ${name(f, b)} are in a direct line of descent (parent, grandparent…), so they can't be partners.`
  }
  return null
}

/** Can the type of an existing parent link be changed to `type`? */
export function checkParentType(f: Family, linkId: string, type: ParentType): string | null {
  const link = f.parentLinks[linkId]
  if (type !== 'biological' || link.type === 'biological') return null
  const bio = parentLinksOf(f, link.childId).filter((l) => l.type === 'biological')
  return bio.length >= 2 ? `${name(f, link.childId)} already has two biological parents.` : null
}

// ---- Edits: return a new Family, leaving the original untouched ----

export function addParentLink<F extends Family>(f: F, parentId: string, childId: string, type: ParentType = 'biological'): F {
  const link: ParentLink = { id: newId(), parentId, childId, type }
  return { ...f, parentLinks: { ...f.parentLinks, [link.id]: link } }
}

export function updateParentLink<F extends Family>(f: F, linkId: string, type: ParentType): F {
  return { ...f, parentLinks: { ...f.parentLinks, [linkId]: { ...f.parentLinks[linkId], type } } }
}

export function removeParentLink<F extends Family>(f: F, linkId: string): F {
  const parentLinks = { ...f.parentLinks }
  delete parentLinks[linkId]
  return { ...f, parentLinks }
}

export function addPartnership<F extends Family>(f: F, a: string, b: string, type: PartnershipType = 'married'): F {
  const p: Partnership = { id: newId(), personIds: [a, b], type, start: emptyEvent(), end: emptyEvent() }
  return { ...f, partnerships: { ...f.partnerships, [p.id]: p } }
}

export function updatePartnership<F extends Family>(f: F, id: string, changes: Partial<Omit<Partnership, 'id' | 'personIds'>>): F {
  return { ...f, partnerships: { ...f.partnerships, [id]: { ...f.partnerships[id], ...changes } } }
}

export function removePartnership<F extends Family>(f: F, id: string): F {
  const partnerships = { ...f.partnerships }
  delete partnerships[id]
  return { ...f, partnerships }
}

/** Remove a person and every link that involves them. */
export function removePerson(f: Family, personId: string): Family {
  const people = { ...f.people }
  delete people[personId]
  const parentLinks = Object.fromEntries(
    Object.entries(f.parentLinks).filter(([, l]) => l.parentId !== personId && l.childId !== personId),
  )
  const partnerships = Object.fromEntries(
    Object.entries(f.partnerships).filter(([, p]) => !p.personIds.includes(personId)),
  )
  return { people, parentLinks, partnerships }
}

/** Drop links that point at people who don't exist (e.g. from a damaged file). */
export function withoutDanglingLinks(f: Family): Family {
  const exists = (id: string) => id in f.people
  return {
    people: f.people,
    parentLinks: Object.fromEntries(
      Object.entries(f.parentLinks).filter(([, l]) => exists(l.parentId) && exists(l.childId) && l.parentId !== l.childId),
    ),
    partnerships: Object.fromEntries(
      Object.entries(f.partnerships).filter(
        ([, p]) => exists(p.personIds[0]) && exists(p.personIds[1]) && p.personIds[0] !== p.personIds[1],
      ),
    ),
  }
}
