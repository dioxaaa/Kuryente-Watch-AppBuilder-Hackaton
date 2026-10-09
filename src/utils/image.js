// Shrinks a photo and re-encodes it as JPEG so it uploads to the local server quickly.
// Phone photos are often 4000+ pixels wide, which is far more than a vision model needs to read digits.
export async function photoToJpegDataUrl(file, maxSide = 1280, quality = 0.9) {
  let bitmap
  try { bitmap = await createImageBitmap(file) } // applies the photo's rotation
  catch { throw new Error('This browser cannot open that photo format. Try a JPG or PNG, or type the value in.') }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}