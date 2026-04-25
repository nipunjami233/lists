'use client'

import { useState } from 'react'
import EmojiPicker from './EmojiPicker'

type List = {
  id: string
  name: string
  emoji: string | null
}

export default function ListActionSheet({
  list,
  onClose,
  onRename,
  onChangeEmoji,
  onDelete,
}: {
  list: List
  onClose: () => void
  onRename: () => void
  onChangeEmoji: (emoji: string) => void
  onDelete: () => void
}) {
  const [pickingEmoji, setPickingEmoji] = useState(false)

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl pb-10 animate-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-6 pb-3 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">{list.emoji ?? '📋'}</span>
          <p className="text-base font-semibold text-gray-900 truncate">{list.name}</p>
        </div>

        {pickingEmoji ? (
          <>
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <button onClick={() => setPickingEmoji(false)} className="text-green-500 text-sm px-3 py-2">‹ Back</button>
              <p className="text-xs uppercase tracking-wider text-gray-400 pr-3">Pick emoji</p>
            </div>
            <div className="px-4 pb-2">
              <EmojiPicker
                selected={list.emoji}
                onSelect={emoji => { onChangeEmoji(emoji); onClose() }}
              />
            </div>
          </>
        ) : (
          <div className="px-2 py-2">
            <SheetButton icon="✎" label="Rename" onClick={() => { onRename(); onClose() }} />
            <SheetButton icon={list.emoji ?? '📋'} label="Change emoji" onClick={() => setPickingEmoji(true)} showChevron />
            <SheetButton icon="🗑" label="Delete list" danger onClick={() => { onDelete(); onClose() }} />
          </div>
        )}
      </div>
    </div>
  )
}

function SheetButton({
  icon, label, onClick, danger = false, showChevron = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  showChevron?: boolean
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl active:bg-gray-100">
      <span className="text-xl w-6 flex justify-center">{icon}</span>
      <span className={`text-base flex-1 text-left ${danger ? 'text-red-500' : 'text-gray-900'}`}>{label}</span>
      {showChevron && <span className="text-gray-300 text-lg">›</span>}
    </button>
  )
}
