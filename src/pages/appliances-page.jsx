import { useEffect, useMemo, useRef, useState } from 'react'
import { AirVent, Check, Fan, Lightbulb, Pencil, Plus, Refrigerator, ScanLine, Search, Tv, WashingMachine, X, Zap, Trash2 } from 'lucide-react'
import { api } from '../api'
import { ConfirmModal } from '../components/confirm-modal'
import { EmptyState } from '../components/empty-state'
import { PageTitle } from '../components/page-title'
import { formatPeso } from '../utils/energy-utils'
import { photoToJpegDataUrl } from '../utils/image'

const categories = ['All appliances', 'Refrigerator', 'Electric fan', 'Air conditioner', 'Rice cooker', 'Television', 'Washing machine', 'Other']
const icons = { Refrigerator, 'Electric fan': Fan, 'Air conditioner': AirVent, 'Rice cooker': Zap, Television: Tv, 'Washing machine': WashingMachine, Other: Lightbulb }
const emptyForm = { name: '', category: 'Refrigerator', watts: '', hours: '', pattern: 'Daily', brand: '', model: '' }

function ApplianceModal({ appliance, onClose, onSave }) {
  const [form, setForm] = useState(appliance ? { ...appliance } : emptyForm)
  const [error, setError] = useState('')
  const [photo, setPhoto] = useState('')
  const [reading, setReading] = useState(false)
  const [labelNote, setLabelNote] = useState('')
  const [labelError, setLabelError] = useState('')
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
    readLabel(file)
  }
  // Fills the form from the label photo (local vision model, or on-device OCR without the server). Typed values are kept.
  async function readLabel(file) {
    setReading(true)
    setLabelNote('')
    setLabelError('')
    try {
      const found = await api.post('/appliances/read-label', { image: await photoToJpegDataUrl(file) })
      setForm(current => ({
        ...current,
        name: current.name.trim() ? current.name : found.name,
        category: current.name.trim() && found.category === 'Other' ? current.category : found.category,
        watts: found.watts ? String(found.watts) : current.watts,
        brand: found.brand || current.brand || '',
        model: found.model || current.model || '',
      }))
      const parts = [found.watts && `${found.watts} W`, found.brand, found.model && `model ${found.model}`].filter(Boolean)
      setLabelNote(`Filled in ${parts.join(', ')} from the label (${found.engine}). Check the details and add the hours used before saving.`)
    } catch (failure) {
      setLabelError(failure.message || 'Could not read this label. Please type the details manually.')
    } finally {
      setReading(false)
    }
  }
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
          <label className="field-label" htmlFor="appliance-label-photo">Rating label photo <span className="optional">(optional · fills in the details)</span></label>
          {photo && <div className="label-photo-preview"><img src={photo} alt="Appliance rating label preview" /><button type="button" className="button button-secondary button-small" onClick={() => { URL.revokeObjectURL(photo); setPhoto(''); setLabelNote(''); setLabelError('') }}>Remove photo</button></div>}
          <label className="mini-upload" htmlFor="appliance-label-photo"><input ref={inputRef} id="appliance-label-photo" type="file" accept="image/*" capture="environment" onChange={event => { choosePhoto(event.target.files?.[0]); event.target.value = '' }} /><span><Plus size={15} /> {photo ? 'Choose a different label photo' : 'Take or choose a label photo'}</span><small>{reading ? <><ScanLine size={13} /> Reading label…</> : 'Reads watts, brand and model'}</small></label>
          {labelNote && <p className="photo-note"><Check size={14} /> {labelNote}</p>}
          {labelError && <p className="form-error" role="alert">{labelError}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary"><Plus size={15} /> {appliance ? 'Save changes' : 'Add appliance'}</button></div>
        </form>
      </section>
    </div>
  )
}

export function AppliancesPage({ appliances, onAdd, onUpdate, onDelete, rate, onToast }) {
  const [filter, setFilter] = useState('All appliances')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(undefined)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const shown = useMemo(() => appliances.filter(item => (filter === 'All appliances' || item.category === filter) && `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase())), [appliances, filter, search])
  const totalDaily = shown.reduce((sum, appliance) => sum + (appliance.watts * appliance.hours) / 1000, 0)

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
      <div className="demo-banner"><Zap size={16} /><span><strong>Rated-power estimates.</strong> Watts × daily hours. Actual appliance consumption may differ.</span></div>
      <div className="appliance-overview"><div><span>REGISTERED APPLIANCES</span><strong>{appliances.length}</strong></div><i /><div><span>ESTIMATED DAILY USE</span><strong>{totalDaily.toFixed(1)} <small>kWh/day</small></strong></div><i /><div><span>ESTIMATED MONTHLY COST</span><strong>{formatPeso(totalDaily * 30 * rate)} <small>/ month</small></strong></div></div>
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
              const daily = appliance.watts * appliance.hours / 1000
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
                  <div className="appliance-estimate"><div><span>Estimated energy</span><strong>{daily.toFixed(2)} <small>kWh/day</small></strong></div><div className="mini-bars"><i /><i /><i /><i /><i /><i /><i /></div></div>
                </article>
              )
            })}
          </div>
        ) : <EmptyState title={search || filter !== 'All appliances' ? 'No matching appliances' : 'No appliances yet'} description={search || filter !== 'All appliances' ? 'Try another search or category.' : 'Add an appliance to start estimating household energy use.'} action={<button className="button button-primary" onClick={() => setModal(null)}><Plus size={16} /> Add appliance</button>} />}
      </section>
      {modal !== undefined && <ApplianceModal appliance={modal || undefined} onClose={() => setModal(undefined)} onSave={save} />}
      {deleteTarget && <ConfirmModal title={`Delete ${deleteTarget.name}?`} description="This appliance profile will be removed from the local database. This action cannot be undone." confirmLabel="Delete appliance" danger onConfirm={removeAppliance} onCancel={() => setDeleteTarget(null)} />}
    </>
  )
}