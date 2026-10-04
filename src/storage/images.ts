import { frameScale, type PhotoCrop } from '../model/photoCrop.ts'

// Shrink photos on upload so save files and browser storage stay small.

const MAX_SIDE = 1600
const QUALITY = 0.85

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This image couldn't be read. Try a JPEG or PNG file.")
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1_500_000 && file.type !== 'image/heic') {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', QUALITY),
  )
}

const AVATAR_SIZE = 256

/** Draw the framed part of a photo into the small square image shown on cards. */
export async function renderAvatar(photo: Blob, crop: PhotoCrop): Promise<Blob> {
  const bitmap = await createImageBitmap(photo)
  const n = AVATAR_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, n, n)
  const s = frameScale(bitmap.width, bitmap.height, crop) * n
  ctx.translate(n / 2 + crop.x * n, n / 2 + crop.y * n)
  ctx.rotate((crop.rotation * Math.PI) / 180)
  ctx.scale(s, s)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.9),
  )
}

const THUMB_SIZE = 320

/** A small version of a photo for gallery grids (longest side 320px). */
export async function makeThumbnail(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo)
  const scale = Math.min(1, THUMB_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.85),
  )
}
