import { useEffect } from 'react'

// Object URLs are shared per blob and released shortly after the last
// component showing that photo goes away.
const cache = new Map<Blob, { url: string; users: number }>()

function urlFor(blob: Blob): string {
  let entry = cache.get(blob)
  if (!entry) {
    entry = { url: URL.createObjectURL(blob), users: 0 }
    cache.set(blob, entry)
  }
  return entry.url
}

/** A URL for displaying a photo blob in an <img>. */
export function usePhotoUrl(blob: Blob | null | undefined): string | null {
  const url = blob ? urlFor(blob) : null
  useEffect(() => {
    if (!blob) return
    urlFor(blob)
    const entry = cache.get(blob)!
    entry.users++
    return () => {
      entry.users--
      setTimeout(() => {
        if (entry.users === 0 && cache.get(blob) === entry) {
          URL.revokeObjectURL(entry.url)
          cache.delete(blob)
        }
      }, 1000)
    }
  }, [blob])
  return url
}
