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
    <div className="grid grid-cols-6 gap-2 p-2 bg-white border border-gray-200 rounded-xl">
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onSelect(e)}
          className={`text-2xl py-2 rounded-lg ${selected === e ? 'bg-green-100' : 'active:bg-gray-100'}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
