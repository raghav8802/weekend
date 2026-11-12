import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ApiError,
  createLead,
  getBlockedDates,
  getProperty,
  type Channel,
  type LeadResponse,
  type PublicProperty,
  type SlotType,
} from '../api'
import { Photo } from '../components/PropertyCard'
import { addDays, prettyDate, priceRange, slotLabel, todayInIndia } from '../format'

const CALENDAR_DAYS = 120

export function PropertyPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [property, setProperty] = useState<PublicProperty | null>(null)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setProperty(null)
    setLoadError(null)
    getProperty(slug)
      .then(setProperty)
      .catch((e: ApiError) => setLoadError(e.status === 404 ? 'This farmhouse is not listed right now.' : e.message))
    const today = todayInIndia()
    getBlockedDates(slug, today, addDays(today, CALENDAR_DAYS))
      .then((days) => setBlocked(new Set(days)))
      .catch(() => setBlocked(new Set()))
  }, [slug])

  if (loadError) {
    return (
      <div className="empty">
        <h1>{loadError}</h1>
        <Link to="/">See all farmhouses</Link>
      </div>
    )
  }
  if (!property) return <p className="muted">Loading…</p>

  const p = property
  const dayUse = priceRange(p.dayUsePriceMin, p.dayUsePriceMax)
  const night = priceRange(p.nightPriceMin, p.nightPriceMax)

  return (
    <div className="listing">
      <Link to="/" className="back">
        ← All farmhouses
      </Link>
      <div className={`gallery ${p.photoUrls.length <= 1 ? 'gallery-single' : ''}`}>
        {p.photoUrls.length === 0 && <Photo alt={p.name} className="gallery-main" />}
        {p.photoUrls.slice(0, 5).map((url, i) => (
          <Photo key={url} url={url} alt={`${p.name} photo ${i + 1}`} className={i === 0 ? 'gallery-main' : ''} />
        ))}
      </div>

      <div className="listing-grid">
        <div>
          <div className="card-title">
            <h1>{p.name}</h1>
            {p.verified && <span className="badge">Verified by our team</span>}
          </div>
          <p className="muted">
            {p.area} · up to {p.maxGuests} guests · {p.bedrooms} {p.bedrooms === 1 ? 'room' : 'rooms'}
            {p.hasPool ? ' · pool' : ''} · host {p.hostFirstName}
          </p>

          <div className="prices">
            {dayUse && (
              <div>
                <span className="muted">Day-use</span>
                <strong>{dayUse}</strong>
              </div>
            )}
            {night && (
              <div>
                <span className="muted">Per night</span>
                <strong>{night}</strong>
              </div>
            )}
          </div>
          <p className="muted small">Final price depends on date and group size. Agree it with the host.</p>

          {p.description && (
            <section>
              <h2>About</h2>
              <p className="prewrap">{p.description}</p>
            </section>
          )}
          {p.amenities.length > 0 && (
            <section>
              <h2>Amenities</h2>
              <ul className="chips">
                {p.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>
          )}
          {p.houseRules && (
            <section>
              <h2>House rules</h2>
              <p className="prewrap">{p.houseRules}</p>
            </section>
          )}
        </div>

        <EnquiryForm
          property={p}
          blocked={blocked}
          initialDate={params.get('date') ?? ''}
          initialGuests={params.get('guests') ?? ''}
        />
      </div>
    </div>
  )
}

function EnquiryForm({
  property,
  blocked,
  initialDate,
  initialGuests,
}: {
  property: PublicProperty
  blocked: Set<string>
  initialDate: string
  initialGuests: string
}) {
  const [slot, setSlot] = useState<SlotType>(property.dayUsePriceMin != null ? 'DAY_USE' : 'NIGHT')
  const [date, setDate] = useState(initialDate)
  const [nights, setNights] = useState(1)
  const [guests, setGuests] = useState(initialGuests)
  const [name, setName] = useState('')
  const [sending, setSending] = useState<Channel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<LeadResponse | null>(null)

  const stayDays = slot === 'NIGHT' ? nights : 1
  const clash = useMemo(() => {
    if (!date) return null
    for (let i = 0; i < stayDays; i++) {
      const d = addDays(date, i)
      if (blocked.has(d)) return d
    }
    return null
  }, [date, stayDays, blocked])

  async function contact(channel: Channel) {
    setError(null)
    if (!name.trim() || !date || !guests) {
      setError('Add your name, date and number of guests so the host can reply quickly.')
      return
    }
    setSending(channel)
    try {
      const res = await createLead(property.slug, {
        guestName: name.trim(),
        eventDate: date,
        nights: slot === 'NIGHT' ? nights : undefined,
        guests: Number(guests),
        slotType: slot,
        channel,
      })
      setSent(res)
      window.location.assign(res.contactUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSending(null)
    }
  }

  return (
    <aside className="enquiry">
      <h2>Ask the host</h2>
      <p className="muted small">Free. Your details go to {property.hostFirstName} only.</p>

      <div className="segmented" role="radiogroup" aria-label="Type of booking">
        {(['DAY_USE', 'NIGHT', 'EVENT'] as SlotType[]).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={slot === s}
            className={slot === s ? 'active' : ''}
            onClick={() => setSlot(s)}
          >
            {slotLabel[s]}
          </button>
        ))}
      </div>

      <label>
        Date
        <input type="date" min={todayInIndia()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      {slot === 'NIGHT' && (
        <label>
          Nights
          <select value={nights} onChange={(e) => setNights(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Guests (max {property.maxGuests})
        <input
          type="number"
          min={1}
          max={property.maxGuests}
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />
      </label>
      <label>
        Your name
        <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
      </label>

      {clash && <p className="warn">The host has marked {prettyDate(clash)} as booked. Try another date.</p>}
      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="btn btn-whatsapp"
        disabled={sending !== null || clash !== null}
        onClick={() => contact('WHATSAPP')}
      >
        {sending === 'WHATSAPP' ? 'Opening WhatsApp…' : 'WhatsApp the host'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={sending !== null || clash !== null}
        onClick={() => contact('CALL')}
      >
        {sending === 'CALL' ? 'Connecting…' : 'Call the host'}
      </button>

      {sent && (
        <div className="notice">
          <p>
            Your enquiry reference is <strong>{sent.reference}</strong>. If WhatsApp did not open,{' '}
            <a href={sent.contactUrl}>tap here</a>.
          </p>
        </div>
      )}
      <p className="muted small">
        Direct bookings are between you and the host and are not covered by us. Visit or video-call before paying any
        advance.
      </p>
    </aside>
  )
}
