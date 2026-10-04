import { useState } from 'react'
import { dateSortKey } from '../../model/dates.ts'
import { fullName } from '../../model/person.ts'
import {
  addParentLink,
  addPartnership,
  checkParentLink,
  checkParentType,
  checkPartnership,
  ENDED_TYPES,
  findPartnership,
  otherPartner,
  PARENT_TYPES,
  parentLinksOf,
  childLinksOf,
  partnershipsOf,
  PARTNERSHIP_TYPES,
  removeParentLink,
  removePartnership,
  updateParentLink,
  updatePartnership,
} from '../../model/relationships.ts'
import { relativesOf, type RelativeGroupKey } from '../../model/relatives.ts'
import type { Family, LifeEvent, ParentType, Partnership, PartnershipType, Person } from '../../model/types.ts'
import { emptyPerson } from '../../model/person.ts'
import PersonChip from './PersonChip.tsx'
import RelativePicker, { type PickedRelative } from './RelativePicker.tsx'

interface Props {
  /** The person being edited (with any unsaved changes). */
  person: Person
  /** People and links including unsaved changes. */
  family: Family
  onChange(family: Family): void
  /** Open another person. */
  openPerson(id: string): void
  /** Only people already saved in the tree can be opened. */
  canOpen(id: string): boolean
  onError(message: string): void
}

type Adding = 'parent' | 'partner' | 'child' | 'sibling' | null

const CURRENT_PARTNER: PartnershipType[] = ['married', 'engaged', 'partner']
const IMMEDIATE: RelativeGroupKey[] = ['partners', 'parents', 'children', 'siblings']

const byBirth = (f: Family) => (a: string, b: string) =>
  (dateSortKey(f.people[a]?.birth.date ?? '') ?? Infinity) - (dateSortKey(f.people[b]?.birth.date ?? '') ?? Infinity)

export default function FamilySection({ person, family, onChange, openPerson, canOpen, onError }: Props) {
  const [adding, setAdding] = useState<Adding>(null)
  const me = person.id
  const f = family
  const name = (id: string) => fullName(f.people[id])
  const open = (id: string) => (canOpen(id) ? () => openPerson(id) : undefined)

  const parentLinks = parentLinksOf(f, me).sort((a, b) => byBirth(f)(a.parentId, b.parentId))
  const childLinks = childLinksOf(f, me).sort((a, b) => byBirth(f)(a.childId, b.childId))
  const partnerships = partnershipsOf(f, me)
  const groups = relativesOf(f, me)
  const siblings = groups.find((g) => g.key === 'siblings')?.relatives ?? []
  const others = groups.filter((g) => !IMMEDIATE.includes(g.key))
  /** "Father", "Wife", "Son"… for the immediate family rows. */
  const labelOf = (key: RelativeGroupKey, id: string) =>
    groups.find((g) => g.key === key)?.relatives.find((r) => r.personId === id)?.label

  const bioParentCount = (childId: string) => parentLinksOf(f, childId).filter((l) => l.type === 'biological').length
  const defaultParentType = (childId: string): ParentType => (bioParentCount(childId) >= 2 ? 'step' : 'biological')
  const currentPartners = partnerships.filter((p) => CURRENT_PARTNER.includes(p.type)).map((p) => otherPartner(p, me))

  /** Adds a newly created person to the family, or returns the existing id. */
  function resolve(fam: Family, picked: PickedRelative): [Family, string] {
    if (picked.kind === 'existing') return [fam, picked.id]
    return [{ ...fam, people: { ...fam.people, [picked.person.id]: picked.person } }, picked.person.id]
  }

  function finish(next: Family) {
    onChange(next)
    setAdding(null)
  }

  // ---- Adding relatives ----

  const onlyParent = parentLinks.length === 1 ? parentLinks[0].parentId : null
  const onlyPartner = currentPartners.length === 1 ? currentPartners[0] : null

  function addParent(picked: PickedRelative, alsoPartner: boolean) {
    let [next, id] = resolve(f, picked)
    const type = defaultParentType(me)
    next = addParentLink(next, id, me, type)
    if (alsoPartner && onlyParent && !checkPartnership(next, id, onlyParent)) next = addPartnership(next, onlyParent, id)
    finish(next)
  }

  function addPartner(picked: PickedRelative) {
    const [next, id] = resolve(f, picked)
    finish(addPartnership(next, me, id))
  }

  function addChild(picked: PickedRelative, alsoPartner: boolean) {
    let [next, id] = resolve(f, picked)
    next = addParentLink(next, me, id, defaultParentType(id))
    if (alsoPartner && onlyPartner && !checkParentLink(next, onlyPartner, id, defaultParentType(id))) {
      next = addParentLink(next, onlyPartner, id, defaultParentType(id))
    }
    finish(next)
  }

  function addSibling(picked: PickedRelative) {
    let [next, id] = resolve(f, picked)
    if (parentLinks.length === 0) {
      // Siblings are linked through parents, so add a stand-in parent for now.
      const unknown: Person = { ...emptyPerson(), firstName: 'Unknown', lastName: 'parent', description: 'Name not known yet' }
      next = { ...next, people: { ...next.people, [unknown.id]: unknown } }
      next = addParentLink(addParentLink(next, unknown.id, me), unknown.id, id)
    } else {
      for (const l of parentLinks) {
        if (!checkParentLink(next, l.parentId, id, l.type)) next = addParentLink(next, l.parentId, id, l.type)
      }
    }
    finish(next)
  }

  const linked = new Set<string>([me])
  parentLinks.forEach((l) => linked.add(l.parentId))
  childLinks.forEach((l) => linked.add(l.childId))
  partnerships.forEach((p) => linked.add(otherPartner(p, me)))
  siblings.forEach((s) => linked.add(s.personId))

  function picker() {
    switch (adding) {
      case 'parent':
        return (
          <RelativePicker
            title={`Add a parent of ${name(me)}`}
            family={f}
            exclude={linked}
            check={(id) => checkParentLink(f, id, me, defaultParentType(me))}
            extra={
              onlyParent && !findPartnership(f, onlyParent, me)
                ? { label: `Also make them partners of ${name(onlyParent)}`, defaultChecked: true }
                : undefined
            }
            onPick={addParent}
            onCancel={() => setAdding(null)}
          />
        )
      case 'partner':
        return (
          <RelativePicker
            title={`Add a partner of ${name(me)}`}
            family={f}
            exclude={linked}
            check={(id) => checkPartnership(f, me, id)}
            defaultGender={person.gender === 'male' ? 'female' : person.gender === 'female' ? 'male' : 'unknown'}
            onPick={addPartner}
            onCancel={() => setAdding(null)}
          />
        )
      case 'child':
        return (
          <RelativePicker
            title={`Add a child of ${name(me)}`}
            family={f}
            exclude={linked}
            check={(id) => checkParentLink(f, me, id, defaultParentType(id))}
            defaultLastName={person.lastName}
            extra={onlyPartner ? { label: `${name(onlyPartner)} is also a parent`, defaultChecked: true } : undefined}
            onPick={addChild}
            onCancel={() => setAdding(null)}
          />
        )
      case 'sibling':
        return (
          <RelativePicker
            title={`Add a brother or sister of ${name(me)}`}
            family={f}
            exclude={linked}
            check={(id) => parentLinks.map((l) => checkParentLink(f, l.parentId, id, l.type)).find((e) => e) ?? null}
            defaultLastName={person.lastName}
            note={
              parentLinks.length === 0
                ? `Brothers and sisters are connected through their parents. Since ${name(me)} has no parents yet, an "Unknown parent" will be added for both. You can fill in their details later.`
                : `They'll be given the same parents: ${parentLinks.map((l) => name(l.parentId)).join(' and ')}.`
            }
            onPick={addSibling}
            onCancel={() => setAdding(null)}
          />
        )
      default:
        return null
    }
  }

  // ---- Editing links ----

  function changeParentType(linkId: string, type: ParentType) {
    const problem = checkParentType(f, linkId, type)
    if (problem) onError(problem)
    else onChange(updateParentLink(f, linkId, type))
  }

  const setEvent = (p: Partnership, key: 'start' | 'end', part: keyof LifeEvent, value: string) =>
    onChange(updatePartnership(f, p.id, { [key]: { ...p[key], [part]: value } }))

  const addButton = (kind: Exclude<Adding, null>, label: string) =>
    adding === kind ? (
      picker()
    ) : (
      <button type="button" className="btn btn-small" onClick={() => setAdding(kind)} disabled={adding !== null}>
        + {label}
      </button>
    )

  return (
    <div className="family">
      <div className="family-group">
        <h3>Parents</h3>
        {parentLinks.map((l) => (
          <div key={l.id} className="family-row">
            <PersonChip person={f.people[l.parentId]} label={labelOf('parents', l.parentId)} onOpen={open(l.parentId)} />
            <select
              aria-label={`How ${name(l.parentId)} is a parent`}
              value={l.type}
              onChange={(e) => changeParentType(l.id, e.target.value as ParentType)}
            >
              {PARENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <RemoveButton label={`Remove ${name(l.parentId)} as a parent`} onClick={() => onChange(removeParentLink(f, l.id))} />
          </div>
        ))}
        {addButton('parent', 'Add parent')}
      </div>

      <div className="family-group">
        <h3>Partners</h3>
        {partnerships.map((p) => {
          const other = otherPartner(p, me)
          const ended = ENDED_TYPES.includes(p.type)
          return (
            <div key={p.id} className="family-row partner-row">
              <div className="family-row-top">
                <PersonChip person={f.people[other]} label={labelOf('partners', other)} onOpen={open(other)} />
                <select
                  aria-label={`Relationship with ${name(other)}`}
                  value={p.type}
                  onChange={(e) => onChange(updatePartnership(f, p.id, { type: e.target.value as PartnershipType }))}
                >
                  {PARTNERSHIP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <RemoveButton label={`Remove ${name(other)} as a partner`} onClick={() => onChange(removePartnership(f, p.id))} />
              </div>
              <div className="form-row partner-dates">
                <SmallEvent
                  label={p.type === 'engaged' ? 'Engaged' : p.type === 'partner' ? 'Together since' : 'Married'}
                  event={p.start}
                  onChange={(part, v) => setEvent(p, 'start', part, v)}
                />
                {ended && (
                  <SmallEvent
                    label={p.type === 'divorced' ? 'Divorced' : p.type === 'separated' ? 'Separated' : 'Widowed'}
                    event={p.end}
                    onChange={(part, v) => setEvent(p, 'end', part, v)}
                  />
                )}
              </div>
            </div>
          )
        })}
        {addButton('partner', 'Add partner')}
      </div>

      <div className="family-group">
        <h3>Children</h3>
        {childLinks.map((l) => (
          <div key={l.id} className="family-row">
            <PersonChip person={f.people[l.childId]} label={labelOf('children', l.childId)} onOpen={open(l.childId)} />
            <select
              aria-label={`How ${name(l.childId)} is a child`}
              value={l.type}
              onChange={(e) => changeParentType(l.id, e.target.value as ParentType)}
            >
              {PARENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <RemoveButton label={`Remove ${name(l.childId)} as a child`} onClick={() => onChange(removeParentLink(f, l.id))} />
          </div>
        ))}
        {addButton('child', 'Add child')}
      </div>

      <div className="family-group">
        <h3>Brothers &amp; sisters</h3>
        {siblings.map((s) => (
          <div key={s.personId} className="family-row">
            <PersonChip person={f.people[s.personId]} label={s.label} onOpen={open(s.personId)} />
          </div>
        ))}
        {addButton('sibling', 'Add brother or sister')}
      </div>

      {others.length > 0 && (
        <div className="family-group">
          <h3>Other relatives</h3>
          <p className="field-hint">Worked out automatically from the links above.</p>
          {others.map((g) => (
            <div key={g.key} className="relatives-group">
              <h4>{g.title}</h4>
              <div className="chip-grid">
                {g.relatives.map((r) => (
                  <PersonChip key={r.personId} person={f.people[r.personId]} label={r.label} onOpen={open(r.personId)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      ✕
    </button>
  )
}

function SmallEvent({ label, event, onChange }: { label: string; event: LifeEvent; onChange(part: keyof LifeEvent, v: string): void }) {
  return (
    <>
      <label className="field">
        <span>{label}: date</span>
        <input value={event.date} onChange={(e) => onChange('date', e.target.value)} placeholder="e.g. 6/12/1975" />
      </label>
      <label className="field">
        <span>{label}: place</span>
        <input value={event.place} onChange={(e) => onChange('place', e.target.value)} />
      </label>
    </>
  )
}
