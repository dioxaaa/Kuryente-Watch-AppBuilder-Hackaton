// On-device meter photo reading with Tesseract (WebAssembly), used when the KuryenteWatch server or its vision model is unavailable.
// The worker, OCR engine and English language data are bundled with the app (see vite.config.ts), so this works with no internet.
export const OCR_MODEL = 'On-device OCR (Tesseract)'
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

// Tesseract page segmentation modes: automatic, one uniform block, one text line.
const [PSM_AUTO, PSM_SINGLE_BLOCK, PSM_SINGLE_LINE] = ['3', '6', '7']

let workerPromise = null
async function getWorker() {
  workerPromise ??= (async () => {
    const [{ createWorker }, { default: workerPath }, { default: simdCore }, { default: plainCore }] = await Promise.all([
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
    await worker.setParameters({ tessedit_char_whitelist: '0123456789.' })
    return worker
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
    const worker = await getWorker()
    // Automatic layout often misses a single large meter display, so retry as one block and as one line.
    for (const mode of [PSM_AUTO, PSM_SINGLE_BLOCK, PSM_SINGLE_LINE]) {
      await worker.setParameters({ tessedit_pageseg_mode: mode })
      text = (await worker.recognize(image)).data.text
      if (extractMeterReading(text)) break
    }
  } catch {
    throw Object.assign(new Error('This device could not read the photo. Please type the reading manually.'), { status: 503 })
  }
  const found = extractMeterReading(text)
  if (!found) throw Object.assign(new Error(NO_DIGITS_MESSAGE), { status: 422 })
  return { ...found, model: OCR_MODEL }
}
