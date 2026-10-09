// On-device meter and appliance label photo reading with Tesseract (WebAssembly), used when the KuryenteWatch server or its vision model is unavailable.
// The worker, OCR engine and English language data are bundled with the app (see vite.config.ts), so this works with no internet.
export const OCR_MODEL = 'On-device OCR (Tesseract)'
import { parseLabelTexts } from './appliance-label.js'

export const NO_DIGITS_MESSAGE = 'Could not find the meter digits in this photo. Please type the reading manually.'

// Picks the meter value from OCR text: the run with the most digits wins, keeping a decimal part when one is shown.
export function extractMeterReading(text) {
  const runs = String(text ?? '').match(/\d+(?:[.,]\d+)?/g) ?? []
  let best = null
  for (const run of runs) {
    const digits = run.replace(/\D/g, '').length
    if (!best || digits > best.digits) best = { run, digits }
  }
  if (!best || best.digits < 2) return null
  const kwh = Number(best.run.replace(',', '.'))
  if (!Number.isFinite(kwh) || !(kwh > 0 && kwh < 10_000_000)) return null
  return { kwh: Math.round(kwh * 100) / 100, digits: best.run.slice(0, 20) }
}

// Same check as WebAssembly feature detection in tesseract.js, so the faster SIMD build is used when the device supports it.
const simdSupported = () => {
  try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])) }
  catch { return false }
}

let workerPromise = null
let queue = Promise.resolve()
// Meter and label reading share one worker with different settings, so jobs run one at a time.
function withWorker(job) {
  const run = queue.then(async () => job(await getWorker()))
  queue = run.catch(() => {})
  return run
}
async function getWorker() {
  workerPromise ??= (async () => {
    const [{ createWorker, PSM }, { default: workerPath }, { default: simdCore }, { default: plainCore }] = await Promise.all([
      import('tesseract.js'),
      import('tesseract.js/dist/worker.min.js?url'),
      import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
      import('tesseract.js-core/tesseract-core-lstm.wasm.js?url'),
    ])
    const worker = await createWorker('eng', 1, {
      workerPath: new URL(workerPath, location.href).href,
      corePath: new URL(simdSupported() ? simdCore : plainCore, location.href).href,
      langPath: new URL(`${import.meta.env.BASE_URL}tessdata`, location.href).href,
      workerBlobURL: false,
    })
    return { worker, PSM }
  })()
  try {
    return await workerPromise
  } catch (error) {
    workerPromise = null
    throw error
  }
}

// `image` is a JPEG data URL from photoToJpegDataUrl(). Returns { kwh, digits, model } like POST /api/meter-readings/read-photo.
export async function readMeterPhotoOnDevice(image) {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) throw Object.assign(new Error('Choose a photo first.'), { status: 400 })
  let text
  try {
    text = await withWorker(async ({ worker, PSM }) => {
      await worker.setParameters({ tessedit_char_whitelist: '0123456789.', tessedit_pageseg_mode: PSM.AUTO })
      return (await worker.recognize(image)).data.text
    })
  } catch {
    throw Object.assign(new Error('This device could not read the photo. Please type the reading manually.'), { status: 503 })
  }
  const found = extractMeterReading(text)
  if (!found) throw Object.assign(new Error(NO_DIGITS_MESSAGE), { status: 422 })
  return { ...found, model: OCR_MODEL }
}

export const NO_LABEL_MESSAGE = 'Could not read the rated watts or model from this label. Try a closer, sharper photo, or type the details manually.'

const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image()
  image.onload = () => resolve(image)
  image.onerror = () => reject(new Error('Could not open the photo.'))
  image.src = src
})

// Labels are often photographed sideways, and printed or embossed text is low contrast,
// so the photo is read upright and turned both ways, in grayscale with the contrast stretched.
async function labelVariants(dataUrl) {
  const image = await loadImage(dataUrl)
  return [0, 90, 270].map(degrees => {
    const turned = degrees !== 0
    const canvas = document.createElement('canvas')
    canvas.width = turned ? image.height : image.width
    canvas.height = turned ? image.width : image.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((degrees * Math.PI) / 180)
    ctx.drawImage(image, -image.width / 2, -image.height / 2)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    stretchContrast(pixels.data)
    ctx.putImageData(pixels, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  })
}

// Grayscale, then map the 2nd..98th brightness percentiles to black..white.
export function stretchContrast(data) {
  const histogram = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    data[i] = data[i + 1] = data[i + 2] = gray
    histogram[gray]++
  }
  const total = data.length / 4
  let low = 0, high = 255, seen = 0
  while (low < 255 && (seen += histogram[low]) < total * 0.02) low++
  seen = 0
  while (high > 0 && (seen += histogram[high]) < total * 0.02) high--
  if (high <= low) return
  const scale = 255 / (high - low)
  for (let i = 0; i < data.length; i += 4) data[i] = data[i + 1] = data[i + 2] = Math.max(0, Math.min(255, (data[i] - low) * scale))
}

// `image` is a JPEG data URL. Returns { name, category, brand, model, watts, engine } like POST /api/appliances/read-label.
export async function readLabelPhotoOnDevice(image) {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) throw Object.assign(new Error('Choose a photo first.'), { status: 400 })
  let texts
  try {
    const variants = await labelVariants(image)
    texts = await withWorker(async ({ worker, PSM }) => {
      const found = []
      for (const mode of [PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT]) {
        await worker.setParameters({ tessedit_char_whitelist: '', tessedit_pageseg_mode: mode })
        for (const variant of variants) found.push((await worker.recognize(variant)).data.text)
      }
      return found
    })
  } catch {
    throw Object.assign(new Error('This device could not read the photo. Please type the details manually.'), { status: 503 })
  }
  const found = parseLabelTexts(texts)
  if (!found) throw Object.assign(new Error(NO_LABEL_MESSAGE), { status: 422 })
  return { ...found, engine: OCR_MODEL }
}
