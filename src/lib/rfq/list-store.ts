import { z } from 'zod'
import { MAX_QUANTITY, MAX_RFQ_ITEMS, RFQ_LIST_STORAGE_KEY } from '@/lib/constants'

/** One line of the buyer's RFQ list, persisted in localStorage. */
export interface RfqListItem {
  sku: string
  name: string
  slug: string
  quantity: number
  unitOfMeasure: string
  /** Free-text line for an item that is not in the catalogue. `sku` is then an internal id, never sent to the server. */
  custom: boolean
}

const STORAGE_VERSION = 1

const itemSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  slug: z.string().trim().max(200).default(''),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  unitOfMeasure: z.string().trim().max(16).default(''),
  custom: z.boolean().default(false),
})

const storedSchema = z.object({ v: z.literal(STORAGE_VERSION), items: z.array(z.unknown()) })

/** Parse persisted data defensively: corrupt, old or tampered values never throw, invalid lines are dropped. */
export function parseStoredList(raw: string | null): RfqListItem[] {
  if (!raw) return []
  try {
    const stored = storedSchema.safeParse(JSON.parse(raw))
    if (!stored.success) return []
    const items: RfqListItem[] = []
    const seen = new Set<string>()
    for (const candidate of stored.data.items) {
      const parsed = itemSchema.safeParse(candidate)
      if (parsed.success && !seen.has(parsed.data.sku)) {
        seen.add(parsed.data.sku)
        items.push(parsed.data)
      }
      if (items.length >= MAX_RFQ_ITEMS) break
    }
    return items
  } catch {
    return []
  }
}

export const serializeList = (items: RfqListItem[]): string => JSON.stringify({ v: STORAGE_VERSION, items })

export type AddResult = { items: RfqListItem[]; status: 'added' | 'increased' | 'full' }

type NewItem = Omit<RfqListItem, 'quantity' | 'custom'> & { quantity?: number; custom?: boolean }

/** Add a line, or increase the quantity when the SKU is already listed (no duplicate lines). */
export function addToList(items: RfqListItem[], item: NewItem): AddResult {
  const qty = Math.min(Math.max(Math.trunc(item.quantity ?? 1), 1), MAX_QUANTITY)
  const idx = items.findIndex((i) => i.sku === item.sku)
  if (idx >= 0) {
    const next = items.slice()
    next[idx] = { ...items[idx]!, quantity: Math.min(items[idx]!.quantity + qty, MAX_QUANTITY) }
    return { items: next, status: 'increased' }
  }
  if (items.length >= MAX_RFQ_ITEMS) return { items, status: 'full' }
  return { items: [...items, { ...item, quantity: qty, custom: item.custom ?? false }], status: 'added' }
}

export function setQuantity(items: RfqListItem[], sku: string, quantity: number): RfqListItem[] {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return items
  return items.map((i) => (i.sku === sku ? { ...i, quantity } : i))
}

export const removeFromList = (items: RfqListItem[], sku: string): RfqListItem[] => items.filter((i) => i.sku !== sku)

/* ---- Browser store (useSyncExternalStore) ---------------------------------------------------- */

const EMPTY: RfqListItem[] = []
let cache: { raw: string | null; items: RfqListItem[] } = { raw: null, items: EMPTY }
const listeners = new Set<() => void>()

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(RFQ_LIST_STORAGE_KEY)
  } catch {
    return null
  }
}

export function getSnapshot(): RfqListItem[] {
  const raw = readRaw()
  if (raw !== cache.raw) cache = { raw, items: raw ? parseStoredList(raw) : EMPTY }
  return cache.items
}

export const getServerSnapshot = (): RfqListItem[] => EMPTY

function emit() {
  for (const l of listeners) l()
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === RFQ_LIST_STORAGE_KEY || e.key === null) emit() // cross-tab sync
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function writeList(items: RfqListItem[]): boolean {
  try {
    if (items.length === 0) window.localStorage.removeItem(RFQ_LIST_STORAGE_KEY)
    else window.localStorage.setItem(RFQ_LIST_STORAGE_KEY, serializeList(items))
  } catch {
    return false // storage unavailable or full; the UI keeps working for this page view only
  }
  emit()
  return true
}

export const rfqListActions = {
  add(item: NewItem): AddResult {
    const result = addToList(getSnapshot(), item)
    if (result.status !== 'full') writeList(result.items)
    return result
  },
  addCustom(name: string, quantity: number): AddResult {
    const id = `custom-${Math.random().toString(36).slice(2, 10)}`
    return rfqListActions.add({ sku: id, name: name.trim().slice(0, 300), slug: '', unitOfMeasure: '', quantity, custom: true })
  },
  setQuantity(sku: string, quantity: number) {
    writeList(setQuantity(getSnapshot(), sku, quantity))
  },
  remove(sku: string) {
    writeList(removeFromList(getSnapshot(), sku))
  },
  clear() {
    writeList([])
  },
}
