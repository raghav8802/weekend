import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  adminCheck,
  adminCreate,
  adminLeads,
  adminList,
  adminRotateLink,
  adminSetStatus,
  adminUpdate,
  type AdminProperty,
  type Lead,
  type PropertyForm,
  type PropertyStatus,
} from '../api'
import { prettyDate, prettyDateTime, slotLabel } from '../format'

const AUTH_KEY = 'weekend-admin-auth'

function readAuth(): string | null {
  try {
    return sessionStorage.getItem(AUTH_KEY)
  } catch {
    return null
  }
}

/** Team-only page: add and verify farmhouses, send hosts their link, watch leads come in. */
export function AdminPage() {
  const [auth, setAuth] = useState<string | null>(readAuth)

  function logout() {
    try {
      sessionStorage.removeItem(AUTH_KEY)
    } catch {
      // ignore
    }
    setAuth(null)
  }

  if (!auth) return <Login onLogin={setAuth} />
  return <Dashboard auth={auth} onLogout={logout} />
}

function Login({ onLogin }: { onLogin: (auth: string) => void }) {
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const auth = btoa(`${form.get('username')}:${form.get('password')}`)
    try {
      await adminCheck(auth)
      try {
        sessionStorage.setItem(AUTH_KEY, auth)
      } catch {
        // Private mode: stay logged in for this page only.
      }
      onLogin(auth)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong username or password' : 'Could not log in')
    }
  }

  return (
    <form className="panel login" onSubmit={submit}>
      <h1>Team login</h1>
      <label>
        Username
        <input name="username" required autoComplete="username" />
      </label>
      <label>
        Password
        <input name="password" type="password" required autoComplete="current-password" />
      </label>
      {error && <p className="alert alert-error">{error}</p>}
      <button className="btn btn-brand" type="submit">
        Log in
      </button>
    </form>
  )
}

function Dashboard({ auth, onLogout }: { auth: string; onLogout: () => void }) {
  const [tab, setTab] = useState<'farmhouses' | 'leads'>('farmhouses')
  const [properties, setProperties] = useState<AdminProperty[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState<AdminProperty | 'new' | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handle = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onLogout()
      else setMessage(e instanceof Error ? e.message : 'Something went wrong')
    },
    [onLogout],
  )

  const load = useCallback(() => {
    Promise.all([adminList(auth), adminLeads(auth)])
      .then(([p, l]) => {
        setProperties(p)
        setLeads(l)
        setLoaded(true)
      })
      .catch(handle)
  }, [auth, handle])

  useEffect(load, [load])

  const names = useMemo(() => new Map(properties.map((p) => [p.id, p.name])), [properties])

  async function setStatus(p: AdminProperty, status: PropertyStatus) {
    try {
      await adminSetStatus(auth, p.id, status)
      setMessage(`${p.name} is now ${status.toLowerCase()}.`)
      load()
    } catch (e) {
      handle(e)
    }
  }

  async function copyHostLink(p: AdminProperty) {
    const url = `${window.location.origin}/host/${p.hostToken}`
    try {
      await navigator.clipboard.writeText(url)
      setMessage(`Host link for ${p.name} copied. Send it to ${p.hostName} on WhatsApp.`)
    } catch {
      window.prompt('Copy the host link', url)
    }
  }

  async function rotate(p: AdminProperty) {
    if (!window.confirm(`Make a new host link for ${p.name}? The old link stops working.`)) return
    try {
      await adminRotateLink(auth, p.id)
      setMessage('New host link created. Copy it and send it to the host.')
      load()
    } catch (e) {
      handle(e)
    }
  }

  if (editing) {
    return (
      <PropertyEditor
        auth={auth}
        existing={editing === 'new' ? null : editing}
        onDone={(saved) => {
          setEditing(null)
          if (saved) setMessage(`Saved ${saved.name}.`)
          load()
        }}
        onAuthError={onLogout}
      />
    )
  }

  return (
    <div className="container staff admin">
      <div className="row space-between">
        <div className="segmented">
          <button type="button" className={tab === 'farmhouses' ? 'active' : ''} onClick={() => setTab('farmhouses')}>
            Farmhouses{loaded ? ` (${properties.length})` : ''}
          </button>
          <button type="button" className={tab === 'leads' ? 'active' : ''} onClick={() => setTab('leads')}>
            Leads{loaded ? ` (${leads.length})` : ''}
          </button>
        </div>
        <div className="row">
          {tab === 'farmhouses' && (
            <button type="button" className="btn btn-brand" onClick={() => setEditing('new')}>
              Add farmhouse
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      {message && <p className="alert alert-ok">{message}</p>}

      {tab === 'farmhouses' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Farmhouse</th>
                <th>Host</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.status === 'LIVE' ? (
                      <a href={`/farmhouse/${p.slug}`} target="_blank" rel="noreferrer">
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                    <div className="muted small">
                      {p.area} · {p.maxGuests} guests
                    </div>
                  </td>
                  <td>
                    {p.hostName}
                    <div className="muted small mono">+{p.hostPhone}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.status === 'LIVE' ? '' : 'badge-warn'}`}>{p.status}</span>
                  </td>
                  <td>
                    <div className="row wrap-row">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(p)}>
                        Edit
                      </button>
                      {p.status === 'LIVE' ? (
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setStatus(p, 'PAUSED')}>
                          Pause
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-dark" onClick={() => setStatus(p, 'LIVE')}>
                          Verified · go live
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => copyHostLink(p)}>
                        Copy host link
                      </button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => rotate(p)}>
                        New link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    {loaded ? 'No farmhouses yet. Add the first one after the property visit.' : 'Loading…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Received</th>
                <th>Farmhouse</th>
                <th>Guest</th>
                <th>For</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="small">
                    {prettyDateTime(l.createdAt)}
                    <div className="muted mono">{l.reference}</div>
                  </td>
                  <td>{names.get(l.propertyId) ?? '—'}</td>
                  <td>
                    {l.guestName}
                    <div className="muted small">
                      {l.guests} guests · {l.channel === 'WHATSAPP' ? 'WhatsApp' : 'Call'}
                    </div>
                  </td>
                  <td>
                    {slotLabel[l.slotType]}
                    <div className="muted small">
                      {prettyDate(l.eventDate)}
                      {l.nights > 1 ? ` · ${l.nights} nights` : ''}
                    </div>
                  </td>
                  <td>{l.status.replace('_', ' ').toLowerCase()}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    {loaded ? 'No leads yet.' : 'Loading…'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface Draft {
  name: string
  area: string
  address: string
  latitude: string
  longitude: string
  description: string
  houseRules: string
  maxGuests: string
  bedrooms: string
  hasPool: boolean
  amenities: string
  photoUrls: string
  dayUsePriceMin: string
  dayUsePriceMax: string
  nightPriceMin: string
  nightPriceMax: string
  hostName: string
  hostPhone: string
}

const str = (n?: number) => (n == null ? '' : String(n))
const num = (s: string) => (s.trim() === '' ? undefined : Number(s))

function toDraft(p: AdminProperty | null): Draft {
  return {
    name: p?.name ?? '',
    area: p?.area ?? '',
    address: p?.address ?? '',
    latitude: str(p?.latitude),
    longitude: str(p?.longitude),
    description: p?.description ?? '',
    houseRules: p?.houseRules ?? 'Music off by 10 PM. No outside DJ without the host’s permission.',
    maxGuests: str(p?.maxGuests),
    bedrooms: str(p?.bedrooms ?? 0),
    hasPool: p?.hasPool ?? false,
    amenities: p?.amenities.join(', ') ?? '',
    photoUrls: p?.photoUrls.join('\n') ?? '',
    dayUsePriceMin: str(p?.dayUsePriceMin),
    dayUsePriceMax: str(p?.dayUsePriceMax),
    nightPriceMin: str(p?.nightPriceMin),
    nightPriceMax: str(p?.nightPriceMax),
    hostName: p?.hostName ?? '',
    hostPhone: p ? `+${p.hostPhone}` : '',
  }
}

function fromDraft(d: Draft): PropertyForm {
  return {
    name: d.name,
    area: d.area,
    address: d.address,
    latitude: num(d.latitude),
    longitude: num(d.longitude),
    description: d.description,
    houseRules: d.houseRules,
    maxGuests: Number(d.maxGuests),
    bedrooms: Number(d.bedrooms || 0),
    hasPool: d.hasPool,
    amenities: d.amenities.split(',').map((s) => s.trim()).filter(Boolean),
    photoUrls: d.photoUrls.split('\n').map((s) => s.trim()).filter(Boolean),
    dayUsePriceMin: num(d.dayUsePriceMin),
    dayUsePriceMax: num(d.dayUsePriceMax),
    nightPriceMin: num(d.nightPriceMin),
    nightPriceMax: num(d.nightPriceMax),
    hostName: d.hostName,
    hostPhone: d.hostPhone,
  }
}

function PropertyEditor({
  auth,
  existing,
  onDone,
  onAuthError,
}: {
  auth: string
  existing: AdminProperty | null
  onDone: (saved: AdminProperty | null) => void
  onAuthError: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(existing))
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft({ ...draft, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setFields({})
    try {
      const form = fromDraft(draft)
      const saved = existing ? await adminUpdate(auth, existing.id, form) : await adminCreate(auth, form)
      onDone(saved)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onAuthError()
      setError(err instanceof Error ? err.message : 'Could not save')
      if (err instanceof ApiError && err.fields) setFields(err.fields)
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>
      {label}
      <input value={draft[key] as string} onChange={set(key)} {...props} />
      {fields[key] && <span className="field-error">{fields[key]}</span>}
    </label>
  )

  return (
    <form className="container staff editor" onSubmit={save}>
      <h1>{existing ? `Edit ${existing.name}` : 'Add a farmhouse'}</h1>
      {!existing && (
        <p className="muted small">New farmhouses stay hidden until you mark them verified after the visit.</p>
      )}

      <fieldset>
        <legend>Listing</legend>
        {field('name', 'Farmhouse name', { required: true, maxLength: 150 })}
        {field('area', 'Area (e.g. Chhattarpur, Sohna Road)', { required: true, maxLength: 80 })}
        {field('address', 'Full address (team only)', { required: true, maxLength: 500 })}
        <div className="two">
          {field('latitude', 'Latitude', { inputMode: 'decimal' })}
          {field('longitude', 'Longitude', { inputMode: 'decimal' })}
        </div>
        <div className="two">
          {field('maxGuests', 'Max guests', { required: true, type: 'number', min: 1 })}
          {field('bedrooms', 'Rooms', { type: 'number', min: 0 })}
        </div>
        <label className="check">
          <input type="checkbox" checked={draft.hasPool} onChange={set('hasPool')} /> Has a pool
        </label>
        {field('amenities', 'Amenities, separated by commas', { placeholder: 'Pool, Lawn, Power backup, Parking' })}
        <label>
          Description
          <textarea rows={4} value={draft.description} onChange={set('description')} maxLength={5000} />
        </label>
        <label>
          House rules
          <textarea rows={3} value={draft.houseRules} onChange={set('houseRules')} maxLength={3000} />
        </label>
        <label>
          Photo links, one per line (https://…)
          <textarea rows={4} value={draft.photoUrls} onChange={set('photoUrls')} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Prices in ₹ (give at least one)</legend>
        <div className="two">
          {field('dayUsePriceMin', 'Day-use from', { type: 'number', min: 1 })}
          {field('dayUsePriceMax', 'Day-use up to', { type: 'number', min: 1 })}
        </div>
        <div className="two">
          {field('nightPriceMin', 'Night from', { type: 'number', min: 1 })}
          {field('nightPriceMax', 'Night up to', { type: 'number', min: 1 })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Who answers enquiries</legend>
        <p className="muted small">The owner or the manager they named. Guests reach this number on WhatsApp.</p>
        {field('hostName', 'Name', { required: true, maxLength: 120 })}
        {field('hostPhone', 'Mobile number', { required: true, inputMode: 'tel', placeholder: '+91 98xxx xxxxx' })}
      </fieldset>

      {error && <p className="alert alert-error">{error}</p>}
      {Object.entries(fields)
        .filter(([k]) => !(k in draft))
        .map(([k, v]) => (
          <p key={k} className="alert alert-error">
            {v}
          </p>
        ))}

      <div className="row">
        <button type="submit" className="btn btn-brand" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
