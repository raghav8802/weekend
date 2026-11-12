import { Link } from 'react-router-dom'
import type { PublicProperty } from '../api'
import { headlinePrice } from '../format'

export function Photo({ url, alt, className }: { url?: string; alt: string; className?: string }) {
  if (!url) return <div className={`photo photo-empty ${className ?? ''}`} aria-label={alt} />
  return <img className={`photo ${className ?? ''}`} src={url} alt={alt} loading="lazy" />
}

export function PropertyCard({ p, query }: { p: PublicProperty; query?: string }) {
  return (
    <Link to={`/farmhouse/${p.slug}${query ? `?${query}` : ''}`} className="card">
      <Photo url={p.photoUrls[0]} alt={p.name} />
      <div className="card-body">
        <div className="card-title">
          <h3>{p.name}</h3>
          {p.verified && <span className="badge">Verified</span>}
        </div>
        <p className="muted">
          {p.area} · up to {p.maxGuests} guests{p.hasPool ? ' · pool' : ''}
        </p>
        <p className="price">{headlinePrice(p)}</p>
      </div>
    </Link>
  )
}
