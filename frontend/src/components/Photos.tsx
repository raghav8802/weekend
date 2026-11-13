import { useState } from 'react'
import { Icon } from './Icon'

// Soft scenery shown until the team adds real photos. The palette is picked from the
// farmhouse's name so each card looks different but stays the same on every visit.
const palettes = [
  { sky: ['#fde7d4', '#fff6ec'], far: '#b9d7c3', near: '#86b89a', house: '#f4efe6', roof: '#c96f4a' },
  { sky: ['#dcecf7', '#f4f9fd'], far: '#b5d3c4', near: '#7fae93', house: '#fbf8f2', roof: '#8a5a44' },
  { sky: ['#f6e3ea', '#fdf5f7'], far: '#c9dcc0', near: '#93b98a', house: '#fffaf3', roof: '#b35d5d' },
  { sky: ['#e6e6f7', '#f7f7fd'], far: '#bcd5cb', near: '#88b3a2', house: '#fbfaf6', roof: '#5f6f8f' },
  { sky: ['#fff1c9', '#fffaeb'], far: '#c5dbb0', near: '#8fbb7a', house: '#fffdf6', roof: '#c08a3e' },
]

function hash(text: string) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function Scenery({ seed, label = true }: { seed: string; label?: boolean }) {
  const p = palettes[hash(seed) % palettes.length]
  const id = `sky-${hash(seed) % 1000}`
  return (
    <div className="scenery">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Photos coming soon">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.sky[0]} />
            <stop offset="1" stopColor={p.sky[1]} />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill={`url(#${id})`} />
        <circle cx="300" cy="78" r="30" fill="#ffffff" opacity="0.85" />
        <path d="M0 190 C70 150 140 160 200 180 C260 200 330 150 400 165 V300 H0Z" fill={p.far} />
        <g transform="translate(150 132)">
          <path d="M-6 52 L50 8 L106 52Z" fill={p.roof} />
          <rect x="4" y="50" width="92" height="56" fill={p.house} />
          <rect x="40" y="72" width="20" height="34" rx="2" fill={p.roof} opacity="0.75" />
          <rect x="14" y="64" width="16" height="14" rx="2" fill={p.far} />
          <rect x="70" y="64" width="16" height="14" rx="2" fill={p.far} />
        </g>
        <path d="M0 236 C90 214 170 226 230 236 C300 248 350 226 400 230 V300 H0Z" fill={p.near} />
        <g fill={p.near}>
          <circle cx="70" cy="196" r="22" />
          <rect x="67" y="200" width="6" height="34" />
          <circle cx="340" cy="200" r="18" />
          <rect x="337" y="204" width="6" height="30" />
        </g>
      </svg>
      {label && <span className="scenery-label">Photos coming soon</span>}
    </div>
  )
}

/** Swipeable-looking photo carousel for cards: arrows on hover, dots underneath. */
export function CardPhotos({ urls, seed, alt }: { urls: string[]; seed: string; alt: string }) {
  const [index, setIndex] = useState(0)
  if (urls.length === 0) return <Scenery seed={seed} />
  const go = (e: React.MouseEvent, step: number) => {
    e.preventDefault()
    e.stopPropagation()
    setIndex((i) => (i + step + urls.length) % urls.length)
  }
  return (
    <div className="card-photos">
      <img src={urls[index]} alt={alt} loading="lazy" />
      {urls.length > 1 && (
        <>
          <button type="button" className="photo-nav prev" aria-label="Previous photo" onClick={(e) => go(e, -1)}>
            <Icon name="left" size={16} />
          </button>
          <button type="button" className="photo-nav next" aria-label="Next photo" onClick={(e) => go(e, 1)}>
            <Icon name="right" size={16} />
          </button>
          <div className="dots" aria-hidden="true">
            {urls.slice(0, 6).map((u, i) => (
              <span key={u} className={i === index ? 'on' : ''} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
