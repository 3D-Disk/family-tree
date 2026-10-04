import type { Gender } from '../model/types.ts'
import { usePhotoUrl } from '../state/usePhotoUrl.ts'

interface Props {
  photo: Blob | null | undefined
  gender: Gender
  size: number
  alt: string
}

/** Profile photo, or a silhouette placeholder based on gender. */
export default function Avatar({ photo, gender, size, alt }: Props) {
  const url = usePhotoUrl(photo)
  if (url) {
    return <img className="avatar" src={url} alt={alt} width={size} height={size} />
  }
  return <Silhouette gender={gender} size={size} label={alt} />
}

function Silhouette({ gender, size, label }: { gender: Gender; size: number; label: string }) {
  const kind = gender === 'male' || gender === 'female' ? gender : 'neutral'
  return (
    <svg
      className={`avatar avatar-${kind}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={`${label} (no photo)`}
    >
      <rect width="64" height="64" className="avatar-bg" />
      <circle className="avatar-fg" cx="32" cy="26" r="11" />
      <path className="avatar-fg" d="M10 64c0-13 10-21 22-21s22 8 22 21z" />
    </svg>
  )
}
