'use client'

const EMOJIS = ['🛒', '🛍️', '🏠', '🎉', '🧹', '🍽️', '🎁', '📋', '📝', '✈️', '🎂', '🍕']

export default function EmojiPicker({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (emoji: string) => void
}) {
  return (
    <div className="grid grid-cols-6 gap-2 p-2 bg-white border border-rose-100 rounded-2xl shadow-sm shadow-rose-100">
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onSelect(e)}
          className={`text-2xl py-2 rounded-xl ${selected === e ? 'bg-rose-100' : 'active:bg-rose-50'}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
