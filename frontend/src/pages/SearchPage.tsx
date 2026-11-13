import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAreas, searchProperties, type PublicProperty } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { PropertyCard } from '../components/PropertyCard'
import { todayInIndia } from '../format'

type Filter = 'all' | 'pool' | 'dayuse' | 'overnight' | 'big' | 'events'

const filters: { id: Filter; label: string; icon: IconName; test: (p: PublicProperty) => boolean }[] = [
  { id: 'all', label: 'All', icon: 'grid', test: () => true },
  { id: 'pool', label: 'Pool', icon: 'pool', test: (p) => p.hasPool },
  { id: 'dayuse', label: 'Day-use', icon: 'sun', test: (p) => p.dayUsePriceMin != null },
  { id: 'overnight', label: 'Overnight', icon: 'moon', test: (p) => p.nightPriceMin != null },
  { id: 'big', label: '50+ guests', icon: 'users', test: (p) => p.maxGuests >= 50 },
  { id: 'events', label: 'Big events', icon: 'party', test: (p) => p.maxGuests >= 100 },
]

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [areas, setAreas] = useState<string[]>([])
  const [results, setResults] = useState<PublicProperty[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const area = params.get('area') ?? ''
  const date = params.get('date') ?? ''
  const guests = params.get('guests') ?? ''
  const nights = params.get('nights') ?? '1'
  const filter = (params.get('filter') as Filter) || 'all'

  useEffect(() => {
    getAreas().then(setAreas).catch(() => setAreas([]))
  }, [])

  useEffect(() => {
    let current = true
    searchProperties({
      area: area || undefined,
      date: date || undefined,
      guests: guests ? Number(guests) : undefined,
      nights: Number(nights) || 1,
    })
      .then((r) => {
        if (!current) return
        setResults(r)
        setError(null)
      })
      .catch((e: Error) => current && setError(e.message))
    // Ignore a slower, older search that answers after a newer one.
    return () => {
      current = false
    }
  }, [area, date, guests, nights])

  const shown = useMemo(() => {
    const f = filters.find((x) => x.id === filter) ?? filters[0]
    return results?.filter(f.test) ?? null
  }, [results, filter])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const next = new URLSearchParams()
    for (const key of ['area', 'date', 'nights', 'guests']) {
      const v = String(form.get(key) ?? '').trim()
      if (v && !(key === 'nights' && v === '1')) next.set(key, v)
    }
    if (filter !== 'all') next.set('filter', filter)
    setParams(next)
  }

  function pickFilter(id: Filter) {
    const next = new URLSearchParams(params)
    if (id === 'all') next.delete('filter')
    else next.set('filter', id)
    setParams(next, { replace: true })
  }

  // Carry the guest's date and group size onto the listing page.
  const carry = new URLSearchParams()
  if (date) carry.set('date', date)
  if (guests) carry.set('guests', guests)

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>
            Farmhouses near Delhi,
            <br /> for every celebration
          </h1>
          <p className="hero-sub">Day-outs, birthdays, New Year and weekend stays. Talk to the host directly — no booking fee.</p>

          <form className="searchbar" onSubmit={onSubmit}>
            <label className="sb-field">
              <span className="sb-label">Where</span>
              <select name="area" defaultValue={area} key={`area-${area}-${areas.length}`}>
                <option value="">All of Delhi NCR</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="sb-field">
              <span className="sb-label">When</span>
              <input type="date" name="date" min={todayInIndia()} defaultValue={date} key={`date-${date}`} />
            </label>
            <label className="sb-field">
              <span className="sb-label">How long</span>
              <select name="nights" defaultValue={nights} key={`nights-${nights}`}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Day or 1 night' : `${n} nights`}
                  </option>
                ))}
              </select>
            </label>
            <label className="sb-field">
              <span className="sb-label">Guests</span>
              <input
                type="number"
                name="guests"
                min={1}
                max={2000}
                placeholder="Add guests"
                defaultValue={guests}
                key={`guests-${guests}`}
              />
            </label>
            <button type="submit" className="sb-button" aria-label="Search">
              <Icon name="search" size={18} />
              <span>Search</span>
            </button>
          </form>
        </div>
      </section>

      <div className="filters-bar">
        <div className="container filters" role="tablist" aria-label="Filter farmhouses">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`filter ${filter === f.id ? 'active' : ''}`}
              onClick={() => pickFilter(f.id)}
            >
              <Icon name={f.icon} size={22} />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="container results">
        {error && <p className="alert alert-error">{error}</p>}
        {!error && shown === null && (
          <div className="grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card skeleton">
                <div className="card-media" />
                <div className="sk-line" />
                <div className="sk-line short" />
              </div>
            ))}
          </div>
        )}
        {shown && shown.length === 0 && (
          <div className="empty">
            <Icon name="search" size={32} />
            <h2>No farmhouses match yet</h2>
            <p className="muted">Try another date, a smaller group, another filter or all areas.</p>
          </div>
        )}
        {shown && shown.length > 0 && (
          <>
            <p className="result-count">
              {shown.length} {shown.length === 1 ? 'farmhouse' : 'farmhouses'}
              {area ? ` in ${area}` : ' across Delhi NCR'}
              {date ? ' free on your dates' : ''}
            </p>
            <div className="grid">
              {shown.map((p) => (
                <PropertyCard key={p.slug} p={p} query={carry.toString()} />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="container trust">
        <div>
          <span className="trust-icon">
            <Icon name="shield" size={22} />
          </span>
          <h3>Visited and verified</h3>
          <p className="muted">Our team visits every farmhouse and checks the owner before it goes live.</p>
        </div>
        <div>
          <span className="trust-icon">
            <Icon name="chat" size={22} />
          </span>
          <h3>Talk to the host directly</h3>
          <p className="muted">WhatsApp or call the host in one tap. Agree the date, price and plan with them.</p>
        </div>
        <div>
          <span className="trust-icon">
            <Icon name="percent" size={22} />
          </span>
          <h3>Zero commission</h3>
          <p className="muted">We add nothing to the price. You pay the host’s own rate.</p>
        </div>
      </section>
    </>
  )
}
