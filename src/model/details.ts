// Helpers for the person Details view: age, summary rows, life timeline, links.

import { dateSortKey, formatDate, parseDate } from './dates.ts'
import { formatLifeEvent, fullName } from './person.ts'
import { childLinksOf, partnershipsOf, otherPartner } from './relationships.ts'
import type { EventType, Family, Person, PersonEvent } from './types.ts'

export const EVENT_TYPES: { value: EventType; label: string; titleLabel: string }[] = [
  { value: 'residence', label: 'Residence', titleLabel: 'Address or description' },
  { value: 'immigration', label: 'Immigration', titleLabel: 'Arrived from' },
  { value: 'emigration', label: 'Emigration', titleLabel: 'Left for' },
  { value: 'occupation', label: 'Occupation', titleLabel: 'Job title' },
  { value: 'military', label: 'Military service', titleLabel: 'Branch, unit or rank' },
  { value: 'education', label: 'Education', titleLabel: 'School or qualification' },
  { value: 'religious', label: 'Religious event', titleLabel: 'e.g. Baptism, Bar Mitzvah' },
  { value: 'other', label: 'Other', titleLabel: 'What happened' },
]

export const eventTypeLabel = (t: EventType) => EVENT_TYPES.find((e) => e.value === t)?.label ?? 'Event'

/** "1950 – 1970", "from 1950", "1950" or "". */
export function dateRange(start: string, end: string): string {
  const s = formatDate(start)
  const e = formatDate(end)
  if (s && e) return `${s} – ${e}`
  if (e) return `until ${e}`
  return s
}

/** Age today (living) or at death, e.g. "Age 45", "Died aged 74", "Died aged about 80". */
export function ageText(p: Person, today = new Date()): string {
  const b = parseDate(p.birth.date)
  if (!b) return ''
  let end: { year: number; month?: number; day?: number; qualifier?: string }
  if (p.living) end = { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() }
  else {
    const d = parseDate(p.death.date)
    if (!d) return ''
    end = d
  }
  let age = end.year - b.year
  const exact = b.day !== undefined && end.day !== undefined && b.qualifier === 'exact' && end.qualifier !== 'about'
  if (exact && (end.month! < b.month! || (end.month === b.month && end.day! < b.day!))) age--
  if (age < 0 || age > 130) return ''
  const n = exact ? `${age}` : `about ${age}`
  return p.living ? `Age ${n}` : `Died aged ${n}`
}

export interface SummaryRow {
  label: string
  values: string[]
}

/** The "Summary" facts, Wikipedia style. */
export function summaryRows(p: Person): SummaryRow[] {
  const rows: SummaryRow[] = []
  const add = (label: string, values: string[]) => {
    const v = values.filter(Boolean)
    if (v.length) rows.push({ label, values: v })
  }
  const byDate = (type: EventType) => sortEvents(p.events.filter((e) => e.type === type))
  const placeWithDates = (e: PersonEvent) => {
    const where = [e.title, e.place].filter((s) => s.trim()).join(', ')
    const when = dateRange(e.date, e.endDate)
    return when && where ? `${where} (${when})` : where || when
  }
  add('Born', [formatLifeEvent(p.birth)])
  if (!p.living) add('Died', [formatLifeEvent(p.death) || 'Date unknown'])
  add('Age', [ageText(p)])
  add('Lived in', byDate('residence').map(placeWithDates))
  add(
    'Immigration',
    byDate('immigration').map((e) => {
      const where = [e.title && `from ${e.title}`, e.place && `to ${e.place}`].filter(Boolean).join(' ')
      return [formatDate(e.date), where].filter(Boolean).join(', ')
    }),
  )
  add('Occupation', byDate('occupation').map(placeWithDates))
  if (!p.living) {
    const b = p.burial
    add('Buried', [[b.cemetery, b.place].filter((s) => s.trim()).join(', ')])
  }
  return rows
}

export function sortEvents(events: PersonEvent[]): PersonEvent[] {
  return [...events].sort((a, b) => (dateSortKey(a.date) ?? Infinity) - (dateSortKey(b.date) ?? Infinity))
}

export interface TimelineEntry {
  date: string
  title: string
  detail: string
  /** Another person this entry is about (spouse, child), so it can be opened. */
  personId?: string
}

/** Everything that happened in the person's life, in date order (undated last). */
export function timeline(f: Family, p: Person): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const name = (id: string) => fullName(f.people[id])
  if (p.birth.date || p.birth.place) entries.push({ date: p.birth.date, title: 'Born', detail: p.birth.place })
  for (const ps of partnershipsOf(f, p.id)) {
    const other = otherPartner(ps, p.id)
    const verb = ps.type === 'engaged' ? 'Engaged to' : ps.type === 'partner' ? 'Partnered with' : 'Married'
    if (ps.start.date || ps.start.place) entries.push({ date: ps.start.date, title: `${verb} ${name(other)}`, detail: ps.start.place, personId: other })
    if (['divorced', 'separated'].includes(ps.type) && (ps.end.date || ps.end.place)) {
      entries.push({ date: ps.end.date, title: `${ps.type === 'divorced' ? 'Divorced' : 'Separated from'} ${name(other)}`, detail: ps.end.place, personId: other })
    }
  }
  for (const l of childLinksOf(f, p.id)) {
    const c = f.people[l.childId]
    if (c?.birth.date) {
      const word = c.gender === 'male' ? 'Son' : c.gender === 'female' ? 'Daughter' : 'Child'
      entries.push({ date: c.birth.date, title: `${word} ${fullName(c)} born`, detail: c.birth.place, personId: c.id })
    }
  }
  for (const e of p.events) {
    const title = e.type === 'other' ? e.title || 'Event' : [eventTypeLabel(e.type), e.title].filter(Boolean).join(': ')
    const detail = [e.place, e.endDate && `until ${formatDate(e.endDate)}`, e.notes].filter(Boolean).join(' · ')
    entries.push({ date: e.date, title, detail })
  }
  if (!p.living && (p.death.date || p.death.place)) entries.push({ date: p.death.date, title: 'Died', detail: p.death.place })
  if (!p.living && (p.burial.date || p.burial.cemetery || p.burial.place)) {
    entries.push({ date: p.burial.date, title: 'Buried', detail: [p.burial.cemetery, p.burial.place].filter(Boolean).join(', ') })
  }
  return entries
    .map((e, i) => ({ e, i, k: dateSortKey(e.date) ?? Infinity }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.e)
}

/** Make a typed address into a safe web link, or null if it isn't one. */
export function safeUrl(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** "facebook.com" from "https://www.facebook.com/someone". */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
