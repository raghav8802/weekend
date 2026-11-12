import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAreas, searchProperties, type PublicProperty } from '../api'
import { PropertyCard } from '../components/PropertyCard'
import { todayInIndia } from '../format'

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [areas, setAreas] = useState<string[]>([])
  const [results, setResults] = useState<PublicProperty[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const area = params.get('area') ?? ''
  const date = params.get('date') ?? ''
  const guests = params.get('guests') ?? ''
  const nights = params.get('nights') ?? '1'

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const next = new URLSearchParams()
    for (const key of ['area', 'date', 'guests', 'nights']) {
      const v = String(form.get(key) ?? '').trim()
      if (v && !(key === 'nights' && v === '1')) next.set(key, v)
    }
    setParams(next)
  }

  // Carry the guest's date and group size onto the listing page.
  const carry = new URLSearchParams()
  if (date) carry.set('date', date)
  if (guests) carry.set('guests', guests)

  return (
    <>
      <section className="hero">
        <h1>Find a farmhouse for your day out, party or stay</h1>
        <p className="muted">Every listing is visited by our team. Talk to the host directly — no booking fee.</p>
        <form className="search" onSubmit={onSubmit}>
          <label>
            Area
            <select name="area" defaultValue={area} key={`area-${area}-${areas.length}`}>
              <option value="">All of Delhi NCR</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" name="date" min={todayInIndia()} defaultValue={date} key={`date-${date}`} />
          </label>
          <label>
            Nights
            <select name="nights" defaultValue={nights} key={`nights-${nights}`}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? '1 day / night' : `${n} nights`}
                </option>
              ))}
            </select>
          </label>
          <label>
            Guests
            <input
              type="number"
              name="guests"
              min={1}
              max={2000}
              placeholder="e.g. 25"
              defaultValue={guests}
              key={`guests-${guests}`}
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </section>

      {error && <p className="error">{error}</p>}
      {!error && results === null && <p className="muted">Loading farmhouses…</p>}
      {results && results.length === 0 && (
        <div className="empty">
          <h2>No farmhouses match yet</h2>
          <p className="muted">Try another date, a smaller group or all areas.</p>
        </div>
      )}
      {results && results.length > 0 && (
        <>
          <p className="muted result-count">
            {results.length} {results.length === 1 ? 'farmhouse' : 'farmhouses'}
            {date ? ' free on your dates' : ''}
          </p>
          <div className="grid">
            {results.map((p) => (
              <PropertyCard key={p.slug} p={p} query={carry.toString()} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
