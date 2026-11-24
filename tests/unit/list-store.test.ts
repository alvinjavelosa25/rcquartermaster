import { describe, expect, it } from 'vitest'
import {
  addToList,
  parseStoredList,
  removeFromList,
  serializeList,
  setQuantity,
  type RfqListItem,
} from '@/lib/rfq/list-store'

const item = (sku: string, quantity = 1): RfqListItem => ({
  sku,
  name: `Item ${sku}`,
  slug: sku.toLowerCase(),
  quantity,
  unitOfMeasure: 'EA',
  custom: false,
})

describe('[FR-030][FR-031] RFQ list store', () => {
  it('adds, merges duplicates and increases quantity', () => {
    const a = addToList([], { sku: 'A', name: 'A', slug: 'a', unitOfMeasure: '' })
    expect(a.status).toBe('added')
    const b = addToList(a.items, { sku: 'A', name: 'A', slug: 'a', unitOfMeasure: '', quantity: 4 })
    expect(b.status).toBe('increased')
    expect(b.items).toHaveLength(1)
    expect(b.items[0]!.quantity).toBe(5)
  })

  it('caps the number of lines', () => {
    let items: RfqListItem[] = []
    for (let i = 0; i < 100; i++)
      items = addToList(items, { sku: `S${i}`, name: 'x', slug: '', unitOfMeasure: '' }).items
    expect(addToList(items, { sku: 'EXTRA', name: 'x', slug: '', unitOfMeasure: '' }).status).toBe(
      'full',
    )
  })

  it('changes and removes quantities, ignoring invalid values', () => {
    const items = [item('A'), item('B', 3)]
    expect(setQuantity(items, 'A', 10)[0]!.quantity).toBe(10)
    for (const bad of [0, -2, 1.5, 1e9, Number.NaN])
      expect(setQuantity(items, 'A', bad)).toBe(items)
    expect(removeFromList(items, 'A').map((i) => i.sku)).toEqual(['B'])
  })

  it('round-trips through serialisation', () => {
    const items = [item('A', 2), { ...item('custom-x'), custom: true }]
    expect(parseStoredList(serializeList(items))).toEqual(items)
  })

  it('is safe with corrupt, tampered or old data', () => {
    expect(parseStoredList(null)).toEqual([])
    expect(parseStoredList('not json')).toEqual([])
    expect(parseStoredList('{"v":99,"items":[]}')).toEqual([])
    expect(parseStoredList('{"v":1,"items":"oops"}')).toEqual([])
    const mixed = JSON.stringify({
      v: 1,
      items: [
        { sku: 'OK', name: 'ok', quantity: 2 },
        { sku: '', name: 'bad', quantity: 2 },
        { sku: 'NEG', name: 'n', quantity: -3 },
        null,
        5,
        { sku: 'OK', name: 'dup', quantity: 1 },
      ],
    })
    const parsed = parseStoredList(mixed)
    expect(parsed.map((i) => i.sku)).toEqual(['OK'])
  })

  it('drops items beyond the maximum when reading', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ sku: `S${i}`, name: 'x', quantity: 1 }))
    expect(parseStoredList(JSON.stringify({ v: 1, items: many }))).toHaveLength(100)
  })
})
