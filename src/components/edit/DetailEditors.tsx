// Editors for the longer person details: life events, burial, notable details and links.

import { useState } from 'react'
import { dateRange, EVENT_TYPES, sortEvents } from '../../model/details.ts'
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
  // Saved events start collapsed to one line; new ones open for typing.
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [closedTypes, setClosedTypes] = useState<Set<EventType>>(() => new Set())
  // Display order: by date, re-sorted when an event is collapsed (not while typing).
  const [order, setOrder] = useState<string[]>(() => sortEvents(events).map((e) => e.id))
  const resort = (list: PersonEvent[]) => setOrder(sortEvents(list).map((e) => e.id))

  const toggle = <T,>(set: Set<T>, item: T, on: boolean) => {
    const next = new Set(set)
    if (on) next.add(item)
    else next.delete(item)
    return next
  }
  const update = (id: string, changes: Partial<PersonEvent>) =>
    onChange(events.map((e) => (e.id === id ? { ...e, ...changes } : e)))
  const add = (type: EventType) => {
    const e: PersonEvent = { id: newId(), type, title: '', date: '', endDate: '', place: '', notes: '' }
    onChange([...events, e])
    setOrder((o) => [...o, e.id])
    setOpenIds((s) => toggle(s, e.id, true))
    setClosedTypes((s) => toggle(s, type, false))
  }
  const collapse = (id: string) => {
    setOpenIds((s) => toggle(s, id, false))
    resort(events)
  }
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i === -1 ? Infinity : i
  }
  const groups = EVENT_TYPES.map((t) => ({
    ...t,
    items: events.filter((e) => e.type === t.value).sort((a, b) => rank(a.id) - rank(b.id)),
  })).filter((g) => g.items.length)

  return (
    <div className="list-editor events-editor">
      {events.length > 1 && (
        <div className="events-toolbar">
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setOpenIds(new Set())
              resort(events)
            }}
          >
            Collapse all
          </button>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setOpenIds(new Set(events.map((e) => e.id)))
              setClosedTypes(new Set())
            }}
          >
            Expand all
          </button>
        </div>
      )}
      {groups.map((g) => {
        const groupOpen = !closedTypes.has(g.value)
        return (
          <div key={g.value} className="event-group">
            <button
              type="button"
              className="event-group-head"
              aria-expanded={groupOpen}
              onClick={() => setClosedTypes((s) => toggle(s, g.value, groupOpen))}
            >
              <span aria-hidden="true">{groupOpen ? '▾' : '▸'}</span> {g.label} ({g.items.length})
            </button>
            {groupOpen &&
              g.items.map((e) =>
                openIds.has(e.id) ? (
                  <EventFields
                    key={e.id}
                    event={e}
                    onChange={(changes) => update(e.id, changes)}
                    onCollapse={() => collapse(e.id)}
                    onRemove={() => onChange(events.filter((x) => x.id !== e.id))}
                  />
                ) : (
                  <div key={e.id} className="event-summary">
                    <button
                      type="button"
                      className="event-summary-open"
                      aria-expanded={false}
                      onClick={() => setOpenIds((s) => toggle(s, e.id, true))}
                      title="Click to edit"
                    >
                      <span aria-hidden="true">▸</span> {eventSummary(e)}
                    </button>
                    <Remove label="Remove this event" onClick={() => onChange(events.filter((x) => x.id !== e.id))} />
                  </div>
                ),
              )}
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

/** One line describing an event, e.g. "Cork, Ireland · 1921 – 1948". */
function eventSummary(e: PersonEvent): string {
  const what = [e.title, e.place].filter((s) => s.trim()).join(', ')
  const when = dateRange(e.date, e.endDate)
  return [what, when].filter(Boolean).join(' · ') || 'No details yet'
}

function EventFields({
  event: e,
  onChange,
  onCollapse,
  onRemove,
}: {
  event: PersonEvent
  onChange(changes: Partial<PersonEvent>): void
  onCollapse(): void
  onRemove(): void
}) {
  const def = EVENT_TYPES.find((t) => t.value === e.type)!
  const lasting = ['residence', 'occupation', 'military', 'education'].includes(e.type)
  return (
    <div className="list-item event-item">
      <div className="list-item-head">
        <button type="button" className="event-collapse" onClick={onCollapse} aria-expanded={true} title="Collapse">
          ▾
        </button>
        <select aria-label="Type of event" value={e.type} onChange={(ev) => onChange({ type: ev.target.value as EventType })}>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <span className="spacer" />
        <Remove label="Remove this event" onClick={onRemove} />
      </div>
      <label className="field">
        <span>{def.titleLabel}</span>
        <input value={e.title} onChange={(ev) => onChange({ title: ev.target.value })} />
      </label>
      <div className="form-row">
        <label className="field">
          <span>{lasting ? 'From' : 'Date'}</span>
          <input value={e.date} onChange={(ev) => onChange({ date: ev.target.value })} placeholder="e.g. 1950, Mar 1912" />
          <DateHint value={e.date} />
        </label>
        <label className="field">
          <span>Until (optional)</span>
          <input value={e.endDate} onChange={(ev) => onChange({ endDate: ev.target.value })} />
          <DateHint value={e.endDate} />
        </label>
      </div>
      <label className="field">
        <span>{e.type === 'immigration' ? 'Arrived in' : e.type === 'emigration' ? 'Left from' : 'Place'}</span>
        <input value={e.place} onChange={(ev) => onChange({ place: ev.target.value })} placeholder="e.g. Boston, MA, USA" />
      </label>
      <label className="field">
        <span>Notes</span>
        <input value={e.notes} onChange={(ev) => onChange({ notes: ev.target.value })} />
      </label>
      <button type="button" className="link-btn event-done" onClick={onCollapse}>
        Done
      </button>
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
