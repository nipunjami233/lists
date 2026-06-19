'use client'

import { useState } from 'react'
import { getCategoryBg } from '@/lib/categories'
import type { CategoryConfig } from '@/lib/categories'
import type { Item } from '@/lib/types'
import { SheetFrame } from './ui'
import { Check, ChevronLeft, ChevronRight, Circle, Pencil, Star, Trash2 } from 'lucide-react'

export default function ItemActionSheet({
  item,
  isStarred,
  categories,
  onClose,
  onRename,
  onToggleStar,
  onChangeCategory,
  onDelete,
}: {
  item: Item
  isStarred: boolean
  categories: CategoryConfig[]
  onClose: () => void
  onRename: () => void
  onToggleStar: () => void
  onChangeCategory: (category: string) => void
  onDelete: () => void
}) {
  const [showCategories, setShowCategories] = useState(false)

  return (
    <SheetFrame onClose={onClose}>
        {/* Item name */}
        <div className="px-6 pb-3 border-b border-rose-50">
          <p className="text-base font-bold text-stone-900 truncate">{item.name}</p>
          <p className="text-xs text-stone-400 mt-0.5">{item.category}</p>
        </div>

        {showCategories ? (
          <>
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <button onClick={() => setShowCategories(false)} className="inline-flex items-center gap-1 text-rose-500 text-sm px-3 py-2">
                <ChevronLeft size={16} />
                Back
              </button>
              <p className="text-xs uppercase tracking-wider text-stone-400 pr-3">Pick category</p>
            </div>
            <div className="px-2 pb-2">
              {categories.map(category => (
                <button
                  key={category.name}
                  onClick={() => { onChangeCategory(category.name); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:bg-rose-50"
                >
                  <span className={`w-3 h-3 rounded-full ${getCategoryBg(category.name, categories)}`} />
                  <span className="text-base text-stone-900 flex-1 text-left">{category.name}</span>
                  {item.category === category.name && <Check size={18} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="px-2 py-2">
            <SheetButton icon={<Pencil size={19} />} label="Rename" onClick={() => { onRename(); onClose() }} />
            <SheetButton
              icon={<Star size={20} fill={isStarred ? 'currentColor' : 'none'} />}
              label={isStarred ? 'Remove from regulars' : 'Add to regulars'}
              iconColor={isStarred ? 'text-amber-400' : 'text-gray-400'}
              onClick={() => { onToggleStar(); onClose() }}
            />
            <SheetButton
              icon={<Circle size={14} className={getCategoryBg(item.category, categories).replace('bg-', 'text-')} fill="currentColor" />}
              label="Change category"
              onClick={() => setShowCategories(true)}
              showChevron
            />
            <SheetButton
              icon={<Trash2 size={20} />}
              label="Delete"
              danger
              onClick={() => { onDelete(); onClose() }}
            />
          </div>
        )}
    </SheetFrame>
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
      className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-rose-50"
    >
      <span className={`text-xl w-6 flex justify-center ${iconColor}`}>{icon}</span>
      <span className={`text-base flex-1 text-left ${danger ? 'text-red-500' : 'text-stone-900'}`}>
        {label}
      </span>
      {showChevron && <ChevronRight size={18} className="text-stone-300" />}
    </button>
  )
}
