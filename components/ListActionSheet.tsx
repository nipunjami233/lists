'use client'

import { useState } from 'react'
import EmojiPicker from './EmojiPicker'
import { SheetFrame } from './ui'
import { ChevronLeft, ChevronRight, Pencil, Smile, Trash2 } from 'lucide-react'

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
    <SheetFrame onClose={onClose}>
        <div className="px-6 pb-3 border-b border-rose-50 flex items-center gap-3">
          <span className="text-2xl">{list.emoji ?? '📋'}</span>
          <p className="text-base font-bold text-stone-900 truncate">{list.name}</p>
        </div>

        {pickingEmoji ? (
          <>
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <button onClick={() => setPickingEmoji(false)} className="inline-flex items-center gap-1 text-rose-500 text-sm px-3 py-2">
                <ChevronLeft size={16} />
                Back
              </button>
              <p className="text-xs uppercase tracking-wider text-stone-400 pr-3">Pick emoji</p>
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
            <SheetButton icon={<Pencil size={19} />} label="Rename" onClick={() => { onRename(); onClose() }} />
            <SheetButton icon={<Smile size={20} />} label="Change emoji" onClick={() => setPickingEmoji(true)} showChevron />
            <SheetButton icon={<Trash2 size={20} />} label="Delete list" danger onClick={() => { onDelete(); onClose() }} />
          </div>
        )}
    </SheetFrame>
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
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-rose-50">
      <span className="text-xl w-6 flex justify-center">{icon}</span>
      <span className={`text-base flex-1 text-left ${danger ? 'text-red-500' : 'text-stone-900'}`}>{label}</span>
      {showChevron && <ChevronRight size={18} className="text-stone-300" />}
    </button>
  )
}
