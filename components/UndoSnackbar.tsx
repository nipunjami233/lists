'use client'

import { useEffect } from 'react'

export default function UndoSnackbar({
  message,
  onUndo,
  onDismiss,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 z-50 animate-snackbar-up bg-gray-900 text-white rounded-full pl-5 pr-2 py-2 flex items-center gap-3 shadow-xl"
         style={{ transform: 'translateX(-50%)', bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <span className="text-sm">{message}</span>
      <button
        onClick={onUndo}
        className="bg-white/10 hover:bg-white/20 text-rose-200 font-semibold text-sm px-4 py-1.5 rounded-full"
      >
        Undo
      </button>
    </div>
  )
}
