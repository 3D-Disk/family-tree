import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react'
import { formatDate, parseDate } from '../model/dates.ts'
import { cardPhoto, fullName, newId } from '../model/person.ts'
import { DEFAULT_CROP, type PhotoCrop } from '../model/photoCrop.ts'
import type { Family, Gender, LifeEvent, Person } from '../model/types.ts'
import { useTree } from '../state/treeContext.ts'
import type { PhotoUpdate } from '../state/treeReducer.ts'
import { preparePhoto, renderAvatar } from '../storage/images.ts'
import Avatar from './Avatar.tsx'
import ConfirmDialog from './ConfirmDialog.tsx'
import FamilySection, { type AddKind } from './family/FamilySection.tsx'
import { BurialFields, EventsEditor, LinksEditor, NotableEditor } from './edit/DetailEditors.tsx'
import PhotoAdjuster from './PhotoAdjuster.tsx'
import PhotoViewer from './PhotoViewer.tsx'

interface Props {
  person: Person
  isNew: boolean
  /** Called after the person is saved or deleted. */
  onDone(): void
  /** Called when the user presses Cancel (the parent asks about unsaved edits). */
  onCancel(): void
  /** Tells the parent whether the form has edits that aren't saved yet. */
  onDirtyChange(dirty: boolean): void
  /** Lets the parent save the form (from the "Save changes?" pop-up). */
  saveRef: RefObject<(() => void) | null>
  /** Open another (already saved) person. */
  onOpenPerson(id: string): void
  /** Open the Family "add" box for this kind of relative. */
  addRequest?: { kind: AddKind; n: number }
}

/** undefined = photo unchanged, null = photo removed. */
type PhotoChange = PhotoUpdate | null | undefined

interface Adjusting {
  blob: Blob
  crop: PhotoCrop
  /** Id to keep for the original photo; absent for a newly chosen photo. */
  id?: string
}

function sameFields(a: Person, b: Person): boolean {
  return JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' })
}

/** Has anything about the family links (or newly created relatives) changed? */
function familyChanged(a: Family, b: Family, personId: string): boolean {
  const others = (f: Family) => Object.keys(f.people).filter((id) => id !== personId).sort()
  return (
    JSON.stringify([a.parentLinks, a.partnerships, others(a)]) !==
    JSON.stringify([b.parentLinks, b.partnerships, others(b)])
  )
}

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

export default function PersonForm({ person, isNew, onDone, onCancel, onDirtyChange, saveRef, onOpenPerson, addRequest }: Props) {
  const { state, dispatch, notify } = useTree()
  const [draft, setDraft] = useState(person)
  const tree = state.tree!
  const [originalFamily] = useState<Family>(() => ({ people: tree.people, parentLinks: tree.parentLinks, partnerships: tree.partnerships }))
  const [draftFamily, setDraftFamily] = useState<Family>(originalFamily)
  const familyEdited = familyChanged(draftFamily, originalFamily, person.id)
  /** The family including this person's unsaved edits. */
  const view: Family = { ...draftFamily, people: { ...draftFamily.people, [draft.id]: draft } }
  const [photo, setPhoto] = useState<PhotoChange>(undefined)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [adjusting, setAdjusting] = useState<Adjusting | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [viewing, setViewing] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const dirty = photo !== undefined || !sameFields(draft, person) || familyEdited
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  function commit() {
    dispatch({ type: 'savePerson', person: draft, photo, family: familyEdited ? draftFamily : undefined })
    notify(`${isNew ? 'Added' : 'Updated'} ${fullName(draft)}`)
  }
  useEffect(() => {
    saveRef.current = commit
  })

  const set = <K extends keyof Person>(key: K, value: Person[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const setEvent = (key: 'birth' | 'death', part: keyof LifeEvent, value: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [part]: value } }))

  const shownPhoto = photo === undefined ? cardPhoto(draft, state.photos) : photo?.avatarBlob
  /** The full, uncropped photo (for the enlarged view). */
  const originalPhoto = photo === undefined ? (draft.photoId ? state.photos[draft.photoId] : undefined) : photo?.blob

  async function onPhotoChosen(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    try {
      setAdjusting({ blob: await preparePhoto(file), crop: DEFAULT_CROP })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not use that photo.', 'error')
    } finally {
      setPhotoBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function adjustExisting() {
    if (photo) setAdjusting({ blob: photo.blob, crop: photo.crop, id: photo.id })
    else if (photo === undefined && draft.photoId && state.photos[draft.photoId]) {
      setAdjusting({ blob: state.photos[draft.photoId], crop: draft.photoCrop ?? DEFAULT_CROP, id: draft.photoId })
    }
  }

  async function onAdjusted(crop: PhotoCrop) {
    const current = adjusting!
    setAdjusting(null)
    setPhotoBusy(true)
    try {
      const avatarBlob = await renderAvatar(current.blob, crop)
      setPhoto({ id: current.id ?? newId(), blob: current.blob, avatarId: newId(), avatarBlob, crop })
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not use that photo.', 'error')
    } finally {
      setPhotoBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    commit()
    onDone()
  }

  function onDelete() {
    if (!window.confirm(`Delete ${fullName(person)}? Their links to other family members will be removed too. This can't be undone.`)) return
    dispatch({ type: 'deletePerson', id: person.id })
    notify(`Deleted ${fullName(person)}`)
    onDone()
  }

  return (
    <form className="person-form" onSubmit={onSubmit}>
      <section className="form-photo">
        {originalPhoto ? (
          <button
            type="button"
            className="photo-enlarge"
            onClick={() => setViewing(true)}
            title="Click to see the full photo"
            aria-label={`See ${fullName(draft)}'s photo full size`}
          >
            <Avatar photo={shownPhoto} gender={draft.gender} size={96} alt={fullName(draft)} />
          </button>
        ) : (
          <Avatar photo={shownPhoto} gender={draft.gender} size={96} alt={fullName(draft)} />
        )}
        <div className="form-photo-actions">
          <button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={photoBusy}>
            {photoBusy ? 'Processing…' : shownPhoto ? 'Change photo' : 'Add photo'}
          </button>
          {shownPhoto && (
            <>
              <button type="button" className="btn" onClick={adjustExisting} disabled={photoBusy}>
                Adjust photo
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmRemove(true)} disabled={photoBusy}>
                Remove photo
              </button>
            </>
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

      {!draft.living && (
        <fieldset>
          <legend>Burial</legend>
          <BurialFields burial={draft.burial} onChange={(b) => set('burial', b)} />
        </fieldset>
      )}

      <fieldset>
        <legend>Family</legend>
        <FamilySection
          person={draft}
          family={view}
          onChange={setDraftFamily}
          openPerson={onOpenPerson}
          canOpen={(id) => id in tree.people && id !== person.id}
          onError={(m) => notify(m, 'error')}
          addRequest={addRequest}
        />
      </fieldset>

      <fieldset>
        <legend>Biography</legend>
        <Field label="Short description" hint="A one-line summary, e.g. “Family historian” or “Served in WWII”">
          {(id) => <input id={id} value={draft.description} onChange={(e) => set('description', e.target.value)} maxLength={80} />}
        </Field>
        <Field label="Life story" hint="Write as much as you like. Blank lines start new paragraphs.">
          {(id) => <textarea id={id} rows={8} value={draft.biography} onChange={(e) => set('biography', e.target.value)} />}
        </Field>
      </fieldset>

      <fieldset>
        <legend>Life events</legend>
        <p className="field-hint fieldset-hint">
          Places they lived, immigration, jobs, military service, schooling and more. These appear in the Summary and timeline.
        </p>
        <EventsEditor events={draft.events} onChange={(events) => set('events', events)} />
      </fieldset>

      <fieldset>
        <legend>Notable details</legend>
        <NotableEditor items={draft.notable} onChange={(notable) => set('notable', notable)} />
      </fieldset>

      <fieldset>
        <legend>Links</legend>
        <LinksEditor links={draft.links} onChange={(links) => set('links', links)} />
      </fieldset>

      <fieldset>
        <legend>Notes</legend>
        <Field label="Research notes" hint="Sources, open questions, things to check.">
          {(id) => <textarea id={id} rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />}
        </Field>
      </fieldset>

      <div className="form-actions">
        {!isNew && (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Delete person
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={photoBusy}>
          {isNew ? 'Add person' : 'Save changes'}
        </button>
      </div>

      {adjusting && (
        <PhotoAdjuster
          photo={adjusting.blob}
          initialCrop={adjusting.crop}
          onDone={onAdjusted}
          onCancel={() => setAdjusting(null)}
        />
      )}

      {viewing && originalPhoto && (
        <PhotoViewer photo={originalPhoto} alt={`Photo of ${fullName(draft)}`} onClose={() => setViewing(false)} />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove this photo?"
          buttons={[
            { label: 'Cancel', value: false },
            { label: 'Remove photo', value: true, kind: 'danger' },
          ]}
          cancelValue={false}
          onChoose={(remove) => {
            setConfirmRemove(false)
            if (remove) setPhoto(null)
          }}
        >
          The photo will be removed from {fullName(draft)} when you save.
        </ConfirmDialog>
      )}
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
