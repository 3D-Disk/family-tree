import { useRef, useState } from 'react'
import { formatDate, parseDate } from '../../model/dates.ts'
import { newId } from '../../model/person.ts'
import type { GalleryPhoto, PhotoStore } from '../../model/types.ts'
import { usePhotoUrl } from '../../state/usePhotoUrl.ts'
import { makeThumbnail, preparePhoto } from '../../storage/images.ts'
import ConfirmDialog from '../ConfirmDialog.tsx'

interface Props {
  items: GalleryPhoto[]
  /** Look up an image (saved or just added). */
  photo(id: string): Blob | undefined
  onChange(items: GalleryPhoto[]): void
  /** Images added in this edit, to be saved with the person. */
  onAddPhotos(photos: PhotoStore): void
  onMakeProfile(full: Blob): void
  onError(message: string): void
}

/** The "Photo gallery" section of the edit form. */
export default function GalleryEditor({ items, photo, onChange, onAddPhotos, onMakeProfile, onError }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(0)
  const [removing, setRemoving] = useState<GalleryPhoto | null>(null)

  async function addFiles(files: FileList | null) {
    const list = [...(files ?? [])]
    if (input.current) input.current.value = ''
    if (!list.length) return
    setBusy(list.length)
    const added: GalleryPhoto[] = []
    const blobs: PhotoStore = {}
    for (const file of list) {
      try {
        const full = await preparePhoto(file)
        const item: GalleryPhoto = { id: newId(), photoId: newId(), thumbId: newId(), caption: '', date: '' }
        blobs[item.photoId] = full
        blobs[item.thumbId] = await makeThumbnail(full)
        added.push(item)
      } catch (e) {
        onError(`${file.name}: ${e instanceof Error ? e.message : 'could not be used.'}`)
      }
      setBusy((n) => n - 1)
    }
    if (added.length) {
      onAddPhotos(blobs)
      onChange([...items, ...added])
    }
  }

  const update = (id: string, changes: Partial<GalleryPhoto>) =>
    onChange(items.map((g) => (g.id === id ? { ...g, ...changes } : g)))
  const move = (i: number, d: number) => {
    const next = [...items]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }

  return (
    <div className="gallery-editor">
      {items.length > 0 && (
        <ul className="gallery-edit-list">
          {items.map((g, i) => (
            <li key={g.id} className="gallery-edit-item">
              <Thumb blob={photo(g.thumbId) ?? photo(g.photoId)} alt={g.caption || `Photo ${i + 1}`} />
              <div className="gallery-edit-fields">
                <label className="field">
                  <span>Caption</span>
                  <input value={g.caption} onChange={(e) => update(g.id, { caption: e.target.value })} placeholder="e.g. Wedding day" />
                </label>
                <label className="field">
                  <span>Date</span>
                  <input value={g.date} onChange={(e) => update(g.id, { date: e.target.value })} placeholder="e.g. Summer 1952" />
                  {g.date.trim() && (
                    <span className={`field-hint${parseDate(g.date) ? '' : ' field-warn'}`}>
                      {parseDate(g.date) ? `Shows as: ${formatDate(g.date)}` : 'Kept as typed.'}
                    </span>
                  )}
                </label>
                <div className="gallery-edit-actions">
                  <button type="button" className="btn btn-small" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move earlier">
                    ◀
                  </button>
                  <button type="button" className="btn btn-small" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move later">
                    ▶
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => {
                      const full = photo(g.photoId)
                      if (full) onMakeProfile(full)
                    }}
                  >
                    Make profile photo
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => setRemoving(g)}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-small" onClick={() => input.current?.click()} disabled={busy > 0}>
        {busy > 0 ? `Adding ${busy} photo${busy === 1 ? '' : 's'}…` : '+ Add photos'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      {removing && (
        <ConfirmDialog
          title="Remove this photo from the gallery?"
          buttons={[
            { label: 'Cancel', value: false },
            { label: 'Remove photo', value: true, kind: 'danger' },
          ]}
          cancelValue={false}
          onChoose={(yes) => {
            if (yes) onChange(items.filter((x) => x.id !== removing.id))
            setRemoving(null)
          }}
        >
          It will be removed when you save.
        </ConfirmDialog>
      )}
    </div>
  )
}

function Thumb({ blob, alt }: { blob: Blob | undefined; alt: string }) {
  const url = usePhotoUrl(blob)
  return url ? <img className="gallery-thumb" src={url} alt={alt} /> : <div className="gallery-thumb" />
}
