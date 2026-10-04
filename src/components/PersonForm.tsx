import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { formatDate, parseDate } from '../model/dates.ts'
import { fullName, newId } from '../model/person.ts'
import type { Gender, LifeEvent, Person } from '../model/types.ts'
import { useTree } from '../state/treeContext.ts'
import { preparePhoto } from '../storage/images.ts'
import Avatar from './Avatar.tsx'

interface Props {
  person: Person
  isNew: boolean
  onDone(): void
}

type PhotoChange = { id: string; blob: Blob } | null | undefined

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

export default function PersonForm({ person, isNew, onDone }: Props) {
  const { state, dispatch, notify } = useTree()
  const [draft, setDraft] = useState(person)
  const [photo, setPhoto] = useState<PhotoChange>(undefined)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Person>(key: K, value: Person[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setEvent = (key: 'birth' | 'death', part: keyof LifeEvent, value: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [part]: value } }))

  const shownPhoto = photo === undefined ? (draft.photoId ? state.photos[draft.photoId] : undefined) : photo?.blob

  async function onPhotoChosen(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    try {
      setPhoto({ id: newId(), blob: await preparePhoto(file) })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not use that photo.', 'error')
    } finally {
      setPhotoBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    dispatch({ type: 'savePerson', person: draft, photo })
    notify(`${isNew ? 'Added' : 'Updated'} ${fullName(draft)}`)
    onDone()
  }

  function onDelete() {
    if (!window.confirm(`Delete ${fullName(person)}? This can't be undone.`)) return
    dispatch({ type: 'deletePerson', id: person.id })
    notify(`Deleted ${fullName(person)}`)
    onDone()
  }

  return (
    <form className="person-form" onSubmit={onSubmit}>
      <section className="form-photo">
        <Avatar photo={shownPhoto} gender={draft.gender} size={96} alt={fullName(draft)} />
        <div className="form-photo-actions">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={photoBusy}>
            {photoBusy ? 'Processing…' : shownPhoto ? 'Change photo' : 'Add photo'}
          </button>
          {shownPhoto && (
            <button type="button" className="btn btn-quiet" onClick={() => setPhoto(null)}>
              Remove photo
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => onPhotoChosen(e.target.files?.[0])}
          />
        </div>
      </section>

      <fieldset>
        <legend>Name</legend>
        <div className="form-row">
          <Field label="First name">
            {(id) => <input id={id} value={draft.firstName} onChange={(e) => set('firstName', e.target.value)} autoFocus />}
          </Field>
          <Field label="Middle name(s)">
            {(id) => <input id={id} value={draft.middleName} onChange={(e) => set('middleName', e.target.value)} />}
          </Field>
        </div>
        <div className="form-row">
          <Field label="Last name">
            {(id) => <input id={id} value={draft.lastName} onChange={(e) => set('lastName', e.target.value)} />}
          </Field>
          <Field label="Last name at birth" hint="If different, e.g. maiden name">
            {(id) => <input id={id} value={draft.birthSurname} onChange={(e) => set('birthSurname', e.target.value)} />}
          </Field>
        </div>
        <Field label="Nickname">
          {(id) => <input id={id} value={draft.nickname} onChange={(e) => set('nickname', e.target.value)} />}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Gender</legend>
        <div className="radio-row">
          {GENDERS.map((g) => (
            <label key={g.value} className="radio">
              <input
                type="radio"
                name="gender"
                value={g.value}
                checked={draft.gender === g.value}
                onChange={() => set('gender', g.value)}
              />
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Birth</legend>
        <EventFields event={draft.birth} onChange={(part, v) => setEvent('birth', part, v)} />
      </fieldset>

      <fieldset>
        <legend>Death</legend>
        <label className="checkbox">
          <input type="checkbox" checked={!draft.living} onChange={(e) => set('living', !e.target.checked)} />
          This person has died
        </label>
        {!draft.living && <EventFields event={draft.death} onChange={(part, v) => setEvent('death', part, v)} />}
      </fieldset>

      <fieldset>
        <legend>About</legend>
        <Field label="Short description" hint="Shown on their card, e.g. “Family historian” or “Served in WWII”">
          {(id) => <input id={id} value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={80} />}
        </Field>
        <Field label="Notes">
          {(id) => <textarea id={id} rows={5} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
      </fieldset>

      <div className="form-actions">
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Delete person
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={photoBusy}>
          {isNew ? 'Add person' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}

function EventFields({ event, onChange }: { event: LifeEvent; onChange(part: keyof LifeEvent, value: string): void }) {
  return (
    <div className="form-row">
      <Field label="Date" hint={<DateHint value={event.date} />}>
        {(id) => (
          <input
            id={id}
            value={event.date}
            onChange={(e) => onChange('date', e.target.value)}
            placeholder="e.g. 1/31/1950, Mar 1890, abt. 1890"
          />
        )}
      </Field>
      <Field label="Place">
        {(id) => (
          <input
            id={id}
            value={event.place}
            onChange={(e) => onChange('place', e.target.value)}
            placeholder="e.g. Manhattan, NY, USA"
          />
        )}
      </Field>
    </div>
  )
}

function DateHint({ value }: { value: string }) {
  if (!value.trim()) return null
  if (parseDate(value)) return <>Shows as: {formatDate(value)}</>
  return <span className="field-warn">Not recognised as a date, so it will be kept exactly as typed.</span>
}
