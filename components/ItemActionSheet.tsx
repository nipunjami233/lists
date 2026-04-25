'use client'

import { useState } from 'react'
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories'
import type { Item } from '@/lib/types'

export default function ItemActionSheet({
  item,
  isStarred,
  onClose,
  onRename,
  onToggleStar,
  onChangeCategory,
  onDelete,
}: {
  item: Item
  isStarred: boolean
  onClose: () => void
  onRename: () => void
  onToggleStar: () => void
  onChangeCategory: (category: string) => void
  onDelete: () => void
}) {
  const [showCategories, setShowCategories] = useState(false)

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg mx-auto bg-white rounded-t-3xl pb-10 animate-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Item name */}
        <div className="px-6 pb-3 border-b border-gray-100">
          <p className="text-base font-semibold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.category}</p>
        </div>

        {showCategories ? (
          <>
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <button onClick={() => setShowCategories(false)} className="text-green-500 text-sm px-3 py-2">
                ‹ Back
              </button>
              <p className="text-xs uppercase tracking-wider text-gray-400 pr-3">Pick category</p>
            </div>
            <div className="px-2 pb-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => { onChangeCategory(cat); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:bg-gray-100"
                >
                  <span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[cat]}`} />
                  <span className="text-base text-gray-900 flex-1 text-left">{cat}</span>
                  {item.category === cat && <span className="text-green-500">✓</span>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="px-2 py-2">
            <SheetButton icon="✎" label="Rename" onClick={() => { onRename(); onClose() }} />
            <SheetButton
              icon={isStarred ? '★' : '☆'}
              label={isStarred ? 'Remove from regulars' : 'Add to regulars'}
              iconColor={isStarred ? 'text-amber-400' : 'text-gray-400'}
              onClick={() => { onToggleStar(); onClose() }}
            />
            <SheetButton
              icon={<span className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[item.category]}`} />}
              label="Change category"
              onClick={() => setShowCategories(true)}
              showChevron
            />
            <SheetButton
              icon="🗑"
              label="Delete"
              danger
              onClick={() => { onDelete(); onClose() }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SheetButton({
  icon,
  label,
  onClick,
  danger = false,
  iconColor = '',
  showChevron = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  iconColor?: string
  showChevron?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 rounded-xl active:bg-gray-100"
    >
      <span className={`text-xl w-6 flex justify-center ${iconColor}`}>{icon}</span>
      <span className={`text-base flex-1 text-left ${danger ? 'text-red-500' : 'text-gray-900'}`}>
        {label}
      </span>
      {showChevron && <span className="text-gray-300 text-lg">›</span>}
    </button>
  )
}
