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
