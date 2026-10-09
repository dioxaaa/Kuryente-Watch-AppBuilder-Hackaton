import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, ImagePlus, Info, ScanLine, Trash2, Upload, Zap } from 'lucide-react'
import { PageTitle } from '../components/page-title'
import { api } from '../api'
import { formatDate } from '../utils/energy-utils'
import { photoToJpegDataUrl } from '../utils/image'
import { checkReading, neighborsAt } from '../utils/meter-check'

export function MeterPage({ readings, rate, onSave, onToast }) {
  const [photo, setPhoto] = useState('')
  const [file, setFile] = useState(null) // the chosen image, kept so the AI can read it
  const [reading, setReading] = useState(false)
  const [ocr, setOcr] = useState(null) // what the AI read from the photo: { kwh, digits, model }
  const [ocrError, setOcrError] = useState('')
  const [value, setValue] = useState('')
  const [recordedAt, setRecordedAt] = useState(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  })
  const [error, setError] = useState('')
  const [reset, setReset] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo)
  }, [photo])
  // compare with the reading taken just before the chosen date, not just the newest one
  const previous = (recordedAt && !Number.isNaN(new Date(recordedAt).getTime()) ? neighborsAt(readings, recordedAt).before : null) ?? readings[readings.length - 1]
  const delta = value !== '' && previous && !reset ? Number(value) - previous.kwh : null
  function selectImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file, such as JPG, PNG, or HEIC.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.')
      return
    }
    setError('')
    if (photo) URL.revokeObjectURL(photo)
    setPhoto(URL.createObjectURL(file))
    setFile(file)
    setOcr(null)
    setOcrError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo)
    setPhoto('')
    setFile(null)
    setOcr(null)
    setOcrError('')
  }

  // Asks the local AI to read the kWh number from the photo. It only fills the field; the person still confirms.
  async function readPhoto() {
    if (!file || reading) return
    setReading(true)
    setOcr(null)
    setOcrError('')
    try {
      const image = await photoToJpegDataUrl(file)
      const result = await api.post('/meter-readings/read-photo', { image })
      setValue(String(result.kwh))
      setError('')
      setOcr(result)
    } catch (err) { setOcrError(err.message) }
    finally { setReading(false) }
  }
  async function saveReading(event) {
    event.preventDefault()
    if (!value || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      setError('Enter a valid meter reading greater than zero.')
      return
    }
    if (!recordedAt || Number.isNaN(new Date(recordedAt).getTime())) {
      setError('Choose a valid date and time for this reading.')
      return
    }
    const problem = checkReading(readings, { kwh: Number(value), date: recordedAt, reset })
    if (problem) {
      setError(problem)
      return
    }
    if (!(await onSave({ kwh: Number(value), date: new Date(recordedAt), source: ocr && Number(value) === ocr.kwh ? 'Photo scan' : 'Manual entry', reset }))) return // the app already showed why it could not save
    setValue('')
    setReset(false)
    removePhoto()
    setError('')
    onToast('Reading saved.')
  }

  return (
    <>
      <PageTitle eyebrow="HOUSEHOLD MONITORING" title="Scan my meter" description="Add a meter reading with a photo or enter it manually. The reading is saved in your local database. Photos are read on this computer and never stored." />
      <div className="demo-banner"><Info size={16} /><span><strong>Check before you save.</strong> The AI can misread a display, so always compare the number with your photo.</span></div>
      <div className="meter-layout">
        <section className="panel meter-form-panel">
          <div className="panel-heading"><div><h2>New meter reading</h2><p>Fields marked with <span className="required">*</span> are required</p></div><span className="step-pill"><span>01</span> Reading details</span></div>
          <form onSubmit={saveReading} noValidate>
            <label className="field-label">Meter photo <span className="optional">(optional)</span></label>
            {photo ? <div className="photo-preview"><img src={photo} alt="Selected meter photo preview" /><div className="photo-overlay"><button className="button button-secondary button-small" type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Replace photo</button><button className="button button-danger button-small" type="button" onClick={removePhoto}><Trash2 size={14} /> Remove</button></div></div> :
              <button className="upload-zone" type="button" onClick={() => inputRef.current?.click()}><span className="upload-icon"><Camera size={20} /></span><strong>Take a photo or upload</strong><span>Use your camera or choose an image from your device</span><span className="upload-formats"><ImagePlus size={14} /> JPG, PNG, HEIC up to 10 MB</span><span className="button button-secondary button-small"><Upload size={14} /> Choose image</span></button>}
            <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => selectImage(event.target.files?.[0])} aria-label="Choose meter photo" />
            {photo && <div className="photo-note"><Check size={14} /> Photo ready. Press “Read display” to fill in the number, or type it yourself.</div>}
            <div className="scan-demo"><span><ScanLine size={17} /><span><strong>Read the display with AI</strong><small>{photo ? 'Runs on this computer. You confirm the number before saving.' : 'Add a photo first.'}</small></span></span><button type="button" className="button button-secondary button-small" disabled={!photo || reading} onClick={readPhoto}>{reading ? 'Reading…' : 'Read display'}</button></div>
            {ocr && <p className="ocr-result" role="status"><Check size={14} /> AI read <strong>{ocr.kwh.toLocaleString()} kWh</strong>{ocr.digits ? ` (display: ${ocr.digits})` : ''}. Compare it with your photo before confirming.</p>}
            {ocrError && <p className="form-error" role="alert"><AlertCircle size={15} />{ocrError}</p>}
            <div className="form-divider" />
            <div className="field-grid">
              <div className="field-group"><label htmlFor="meter-reading">Meter reading <span className="required">*</span></label><div className="input-with-unit"><input id="meter-reading" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="e.g. 3,012.00" value={value} onChange={event => { setValue(event.target.value); setError('') }} /><span>kWh</span></div></div>
              <div className="field-group"><label htmlFor="reading-date">Date and time <span className="required">*</span></label><input id="reading-date" type="datetime-local" value={recordedAt} onChange={event => setRecordedAt(event.target.value)} /></div>
            </div>
            <label className="reset-meter-option"><input type="checkbox" checked={reset} onChange={event => { setReset(event.target.checked); setError('') }} /><span><strong>New or replaced meter</strong><small>Tick this if your meter was changed and counts from a new starting number. Usage is not compared with older readings.</small></span></label>
            {error && <p className="form-error" role="alert"><AlertCircle size={15} />{error}</p>}
            {delta !== null && delta < 0 && !error && <p className="form-error"><AlertCircle size={15} />This is below your earlier reading. Check the value before confirming.</p>}
            <div className="comparison-box">
              {previous ? <><span className="comparison-icon"><Zap size={17} /></span><span className="comparison-copy"><strong>Consumption preview</strong><small>{reset ? 'New meter: not compared with older readings' : `Earlier reading: ${previous.kwh.toLocaleString()} kWh · ${formatDate(previous.date)}`}</small></span><span className="comparison-value">{delta === null ? '—' : delta < 0 ? 'Check value' : `${delta.toFixed(2)} kWh`}<small>{delta !== null && delta >= 0 ? `≈ ₱${(delta * rate).toFixed(2)} estimated` : 'Enter a reading above'}</small></span></> :
                <><span className="comparison-icon"><Info size={17} /></span><span className="comparison-copy"><strong>First reading</strong><small>Another reading will be needed to calculate household consumption.</small></span></>}
            </div>
            <div className="form-actions"><span><span className="required">*</span> Required</span><button type="submit" className="button button-primary"><Check size={16} /> Confirm reading</button></div>
          </form>
        </section>
        <aside className="meter-side-column">
          <section className="panel reading-guide"><span className="guide-icon"><Camera size={18} /></span><h3>For a clear reading</h3><ul><li>Keep the meter screen in focus.</li><li>Avoid glare and shadows.</li><li>Include the full kWh value.</li><li>Double-check before confirming.</li></ul><span className="guide-disclaimer"><Info size={14} /> Photos are read on this computer by the local AI and never stored.</span></section>
          <section className="panel last-reading-card"><span className="eyebrow">PREVIOUS READING</span><strong>{previous ? previous.kwh.toLocaleString() : '—'} <small>kWh</small></strong><span>{previous ? `${previous.source} · ${formatDate(previous.date)}` : 'No previous reading'}</span></section>
        </aside>
      </div>
    </>
  )
}