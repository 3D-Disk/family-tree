// Genealogy dates are often partial or approximate, so we keep the user's
// text and parse it on demand for display and sorting.

export type DateQualifier = 'exact' | 'about' | 'before' | 'after'

export interface ParsedDate {
  qualifier: DateQualifier
  year: number
  month?: number
  day?: number
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const QUALIFIERS: [RegExp, DateQualifier][] = [
  [/^(about|abt\.?|approx\.?|approximately|circa|ca\.?|c\.|~)\s*/i, 'about'],
  [/^(before|bef\.?)\s*/i, 'before'],
  [/^(after|aft\.?)\s*/i, 'after'],
]

function monthFromName(name: string): number | undefined {
  const n = name.toLowerCase().replace(/\.$/, '')
  if (n.length < 3) return undefined
  const i = MONTHS.findIndex((m) => m.startsWith(n))
  return i === -1 ? undefined : i + 1
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function build(qualifier: DateQualifier, year: number, month?: number, day?: number): ParsedDate | null {
  if (year < 1 || year > 9999) return null
  if (month !== undefined && (month < 1 || month > 12)) return null
  if (day !== undefined && (month === undefined || day < 1 || day > daysInMonth(year, month))) return null
  return { qualifier, year, month, day }
}

/** Parse a user-entered date. Returns null if it isn't recognised. */
export function parseDate(input: string): ParsedDate | null {
  let text = input.trim().replace(/\s+/g, ' ')
  if (!text) return null

  let qualifier: DateQualifier = 'exact'
  for (const [re, q] of QUALIFIERS) {
    if (re.test(text)) {
      qualifier = q
      text = text.replace(re, '')
      break
    }
  }

  let m: RegExpMatchArray | null
  // 1890
  if ((m = text.match(/^(\d{4})$/))) return build(qualifier, +m[1])
  // 1/31/1890 (US order: month/day/year)
  if ((m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return build(qualifier, +m[3], +m[1], +m[2])
  // 1890-01-31
  if ((m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return build(qualifier, +m[1], +m[2], +m[3])
  // 1/1890
  if ((m = text.match(/^(\d{1,2})[/.-](\d{4})$/))) return build(qualifier, +m[2], +m[1])
  // Mar 1890
  if ((m = text.match(/^([a-z]+\.?),? (\d{4})$/i))) {
    const month = monthFromName(m[1])
    return month ? build(qualifier, +m[2], month) : null
  }
  // Mar 31, 1890
  if ((m = text.match(/^([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i))) {
    const month = monthFromName(m[1])
    return month ? build(qualifier, +m[3], month, +m[2]) : null
  }
  // 31 Mar 1890
  if ((m = text.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+\.?),? (\d{4})$/i))) {
    const month = monthFromName(m[2])
    return month ? build(qualifier, +m[3], month, +m[1]) : null
  }
  return null
}

const PREFIX: Record<DateQualifier, string> = { exact: '', about: 'abt. ', before: 'bef. ', after: 'aft. ' }

/** Display a date consistently, e.g. "1/1/2000", "Mar 1890", "abt. 1890". Unrecognised text is shown as typed. */
export function formatDate(input: string): string {
  const d = parseDate(input)
  if (!d) return input.trim()
  let body: string
  if (d.day !== undefined && d.month !== undefined) body = `${d.month}/${d.day}/${d.year}`
  else if (d.month !== undefined) body = `${MONTH_ABBR[d.month - 1]} ${d.year}`
  else body = String(d.year)
  return PREFIX[d.qualifier] + body
}

/** The year of a date, or undefined if it can't be read. */
export function yearOf(input: string): number | undefined {
  return parseDate(input)?.year
}

const SHORT_PREFIX: Record<DateQualifier, string> = { exact: '', about: 'c. ', before: 'bef. ', after: 'aft. ' }

/** Just the year, keeping any qualifier: "1890", "c. 1890", "bef. 1900". */
export function shortYear(input: string): string | undefined {
  const d = parseDate(input)
  return d ? SHORT_PREFIX[d.qualifier] + d.year : undefined
}

/** A number for ordering dates chronologically (missing month/day sort first). */
export function dateSortKey(input: string): number | undefined {
  const d = parseDate(input)
  return d ? d.year * 10000 + (d.month ?? 0) * 100 + (d.day ?? 0) : undefined
}
