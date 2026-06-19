'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { inferCategory, CATEGORIES, CATEGORY_COLORS, CATEGORY_TEXT } from '@/lib/categories'
import { getCachedItems, setCachedItems, queueOp, flushPendingOps, getPendingOps } from '@/lib/cache'
import { recordItemHistory, upsertRecurringItem } from '@/lib/household'
import type { Item } from '@/lib/types'
import ItemActionSheet from './ItemActionSheet'
import UndoSnackbar from './UndoSnackbar'
import { AppShell, Badge, Button, IconButton, TextInput } from './ui'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  WifiOff,
} from 'lucide-react'

const SWIPE_THRESHOLD = 65
const DIRECTION_LOCK_THRESHOLD = 8
const LONG_PRESS_MS = 500
const SWIPE_HINT_KEY = 'hasSeenSwipeHint'

const CATEGORY_BORDER: Record<string, string> = {
  'Produce':         '#4ade80',
  'Dairy':           '#60a5fa',
  'Meat & Fish':     '#f87171',
  'Bakery & Grains': '#fbbf24',
  'Frozen':          '#22d3ee',
  'Drinks':          '#c084fc',
  'Snacks':          '#fb923c',
  'Household':       '#9ca3af',
  'Other':           '#e5e7eb',
}

type PendingDeletion = { items: Item[]; message: string }

export default function ListScreen({
  session,
  listId,
  listName,
  householdId,
  onBack,
}: {
  session: Session
  listId: string
  listName: string
  householdId?: string | null
  onBack: () => void
}) {
  const [items, setItems] = useState<Item[]>(() => getCachedItems(listId))
  const [inputText, setInputText] = useState('')
  const [suggestions, setSuggestions] = useState<{ name: string; is_recurring: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const [syncConflict, setSyncConflict] = useState(false)
  const [shoppingMode, setShoppingMode] = useState(false)
  const [recurringNames, setRecurringNames] = useState<Set<string>>(new Set())
  const [actionSheetItem, setActionSheetItem] = useState<Item | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDeletion | null>(null)
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set())
  const [searchMode, setSearchMode] = useState(false)
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [showChecked, setShowChecked] = useState(false)
  const [pendingCount, setPendingCount] = useState(() => getPendingOps(listId).length)
  const [syncMessage, setSyncMessage] = useState('')

  // Touch state
  const touchStart = useRef<Record<string, { x: number; y: number; lock: 'h' | 'v' | null; longPressTimer: ReturnType<typeof setTimeout> | null }>>({})
  const [swipeDeltas, setSwipeDeltas] = useState<Record<string, number>>({})
  const [snappingItems, setSnappingItems] = useState<Set<string>>(new Set())

  const inputRef = useRef<HTMLInputElement>(null)
  const knownItemIds = useRef<Set<string>>(new Set())

  function queuePending(op: Parameters<typeof queueOp>[1]) {
    queueOp(listId, op)
    setPendingCount(getPendingOps(listId).length)
  }

  // ── Data loading ──────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('checked', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      if (data) {
        // Detect new items from realtime sync (not present before)
        const newOnes = data.filter((d: Item) => !knownItemIds.current.has(d.id) && knownItemIds.current.size > 0)
        if (newOnes.length > 0) {
          setRecentlyAddedIds(prev => {
            const next = new Set(prev)
            newOnes.forEach((n: Item) => next.add(n.id))
            return next
          })
          setTimeout(() => {
            setRecentlyAddedIds(prev => {
              const next = new Set(prev)
              newOnes.forEach((n: Item) => next.delete(n.id))
              return next
            })
          }, 1600)
        }
        knownItemIds.current = new Set(data.map((d: Item) => d.id))
        setItems(data as Item[])
        setCachedItems(listId, data as Item[])
      }
    } catch {
      // Offline — keep cached data
    } finally {
      setLoading(false)
    }
  }, [listId])

  const fetchRecurring = useCallback(async () => {
    const { data } = await supabase.from('item_history').select('name').eq('is_recurring', true)
    if (data) setRecurringNames(new Set(data.map((d: { name: string }) => d.name.toLowerCase())))
  }, [])

  useEffect(() => {
    // Initialize knownItemIds from cache so we don't flash everything on first load
    knownItemIds.current = new Set(getCachedItems(listId).map(i => i.id))

    fetchItems()
    fetchRecurring()

    const channel = supabase
      .channel(`items-realtime-${listId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchItems)
      .subscribe()

    const handleOnline = async () => {
      setIsOffline(false)
      const skipped = await flushPendingOps(listId)
      setPendingCount(0)
      if (skipped > 0) setSyncConflict(true)
      else setSyncMessage('Synced')
      await fetchItems()
    }
    const handleOffline = () => {
      setIsOffline(true)
      setSyncMessage('')
    }

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      // Swipe hint - show once globally, never again
      const seen = localStorage.getItem(SWIPE_HINT_KEY)
      if (!seen) {
        setShowSwipeHint(true)
        localStorage.setItem(SWIPE_HINT_KEY, '1')
        setTimeout(() => setShowSwipeHint(false), 6000)
      }
    }

    return () => {
      supabase.removeChannel(channel)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [listId, fetchItems, fetchRecurring])

  useEffect(() => {
    if (!syncConflict) return
    const t = setTimeout(() => setSyncConflict(false), 4000)
    return () => clearTimeout(t)
  }, [syncConflict])

  useEffect(() => {
    if (!syncMessage) return
    const t = setTimeout(() => setSyncMessage(''), 2500)
    return () => clearTimeout(t)
  }, [syncMessage])

  function dismissHint() {
    if (showSwipeHint) {
      setShowSwipeHint(false)
      localStorage.setItem(SWIPE_HINT_KEY, '1')
    }
  }

  // ── Autocomplete (recurring first) ────────────────────────────

  async function fetchSuggestions(text: string) {
    if (text.trim().length < 1) { setSuggestions([]); return }
    const { data } = await supabase
      .from('item_history')
      .select('name, is_recurring')
      .ilike('name', `${text}%`)
      .order('is_recurring', { ascending: false })
      .order('use_count', { ascending: false })
      .limit(5)

    if (data) {
      const uncheckedNames = items.filter(i => !i.checked).map(i => i.name.toLowerCase())
      setSuggestions(
        data
          .filter((d: { name: string }) => !uncheckedNames.includes(d.name.toLowerCase()))
          .map((d: { name: string; is_recurring: boolean }) => ({ name: d.name, is_recurring: d.is_recurring }))
      )
    }
  }

  // ── Add (with bulk paste support) ─────────────────────────────

  function parseBulkInput(raw: string): string[] {
    // Normalize line endings (Apple Notes can use \r\n or \r)
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    return normalized
      .split(/\n|,/)
      .map(line =>
        line
          .replace(/^[\s\t]+/, '')                    // leading whitespace/tabs
          .replace(/^[-•*–—]\s*/, '')                 // bullet: - • * – —
          .replace(/^\[\s*[xX✓✔]?\s*\]\s*/, '')       // [x] or [ ] checkboxes
          .replace(/^[□■☐☑✓✔○●]\s*/, '')             // unicode checkboxes/bullets
          .replace(/^\d+[\.\)]\s*/, '')               // numbered: 1. or 1)
          .trim()
      )
      .filter(line => line.length > 0)
  }

  async function handleAddInput(rawInput: string) {
    if (!rawInput.trim()) return

    const parts = parseBulkInput(rawInput)
    if (parts.length === 0) return

    setInputText(''); setSuggestions([])

    // Dedupe against existing items + within the batch itself
    const seen = new Set<string>()
    const toAdd: Item[] = []
    let unckeckedExisting: Item | null = null

    for (const name of parts) {
      const lower = name.toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)

      const existing = items.find(i => i.name.toLowerCase() === lower)
      if (existing) {
        if (existing.checked && parts.length === 1) unckeckedExisting = existing
        continue
      }

      toAdd.push({
        id: crypto.randomUUID(),
        name,
        checked: false,
        category: inferCategory(name),
        added_by: session.user.email ?? null,
        list_id: listId,
        updated_at: new Date().toISOString(),
      })
    }

    // Single existing checked item: uncheck it (preserves old behavior)
    if (toAdd.length === 0 && unckeckedExisting) {
      await toggleItem(unckeckedExisting.id, true)
      return
    }

    if (toAdd.length === 0) {
      if (parts.length === 1) alert(`"${parts[0]}" is already on your list.`)
      return
    }

    // Optimistic update + slide-in
    setItems(prev => {
      const next = [...toAdd, ...prev]
      setCachedItems(listId, next)
      return next
    })
    setRecentlyAddedIds(prev => {
      const n = new Set(prev)
      toAdd.forEach(i => n.add(i.id))
      return n
    })
    toAdd.forEach(i => knownItemIds.current.add(i.id))
    setTimeout(() => {
      setRecentlyAddedIds(prev => {
        const n = new Set(prev)
        toAdd.forEach(i => n.delete(i.id))
        return n
      })
    }, 1600)

    if (isOffline) {
      toAdd.forEach(item => queuePending({ type: 'add', item, queued_at: item.updated_at }))
    } else {
      await supabase.from('items').insert(toAdd)
      for (const item of toAdd) {
        await recordItemHistory(item.name, householdId ?? null)
      }
    }
  }

  // ── Toggle ───────────────────────────────────────────────────

  async function toggleItem(id: string, currentChecked: boolean) {
    const now = new Date().toISOString()
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, checked: !currentChecked, updated_at: now } : i)
      setCachedItems(listId, next)
      return next
    })

    if (isOffline) {
      queuePending({ type: 'toggle', id, checked: !currentChecked, queued_at: now })
    } else {
      await supabase.from('items').update({ checked: !currentChecked }).eq('id', id)
    }
  }

  // ── Delete with undo ─────────────────────────────────────────

  function deleteItemWithUndo(item: Item) {
    setItems(prev => {
      const next = prev.filter(i => i.id !== item.id)
      setCachedItems(listId, next)
      return next
    })
    setPendingDelete({ items: [item], message: `Deleted "${item.name}"` })
  }

  function clearCheckedWithUndo() {
    const checkedItems = items.filter(i => i.checked)
    if (checkedItems.length === 0) return
    setItems(prev => {
      const next = prev.filter(i => !i.checked)
      setCachedItems(listId, next)
      return next
    })
    setPendingDelete({
      items: checkedItems,
      message: `Cleared ${checkedItems.length} item${checkedItems.length > 1 ? 's' : ''}`,
    })
  }

  async function commitPendingDelete() {
    if (!pendingDelete) return
    const ids = pendingDelete.items.map(i => i.id)
    setPendingDelete(null)
    if (isOffline) {
      ids.forEach(id => queuePending({ type: 'delete', id, queued_at: new Date().toISOString() }))
    } else {
      await supabase.from('items').delete().in('id', ids)
    }
  }

  function undoPendingDelete() {
    if (!pendingDelete) return
    const restored = pendingDelete.items
    setItems(prev => {
      const next = [...prev, ...restored].sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1
        return a.updated_at.localeCompare(b.updated_at)
      })
      setCachedItems(listId, next)
      return next
    })
    setPendingDelete(null)
  }

  // ── Rename ───────────────────────────────────────────────────

  async function saveRename(id: string) {
    const name = renameText.trim()
    setRenamingId(null)
    if (!name) return
    const now = new Date().toISOString()
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, name, updated_at: now } : i)
      setCachedItems(listId, next)
      return next
    })
    if (isOffline) queuePending({ type: 'rename', id, name, queued_at: now })
    else await supabase.from('items').update({ name }).eq('id', id)
  }

  // ── Change category ──────────────────────────────────────────

  async function changeCategory(id: string, category: string) {
    setItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, category } : i)
      setCachedItems(listId, next)
      return next
    })
    if (!isOffline) await supabase.from('items').update({ category }).eq('id', id)
  }

  // ── Recurring ───────────────────────────────────────────────

  async function toggleRecurring(itemName: string) {
    const lower = itemName.toLowerCase()
    const isCurrentlyRecurring = recurringNames.has(lower)
    setRecurringNames(prev => {
      const next = new Set(prev)
      if (isCurrentlyRecurring) next.delete(lower)
      else next.add(lower)
      return next
    })
    await upsertRecurringItem(itemName, !isCurrentlyRecurring, householdId ?? null)
  }

  async function addRegulars() {
    const { data: recurringItems } = await supabase
      .from('item_history')
      .select('name')
      .eq('is_recurring', true)
    if (!recurringItems) return

    const currentNames = new Set(items.map(i => i.name.toLowerCase()))
    const toAdd = recurringItems.filter((r: { name: string }) => !currentNames.has(r.name.toLowerCase()))
    if (toAdd.length === 0) return

    const newItems: Item[] = toAdd.map((r: { name: string }) => ({
      id: crypto.randomUUID(),
      name: r.name,
      checked: false,
      category: inferCategory(r.name),
      added_by: session.user.email ?? null,
      list_id: listId,
      updated_at: new Date().toISOString(),
    }))

    setItems(prev => {
      const next = [...newItems, ...prev]
      setCachedItems(listId, next)
      return next
    })
    setRecentlyAddedIds(prev => { const n = new Set(prev); newItems.forEach(i => n.add(i.id)); return n })
    newItems.forEach(i => knownItemIds.current.add(i.id))
    setTimeout(() => {
      setRecentlyAddedIds(prev => { const n = new Set(prev); newItems.forEach(i => n.delete(i.id)); return n })
    }, 1600)

    if (!isOffline) await supabase.from('items').insert(newItems)
    else newItems.forEach(item => queuePending({ type: 'add', item, queued_at: item.updated_at }))
  }

  // ── Touch handlers (swipe + long-press) ──────────────────────

  function handleTouchStart(item: Item, clientX: number, clientY: number) {
    const longPressTimer = setTimeout(() => {
      const start = touchStart.current[item.id]
      if (start && start.lock !== 'h' && start.lock !== 'v') {
        // Still no movement after 500ms — long press
        setActionSheetItem(item)
        delete touchStart.current[item.id]
      }
    }, LONG_PRESS_MS)

    touchStart.current[item.id] = { x: clientX, y: clientY, lock: null, longPressTimer }
  }

  function handleTouchMove(id: string, clientX: number, clientY: number) {
    const start = touchStart.current[id]
    if (!start) return
    const dx = clientX - start.x
    const dy = clientY - start.y

    if (start.lock === null) {
      if (Math.abs(dx) < DIRECTION_LOCK_THRESHOLD && Math.abs(dy) < DIRECTION_LOCK_THRESHOLD) return
      start.lock = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      // Cancel long press once we know it's a gesture
      if (start.longPressTimer) { clearTimeout(start.longPressTimer); start.longPressTimer = null }
    }

    if (start.lock === 'v') return
    setSwipeDeltas(prev => ({ ...prev, [id]: dx }))
  }

  function handleTouchEnd(id: string, item: Item) {
    const start = touchStart.current[id]
    const delta = swipeDeltas[id] ?? 0
    if (start?.longPressTimer) clearTimeout(start.longPressTimer)
    delete touchStart.current[id]

    if (start?.lock === 'h') {
      dismissHint()
      if (delta > SWIPE_THRESHOLD) toggleItem(id, item.checked)
      else if (delta < -SWIPE_THRESHOLD) deleteItemWithUndo(item)
    }

    if (delta !== 0) {
      setSnappingItems(prev => new Set(prev).add(id))
      setSwipeDeltas(prev => ({ ...prev, [id]: 0 }))
      setTimeout(() => {
        setSnappingItems(prev => { const n = new Set(prev); n.delete(id); return n })
      }, 220)
    }
  }

  // ── Derived ──────────────────────────────────────────────────

  const searchActive = searchMode && inputText.trim().length > 0
  const filteredItems = searchActive
    ? items.filter(i => i.name.toLowerCase().includes(inputText.toLowerCase()))
    : items
  const unchecked = filteredItems.filter(i => !i.checked)
  const checked = filteredItems.filter(i => i.checked)
  const totalCount = items.length
  const checkedCount = items.filter(i => i.checked).length
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  const hasRegularsToAdd = recurringNames.size > 0 &&
    [...recurringNames].some(name => !items.some(i => i.name.toLowerCase() === name))

  // ── Item row ──────────────────────────────────────────────────

  function renderItem(item: Item, isFirst: boolean = false) {
    const delta = swipeDeltas[item.id] ?? 0
    const isSnapping = snappingItems.has(item.id)
    const isRenaming = renamingId === item.id
    const isFlashing = recentlyAddedIds.has(item.id)
    const borderColor = CATEGORY_BORDER[item.category] ?? CATEGORY_BORDER['Other']

    return (
      <div
        key={item.id}
        className={`relative rounded-xl overflow-hidden mb-2 ${isFlashing ? 'animate-flash' : ''}`}
      >
        {/* Swipe hint - only on first item */}
        {isFirst && showSwipeHint && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none animate-pulse bg-stone-900/85 text-white text-xs px-3 py-1.5 rounded-full whitespace-nowrap">
            ← swipe to delete · check →
          </div>
        )}

        {/* Swipe backgrounds */}
        <div className={`absolute inset-0 flex items-center px-5 bg-emerald-500 transition-opacity duration-100 ${delta > 30 ? 'opacity-100' : 'opacity-0'}`}>
          <Check size={22} className="text-white" />
        </div>
        <div className={`absolute inset-0 flex items-center justify-end px-5 bg-red-400 transition-opacity duration-100 ${delta < -30 ? 'opacity-100' : 'opacity-0'}`}>
          <Trash2 size={21} className="text-white" />
        </div>

        {/* Item content */}
        <div
          className={`relative z-10 flex items-center gap-3 bg-white py-4 pl-4 pr-3 shadow-sm shadow-rose-100 ${item.checked ? 'opacity-50' : ''}`}
          style={{
            transform: `translateX(${delta}px)`,
            transition: isSnapping ? 'transform 0.22s ease' : 'none',
            borderLeft: `4px solid ${borderColor}`,
          }}
          onTouchStart={e => handleTouchStart(item, e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => handleTouchMove(item.id, e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={() => handleTouchEnd(item.id, item)}
          onTouchCancel={() => handleTouchEnd(item.id, item)}
        >
          <button
            onClick={() => toggleItem(item.id, item.checked)}
            className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${
              item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-rose-300'
            }`}
            aria-label={item.checked ? 'Mark item as not picked' : 'Mark item as picked'}
          >
            {item.checked && <Check size={15} className="text-white" />}
          </button>

          {isRenaming ? (
            <input
              autoFocus
              value={renameText}
              onChange={e => setRenameText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveRename(item.id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onBlur={() => saveRename(item.id)}
              className={`flex-1 text-base outline-none border-b border-rose-300 ${item.checked ? 'line-through text-stone-400' : 'text-stone-900'}`}
            />
          ) : (
            <button
              onClick={() => setActionSheetItem(item)}
              className={`flex-1 text-left text-base ${item.checked ? 'line-through text-stone-400' : 'text-stone-900'}`}
            >
              {item.name}
            </button>
          )}

          <button
            onClick={() => setActionSheetItem(item)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-stone-300 active:bg-rose-50"
            aria-label={`More actions for ${item.name}`}
            title={`More actions for ${item.name}`}
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
      </div>
    )
  }

  // ── Renderers ────────────────────────────────────────────────

  function renderShoppingMode() {
    const groups: { category: string; items: Item[] }[] = []
    for (const cat of CATEGORIES) {
      const catItems = unchecked.filter(i => (i.category || 'Other') === cat)
      if (catItems.length > 0) groups.push({ category: cat, items: catItems })
    }
    return (
      <>
        {groups.map(({ category, items: groupItems }, gIdx) => (
          <div key={category}>
            <div className="flex items-center gap-2 px-1 pt-4 pb-2">
              <span className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[category]}`} />
              <span className={`text-xs font-semibold uppercase tracking-wider ${CATEGORY_TEXT[category]}`}>
                {category}
              </span>
              <span className="text-xs font-medium text-stone-300">{groupItems.length}</span>
            </div>
            {groupItems.map((item, idx) => renderItem(item, gIdx === 0 && idx === 0))}
          </div>
        ))}
        {checked.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-300 uppercase tracking-wider px-1 pt-4 pb-2">Done</p>
            {checked.map(item => renderItem(item))}
          </div>
        )}
      </>
    )
  }

  function renderEmptyState() {
    if (searchActive) {
      return <p className="text-center text-stone-300 mt-16 text-base">No matches for &ldquo;{inputText}&rdquo;</p>
    }
    if (recurringNames.size > 0) {
      return (
        <div className="text-center mt-20 px-6">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-stone-600 text-base mb-2 font-semibold">Your list is empty</p>
          <p className="text-stone-400 text-sm">Tap <span className="text-amber-500 font-medium">Regulars</span> to add your usual items</p>
        </div>
      )
    }
    return (
      <div className="text-center mt-20 px-6">
        <p className="text-5xl mb-4">🛒</p>
        <p className="text-stone-600 text-base mb-2 font-semibold">Your list is empty</p>
        <p className="text-stone-400 text-sm">Try adding &ldquo;Milk&rdquo; or &ldquo;Eggs&rdquo; to get started</p>
      </div>
    )
  }

  function renderNormalMode() {
    if (filteredItems.length === 0) return renderEmptyState()
    const collapseChecked = !searchActive && checked.length > 8 && !showChecked

    return (
      <>
        {unchecked.map((item, idx) => renderItem(item, idx === 0))}
        {checked.length > 0 && (
          <>
            <div className="flex items-center justify-between pt-4 pb-2 px-1">
              <button
                onClick={() => setShowChecked(!showChecked)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-300 uppercase tracking-wider"
              >
                Checked off ({checked.length})
                {collapseChecked ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
              <div className="flex items-center gap-2">
                {collapseChecked && <Badge tone="stone">Hidden</Badge>}
                {!searchActive && (
                <button onClick={clearCheckedWithUndo} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-red-50 text-red-500 font-medium">
                  <Trash2 size={13} />
                  Clear all
                </button>
                )}
              </div>
            </div>
            {!collapseChecked && checked.map(item => renderItem(item))}
          </>
        )}
      </>
    )
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <AppShell>

      {syncConflict && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          Some offline changes conflicted, so the latest saved version is showing.
        </div>
      )}

      {syncMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {syncMessage}
        </div>
      )}

      {/* Header */}
      <div className="safe-top sticky top-0 z-20 bg-[var(--background)]/95 px-5 pb-3 backdrop-blur">
        {/* Back button on its own row */}
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-stone-500 text-sm font-medium mb-2 -ml-1 px-1 py-1 active:bg-rose-50 rounded-lg"
        >
          <ArrowLeft size={16} />
          Lists
        </button>

        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-stone-900 truncate">{listName}</h1>
              {isOffline && (
                <Badge tone="red"><WifiOff size={12} className="mr-1" /> Offline</Badge>
              )}
            </div>
            <p className="text-stone-400 text-sm mt-0.5">
              {items.filter(i => !i.checked).length} item{items.filter(i => !i.checked).length !== 1 ? 's' : ''} left
              {pendingCount > 0 && ` · ${pendingCount} waiting to sync`}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 ml-2 flex-shrink-0">
            <IconButton
              label={searchMode ? 'Close search' : 'Search items'}
              onClick={() => { setSearchMode(!searchMode); setInputText(''); setSuggestions([]) }}
              className={searchMode ? 'bg-rose-100 text-rose-600' : ''}
            >
              <Search size={18} />
            </IconButton>
            {hasRegularsToAdd && !shoppingMode && !searchMode && (
              <button onClick={addRegulars} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 font-semibold whitespace-nowrap">
                <Star size={13} fill="currentColor" />
                Regulars
              </button>
            )}
          </div>
        </div>

        <Button
          onClick={() => setShoppingMode(!shoppingMode)}
          variant={shoppingMode ? 'secondary' : 'primary'}
          className="w-full py-3 text-base"
        >
          {shoppingMode ? <Check size={18} /> : <ShoppingCart size={18} />}
          {shoppingMode ? 'Done shopping' : 'Start shopping'}
        </Button>
      </div>

      {/* Shopping mode progress */}
      {shoppingMode && (
        <div className="sticky top-[9.5rem] z-10 bg-[var(--background)]/95 px-5 pb-3 backdrop-blur">
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
            <span>{checkedCount} of {totalCount} picked</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-white rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Add or Search input */}
      {!shoppingMode && (
        <div className="px-4 mb-1">
          <div className="flex gap-2">
            <TextInput
              ref={inputRef}
              type="text"
              placeholder={searchMode ? 'Search items...' : 'Add an item (or paste a list)...'}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value)
                if (!searchMode) fetchSuggestions(e.target.value)
              }}
              onPaste={e => {
                if (searchMode) return
                const pasted = e.clipboardData.getData('text')
                // If multi-line paste, intercept and bulk-add
                if (/[\n\r]/.test(pasted)) {
                  e.preventDefault()
                  handleAddInput(pasted)
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !searchMode) handleAddInput(inputText)
                if (e.key === 'Escape' && searchMode) { setSearchMode(false); setInputText('') }
              }}
              className="flex-1"
              autoCapitalize="words"
              autoCorrect="off"
            />
            {searchMode ? (
              inputText && (
                <Button variant="secondary" onClick={() => setInputText('')} className="px-4">×</Button>
              )
            ) : (
              <Button onClick={() => handleAddInput(inputText)} className="px-5">
                <Plus size={18} />
                Add
              </Button>
            )}
          </div>

          {!searchMode && suggestions.length > 0 && (
            <div className="bg-white border border-rose-100 rounded-2xl mt-1 overflow-hidden shadow-sm shadow-rose-100">
              {suggestions.map(s => (
                <button
                  key={s.name}
                  onClick={() => handleAddInput(s.name)}
                  className="w-full text-left px-4 py-3 text-base text-stone-700 border-b border-rose-50 last:border-0 active:bg-rose-50 flex items-center gap-3"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${CATEGORY_COLORS[inferCategory(s.name)]}`} />
                  <span className="flex-1">{s.name}</span>
                  {s.is_recurring && <Star size={15} className="text-amber-400" fill="currentColor" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* List */}
      <div className="flex-1 px-4 pt-2 pb-20">
        {loading && items.length === 0 ? (
          <div className="flex justify-center mt-20">
            <div className="w-8 h-8 border-4 border-rose-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shoppingMode ? renderShoppingMode() : renderNormalMode()}
      </div>

      {/* Action sheet */}
      {actionSheetItem && (
        <ItemActionSheet
          item={actionSheetItem}
          isStarred={recurringNames.has(actionSheetItem.name.toLowerCase())}
          onClose={() => setActionSheetItem(null)}
          onRename={() => { setRenamingId(actionSheetItem.id); setRenameText(actionSheetItem.name) }}
          onToggleStar={() => toggleRecurring(actionSheetItem.name)}
          onChangeCategory={cat => changeCategory(actionSheetItem.id, cat)}
          onDelete={() => deleteItemWithUndo(actionSheetItem)}
        />
      )}

      {/* Undo snackbar */}
      {pendingDelete && (
        <UndoSnackbar
          message={pendingDelete.message}
          onUndo={undoPendingDelete}
          onDismiss={commitPendingDelete}
        />
      )}
    </AppShell>
  )
}
