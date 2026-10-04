// Works out every relative of a person from the stored parent and partner
// links, with a label such as "Mother", "Half-brother" or "Aunt (by marriage)".

import { childIds, parentIds, parentLinksOf, partnershipsOf, otherPartner, childLinksOf } from './relationships.ts'
import type { Family, Gender, ParentType, PartnershipType } from './types.ts'

export interface Relative {
  personId: string
  label: string
}

export interface RelativeGroup {
  key: RelativeGroupKey
  title: string
  relatives: Relative[]
}

export type RelativeGroupKey =
  | 'partners'
  | 'parents'
  | 'stepParents'
  | 'siblings'
  | 'children'
  | 'stepChildren'
  | 'grandparents'
  | 'grandchildren'
  | 'auntsUncles'
  | 'niecesNephews'
  | 'cousins'
  | 'inLaws'

/** [male, female, neutral] */
type Words = [string, string, string]

function word(gender: Gender, [m, f, n]: Words): string {
  return gender === 'male' ? m : gender === 'female' ? f : n
}

const PARENT_WORDS: Record<ParentType, Words> = {
  biological: ['Father', 'Mother', 'Parent'],
  adoptive: ['Adoptive father', 'Adoptive mother', 'Adoptive parent'],
  step: ['Stepfather', 'Stepmother', 'Step-parent'],
  foster: ['Foster father', 'Foster mother', 'Foster parent'],
  guardian: ['Guardian', 'Guardian', 'Guardian'],
}

const CHILD_WORDS: Record<ParentType, Words> = {
  biological: ['Son', 'Daughter', 'Child'],
  adoptive: ['Adopted son', 'Adopted daughter', 'Adopted child'],
  step: ['Stepson', 'Stepdaughter', 'Stepchild'],
  foster: ['Foster son', 'Foster daughter', 'Foster child'],
  guardian: ['Ward', 'Ward', 'Ward'],
}

const PARTNER_WORDS: Record<PartnershipType, Words> = {
  married: ['Husband', 'Wife', 'Spouse'],
  engaged: ['Fiancé', 'Fiancée', 'Fiancé(e)'],
  partner: ['Partner', 'Partner', 'Partner'],
  divorced: ['Ex-husband', 'Ex-wife', 'Ex-spouse'],
  separated: ['Husband (separated)', 'Wife (separated)', 'Spouse (separated)'],
  widowed: ['Husband (widowed)', 'Wife (widowed)', 'Spouse (widowed)'],
}

/** Partnerships that still make in-laws and step-relatives. */
const CURRENT: PartnershipType[] = ['married', 'engaged', 'partner', 'widowed']

export function relativesOf(f: Family, personId: string): RelativeGroup[] {
  const gender = (id: string) => f.people[id]?.gender ?? 'unknown'
  const label = (id: string, words: Words) => word(gender(id), words)
  const seen = new Set<string>([personId])
  const groups: RelativeGroup[] = []

  /** Add a group, skipping anyone already listed in a closer group. */
  function add(key: RelativeGroupKey, title: string, entries: Relative[]) {
    const relatives: Relative[] = []
    for (const r of entries) {
      if (seen.has(r.personId) || !(r.personId in f.people)) continue
      seen.add(r.personId)
      relatives.push(r)
    }
    if (relatives.length) groups.push({ key, title, relatives })
  }

  const uniq = (ids: string[]) => [...new Set(ids)]
  const currentPartners = (id: string) =>
    partnershipsOf(f, id)
      .filter((p) => CURRENT.includes(p.type))
      .map((p) => otherPartner(p, id))

  /** Siblings of `id`: anyone sharing at least one parent. */
  const siblingIds = (id: string) => uniq(parentIds(f, id).flatMap((p) => childIds(f, p))).filter((s) => s !== id)

  // Partners
  add(
    'partners',
    'Partners',
    partnershipsOf(f, personId).map((p) => {
      const id = otherPartner(p, personId)
      return { personId: id, label: label(id, PARTNER_WORDS[p.type]) }
    }),
  )

  // Parents and step-parents
  const myParents = parentIds(f, personId)
  add(
    'parents',
    'Parents',
    parentLinksOf(f, personId).map((l) => ({ personId: l.parentId, label: label(l.parentId, PARENT_WORDS[l.type]) })),
  )
  add(
    'stepParents',
    'Step-parents',
    uniq(myParents.flatMap(currentPartners)).map((id) => ({ personId: id, label: label(id, PARENT_WORDS.step) })),
  )

  // Siblings (full, half) and step-siblings
  const mySet = new Set(myParents)
  const siblings = siblingIds(personId).map((id) => {
    const theirs = parentIds(f, id)
    const shared = theirs.filter((p) => mySet.has(p)).length
    const half = shared === 1 && (mySet.size > 1 || theirs.length > 1)
    return {
      personId: id,
      label: label(id, half ? ['Half-brother', 'Half-sister', 'Half-sibling'] : ['Brother', 'Sister', 'Sibling']),
    }
  })
  const stepSiblings = uniq(myParents.flatMap(currentPartners).flatMap((sp) => childIds(f, sp))).map((id) => ({
    personId: id,
    label: label(id, ['Stepbrother', 'Stepsister', 'Step-sibling']),
  }))
  add('siblings', 'Siblings', [...siblings, ...stepSiblings])

  // Children and step-children
  const myChildren = childIds(f, personId)
  add(
    'children',
    'Children',
    childLinksOf(f, personId).map((l) => ({ personId: l.childId, label: label(l.childId, CHILD_WORDS[l.type]) })),
  )
  add(
    'stepChildren',
    'Stepchildren',
    uniq(currentPartners(personId).flatMap((p) => childIds(f, p))).map((id) => ({
      personId: id,
      label: label(id, CHILD_WORDS.step),
    })),
  )

  // Grandparents and grandchildren
  add(
    'grandparents',
    'Grandparents',
    uniq(myParents.flatMap((p) => parentIds(f, p))).map((id) => ({
      personId: id,
      label: label(id, ['Grandfather', 'Grandmother', 'Grandparent']),
    })),
  )
  add(
    'grandchildren',
    'Grandchildren',
    uniq(myChildren.flatMap((c) => childIds(f, c))).map((id) => ({
      personId: id,
      label: label(id, ['Grandson', 'Granddaughter', 'Grandchild']),
    })),
  )

  // Aunts and uncles (blood relatives, then those by marriage)
  const bloodAuntsUncles = uniq(myParents.flatMap(siblingIds)).filter((id) => !mySet.has(id))
  const byMarriage = uniq(bloodAuntsUncles.flatMap(currentPartners)).filter((id) => !mySet.has(id))
  add('auntsUncles', 'Aunts & uncles', [
    ...bloodAuntsUncles.map((id) => ({ personId: id, label: label(id, ['Uncle', 'Aunt', 'Aunt/uncle']) })),
    ...byMarriage.map((id) => ({
      personId: id,
      label: label(id, ['Uncle (by marriage)', 'Aunt (by marriage)', 'Aunt/uncle (by marriage)']),
    })),
  ])

  // Nieces and nephews
  add(
    'niecesNephews',
    'Nieces & nephews',
    uniq(siblings.flatMap((s) => childIds(f, s.personId))).map((id) => ({
      personId: id,
      label: label(id, ['Nephew', 'Niece', 'Niece/nephew']),
    })),
  )

  // First cousins: children of blood aunts and uncles
  add(
    'cousins',
    'First cousins',
    uniq(bloodAuntsUncles.flatMap((a) => childIds(f, a))).map((id) => ({ personId: id, label: 'First cousin' })),
  )

  // In-laws
  const partners = currentPartners(personId)
  add('inLaws', 'In-laws', [
    ...uniq(partners.flatMap((p) => parentIds(f, p))).map((id) => ({
      personId: id,
      label: label(id, ['Father-in-law', 'Mother-in-law', 'Parent-in-law']),
    })),
    ...uniq([
      ...partners.flatMap(siblingIds),
      ...siblings.flatMap((s) => currentPartners(s.personId)),
    ]).map((id) => ({ personId: id, label: label(id, ['Brother-in-law', 'Sister-in-law', 'Sibling-in-law']) })),
    ...uniq(myChildren.flatMap(currentPartners)).map((id) => ({
      personId: id,
      label: label(id, ['Son-in-law', 'Daughter-in-law', 'Child-in-law']),
    })),
  ])

  return groups
}
