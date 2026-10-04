import { describe, expect, it } from 'vitest'
import { ageText, dateRange, linkHost, safeUrl, summaryRows, timeline } from './details.ts'
import { emptyPerson } from './person.ts'
import { addParentLink, addPartnership, updatePartnership } from './relationships.ts'
import { family } from './testFamily.ts'
import type { PersonEvent } from './types.ts'

const ev = (over: Partial<PersonEvent>): PersonEvent => ({ id: Math.random().toString(), type: 'other', title: '', date: '', endDate: '', place: '', notes: '', ...over })
const person = (over: Partial<ReturnType<typeof emptyPerson>>) => ({ ...emptyPerson(), ...over })

describe('ageText', () => {
  const today = new Date(2026, 9, 4)
  it('gives exact ages when full dates are known', () => {
    expect(ageText(person({ birth: { date: '10/5/1980', place: '' } }), today)).toBe('Age 45')
    expect(ageText(person({ birth: { date: '10/4/1980', place: '' } }), today)).toBe('Age 46')
    expect(ageText(person({ living: false, birth: { date: '1/1/1900', place: '' }, death: { date: '12/31/1974', place: '' } }))).toBe('Died aged 74')
  })
  it('says "about" when dates are partial', () => {
    expect(ageText(person({ living: false, birth: { date: 'abt 1900', place: '' }, death: { date: '1980', place: '' } }))).toBe('Died aged about 80')
  })
  it('gives nothing when it can’t tell', () => {
    expect(ageText(person({}))).toBe('')
    expect(ageText(person({ living: false, birth: { date: '1900', place: '' } }))).toBe('')
  })
})

describe('summaryRows', () => {
  it('picks out residences, immigration and occupation', () => {
    const p = person({
      birth: { date: '1/1/1900', place: 'Cork, Ireland' },
      living: false,
      death: { date: '1980', place: 'Boston' },
      burial: { cemetery: 'Mount Hope', place: 'Boston, MA', plot: '', date: '', notes: '' },
      events: [
        ev({ type: 'residence', place: 'Boston, MA', date: '1925', endDate: '1980' }),
        ev({ type: 'residence', place: 'Cork, Ireland', date: '1900', endDate: '1924' }),
        ev({ type: 'immigration', date: '1924', title: 'Ireland', place: 'New York, NY' }),
        ev({ type: 'occupation', title: 'Teacher' }),
      ],
    })
    const rows = Object.fromEntries(summaryRows(p).map((r) => [r.label, r.values]))
    expect(rows.Born).toEqual(['1/1/1900 (Cork, Ireland)'])
    expect(rows.Died).toEqual(['1980 (Boston)'])
    expect(rows['Lived in']).toEqual(['Cork, Ireland (1900 – 1924)', 'Boston, MA (1925 – 1980)'])
    expect(rows.Immigration).toEqual(['1924, from Ireland to New York, NY'])
    expect(rows.Occupation).toEqual(['Teacher'])
    expect(rows.Buried).toEqual(['Mount Hope, Boston, MA'])
  })
  it('leaves out empty rows', () => {
    expect(summaryRows(person({})).map((r) => r.label)).toEqual([])
  })
})

describe('timeline', () => {
  it('merges birth, marriage, children, events, death and burial in date order', () => {
    let f = family([['me', 'female'], ['hub', 'male'], ['kid', 'male']])
    f.people.me = { ...f.people.me, birth: { date: '1950', place: 'Boston' }, living: false, death: { date: '2020', place: '' },
      events: [ev({ type: 'occupation', title: 'Nurse', date: '1972' }), ev({ type: 'other', title: 'Won a prize' })] }
    f.people.kid = { ...f.people.kid, birth: { date: '1980', place: '' } }
    f = addPartnership(f, 'me', 'hub')
    f = updatePartnership(f, Object.keys(f.partnerships)[0], { start: { date: '1975', place: 'Paris' } })
    f = addParentLink(f, 'me', 'kid')
    expect(timeline(f, f.people.me).map((e) => e.title)).toEqual([
      'Born', 'Occupation: Nurse', 'Married hub', 'Son kid born', 'Died', 'Won a prize',
    ])
  })
})

describe('links', () => {
  it('adds https:// and only allows web addresses', () => {
    expect(safeUrl('facebook.com/someone')).toBe('https://facebook.com/someone')
    expect(safeUrl('http://example.org')).toBe('http://example.org/')
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('  ')).toBeNull()
    expect(linkHost('https://www.facebook.com/x')).toBe('facebook.com')
  })
  it('formats date ranges', () => {
    expect(dateRange('1950', '1960')).toBe('1950 – 1960')
    expect(dateRange('', '1960')).toBe('until 1960')
    expect(dateRange('1950', '')).toBe('1950')
  })
})
