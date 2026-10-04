// How a profile photo is framed inside the round card picture.
// The frame is a square of side 1; the photo's centre is offset by (x, y)
// in frame units, rotated, and scaled so that zoom 1 just covers the frame.

export type Rotation = 0 | 90 | 180 | 270

export interface PhotoCrop {
  x: number
  y: number
  zoom: number
  rotation: Rotation
}

export const DEFAULT_CROP: PhotoCrop = { x: 0, y: 0, zoom: 1, rotation: 0 }
export const MIN_ZOOM = 1
export const MAX_ZOOM = 5

/** Width and height of the photo after rotation. */
export function rotatedSize(width: number, height: number, rotation: Rotation): [number, number] {
  return rotation === 90 || rotation === 270 ? [height, width] : [width, height]
}

/** Scale (frame units per photo pixel) for the given zoom. */
export function frameScale(width: number, height: number, crop: PhotoCrop): number {
  const [w, h] = rotatedSize(width, height, crop.rotation)
  return crop.zoom / Math.min(w, h)
}

/** Keep zoom in range and the photo always covering the whole frame. */
export function clampCrop(crop: PhotoCrop, width: number, height: number): PhotoCrop {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, crop.zoom))
  const c = { ...crop, zoom }
  const [w, h] = rotatedSize(width, height, c.rotation)
  const s = frameScale(width, height, c)
  const maxX = (w * s - 1) / 2
  const maxY = (h * s - 1) / 2
  const clamp = (v: number, m: number) => Math.min(m, Math.max(-m, v))
  return { ...c, x: clamp(c.x, maxX), y: clamp(c.y, maxY) }
}

export function rotateCrop(crop: PhotoCrop, width: number, height: number): PhotoCrop {
  const rotation = ((crop.rotation + 90) % 360) as Rotation
  return clampCrop({ ...crop, rotation, x: 0, y: 0 }, width, height)
}
