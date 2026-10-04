import { useRef, useState, type ReactNode } from 'react'
import { formatDate } from '../model/dates.ts'
import { linkHost, safeUrl, summaryRows, timeline } from '../model/details.ts'
import { cardPhoto, fullName, lifeSpan } from '../model/person.ts'
import { relativesOf } from '../model/relatives.ts'
import { useTree } from '../state/treeContext.ts'
import Avatar from './Avatar.tsx'
import PersonChip from './family/PersonChip.tsx'
import PhotoViewer from './PhotoViewer.tsx'

interface Props {
  personId: string
  onEdit(): void
  onOpenPerson(id: string): void
}

/** Read-only, nicely laid out view of everything about one person. */
export default function PersonDetails({ personId, onEdit, onOpenPerson }: Props) {
  const { state } = useTree()
  const tree = state.tree!
  const p = tree.people[personId]
  const [viewing, setViewing] = useState(false)
  const body = useRef<HTMLDivElement>(null)
  if (!p) return null

  const name = fullName(p)
  const original = p.photoId ? state.photos[p.photoId] : undefined
  const summary = summaryRows(p)
  const events = timeline(tree, p)
  const groups = relativesOf(tree, p.id)
  const links = p.links.map((l) => ({ ...l, href: safeUrl(l.url) })).filter((l) => l.href)
  const notable = p.notable.filter((n) => n.trim())
  const b = p.burial
  const hasBurial = !p.living && [b.cemetery, b.place, b.plot, b.date, b.notes].some((s) => s.trim())

  const sections: { id: string; title: string; content: ReactNode }[] = []
  if (summary.length) {
    sections.push({
      id: 'summary',
      title: 'Summary',
      content: (
        <dl className="summary">
          {summary.map((r) => (
            <div key={r.label} className="summary-row">
              <dt>{r.label}</dt>
              <dd>
                {r.values.map((v, i) => (
                  <div key={i}>{v}</div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ),
    })
  }
  if (p.biography.trim()) {
    sections.push({ id: 'biography', title: 'Biography', content: <div className="prose">{p.biography}</div> })
  }
  if (groups.length) {
    sections.push({
      id: 'relatives',
      title: 'Relatives',
      content: groups.map((g) => (
        <div key={g.key} className="relatives-group">
          <h4>{g.title}</h4>
          <div className="chip-grid">
            {g.relatives.map((r) => (
              <PersonChip key={r.personId} person={tree.people[r.personId]} label={r.label} onOpen={() => onOpenPerson(r.personId)} />
            ))}
          </div>
        </div>
      )),
    })
  }
  if (events.length) {
    sections.push({
      id: 'events',
      title: 'Life events',
      content: (
        <ol className="timeline">
          {events.map((e, i) => (
            <li key={i}>
              <span className="timeline-date">{formatDate(e.date) || '—'}</span>
              <span className="timeline-body">
                {e.personId ? (
                  <button type="button" className="link-btn" onClick={() => onOpenPerson(e.personId!)}>
                    {e.title}
                  </button>
                ) : (
                  <strong>{e.title}</strong>
                )}
                {e.detail && <span className="timeline-detail">{e.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      ),
    })
  }
  if (hasBurial) {
    sections.push({
      id: 'burial',
      title: 'Burial',
      content: (
        <dl className="summary">
          {[
            ['Cemetery', b.cemetery],
            ['Location', b.place],
            ['Plot', b.plot],
            ['Date', formatDate(b.date)],
          ]
            .filter(([, v]) => v.trim())
            .map(([k, v]) => (
              <div key={k} className="summary-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          {b.notes.trim() && <div className="prose burial-notes">{b.notes}</div>}
        </dl>
      ),
    })
  }
  if (notable.length) {
    sections.push({
      id: 'notable',
      title: 'Notable details',
      content: (
        <ul className="notable">
          {notable.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      ),
    })
  }
  if (links.length) {
    sections.push({
      id: 'links',
      title: 'Links',
      content: (
        <ul className="links">
          {links.map((l) => (
            <li key={l.id}>
              <a href={l.href!} target="_blank" rel="noopener noreferrer">
                {l.label.trim() || linkHost(l.href!)}
              </a>
              <span className="link-host">{linkHost(l.href!)}</span>
            </li>
          ))}
        </ul>
      ),
    })
  }
  if (p.notes.trim()) {
    sections.push({ id: 'notes', title: 'Notes', content: <div className="prose">{p.notes}</div> })
  }

  const jump = (id: string) =>
    body.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  return (
    <div className="details" ref={body}>
      <header className="details-header">
        {original ? (
          <button
            type="button"
            className="photo-enlarge"
            onClick={() => setViewing(true)}
            title="Click to see the full photo"
            aria-label={`See ${name}'s photo full size`}
          >
            <Avatar photo={cardPhoto(p, state.photos)} gender={p.gender} size={104} alt={name} />
          </button>
        ) : (
          <Avatar photo={undefined} gender={p.gender} size={104} alt={name} />
        )}
        <div className="details-heading">
          <h3>
            {name}
            {p.nickname.trim() && <span className="details-nickname"> “{p.nickname.trim()}”</span>}
          </h3>
          {p.birthSurname.trim() && p.birthSurname.trim() !== p.lastName.trim() && (
            <div className="details-sub">née {p.birthSurname.trim()}</div>
          )}
          {lifeSpan(p) && <div className="details-sub">{p.living ? lifeSpan(p) : `✝ ${lifeSpan(p)}`}</div>}
          {p.description.trim() && <div className="details-description">{p.description}</div>}
          <button type="button" className="btn btn-primary details-edit" onClick={onEdit}>
            Edit details
          </button>
        </div>
      </header>

      {sections.length > 1 && (
        <nav className="section-nav" aria-label="Jump to section">
          {sections.map((s) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)}>
              {s.title}
            </button>
          ))}
        </nav>
      )}

      {sections.map((s) => (
        <section key={s.id} className="details-section" data-section={s.id}>
          <h3>{s.title}</h3>
          {s.content}
        </section>
      ))}

      {sections.length < 4 && (
        <p className="details-empty">
          Add more about {p.firstName.trim() || 'this person'}, such as a biography, places they lived, life events or
          fun facts.{' '}
          <button type="button" className="link-btn" onClick={onEdit}>
            Edit details
          </button>
        </p>
      )}

      {viewing && original && <PhotoViewer photo={original} alt={`Photo of ${name}`} onClose={() => setViewing(false)} />}
    </div>
  )
}
