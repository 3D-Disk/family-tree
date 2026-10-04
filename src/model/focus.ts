// "Focus on a person": which people to show — their ancestors and descendants
// (limited to a number of generations), plus partners and brothers & sisters.

import { childIds, parentIds, partnerIds } from './relationships.ts'
import type { Family } from './types.ts'

export interface FocusOptions {
  /** Generations of ancestors to show (Infinity = all, 0 = none). */
  up: number
  /** Generations of descendants to show (Infinity = all, 0 = none). */
  down: number
}

export function focusIds(f: Family, personId: string, { up, down }: FocusOptions): Set<string> {
  const shown = new Set<string>([personId])
  if (!(personId in f.people)) return shown

  // Ancestors, generation by generation.
  let level = [personId]
  for (let g = 0; g < up && level.length; g++) {
    level = level.flatMap((id) => parentIds(f, id)).filter((id) => !shown.has(id))
    level.forEach((id) => shown.add(id))
  }

  // Descendants, and the partners of the person and of each descendant.
  const withPartners = (id: string) => partnerIds(f, id).forEach((p) => shown.add(p))
  withPartners(personId)
  level = [personId]
  for (let g = 0; g < down && level.length; g++) {
    level = level.flatMap((id) => childIds(f, id)).filter((id) => !shown.has(id))
    level.forEach((id) => {
      shown.add(id)
      withPartners(id)
    })
  }

  // Brothers & sisters hang off the parents, so they're only shown with them.
  if (up >= 1) {
    for (const parent of parentIds(f, personId)) for (const sib of childIds(f, parent)) shown.add(sib)
  }
  return shown
}

/** The part of the family made of these people and the links between them. */
export function subFamily(f: Family, ids: Set<string>): Family {
  return {
    people: Object.fromEntries(Object.entries(f.people).filter(([id]) => ids.has(id))),
    parentLinks: Object.fromEntries(
      Object.entries(f.parentLinks).filter(([, l]) => ids.has(l.parentId) && ids.has(l.childId)),
    ),
    partnerships: Object.fromEntries(
      Object.entries(f.partnerships).filter(([, p]) => p.personIds.every((id) => ids.has(id))),
    ),
  }
}
