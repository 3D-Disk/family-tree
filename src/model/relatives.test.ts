import { describe, expect, it } from 'vitest'
import { addParentLink, addPartnership } from './relationships.ts'
import { relativesOf, type RelativeGroupKey } from './relatives.ts'
import { couple, family } from './testFamily.ts'
import type { Family } from './types.ts'

// Grandparents gpa+gma have children dad and aunt.
// dad+mom have me and bro. aunt+uncle have cousin.
// mom's mother is nana. dad later has half-sister hsis with ex.
// I'm married to hubby, whose parents are fil+mil and sister is sil.
// I have a son, who is married to dil and has a grandchild gkid.
function bigFamily(): Family {
  let f = family([
    ['gpa', 'male'], ['gma', 'female'], ['nana', 'female'], ['dad', 'male'], ['mom', 'female'],
    ['aunt', 'female'], ['uncle', 'male'], ['cousin', 'unknown'], ['me', 'female'], ['bro', 'male'],
    ['ex', 'female'], ['hsis', 'female'], ['hubby', 'male'], ['fil', 'male'], ['mil', 'female'],
    ['sil', 'female'], ['son', 'male'], ['dil', 'female'], ['gkid', 'male'], ['stepmom', 'female'],
    ['stepbro', 'male'],
  ])
  f = couple(f, 'gpa', 'gma', ['dad', 'aunt'])
  f = addParentLink(f, 'nana', 'mom')
  f = couple(f, 'dad', 'mom', ['me', 'bro'], 'divorced')
  f = couple(f, 'aunt', 'uncle', ['cousin'])
  f = couple(f, 'dad', 'ex', ['hsis'], 'divorced')
  f = couple(f, 'fil', 'mil', ['hubby', 'sil'])
  f = addPartnership(f, 'me', 'hubby')
  f = addParentLink(f, 'me', 'son')
  f = addPartnership(f, 'son', 'dil')
  f = addParentLink(f, 'son', 'gkid')
  f = addPartnership(f, 'dad', 'stepmom')
  f = addParentLink(f, 'stepmom', 'stepbro')
  return f
}

function labels(f: Family, id: string): Partial<Record<RelativeGroupKey, string[]>> {
  return Object.fromEntries(
    relativesOf(f, id).map((g) => [g.key, g.relatives.map((r) => `${r.personId}:${r.label}`).sort()]),
  )
}

describe('relativesOf', () => {
  const me = labels(bigFamily(), 'me')

  it('finds immediate family with gendered labels', () => {
    expect(me.parents).toEqual(['dad:Father', 'mom:Mother'])
    expect(me.partners).toEqual(['hubby:Husband'])
    expect(me.children).toEqual(['son:Son'])
  })

  it('tells full, half and step siblings apart', () => {
    expect(me.siblings).toEqual(['bro:Brother', 'hsis:Half-sister', 'stepbro:Stepbrother'])
  })

  it('finds step-parents through a parent’s current partner only', () => {
    // dad's ex-wife is not a step-parent; his current wife is.
    expect(me.stepParents).toEqual(['stepmom:Stepmother'])
  })

  it('finds grandparents on both sides and grandchildren', () => {
    expect(me.grandparents).toEqual(['gma:Grandmother', 'gpa:Grandfather', 'nana:Grandmother'])
    expect(me.grandchildren).toEqual(['gkid:Grandson'])
  })

  it('finds aunts, uncles by marriage, cousins, nieces and nephews', () => {
    expect(me.auntsUncles).toEqual(['aunt:Aunt', 'uncle:Uncle (by marriage)'])
    expect(me.cousins).toEqual(['cousin:First cousin'])
    expect(labels(bigFamily(), 'aunt').niecesNephews).toEqual(['bro:Nephew', 'hsis:Niece', 'me:Niece'])
  })

  it('finds in-laws', () => {
    expect(me.inLaws).toEqual([
      'dil:Daughter-in-law', 'fil:Father-in-law', 'mil:Mother-in-law', 'sil:Sister-in-law',
    ])
  })

  it('uses partnership type for labels', () => {
    expect(labels(bigFamily(), 'dad').partners).toEqual(['ex:Ex-wife', 'mom:Ex-wife', 'stepmom:Wife'])
  })

  it('lists each person only once, in the closest group', () => {
    const all = relativesOf(bigFamily(), 'me').flatMap((g) => g.relatives.map((r) => r.personId))
    expect(new Set(all).size).toBe(all.length)
    expect(all).not.toContain('me')
  })

  it('handles someone with no relatives', () => {
    expect(relativesOf(family([['x', 'male']]), 'x')).toEqual([])
  })

  it('uses adoptive and step parent types', () => {
    let f = family([['kid', 'female'], ['a', 'male'], ['b', 'female']])
    f = addParentLink(f, 'a', 'kid', 'adoptive')
    f = addParentLink(f, 'b', 'kid', 'step')
    expect(labels(f, 'kid').parents).toEqual(['a:Adoptive father', 'b:Stepmother'])
    expect(labels(f, 'a').children).toEqual(['kid:Adopted daughter'])
  })
})
