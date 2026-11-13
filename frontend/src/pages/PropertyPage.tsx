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
import { Icon, amenityIcon } from '../components/Icon'
import { Scenery } from '../components/Photos'
import { addDays, inr, prettyDate, priceRange, slotLabel, todayInIndia } from '../format'

const CALENDAR_DAYS = 120

export function PropertyPage() {
  const { slug = '' } = useParams()
  const [params] = useSearchParams()
  const [property, setProperty] = useState<PublicProperty | null>(null)
  const [blocked, setBlocked] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    getProperty(slug)
      .then((p) => current && setProperty(p))
      .catch(
        (e: ApiError) =>
          current && setLoadError(e.status === 404 ? 'This farmhouse is not listed right now.' : e.message),
      )
    const today = todayInIndia()
    getBlockedDates(slug, today, addDays(today, CALENDAR_DAYS))
      .then((days) => current && setBlocked(new Set(days)))
      .catch(() => current && setBlocked(new Set()))
    return () => {
      current = false
    }
  }, [slug])

  if (loadError) {
    return (
      <div className="container empty">
        <h1>{loadError}</h1>
        <Link to="/" className="btn btn-dark">
          See all farmhouses
        </Link>
      </div>
    )
  }
  if (!property) {
    return (
      <div className="container listing">
        <div className="sk-line wide" />
        <div className="gallery skeleton-block" />
      </div>
    )
  }

  const p = property
  const dayUse = priceRange(p.dayUsePriceMin, p.dayUsePriceMax)
  const night = priceRange(p.nightPriceMin, p.nightPriceMax)
  const photos = p.photoUrls.slice(0, 5)

  return (
    <div className="container listing">
      <Link to="/" className="back">
        <Icon name="left" size={16} /> All farmhouses
      </Link>
      <h1 className="listing-title">{p.name}</h1>
      <p className="listing-sub">
        <Icon name="pin" size={16} /> {p.area}, Delhi NCR
        {p.verified && (
          <>
            <span className="dot-sep">·</span>
            <span className="verified">
              <Icon name="shield" size={16} /> Verified by our team
            </span>
          </>
        )}
      </p>

      <div className={`gallery gallery-${Math.min(Math.max(photos.length, 1), 5)}`}>
        {photos.length === 0 ? (
          <Scenery seed={p.slug} />
        ) : (
          photos.map((url, i) => <img key={url} src={url} alt={`${p.name} photo ${i + 1}`} className={`g${i}`} />)
        )}
      </div>

      <div className="listing-grid">
        <div className="listing-main">
          <div className="host-row">
            <div>
              <h2>Farmhouse in {p.area}</h2>
              <p className="muted">
                Up to {p.maxGuests} guests
                {p.bedrooms > 0 && ` · ${p.bedrooms} ${p.bedrooms === 1 ? 'room' : 'rooms'}`}
                {p.hasPool && ' · private pool'}
              </p>
            </div>
            <div className="avatar" aria-hidden="true">
              {p.hostFirstName.slice(0, 1).toUpperCase()}
            </div>
          </div>

          <ul className="highlights">
            <li>
              <Icon name="chat" size={24} />
              <div>
                <strong>Hosted by {p.hostFirstName}</strong>
                <span className="muted">Message or call {p.hostFirstName} directly from this page.</span>
              </div>
            </li>
            {p.verified && (
              <li>
                <Icon name="shield" size={24} />
                <div>
                  <strong>Visited by our team</strong>
                  <span className="muted">We checked the property and the owner before listing it.</span>
                </div>
              </li>
            )}
            <li>
              <Icon name="percent" size={24} />
              <div>
                <strong>No booking fee</strong>
                <span className="muted">You pay the host’s own price. We take no commission.</span>
              </div>
            </li>
          </ul>

          {p.description && (
            <section className="section">
              <h2>About this farmhouse</h2>
              <p className="prewrap">{p.description}</p>
            </section>
          )}

          {p.amenities.length > 0 && (
            <section className="section">
              <h2>What this place offers</h2>
              <ul className="amenities">
                {p.amenities.map((a) => (
                  <li key={a}>
                    <Icon name={amenityIcon(a)} size={24} />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="section">
            <h2>Prices</h2>
            <div className="price-table">
              {dayUse && (
                <div>
                  <Icon name="sun" size={22} />
                  <span>Day-use</span>
                  <strong>{dayUse}</strong>
                </div>
              )}
              {night && (
                <div>
                  <Icon name="moon" size={22} />
                  <span>Per night</span>
                  <strong>{night}</strong>
                </div>
              )}
            </div>
            <p className="muted small">The final price depends on the date and group size. Agree it with the host.</p>
          </section>

          {p.houseRules && (
            <section className="section">
              <h2>House rules</h2>
              <p className="prewrap">{p.houseRules}</p>
            </section>
          )}

          <section className="section safety">
            <Icon name="info" size={22} />
            <p>
              Bookings made by calling or messaging the host are agreed directly between you and the host. Visit or
              video-call the farmhouse before paying any advance.
            </p>
          </section>
        </div>

        <EnquiryCard
          property={p}
          blocked={blocked}
          initialDate={params.get('date') ?? ''}
          initialGuests={params.get('guests') ?? ''}
        />
      </div>

      <div className="mobile-bar">
        <div>
          <strong>{p.dayUsePriceMin != null ? inr(p.dayUsePriceMin) : p.nightPriceMin != null ? inr(p.nightPriceMin) : ''}</strong>
          <span className="muted"> {p.dayUsePriceMin != null ? 'day-use' : 'night'}</span>
          <div className="muted small">No booking fee</div>
        </div>
        <a href="#enquiry" className="btn btn-brand">
          Ask the host
        </a>
      </div>
    </div>
  )
}

function EnquiryCard({
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

  const headline =
    slot === 'NIGHT' && property.nightPriceMin != null
      ? { amount: inr(property.nightPriceMin), unit: 'night' }
      : property.dayUsePriceMin != null
        ? { amount: inr(property.dayUsePriceMin), unit: 'day-use' }
        : property.nightPriceMin != null
          ? { amount: inr(property.nightPriceMin), unit: 'night' }
          : null

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
    <aside className="enquiry" id="enquiry">
      {headline && (
        <p className="enquiry-price">
          <span className="from">from</span> <strong>{headline.amount}</strong> <span className="muted">{headline.unit}</span>
        </p>
      )}

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

      <div className="field-box">
        <div className="field-row">
          <label className="fb-field">
            <span>{slot === 'NIGHT' ? 'Check-in' : 'Date'}</span>
            <input type="date" min={todayInIndia()} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {slot === 'NIGHT' && (
            <label className="fb-field">
              <span>Nights</span>
              <select value={nights} onChange={(e) => setNights(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="fb-field">
          <span>Guests · max {property.maxGuests}</span>
          <input
            type="number"
            min={1}
            max={property.maxGuests}
            placeholder="How many?"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </label>
        <label className="fb-field">
          <span>Your name</span>
          <input
            value={name}
            maxLength={100}
            placeholder="So the host knows who’s asking"
            onChange={(e) => setName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
      </div>

      {clash && <p className="alert alert-warn">The host has marked {prettyDate(clash)} as booked. Try another date.</p>}
      {error && <p className="alert alert-error">{error}</p>}

      <button
        type="button"
        className="btn btn-brand btn-block btn-lg"
        disabled={sending !== null || clash !== null}
        onClick={() => contact('WHATSAPP')}
      >
        <Icon name="chat" size={18} />
        {sending === 'WHATSAPP' ? 'Opening WhatsApp…' : 'WhatsApp the host'}
      </button>
      <button
        type="button"
        className="btn btn-outline btn-block"
        disabled={sending !== null || clash !== null}
        onClick={() => contact('CALL')}
      >
        <Icon name="phone" size={18} />
        {sending === 'CALL' ? 'Connecting…' : 'Call the host'}
      </button>
      <p className="muted small center">You won’t be charged anything by us.</p>

      {sent && (
        <p className="alert alert-ok">
          Enquiry <strong>{sent.reference}</strong> sent. If WhatsApp did not open, <a href={sent.contactUrl}>tap here</a>.
        </p>
      )}
    </aside>
  )
}
