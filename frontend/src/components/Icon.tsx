// Small line-icon set drawn on a 24×24 grid with the current text colour.

const paths = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bed: <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />,
  pool: (
    <path d="M2 7c1 .8 2 1.2 3.3 1.2 2.6 0 2.6-2 5.2-2s2.6 2 5.2 2 2.6-2 5.2-2M2 12.5c1 .8 2 1.2 3.3 1.2 2.6 0 2.6-2 5.2-2s2.6 2 5.2 2 2.6-2 5.2-2M2 18c1 .8 2 1.2 3.3 1.2 2.6 0 2.6-2 5.2-2s2.6 2 5.2 2 2.6-2 5.2-2" />
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />,
  percent: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  phone: (
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2z" />
  ),
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />,
  party: (
    <>
      <path d="M5.8 11.3 2 22l10.7-3.8" />
      <path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01" />
      <path d="m22 2-2.2.8a3 3 0 0 0-1.9 3.2v0c.1.9-.6 1.7-1.5 1.7h-.4c-.9 0-1.6.7-1.7 1.5L14 10" />
      <path d="m22 13-.8-.3a2.2 2.2 0 0 0-2.8 1.4v0a2 2 0 0 1-2.2 1.3L14 15" />
      <path d="m11 2 .3.8a2.2 2.2 0 0 1-1.4 2.8v0a2 2 0 0 0-1.3 2.2L9 10" />
      <path d="M11 13c1.9 1.9 2.8 4.2 2 5-.8.8-3.1 0-5-2s-2.8-4.2-2-5c.8-.8 3.1 0 5 2z" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  tree: (
    <>
      <path d="M12 22v-6" />
      <path d="M8 16h8a4 4 0 0 0 1-7.9A5 5 0 0 0 7 8.1 4 4 0 0 0 8 16z" />
    </>
  ),
  car: (
    <>
      <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
      <path d="M9 17h6" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  zap: <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  ),
  wifi: <path d="M5 12.6a11 11 0 0 1 14 0M1.4 9a16 16 0 0 1 21.2 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01" />,
  snow: <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />,
  utensils: <path d="M3 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V2M6 2v20M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2h3zm0 0v7" />,
  mic: (
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  link: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
}

export type IconName = keyof typeof paths

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

/** Picks an icon for an amenity the team typed in, e.g. "Power backup" → zap. */
export function amenityIcon(amenity: string): IconName {
  const a = amenity.toLowerCase()
  if (a.includes('pool') || a.includes('swim')) return 'pool'
  if (a.includes('lawn') || a.includes('garden') || a.includes('green')) return 'tree'
  if (a.includes('park') || a.includes('car')) return 'car'
  if (a.includes('power') || a.includes('backup') || a.includes('generator')) return 'zap'
  if (a.includes('music') || a.includes('speaker') || a.includes('sound') || a.includes('dj')) return 'music'
  if (a.includes('bonfire') || a.includes('fire') || a.includes('bbq') || a.includes('barbecue')) return 'flame'
  if (a.includes('wifi') || a.includes('wi-fi') || a.includes('internet')) return 'wifi'
  if (a.includes('ac') || a.includes('air') || a.includes('cool')) return 'snow'
  if (a.includes('kitchen') || a.includes('cater') || a.includes('food')) return 'utensils'
  if (a.includes('stage') || a.includes('mic')) return 'mic'
  if (a.includes('room') || a.includes('bed')) return 'bed'
  return 'check'
}
