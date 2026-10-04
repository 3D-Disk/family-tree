import { useEffect, useRef, useState } from 'react'
import { formatDate } from '../model/dates.ts'
import { usePhotoUrl } from '../state/usePhotoUrl.ts'

export interface ViewerPhoto {
  blob: Blob
  caption?: string
  date?: string
}

interface Props {
  photos: ViewerPhoto[]
  startIndex?: number
  alt: string
  onClose(): void
}

/**
 * Full-size view of one or more photos over the page.
 * ‹ › buttons or the arrow keys step through them; click outside, press Esc or ✕ to close.
 */
export default function PhotoViewer({ photos, startIndex = 0, alt, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(startIndex)
  const current = photos[Math.min(index, photos.length - 1)]
  const url = usePhotoUrl(current?.blob)
  const many = photos.length > 1
  const step = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length)

  useEffect(() => {
    const d = ref.current!
    d.showModal()
    return () => d.close()
  }, [])

  const caption = [current?.caption?.trim(), current?.date?.trim() && formatDate(current.date)].filter(Boolean).join(' · ')

  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-label={alt}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowRight') step(1)
        if (e.key === 'ArrowLeft') step(-1)
      }}
      onClick={onClose}
    >
      <figure onClick={(e) => e.stopPropagation()}>
        {url && <img src={url} alt={current?.caption || alt} />}
        {(caption || many) && (
          <figcaption>
            {caption}
            {many && <span className="photo-viewer-count">{index + 1} of {photos.length}</span>}
          </figcaption>
        )}
      </figure>
      {many && (
        <>
          <button type="button" className="photo-viewer-nav prev" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1) }}>
            ‹
          </button>
          <button type="button" className="photo-viewer-nav next" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1) }}>
            ›
          </button>
        </>
      )}
      <button type="button" className="photo-viewer-close" onClick={onClose} aria-label="Close photo">
        ✕
      </button>
    </dialog>
  )
}
