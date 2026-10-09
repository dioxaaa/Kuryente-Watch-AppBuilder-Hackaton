import { useEffect, useMemo, useRef, useState } from 'react'
import { AirVent, Fan, Lightbulb, Pencil, Plus, Refrigerator, Search, Tv, WashingMachine, X, Zap, Trash2, Gauge, ScanLine, Check, Info } from 'lucide-react'
import { ConfirmModal } from '../components/confirm-modal'
import { EmptyState } from '../components/empty-state'
import { PageTitle } from '../components/page-title'
import { applianceAverageDailyKwh, applianceMonthKwh, estimateDailyKwh, formatDate, formatPeso, meterDailyUse, usedDaysPer30 } from '../utils/energy-utils'
import { photoToJpegDataUrl } from '../utils/image'

const categories = ['All appliances', 'Refrigerator', 'Electric fan', 'Air conditioner', 'Rice cooker', 'Television', 'Washing machine', 'Other']
const icons = { Refrigerator, 'Electric fan': Fan, 'Air conditioner': AirVent, 'Rice cooker': Zap, Television: Tv, 'Washing machine': WashingMachine, Other: Lightbulb }
const emptyForm = { name: '', category: 'Refrigerator', watts: '', hours: '', pattern: 'Daily', brand: '', model: '' }

function ApplianceModal({ appliance, onClose, onSave, rate }) {
  const [form, setForm] = useState(appliance ? { ...appliance } : emptyForm)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState('')
  const [file, setFile] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState(null)
  const inputRef = useRef(null)
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo) }, [photo])

  async function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return setError('Enter an appliance name.')
    if (!form.watts || !Number.isFinite(Number(form.watts)) || Number(form.watts) <= 0) return setError('Rated watts must be a number greater than zero.')
    if (!form.hours || !Number.isFinite(Number(form.hours)) || Number(form.hours) <= 0 || Number(form.hours) > 24) return setError('Hours used must be between 0 and 24.')
    const success = await onSave({ ...form, name: form.name.trim(), watts: Number(form.watts), hours: Number(form.hours) })
    if (!success) setError('The appliance was not saved. Check the local server connection and try again.')
  }
  const change = event => { setError(''); setForm({ ...form, [event.target.name]: event.target.value }) }
  function choosePhoto(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Choose an image file.')
    if (file.size > 10 * 1024 * 1024) return setError('Choose an image smaller than 10 MB.')
    if (photo) URL.revokeObjectURL(photo)
    setPhoto(URL.createObjectURL(file))
    setFile(file)
    setScan(null)
    setError('')
  }

  function removePhoto() {
    if (photo) URL.revokeObjectURL(photo)
    setPhoto('')
    setFile(null)
    setScan(null)
  }

  // Reads the label on this device, fills the fields it found, and leaves everything editable.
  async function readLabel() {
    if (!file || scanning) return
    setScanning(true)
    setError('')
    setScan(null)
    try {
      const { readApplianceLabelOnDevice } = await import('../utils/offline-ocr.js')
      const found = await readApplianceLabelOnDevice(await photoToJpegDataUrl(file, 2000, 0.92))
      setForm(current => ({
        ...current,
        watts: found.watts ?? current.watts,
        brand: current.brand || found.brand || '',
        model: current.model || found.model || '',
      }))
      setScan(found)
    } catch (failure) {
      setError(failure.message || 'Could not read this label. Type the details in.')
    } finally {
      setScanning(false)
    }
  }

  const previewDaily = Number(form.watts) > 0 && Number(form.hours) > 0 ? estimateDailyKwh(form) : null
  const previewDays = usedDaysPer30(form.pattern)
  const previewMonth = previewDaily !== null ? previewDaily * previewDays : null
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="confirm-modal appliance-modal" role="dialog" aria-modal="true" aria-labelledby="appliance-modal-title">
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        <p className="eyebrow">APPLIANCE PROFILE</p><h2 id="appliance-modal-title">{appliance ? 'Edit appliance' : 'Add an appliance'}</h2><p>Add the details from your appliance label. Energy use is estimated from rated watts.</p>
        <form onSubmit={submit} className="appliance-form" noValidate>
          <div className="field-group"><label htmlFor="appliance-name">Appliance name <span className="required">*</span></label><input id="appliance-name" name="name" maxLength={100} value={form.name} onChange={change} placeholder="e.g. Kitchen refrigerator" /></div>
          <div className="field-grid"><div className="field-group"><label htmlFor="appliance-category">Category</label><select id="appliance-category" name="category" value={form.category} onChange={change}>{categories.slice(1).map(category => <option key={category}>{category}</option>)}</select></div><div className="field-group"><label htmlFor="appliance-watts">Rated power <span className="required">*</span></label><div className="input-with-unit"><input id="appliance-watts" name="watts" type="number" min="1" max="100000" value={form.watts} onChange={change} placeholder="e.g. 150" /><span>W</span></div></div></div>
          <div className="field-grid"><div className="field-group"><label htmlFor="appliance-hours">Hours used per day <span className="required">*</span></label><div className="input-with-unit"><input id="appliance-hours" name="hours" type="number" min="0.1" max="24" step="0.1" value={form.hours} onChange={change} placeholder="e.g. 8" /><span>hrs</span></div></div><div className="field-group"><label htmlFor="appliance-pattern">Usage pattern</label><select id="appliance-pattern" name="pattern" value={form.pattern || 'Daily'} onChange={change}>{['Daily', 'Weekdays', 'Weekends', 'Occasional'].map(pattern => <option key={pattern}>{pattern}</option>)}</select></div></div>
          <div className="field-grid"><div className="field-group"><label htmlFor="appliance-brand">Brand <span className="optional">(optional)</span></label><input id="appliance-brand" name="brand" maxLength={100} value={form.brand || ''} onChange={change} placeholder="Brand name" /></div><div className="field-group"><label htmlFor="appliance-model">Model <span className="optional">(optional)</span></label><input id="appliance-model" name="model" maxLength={100} value={form.model || ''} onChange={change} placeholder="Model number" /></div></div>
          <label className="field-label" htmlFor="appliance-label-photo">Rating label photo <span className="optional">(optional · read on this device)</span></label>
          {photo && <div className="label-photo-preview"><img src={photo} alt="Appliance rating label preview" /><button type="button" className="button button-secondary button-small" onClick={removePhoto}>Remove photo</button></div>}
          <label className="mini-upload" htmlFor="appliance-label-photo"><input ref={inputRef} id="appliance-label-photo" type="file" accept="image/*" capture="environment" onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} /><span><Plus size={15} /> {photo ? 'Choose a different label photo' : 'Take or choose a label photo'}</span><small>Fields stay editable</small></label>
          {photo && <button className="button button-secondary button-small" type="button" onClick={readLabel} disabled={scanning}><ScanLine size={15} /> {scanning ? 'Reading label…' : 'Read specifications from photo'}</button>}
          {scan && (
            <p className="photo-note"><Check size={14} /><span>
              {scan.watts ? <>Suggested <strong>{scan.watts} W</strong> from the label. </> : <>No explicit wattage found; enter the rated watts manually{scan.amps ? ` (the label also shows ${scan.amps} A${scan.volts ? ` at ${scan.volts} V` : ''})` : ''}. </>}
              {scan.otherWatts?.length ? `Other values seen: ${scan.otherWatts.join(', ')} W. ` : ''}
              Check every field against your photo. A label shows the maximum rating, not real use.
            </span></p>
          )}
          <div className="reading-preview appliance-preview">
            <span>Per day of use</span><strong>{previewDaily !== null ? `${previewDaily.toFixed(2)} kWh` : '—'}</strong>
            <span>Per 30 days</span><strong>{previewMonth !== null ? `${previewMonth.toFixed(1)} kWh` : '—'}</strong>
            <span>Est. monthly cost</span><strong>{previewMonth !== null ? formatPeso(previewMonth * rate) : '—'}</strong>
          </div>
          <p className="muted-copy"><Info size={14} /> Estimate = watts × hours per day ÷ 1000, times the days it runs ({previewDays % 1 ? previewDays.toFixed(1) : previewDays} of 30 for “{form.pattern || 'Daily'}”), at ₱{Number(rate).toFixed(2)}/kWh. Enter the hours you actually use it.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Plus size={15} /> {appliance ? 'Save changes' : 'Add appliance'}</button></div>
        </form>
      </section>
    </div>
  )
}

function MeterComparison({ meter, listDaily, rate }) {
  if (!meter) {
    return <p className="meter-compare"><Gauge size={16} /><span>Save meter readings about a day apart to compare this estimate with what your meter actually records.</span></p>
  }
  const ratio = listDaily / meter.perDay
  const verdict = ratio > 1.2
    ? 'Your list is higher than the meter: refrigerators and aircons switch on and off, so they rarely use their full rated watts for all the hours entered.'
    : ratio < 0.8
      ? 'Your list is lower than the meter: the rest is likely appliances not listed yet, like lights, chargers or a water pump.'
      : 'Your list and your meter roughly match.'
  return (
    <p className="meter-compare"><Gauge size={16} /><span>
      <strong>Meter check:</strong> since {formatDate(meter.from)} your meter recorded about <strong>{meter.perDay.toFixed(1)} kWh/day</strong> ({formatPeso(meter.perDay * 30 * rate)} for 30 days). Your appliance list adds up to <strong>{listDaily.toFixed(1)} kWh/day</strong>. {verdict}
    </span></p>
  )
}

export function AppliancesPage({ appliances, readings = [], onAdd, onUpdate, onDelete, rate, onToast }) {
  const [filter, setFilter] = useState('All appliances')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const shown = useMemo(() => appliances.filter(item => (filter === 'All appliances' || item.category === filter) && `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [appliances, filter, search])
const totalMonth = shown.reduce((sum, appliance) => sum + applianceMonthKwh(appliance), 0)
const totalDaily = shown.reduce((sum, appliance) => sum + applianceAverageDailyKwh(appliance), 0)
const listDaily = appliances.reduce((sum, appliance) => sum + applianceAverageDailyKwh(appliance), 0)
  const meter = meterDailyUse(readings, new Date(Date.now() - 30 * 86400000))

  async function save(item) {
    const editing = Boolean(modal?.id)
    const saved = editing ? await onUpdate(item) : await onAdd(item)
    if (!saved) return false
    setModal(undefined)
    onToast(editing ? 'Appliance updated in your local database.' : 'Appliance saved in your local database.')
    return true
  }

  async function removeAppliance() {
    if (await onDelete(deleteTarget.id)) onToast('Appliance deleted from the local database.')
    setDeleteTarget(null)
  }

  return (
    <>
      <PageTitle eyebrow="YOUR HOUSEHOLD" title="My appliances" description="Keep a household inventory and estimate energy use from each rating label." action={<button className="button button-primary" onClick={() => setModal(null)}><Plus size={17} /> Add appliance</button>} />
      <div className="demo-banner"><Zap size={16} /><span><strong>Label estimates.</strong> Rated watts × the hours you entered, as if each appliance ran at full power the whole time. Your real use comes from your meter readings.</span></div>
      <div className="appliance-overview"><div><span>REGISTERED APPLIANCES</span><strong>{appliances.length}</strong></div><i /><div><span>LABEL ESTIMATE / DAY (AVERAGE)</span><strong>{totalDaily.toFixed(1)} <small>kWh/day</small></strong></div><i /><div><span>LABEL ESTIMATE / 30 DAYS</span><strong>{formatPeso(totalMonth * rate)} <small>/ month</small></strong></div></div>
      {appliances.length > 0 && <MeterComparison meter={meter} listDaily={listDaily} rate={rate} />}
      <section className="panel appliances-panel">
        <div className="appliances-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter by appliance category">
            {categories.map(category => <button key={category} onClick={() => setFilter(category)} className={filter === category ? 'filter-active' : ''} aria-pressed={filter === category}>{category}</button>)}
          </div>
          <label className="search-input"><Search size={16} /><input aria-label="Search appliances" placeholder="Search appliances" value={search} onChange={event => setSearch(event.target.value)} /></label>
        </div>
        {shown.length ? (
          <div className="appliance-grid">
            {shown.map(appliance => {
              const Icon = icons[appliance.category] || Lightbulb
              const daily = estimateDailyKwh(appliance)
              const month = applianceMonthKwh(appliance)
              const usedDays = usedDaysPer30(appliance.pattern)
              return (
                <article className="appliance-card" key={appliance.id}>
                  <div className="appliance-card-top">
                    <span className={`appliance-icon appliance-${appliance.category.toLowerCase().replaceAll(' ', '-')}`}><Icon size={19} /></span>
                    <span className={`badge ${appliance.isSample ? 'badge-demo' : 'badge-success'}`}>{appliance.isSample ? 'SAMPLE' : 'LOCAL'}</span>
                    <div className="card-menu">
                      <button className="icon-button" onClick={() => setModal(appliance)} aria-label={`Edit ${appliance.name}`}><Pencil size={15} /></button>
                      <button className="icon-button" onClick={() => setDeleteTarget(appliance)} aria-label={`Delete ${appliance.name}`}><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <span className="appliance-category">{appliance.category}</span>
                  <h3>{appliance.name}</h3>
                  <p>{appliance.brand || (appliance.isSample ? 'Sample appliance' : 'No brand entered')}{appliance.model ? ` · ${appliance.model}` : ''}</p>
                  <div className="appliance-details"><span><Zap size={14} /> {appliance.watts} W rated</span><span>{appliance.hours} hrs/day · {appliance.pattern || 'Daily'}</span></div>
                  <div className="appliance-estimate"><div><span>Estimated energy</span><strong>{daily.toFixed(2)} <small>kWh/day of use</small></strong><span className="appliance-cost">≈ {month.toFixed(1)} kWh · {formatPeso(month * rate)} / 30 days{usedDays !== 30 ? ` (${usedDays % 1 ? usedDays.toFixed(1) : usedDays} days of use)` : ''}</span></div><div className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></div></div>
                </article>
              )
            })}
          </div>
        ) : <EmptyState title={search || filter !== 'All appliances' ? 'No matching appliances' : 'No appliances yet'} description={search || filter !== 'All appliances' ? 'Try another search or category.' : 'Add an appliance to start estimating household energy use.'} action={<button className="button button-primary" onClick={() => setModal(null)}><Plus size={16} /> Add appliance</button>} />}
      </section>
      {modal !== undefined && <ApplianceModal appliance={modal || undefined} onClose={() => setModal(undefined)} onSave={save} rate={rate} />}
      {deleteTarget && <ConfirmModal title={`Delete ${deleteTarget.name}?`} description="This appliance profile will be removed from the local database. This action cannot be undone." confirmLabel="Delete appliance" danger onConfirm={removeAppliance} onCancel={() => setDeleteTarget(null)} />}
    </>
  )
}