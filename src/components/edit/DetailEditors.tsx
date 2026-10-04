// Editors for the longer person details: life events, burial, notable details and links.

import { EVENT_TYPES } from '../../model/details.ts'
import { formatDate, parseDate } from '../../model/dates.ts'
import { newId } from '../../model/person.ts'
import type { Burial, EventType, PersonEvent, PersonLink } from '../../model/types.ts'
import { safeUrl } from '../../model/details.ts'

function DateHint({ value }: { value: string }) {
  if (!value.trim()) return null
  return parseDate(value) ? (
    <span className="field-hint">Shows as: {formatDate(value)}</span>
  ) : (
    <span className="field-hint field-warn">Not recognised as a date, so it will be kept as typed.</span>
  )
}

function Remove({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      ✕
    </button>
  )
}

export function EventsEditor({ events, onChange }: { events: PersonEvent[]; onChange(events: PersonEvent[]): void }) {
  const update = (id: string, changes: Partial<PersonEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...changes } : e)))
  const add = (type: EventType) =>
    onChange([...events, { id: newId(), type, title: '', date: '', endDate: '', place: '', notes: '' }])
  return (
    <div className="list-editor">
      {events.map((e) => {
        const def = EVENT_TYPES.find((t) => t.value === e.type)!
        return (
          <div key={e.id} className="list-item event-item">
            <div className="list-item-head">
              <select
                aria-label="Type of event"
                value={e.type}
                onChange={(ev) => update(e.id, { type: ev.target.value as EventType })}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <Remove label="Remove this event" onClick={() => onChange(events.filter((x) => x.id !== e.id))} />
            </div>
            <label className="field">
              <span>{def.titleLabel}</span>
              <input value={e.title} onChange={(ev) => update(e.id, { title: ev.target.value })} />
            </label>
            <div className="form-row">
              <label className="field">
                <span>{e.type === 'residence' || e.type === 'occupation' || e.type === 'military' || e.type === 'education' ? 'From' : 'Date'}</span>
                <input value={e.date} onChange={(ev) => update(e.id, { date: ev.target.value })} placeholder="e.g. 1950, Mar 1912" />
                <DateHint value={e.date} />
              </label>
              <label className="field">
                <span>Until (optional)</span>
                <input value={e.endDate} onChange={(ev) => update(e.id, { endDate: ev.target.value })} />
                <DateHint value={e.endDate} />
              </label>
            </div>
            <label className="field">
              <span>{e.type === 'immigration' ? 'Arrived in' : e.type === 'emigration' ? 'Left from' : 'Place'}</span>
              <input value={e.place} onChange={(ev) => update(e.id, { place: ev.target.value })} placeholder="e.g. Boston, MA, USA" />
            </label>
            <label className="field">
              <span>Notes</span>
              <input value={e.notes} onChange={(ev) => update(e.id, { notes: ev.target.value })} />
            </label>
          </div>
        )
      })}
      <div className="add-row">
        <span>Add:</span>
        {EVENT_TYPES.map((t) => (
          <button key={t.value} type="button" className="btn btn-small" onClick={() => add(t.value)}>
            + {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BurialFields({ burial, onChange }: { burial: Burial; onChange(b: Burial): void }) {
  const set = (k: keyof Burial, v: string) => onChange({ ...burial, [k]: v })
  return (
    <div className="burial-fields">
      <div className="form-row">
        <label className="field">
          <span>Cemetery</span>
          <input value={burial.cemetery} onChange={(e) => set('cemetery', e.target.value)} />
        </label>
        <label className="field">
          <span>Location</span>
          <input value={burial.place} onChange={(e) => set('place', e.target.value)} placeholder="e.g. Boston, MA, USA" />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Plot / grave</span>
          <input value={burial.plot} onChange={(e) => set('plot', e.target.value)} placeholder="e.g. Section B, Row 4" />
        </label>
        <label className="field">
          <span>Burial date</span>
          <input value={burial.date} onChange={(e) => set('date', e.target.value)} />
          <DateHint value={burial.date} />
        </label>
      </div>
      <label className="field">
        <span>Burial notes</span>
        <input value={burial.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
    </div>
  )
}

export function NotableEditor({ items, onChange }: { items: string[]; onChange(items: string[]): void }) {
  return (
    <div className="list-editor">
      {items.map((text, i) => (
        <div key={i} className="list-row">
          <input
            aria-label={`Notable detail ${i + 1}`}
            value={text}
            onChange={(e) => onChange(items.map((t, j) => (j === i ? e.target.value : t)))}
            placeholder="e.g. Played the fiddle at every family wedding"
          />
          <Remove label="Remove this detail" onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => onChange([...items, ''])}>
        + Add a detail or fun fact
      </button>
    </div>
  )
}

export function LinksEditor({ links, onChange }: { links: PersonLink[]; onChange(links: PersonLink[]): void }) {
  const update = (id: string, changes: Partial<PersonLink>) =>
    onChange(links.map((l) => (l.id === id ? { ...l, ...changes } : l)))
  return (
    <div className="list-editor">
      {links.map((l) => (
        <div key={l.id} className="list-item link-item">
          <div className="form-row">
            <label className="field">
              <span>Name</span>
              <input value={l.label} onChange={(e) => update(l.id, { label: e.target.value })} placeholder="e.g. Facebook, Obituary" />
            </label>
            <label className="field">
              <span>Web address</span>
              <input value={l.url} onChange={(e) => update(l.id, { url: e.target.value })} placeholder="e.g. facebook.com/name" />
              {l.url.trim() && !safeUrl(l.url) && (
                <span className="field-hint field-warn">This doesn't look like a web address.</span>
              )}
            </label>
          </div>
          <Remove label="Remove this link" onClick={() => onChange(links.filter((x) => x.id !== l.id))} />
        </div>
      ))}
      <button type="button" className="btn btn-small" onClick={() => onChange([...links, { id: newId(), label: '', url: '' }])}>
        + Add a link
      </button>
    </div>
  )
}
