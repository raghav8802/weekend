import type { PublicProperty, SlotType } from './api'

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export const inr = (n: number) => rupees.format(n)

export function priceRange(min?: number, max?: number): string | null {
  if (min == null) return null
  return max != null && max > min ? `${inr(min)} – ${inr(max)}` : `from ${inr(min)}`
}

/** "Day-use from ₹15,000" style line for cards. */
export function headlinePrice(p: PublicProperty): string {
  if (p.dayUsePriceMin != null) return `Day-use from ${inr(p.dayUsePriceMin)}`
  if (p.nightPriceMin != null) return `Night from ${inr(p.nightPriceMin)}`
  return 'Price on request'
}

/** Today's date in India as YYYY-MM-DD, whatever the browser's time zone. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function prettyDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
}

export const slotLabel: Record<SlotType, string> = {
  DAY_USE: 'Day-use',
  NIGHT: 'Overnight',
  EVENT: 'Event / party',
}
