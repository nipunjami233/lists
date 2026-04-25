'use client'

import { useState, useEffect, useRef } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import EmojiPicker from './EmojiPicker'
import ListActionSheet from './ListActionSheet'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'

type List = {
  id: string
  name: string
  emoji: string | null
  created_at: string
  item_count?: number
  unchecked_count?: number
  last_activity?: string | null
}

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
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState<string>('📋')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [renameEmoji, setRenameEmoji] = useState<string>('📋')
  const [showProfile, setShowProfile] = useState(false)
  const [actionSheetList, setActionSheetList] = useState<List | null>(null)
  const [showHint, setShowHint] = useState(false)

  const longPressTimer = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const longPressFired = useRef<Record<string, boolean>>({})

  useEffect(() => {
    fetchLists()
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

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchLists() {
    const { data: listsData } = await supabase
      .from('lists').select('*').order('created_at', { ascending: true })
    if (!listsData) return

    const withCounts = await Promise.all(
      listsData.map(async list => {
        const { count: total } = await supabase
          .from('items').select('*', { count: 'exact', head: true }).eq('list_id', list.id)
        const { count: unchecked } = await supabase
          .from('items').select('*', { count: 'exact', head: true }).eq('list_id', list.id).eq('checked', false)
        const { data: latest } = await supabase
          .from('items').select('updated_at').eq('list_id', list.id)
          .order('updated_at', { ascending: false }).limit(1).maybeSingle()
        return {
          ...list,
          item_count: total ?? 0,
          unchecked_count: unchecked ?? 0,
          last_activity: latest?.updated_at ?? null,
        }
      })
    )

    withCounts.sort((a, b) => {
      if (!a.last_activity && !b.last_activity) return a.name.localeCompare(b.name)
      if (!a.last_activity) return 1
      if (!b.last_activity) return -1
      return b.last_activity.localeCompare(a.last_activity)
    })

    setLists(withCounts)
    setLoading(false)
  }

  async function createList(presetName?: string, presetEmoji?: string) {
    const name = (presetName ?? newName).trim()
    const emoji = presetEmoji ?? newEmoji
    if (!name) return
    setNewName(''); setNewEmoji('📋'); setCreating(false)
    await supabase.from('lists').insert({ name, emoji })
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">

      <div className="px-5 pt-14 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-400 text-sm mt-1">{APP_TAGLINE}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowProfile(!showProfile)}
            className="w-10 h-10 rounded-full bg-green-400 text-white font-semibold flex items-center justify-center"
          >
            {userInitial}
          </button>
          {showProfile && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowProfile(false)} />
              <div className="absolute right-0 top-12 z-40 bg-white rounded-xl shadow-lg border border-gray-100 min-w-[180px] overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs text-gray-400">Signed in as</p>
                  <p className="text-sm text-gray-900 truncate">{session.user.email}</p>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full text-left px-4 py-3 text-sm text-red-500 active:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hint - shown once */}
      {showHint && lists.length > 0 && (
        <div className="mx-4 mb-3 px-4 py-2.5 bg-gray-900 text-white text-xs rounded-xl flex items-center gap-2">
          <span>💡</span>
          <span>Long-press a list to rename, change emoji, or delete</span>
        </div>
      )}

      <div className="flex-1 px-4 pb-10 space-y-2">
        {loading ? (
          <div className="flex justify-center mt-20">
            <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lists.length === 0 && !creating ? (
          <div className="text-center mt-12 px-4">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-gray-700 text-lg font-semibold mb-1">Create your first list</p>
            <p className="text-gray-400 text-sm mb-6">Pick one to get started, or make your own</p>
            <div className="space-y-2">
              {SAMPLE_LISTS.map(s => (
                <button
                  key={s.name}
                  onClick={() => createList(s.name, s.emoji)}
                  className="w-full flex items-center gap-3 bg-white px-4 py-4 rounded-xl active:bg-gray-50"
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="flex-1 text-left text-base font-medium text-gray-900">{s.name}</span>
                  <span className="text-gray-300">+</span>
                </button>
              ))}
            </div>
            <button onClick={() => setCreating(true)} className="mt-6 text-green-500 font-medium text-sm">
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
                      className="text-3xl px-3 py-2 bg-white rounded-xl border border-gray-200"
                    >
                      {renameEmoji}
                    </button>
                    <input
                      autoFocus
                      type="text"
                      value={renameText}
                      onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(list.id)
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="flex-1 px-4 py-4 rounded-xl border border-green-400 text-base outline-none bg-white"
                    />
                    <button onClick={() => saveRename(list.id)} className="px-5 bg-green-400 text-white font-semibold rounded-xl">
                      Save
                    </button>
                  </div>
                  <EmojiPicker selected={renameEmoji} onSelect={setRenameEmoji} />
                </div>
              ) : (
                <button
                  key={list.id}
                  onClick={() => handleListClick(list)}
                  onTouchStart={() => handleListTouchStart(list)}
                  onTouchEnd={() => handleListTouchEnd(list)}
                  onTouchMove={() => handleListTouchMove(list)}
                  onTouchCancel={() => handleListTouchEnd(list)}
                  onContextMenu={e => { e.preventDefault(); setActionSheetList(list) }}
                  className="w-full flex items-center gap-4 bg-white px-4 py-4 rounded-xl text-left active:bg-gray-50"
                >
                  <span className="text-2xl">{list.emoji ?? '📋'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">{list.name}</p>
                    <p className="text-sm text-gray-400">
                      {list.unchecked_count} left · {list.item_count} total
                    </p>
                  </div>
                  <span className="text-gray-300 text-lg">›</span>
                </button>
              )
            ))}

            {creating ? (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <button type="button" className="text-3xl px-3 py-2 bg-white rounded-xl border border-gray-200">
                    {newEmoji}
                  </button>
                  <input
                    autoFocus
                    type="text"
                    placeholder="List name..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createList()
                      if (e.key === 'Escape') { setCreating(false); setNewName(''); setNewEmoji('📋') }
                    }}
                    className="flex-1 px-4 py-4 rounded-xl border border-gray-200 text-base outline-none focus:border-green-400 bg-white"
                  />
                  <button onClick={() => createList()} className="px-5 bg-green-400 text-white font-semibold rounded-xl">
                    Add
                  </button>
                </div>
                <EmojiPicker selected={newEmoji} onSelect={setNewEmoji} />
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full py-4 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 text-base font-medium active:bg-gray-50"
              >
                + New list
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
    </div>
  )
}
