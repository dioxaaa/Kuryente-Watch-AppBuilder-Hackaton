import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Check, ImagePlus, Info, ScanLine, Trash2, Upload, Zap } from 'lucide-react'
import { api } from '../api'
import { PageTitle } from '../components/page-title'
import { formatDate, formatPeso } from '../utils/energy-utils'
import { photoToJpegDataUrl } from '../utils/image'
import { checkReading, neighborsAt } from '../utils/meter-check'

function localDateTimeValue() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

export function MeterPage({ readings, rate, onSave, onToast }) {
  const [photo, setPhoto] = useState('')
  const [file, setFile] = useState(null)
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const [recordedAt, setRecordedAt] = useState(localDateTimeValue)
  const [reset, setReset] = useState(false)
  const [readingPhoto, setReadingPhoto] = useState(false)
  const [ocr, setOcr] = useState(null)
  const [ocrError, setOcrError] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const normalizedReadings = readings.map(item => ({
    ...item,
    kwh: item.kwh ?? item.readingKwh,
    date: item.date ?? item.recordedAt,
  }))
  const previous = recordedAt ? neighborsAt(normalizedReadings, recordedAt).before : null
  const delta = value !== '' && previous && !reset ? Number(value) - previous.kwh : null

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo)
  }, [photo])

  function selectImage(selected) {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      setError('Choose an image file, such as JPG or PNG.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Choose an image smaller than 10 MB.')
      return
    }
    if (photo) URL.revokeObjectURL(photo)
    setPhoto(URL.createObjectURL(selected))
    setFile(selected)
    setOcr(null)
    setOcrError('')
    setError('')
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo)
    setPhoto('')
    setFile(null)
    setOcr(null)
    setOcrError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function readPhoto() {
    if (!file || readingPhoto) return
    setReadingPhoto(true)
    setOcr(null)
    setOcrError('')
    try {
      const result = await api.post('/meter-readings/read-photo', { image: await photoToJpegDataUrl(file) })
      setValue(String(result.kwh))
      setOcr(result)
      setError('')
    } catch (failure) {
      setOcrError(failure.message || 'The local vision model could not read this photo.')
    } finally {
      setReadingPhoto(false)
    }
  }

  async function saveReading(event) {
    event.preventDefault()
    const amount = Number(value)
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid meter reading greater than zero.')
      return
    }
    if (!recordedAt || Number.isNaN(new Date(recordedAt).getTime())) {
      setError('Choose a valid date and time for this reading.')
      return
    }
    const problem = checkReading(normalizedReadings, { kwh: amount, date: recordedAt, reset })
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      const saved = await onSave({
        readingKwh: amount,
        recordedAt: new Date(recordedAt).toISOString(),
        notes: [notes.trim(), ocr && amount === ocr.kwh ? `Photo assisted · ${ocr.model}` : ''].filter(Boolean).join(' · '),
      })
      if (saved) {
        setValue('')
        setNotes('')
        setReset(false)
        setOcr(null)
        removePhoto()
        setRecordedAt(localDateTimeValue())
        onToast('Meter reading saved to the local database.')
      }
    } catch (failure) {
      setError(failure.message || 'Could not save this reading.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle eyebrow="HOUSEHOLD MONITORING" title="Add a meter reading" description="Record the cumulative kWh value shown on your electricity meter." />
      <div className="demo-banner"><Info size={16} /><span><strong>Review before saving.</strong> Photos are read by the local Ollama vision model when the KuryenteWatch server is running, or by on-device OCR when it is not; you can always enter the value manually.</span></div>
      <div className="meter-layout">
        <section className="panel meter-form-panel">
          <div className="panel-heading"><div><h2>New meter reading</h2><p>Enter the cumulative display value</p></div><span className="step-pill"><span>01</span> Reading details</span></div>
          <form onSubmit={saveReading} noValidate>
            <label className="field-label">Meter photo <span className="optional">(optional)</span></label>
            {photo ? (
              <div className="photo-preview">
                <img src={photo} alt="Selected meter photo preview" />
                <div className="photo-overlay">
                  <button className="button button-secondary button-small" type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Replace photo</button>
                  <button className="button button-danger button-small" type="button" onClick={removePhoto}><Trash2 size={14} /> Remove</button>
                </div>
              </div>
            ) : (
              <button className="upload-zone" type="button" onClick={() => inputRef.current?.click()}>
                <span className="upload-icon"><Camera size={20} /></span><strong>Take a photo or upload</strong>
                <span>Use your camera or choose an image from your device</span>
                <span className="upload-formats"><ImagePlus size={14} /> JPG, PNG up to 10 MB</span>
                <span className="button button-secondary button-small"><Upload size={14} /> Choose image</span>
              </button>
            )}
            <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => { selectImage(event.target.files?.[0]); event.target.value = '' }} aria-label="Choose meter photo" />
            {photo && <button className="button button-secondary button-small" type="button" onClick={readPhoto} disabled={readingPhoto}><ScanLine size={15} /> {readingPhoto ? 'Reading photo…' : 'Read display from photo'}</button>}
            {ocr && <p className="photo-note"><Check size={14} /> Suggested {ocr.kwh.toLocaleString()} kWh by {ocr.model}. Verify the value against your photo.</p>}
            {ocrError && <p className="form-error" role="alert">{ocrError}</p>}
            <div className="field-group">
              <label htmlFor="meter-reading">Meter reading <span className="required">*</span></label>
              <div className="input-with-unit"><input id="meter-reading" type="number" min="0.01" step="0.01" value={value} onChange={event => { setValue(event.target.value); setError('') }} placeholder="e.g. 3,012.5" required /><span>kWh</span></div>
              <small>Use the full cumulative value displayed on your meter.</small>
            </div>
            <div className="field-grid">
              <div className="field-group"><label htmlFor="meter-date">Date and time <span className="required">*</span></label><input id="meter-date" type="datetime-local" value={recordedAt} onChange={event => setRecordedAt(event.target.value)} required /></div>
              <div className="field-group"><label htmlFor="meter-notes">Notes <span className="optional">(optional)</span></label><input id="meter-notes" maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="e.g. After returning home" /></div>
            </div>
            <label className="preference-row meter-reset-option"><input type="checkbox" checked={reset} onChange={event => setReset(event.target.checked)} /><span><strong>New or replaced meter</strong><small>Start a new meter sequence if the physical meter was changed.</small></span></label>
            {error && <p className="form-error" role="alert"><AlertCircle size={15} /> {error}</p>}
            <div className="reading-preview">
              <span>Previous reading</span><strong>{previous ? `${previous.kwh.toLocaleString()} kWh` : 'First reading'}</strong>
              <span>Estimated use</span><strong>{delta !== null && delta >= 0 ? `${delta.toFixed(2)} kWh` : '—'}</strong>
              <span>Estimated cost</span><strong>{delta !== null && delta >= 0 ? formatPeso(delta * rate) : '—'}</strong>
            </div>
            {!readings.length && <p className="muted-copy"><Info size={14} /> This first reading starts your history. Add another reading later to calculate consumption.</p>}
            <div className="form-actions"><span><span className="required">*</span> Required · saved in local SQLite</span><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : <><Check size={16} /> Save reading</>}</button></div>
          </form>
        </section>
        <aside className="meter-side-column">
          <section className="panel reading-guide"><span className="guide-icon"><Camera size={18} /></span><h3>For an accurate reading</h3><ul><li>Enter the full cumulative kWh value.</li><li>Include digits after the decimal when shown.</li><li>Use the time you checked the meter.</li><li>Check the value before saving.</li></ul><span className="guide-disclaimer"><Info size={14} /> Photos are read on this device or by your local KuryenteWatch server, never a cloud service.</span></section>
          <section className="panel last-reading-card"><span className="eyebrow">PREVIOUS READING</span><strong>{previous ? previous.kwh.toLocaleString() : '—'} <small>kWh</small></strong><span>{previous ? formatDate(previous.date) : 'No previous reading'}</span></section>
        </aside>
      </div>
    </>
  )
}
