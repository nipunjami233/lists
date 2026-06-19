'use client'

import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getHouseholdAccess, getListSummaries } from '@/lib/household'
import type { HouseholdAccess, ListSummary } from '@/lib/types'
import EmojiPicker from './EmojiPicker'
import ListActionSheet from './ListActionSheet'
import SettingsScreen from './SettingsScreen'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'
import { AppShell, Badge, Button, TextInput } from './ui'
import { LogOut, MoreHorizontal, Plus, Settings, Sparkles } from 'lucide-react'

type List = ListSummary

const SAMPLE_LISTS = [
  { name: 'Groceries', emoji: '🛒' },
  { name: 'Household', emoji: '🏠' },
  { name: 'Party', emoji: '🎉' },
]

const LONG_PRESS_MS = 500
const LISTS_HINT_KEY = 'hasSeenListsHint'

export default function ListsScreen({
  session,
  onSelectList,
}: {
  session: Session
  onSelectList: (list: List) => void
}) {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<HouseholdAccess | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState<string>('📋')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [renameEmoji, setRenameEmoji] = useState<string>('📋')
  const [showProfile, setShowProfile] = useState(false)
  const [actionSheetList, setActionSheetList] = useState<List | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [screen, setScreen] = useState<'lists' | 'settings'>('lists')

  const longPressTimer = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const longPressFired = useRef<Record<string, boolean>>({})

  useEffect(() => {
    let active = true

    async function init() {
      try {
        const householdAccess = await getHouseholdAccess(session.user.id)
        if (!active) return
        setAccess(householdAccess)
        if (householdAccess.status === 'none') {
          setLoading(false)
          return
        }
        await fetchLists()
      } catch {
        if (active) setLoading(false)
      }
    }

    init()

    const channel = supabase
      .channel('lists-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lists' }, fetchLists)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, fetchLists)
      .subscribe()

    if (typeof window !== 'undefined') {
      const seen = localStorage.getItem(LISTS_HINT_KEY)
      if (!seen) {
        setShowHint(true)
        localStorage.setItem(LISTS_HINT_KEY, '1')
        setTimeout(() => setShowHint(false), 6000)
      }
    }

    return () => { active = false; supabase.removeChannel(channel) }
  }, [session.user.id])

  async function fetchLists() {
    const summaries = await getListSummaries()
    setLists(summaries)
    setLoading(false)
  }

  async function createList(presetName?: string, presetEmoji?: string) {
    const name = (presetName ?? newName).trim()
    const emoji = presetEmoji ?? newEmoji
    if (!name) return
    setNewName(''); setNewEmoji('📋'); setCreating(false)
    const payload = access?.status === 'member'
      ? { name, emoji, household_id: access.householdId }
      : { name, emoji }
    await supabase.from('lists').insert(payload)
  }

  async function deleteList(id: string) {
    await supabase.from('lists').delete().eq('id', id)
  }

  function startRename(list: List) {
    setRenamingId(list.id)
    setRenameText(list.name)
    setRenameEmoji(list.emoji ?? '📋')
  }

  async function saveRename(id: string) {
    const name = renameText.trim()
    setRenamingId(null)
    if (!name) return
    await supabase.from('lists').update({ name, emoji: renameEmoji }).eq('id', id)
  }

  async function changeEmoji(id: string, emoji: string) {
    await supabase.from('lists').update({ emoji }).eq('id', id)
  }

  // Long-press on list card
  function handleListTouchStart(list: List) {
    longPressFired.current[list.id] = false
    longPressTimer.current[list.id] = setTimeout(() => {
      longPressFired.current[list.id] = true
      setActionSheetList(list)
    }, LONG_PRESS_MS)
  }

  function handleListTouchEnd(list: List) {
    const timer = longPressTimer.current[list.id]
    if (timer) clearTimeout(timer)
    longPressTimer.current[list.id] = null
  }

  function handleListTouchMove(list: List) {
    const timer = longPressTimer.current[list.id]
    if (timer) clearTimeout(timer)
    longPressTimer.current[list.id] = null
  }

  function handleListClick(list: List) {
    // Don't navigate if long-press just fired
    if (longPressFired.current[list.id]) {
      longPressFired.current[list.id] = false
      return
    }
    onSelectList(list)
  }

  const userInitial = (session.user.email?.[0] ?? '?').toUpperCase()

  if (screen === 'settings') {
    return (
      <SettingsScreen
        householdId={access?.status === 'member' ? access.householdId : null}
        householdName={access?.status === 'member' ? access.householdName : undefined}
        onBack={() => setScreen('lists')}
      />
    )
  }

  if (!loading && access?.status === 'none') {
    return (
      <AppShell>
        <div className="safe-top flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-rose-100 text-3xl">💌</div>
          <h1 className="text-3xl font-bold text-stone-900">{APP_NAME}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            You are signed in, but this account has not been added to the NK Household yet.
          </p>
          <Button
            variant="secondary"
            className="mt-8"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={18} />
            Sign out
          </Button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>

      <div className="safe-top px-5 pb-5 flex items-start justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-500 shadow-sm shadow-rose-100">
            <Sparkles size={13} />
            {access?.status === 'member' ? access.householdName : 'Recovered preview'}
          </div>
          <h1 className="text-4xl font-black tracking-normal text-stone-900">{APP_NAME}</h1>
          <p className="text-stone-500 text-sm mt-1">{APP_TAGLINE}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-400 to-orange-300 text-white font-bold flex items-center justify-center shadow-sm shadow-rose-200"
          >
            {userInitial}
          </button>
          {showProfile && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-12 z-40 bg-white rounded-2xl shadow-lg border border-rose-100 min-w-[210px] overflow-hidden">
	                <div className="px-4 py-3 border-b border-rose-50">
	                  <p className="text-xs text-stone-400">Signed in as</p>
	                  <p className="text-sm text-stone-900 truncate">{session.user.email}</p>
	                </div>
	                <button
	                  onClick={() => { setShowProfile(false); setScreen('settings') }}
	                  className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm text-stone-700 active:bg-rose-50"
	                >
	                  <Settings size={16} />
	                  Manage categories
	                </button>
	                <button
	                  onClick={() => supabase.auth.signOut()}
	                  className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm text-red-500 active:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hint - shown once */}
      {showHint && lists.length > 0 && (
        <div className="mx-4 mb-3 px-4 py-2.5 bg-stone-900 text-white text-xs rounded-2xl flex items-center gap-2 shadow-lg">
          <Sparkles size={14} />
          <span>Long-press a list to rename, change emoji, or delete</span>
        </div>
      )}

      <div className="flex-1 px-4 pb-10 space-y-2">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-8 h-8 border-4 border-rose-300 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lists.length === 0 && !creating ? (
          <div className="text-center mt-12 px-4">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-stone-700 text-lg font-semibold mb-1">Create your first list</p>
            <p className="text-stone-400 text-sm mb-6">Pick one to get started, or make your own</p>
            <div className="space-y-2">
              {SAMPLE_LISTS.map(s => (
                <button
                  key={s.name}
                  onClick={() => createList(s.name, s.emoji)}
                  className="w-full flex items-center gap-3 bg-white px-4 py-4 rounded-2xl shadow-sm shadow-rose-100 active:bg-rose-50"
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="flex-1 text-left text-base font-medium text-stone-900">{s.name}</span>
                  <Plus size={18} className="text-rose-300" />
                </button>
              ))}
            </div>
            <button onClick={() => setCreating(true)} className="mt-6 text-rose-500 font-medium text-sm">
              Or create custom list
            </button>
          </div>
        ) : (
          <>
            {lists.map(list => (
              renamingId === list.id ? (
                <div key={list.id} className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-3xl px-3 py-2 bg-white rounded-2xl border border-rose-100"
                    >
                      {renameEmoji}
                    </button>
                    <TextInput
                      autoFocus
                      type="text"
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(list.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="flex-1"
                    />
                    <Button onClick={() => saveRename(list.id)} className="px-5">
                      Save
                    </Button>
                  </div>
                  <EmojiPicker selected={renameEmoji} onSelect={setRenameEmoji} />
                </div>
              ) : (
                <div
                  key={list.id}
                  className="flex w-full items-stretch overflow-hidden rounded-[1.4rem] bg-white shadow-sm shadow-rose-100"
                >
                  <button
                    type="button"
                    onClick={() => handleListClick(list)}
                    onTouchStart={() => handleListTouchStart(list)}
                    onTouchEnd={() => handleListTouchEnd(list)}
                    onTouchMove={() => handleListTouchMove(list)}
                    onTouchCancel={() => handleListTouchEnd(list)}
                    onContextMenu={e => { e.preventDefault(); setActionSheetList(list) }}
                    className="flex min-w-0 flex-1 items-center gap-4 px-4 py-4 text-left active:bg-rose-50"
                  >
                    <span className="text-2xl">{list.emoji ?? '📋'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-stone-900">{list.name}</p>
                      <p className="text-sm text-stone-400">
                        {list.unchecked_count} left · {list.item_count} total
                      </p>
                    </div>
                    {list.unchecked_count === 0 && list.item_count > 0 && <Badge tone="green">Done</Badge>}
                  </button>
                  <button
                    type="button"
                    aria-label={`More actions for ${list.name}`}
                    title={`More actions for ${list.name}`}
                    onClick={e => {
                      e.stopPropagation()
                      handleListTouchEnd(list)
                      setActionSheetList(list)
                    }}
                    onTouchStart={e => e.stopPropagation()}
                    onContextMenu={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      setActionSheetList(list)
                    }}
                    className="flex w-14 flex-shrink-0 items-center justify-center text-stone-400 active:bg-rose-50"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              )
            ))}

            {creating ? (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button type="button" className="text-3xl px-3 py-2 bg-white rounded-2xl border border-rose-100">
                    {newEmoji}
                  </button>
                  <TextInput
                    autoFocus
                    type="text"
                    placeholder="List name..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createList()
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); setNewEmoji('📋') }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={() => createList()} className="px-5">
                    Add
                  </Button>
                </div>
                <EmojiPicker selected={newEmoji} onSelect={setNewEmoji} />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full py-4 rounded-[1.4rem] border-2 border-dashed border-rose-200 text-rose-400 text-base font-semibold active:bg-rose-50"
              >
                <span className="inline-flex items-center gap-2"><Plus size={18} /> New list</span>
              </button>
            )}
          </>
        )}
      </div>

      {actionSheetList && (
        <ListActionSheet
          list={actionSheetList}
          onClose={() => setActionSheetList(null)}
          onRename={() => startRename(actionSheetList)}
          onChangeEmoji={emoji => changeEmoji(actionSheetList.id, emoji)}
          onDelete={() => deleteList(actionSheetList.id)}
        />
      )}
    </AppShell>
  )
}
