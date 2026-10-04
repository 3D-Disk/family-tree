import { describe, expect, it } from 'vitest'
import { dateSortKey, formatDate, parseDate, yearOf } from './dates.ts'

describe('parseDate', () => {
  it.each([
    ['1890', { qualifier: 'exact', year: 1890 }],
    ['1/1/2000', { qualifier: 'exact', year: 2000, month: 1, day: 1 }],
    ['12/31/1999', { qualifier: 'exact', year: 1999, month: 12, day: 31 }],
    ['1999-12-31', { qualifier: 'exact', year: 1999, month: 12, day: 31 }],
    ['3/1890', { qualifier: 'exact', year: 1890, month: 3 }],
    ['Mar 1890', { qualifier: 'exact', year: 1890, month: 3 }],
    ['March 1890', { qualifier: 'exact', year: 1890, month: 3 }],
    ['March 5, 1890', { qualifier: 'exact', year: 1890, month: 3, day: 5 }],
    ['5th March 1890', { qualifier: 'exact', year: 1890, month: 3, day: 5 }],
    ['abt. 1890', { qualifier: 'about', year: 1890 }],
    ['circa 1890', { qualifier: 'about', year: 1890 }],
    ['~1890', { qualifier: 'about', year: 1890 }],
    ['before 1900', { qualifier: 'before', year: 1900 }],
    ['aft Jun 1850', { qualifier: 'after', year: 1850, month: 6 }],
  ])('parses %s', (input, expected) => {
    expect(parseDate(input)).toEqual(expect.objectContaining(expected))
  })

  it.each(['', 'sometime', '2/30/2000', '13/1/2000', 'Foo 1890', '90'])('rejects %j', (input) => {
    expect(parseDate(input)).toBeNull()
  })
})

describe('formatDate', () => {
  it.each([
    ['01/01/2000', '1/1/2000'],
    ['2000-01-01', '1/1/2000'],
    ['january 2000', 'Jan 2000'],
    ['about 1890', 'abt. 1890'],
    ['Before 1900', 'bef. 1900'],
    ['  spring of 1890 ', 'spring of 1890'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatDate(input)).toBe(expected)
  })
})

describe('sorting helpers', () => {
  it('reads the year', () => {
    expect(yearOf('abt. 1890')).toBe(1890)
    expect(yearOf('unknown')).toBeUndefined()
  })

  it('orders partial dates before full dates in the same year', () => {
    expect(dateSortKey('1890')!).toBeLessThan(dateSortKey('Mar 1890')!)
    expect(dateSortKey('Mar 1890')!).toBeLessThan(dateSortKey('3/2/1890')!)
  })
})
