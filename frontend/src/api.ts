// Typed calls to the Spring Boot API. Shapes mirror the Java records.

export type SlotType = 'DAY_USE' | 'NIGHT' | 'EVENT'
export type Channel = 'WHATSAPP' | 'CALL'
export type LeadStatus = 'NEW' | 'BOOKED' | 'NOT_BOOKED'
export type PropertyStatus = 'PENDING' | 'LIVE' | 'PAUSED'

export interface PublicProperty {
  slug: string
  name: string
  area: string
  description: string
  houseRules: string
  maxGuests: number
  bedrooms: number
  hasPool: boolean
  amenities: string[]
  photoUrls: string[]
  dayUsePriceMin?: number
  dayUsePriceMax?: number
  nightPriceMin?: number
  nightPriceMax?: number
  hostFirstName: string
  verified: boolean
}

export interface AdminProperty extends Omit<PublicProperty, 'hostFirstName' | 'verified'> {
  id: string
  address: string
  latitude?: number
  longitude?: number
  hostName: string
  hostPhone: string
  hostToken: string
  status: PropertyStatus
  verifiedAt?: string
  createdAt: string
}

export type PropertyForm = Omit<
  AdminProperty,
  'id' | 'slug' | 'hostToken' | 'status' | 'verifiedAt' | 'createdAt'
>

export interface Lead {
  id: string
  propertyId: string
  reference: string
  guestName: string
  eventDate: string
  nights: number
  guests: number
  slotType: SlotType
  channel: Channel
  status: LeadStatus
  createdAt: string
}

export interface LeadRequest {
  guestName: string
  eventDate: string
  nights?: number
  guests: number
  slotType: SlotType
  channel: Channel
}

export interface LeadResponse {
  reference: string
  contactUrl: string
  message: string
}

export interface HostBlock {
  id: string
  fromDate: string
  toDate: string
  source: 'HOST_BLOCKED' | 'DIRECT_CONFIRMED'
  note?: string
}

export interface HostView {
  property: PublicProperty
  status: PropertyStatus
  summary: { total: number; booked: number; lastThirtyDays: number }
  leads: Lead[]
  blocks: HostBlock[]
}

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>

  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (init.body) headers['Content-Type'] = 'application/json'
  if (auth) headers['Authorization'] = `Basic ${auth}`
  const res = await fetch(path, { ...init, headers: { ...headers, ...(init.headers as object) } })
  if (!res.ok) {
    let message = 'Something went wrong. Please try again.'
    let fields: Record<string, string> | undefined
    try {
      const body = await res.json()
      message = body.error ?? message
      fields = body.fields
    } catch {
      // Not JSON: keep the generic message.
    }
    throw new ApiError(res.status, message, fields)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

// --- guests ---

export interface SearchParams {
  area?: string
  guests?: number
  date?: string
  nights?: number
}

export function searchProperties(p: SearchParams) {
  const q = new URLSearchParams()
  if (p.area) q.set('area', p.area)
  if (p.guests) q.set('guests', String(p.guests))
  if (p.date) q.set('date', p.date)
  if (p.date && p.nights && p.nights > 1) q.set('nights', String(p.nights))
  return request<PublicProperty[]>(`/api/properties?${q}`)
}

export const getAreas = () => request<string[]>('/api/areas')
export const getProperty = (slug: string) => request<PublicProperty>(`/api/properties/${encodeURIComponent(slug)}`)

export const getBlockedDates = (slug: string, from: string, to: string) =>
  request<string[]>(`/api/properties/${encodeURIComponent(slug)}/blocked-dates?from=${from}&to=${to}`)

export const createLead = (slug: string, body: LeadRequest) =>
  request<LeadResponse>(`/api/properties/${encodeURIComponent(slug)}/leads`, post(body))

// --- hosts (secret link) ---

const hostPath = (token: string) => `/api/host/${encodeURIComponent(token)}`

export const getHostView = (token: string) => request<HostView>(hostPath(token))

export const blockDates = (token: string, fromDate: string, toDate: string, note?: string) =>
  request<HostBlock>(`${hostPath(token)}/blocks`, post({ fromDate, toDate, note }))

export const unblock = (token: string, blockId: string) =>
  request<void>(`${hostPath(token)}/blocks/${blockId}`, { method: 'DELETE' })

export const setLeadOutcome = (token: string, leadId: string, status: 'BOOKED' | 'NOT_BOOKED') =>
  request<{ lead: Lead; datesBlocked: boolean; datesAlreadyBlocked: boolean }>(
    `${hostPath(token)}/leads/${leadId}/outcome`,
    post({ status }),
  )

// --- team (login) ---

export const adminCheck = (auth: string) => request<void>('/api/admin/me', {}, auth)
export const adminList = (auth: string) => request<AdminProperty[]>('/api/admin/properties', {}, auth)
export const adminCreate = (auth: string, form: PropertyForm) =>
  request<AdminProperty>('/api/admin/properties', post(form), auth)
export const adminUpdate = (auth: string, id: string, form: PropertyForm) =>
  request<AdminProperty>(`/api/admin/properties/${id}`, { method: 'PUT', body: JSON.stringify(form) }, auth)
export const adminSetStatus = (auth: string, id: string, status: PropertyStatus) =>
  request<AdminProperty>(`/api/admin/properties/${id}/status`, post({ status }), auth)
export const adminRotateLink = (auth: string, id: string) =>
  request<AdminProperty>(`/api/admin/properties/${id}/rotate-host-link`, { method: 'POST' }, auth)
export const adminLeads = (auth: string) => request<Lead[]>('/api/admin/leads', {}, auth)
