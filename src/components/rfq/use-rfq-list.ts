'use client'

import { useSyncExternalStore } from 'react'
import {
  getServerSnapshot,
  getSnapshot,
  rfqListActions,
  subscribe,
  type RfqListItem,
} from '@/lib/rfq/list-store'

export function useRfqList(): { items: RfqListItem[]; actions: typeof rfqListActions } {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { items, actions: rfqListActions }
}
