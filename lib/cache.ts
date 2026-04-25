import { supabase } from './supabase'
import type { Item, PendingOp } from './types'

function storageKey(prefix: string, listId: string) {
  return `groceries-${prefix}-${listId}`
}

// --- Item cache ---

export function getCachedItems(listId: string): Item[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey('items', listId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function setCachedItems(listId: string, items: Item[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey('items', listId), JSON.stringify(items))
  } catch {}
}

// --- Pending ops queue ---

export function getPendingOps(listId: string): PendingOp[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey('pending', listId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function queueOp(listId: string, op: PendingOp) {
  if (typeof window === 'undefined') return
  try {
    const ops = getPendingOps(listId)
    ops.push(op)
    localStorage.setItem(storageKey('pending', listId), JSON.stringify(ops))
  } catch {}
}

function clearPendingOps(listId: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey('pending', listId))
  } catch {}
}

// --- Flush: apply queued ops with conflict detection ---
// Returns the number of ops skipped because server had newer data.

export async function flushPendingOps(listId: string): Promise<number> {
  const ops = getPendingOps(listId)
  if (ops.length === 0) return 0

  let skipped = 0

  for (const op of ops) {
    try {
      if (op.type === 'add') {
        // Insert with pre-generated ID; skip if already exists
        const { data: existing } = await supabase
          .from('items')
          .select('id')
          .eq('id', op.item.id)
          .maybeSingle()

        if (!existing) {
          await supabase.from('items').insert(op.item)
        }
      }

      else if (op.type === 'toggle') {
        const { data: serverItem } = await supabase
          .from('items')
          .select('updated_at')
          .eq('id', op.id)
          .maybeSingle()

        if (serverItem) {
          const serverTime = new Date(serverItem.updated_at ?? 0).getTime()
          const opTime = new Date(op.queued_at).getTime()
          if (serverTime > opTime) { skipped++; continue }
          await supabase.from('items').update({ checked: op.checked }).eq('id', op.id)
        }
      }

      else if (op.type === 'rename') {
        const { data: serverItem } = await supabase
          .from('items')
          .select('updated_at')
          .eq('id', op.id)
          .maybeSingle()

        if (serverItem) {
          const serverTime = new Date(serverItem.updated_at ?? 0).getTime()
          const opTime = new Date(op.queued_at).getTime()
          if (serverTime > opTime) { skipped++; continue }
          await supabase.from('items').update({ name: op.name }).eq('id', op.id)
        }
      }

      else if (op.type === 'delete') {
        await supabase.from('items').delete().eq('id', op.id)
      }
    } catch {
      // Keep going if one op fails
    }
  }

  clearPendingOps(listId)
  return skipped
}
