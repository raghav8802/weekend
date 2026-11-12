import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError, blockDates, getHostView, setLeadOutcome, unblock, type HostView, type Lead } from '../api'
import { prettyDate, prettyDateTime, slotLabel, todayInIndia } from '../format'

/** The host's private page, opened from the link we send them on WhatsApp. */
export function HostPage() {
  const { token = '' } = useParams()
  const [view, setView] = useState<HostView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    getHostView(token)
      .then((v) => {
        setView(v)
        setError(null)
      })
      .catch((e: ApiError) =>
        setError(e.status === 404 ? 'This link is not valid. Ask the team for your latest host link.' : e.message),
      )
  }, [token])

  useEffect(load, [load])

  if (error) return <p className="error">{error}</p>
  if (!view) return <p className="muted">Loading…</p>

  async function outcome(lead: Lead, status: 'BOOKED' | 'NOT_BOOKED') {
    try {
      const res = await setLeadOutcome(token, lead.id, status)
      setNotice(
        status === 'NOT_BOOKED'
          ? `Marked ${lead.reference} as not booked.`
          : res.datesBlocked
            ? `Marked ${lead.reference} as booked and blocked ${prettyDate(lead.eventDate)} on your calendar.`
            : `Marked ${lead.reference} as booked. Those dates were already blocked.`,
      )
      load()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save')
    }
  }

  const { property, summary, leads, blocks } = view

  return (
    <div className="host">
      <h1>{property.name}</h1>
      <p className="muted">
        Your host page · keep this link private
        {view.status !== 'LIVE' && <span className="badge badge-warn"> Not visible to guests yet</span>}
      </p>

      <div className="stats">
        <div>
          <strong>{summary.lastThirtyDays}</strong>
          <span>enquiries in the last 30 days</span>
        </div>
        <div>
          <strong>{summary.total}</strong>
          <span>enquiries in total</span>
        </div>
        <div>
          <strong>{summary.booked}</strong>
          <span>became bookings</span>
        </div>
      </div>

      {notice && <p className="notice">{notice}</p>}

      <section>
        <h2>Block dates</h2>
        <p className="muted small">Booked offline or not available? Block the dates so guests don’t ask for them.</p>
        <BlockForm
          onSave={async (from, to, note) => {
            await blockDates(token, from, to, note)
            setNotice(`Blocked ${prettyDate(from)}${from !== to ? ` to ${prettyDate(to)}` : ''}.`)
            load()
          }}
        />
        {blocks.length === 0 ? (
          <p className="muted">No dates blocked.</p>
        ) : (
          <ul className="list">
            {blocks.map((b) => (
              <li key={b.id}>
                <span>
                  {prettyDate(b.fromDate)}
                  {b.fromDate !== b.toDate && ` – ${prettyDate(b.toDate)}`}
                  <span className="muted"> · {b.source === 'DIRECT_CONFIRMED' ? 'booked via enquiry' : b.note ?? 'blocked'}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={async () => {
                    await unblock(token, b.id)
                    load()
                  }}
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Enquiries</h2>
        <p className="muted small">Did a guest book after contacting you? Tell us — it blocks the dates for you.</p>
        {leads.length === 0 ? (
          <p className="muted">No enquiries yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Guest</th>
                  <th>For</th>
                  <th>Received</th>
                  <th>Booked?</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.reference}</td>
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
                    <td className="small">{prettyDateTime(l.createdAt)}</td>
                    <td>
                      {l.status === 'NEW' ? (
                        <div className="row">
                          <button type="button" className="btn btn-small" onClick={() => outcome(l, 'BOOKED')}>
                            Yes
                          </button>
                          <button
                            type="button"
                            className="btn btn-small btn-secondary"
                            onClick={() => outcome(l, 'NOT_BOOKED')}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <span className={l.status === 'BOOKED' ? 'badge' : 'muted'}>
                          {l.status === 'BOOKED' ? 'Booked' : 'Not booked'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function BlockForm({ onSave }: { onSave: (from: string, to: string, note?: string) => Promise<void> }) {
  const today = todayInIndia()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await onSave(from, to || from, note || undefined)
      setFrom('')
      setTo('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not block')
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <label>
        From
        <input type="date" required min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
      </label>
      <label>
        To
        <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label>
        Note
        <input placeholder="e.g. family function" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-primary">
        Block
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
