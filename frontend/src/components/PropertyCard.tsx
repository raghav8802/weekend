import { Link } from 'react-router-dom'
import type { PublicProperty } from '../api'
import { inr } from '../format'
import { CardPhotos } from './Photos'

function price(p: PublicProperty) {
  if (p.dayUsePriceMin != null) return { amount: inr(p.dayUsePriceMin), unit: 'day-use' }
  if (p.nightPriceMin != null) return { amount: inr(p.nightPriceMin), unit: 'night' }
  return null
}

export function PropertyCard({ p, query }: { p: PublicProperty; query?: string }) {
  const pr = price(p)
  const facts = [`Up to ${p.maxGuests} guests`, p.bedrooms > 0 ? `${p.bedrooms} ${p.bedrooms === 1 ? 'room' : 'rooms'}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/farmhouse/${p.slug}${query ? `?${query}` : ''}`} className="card">
      <div className="card-media">
        <CardPhotos urls={p.photoUrls} seed={p.slug} alt={p.name} />
        <div className="card-tags">
          {p.verified && <span className="tag">Verified</span>}
          {p.hasPool && <span className="tag">Pool</span>}
        </div>
      </div>
      <div className="card-body">
        <div className="card-line">
          <h3>{p.name}</h3>
        </div>
        <p className="muted">{p.area}</p>
        <p className="muted">{facts}</p>
        {pr && (
          <p className="card-price">
            <strong>{pr.amount}</strong> <span>{pr.unit}</span>
          </p>
        )}
      </div>
    </Link>
  )
}
