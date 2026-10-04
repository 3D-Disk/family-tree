import { useEffect, useRef } from 'react'
import { usePhotoUrl } from '../state/usePhotoUrl.ts'

interface Props {
  photo: Blob
  alt: string
  onClose(): void
}

/** Full-size view of a photo over the page. Click anywhere, press Esc or ✕ to close. */
export default function PhotoViewer({ photo, alt, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const url = usePhotoUrl(photo)

  useEffect(() => {
    const d = ref.current!
    d.showModal()
    return () => d.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="photo-viewer"
      aria-label={alt}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={onClose}
    >
      {url && <img src={url} alt={alt} />}
      <button type="button" className="photo-viewer-close" onClick={onClose} aria-label="Close photo">
        ✕
      </button>
    </dialog>
  )
}
