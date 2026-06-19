'use client'

import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-rose-400 text-white shadow-sm shadow-rose-200 active:bg-rose-500',
  secondary: 'bg-white text-stone-800 border border-rose-100 shadow-sm active:bg-rose-50',
  ghost: 'text-stone-500 active:bg-rose-50',
  danger: 'bg-red-50 text-red-500 active:bg-red-100',
  success: 'bg-emerald-500 text-white active:bg-emerald-600',
}

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60',
        buttonVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-stone-500 shadow-sm shadow-rose-100 transition active:bg-rose-50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({
  className,
  ...props
}, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        'w-full rounded-2xl border border-rose-100 bg-white px-4 py-4 text-base text-stone-900 outline-none shadow-sm shadow-rose-100 placeholder:text-stone-300 focus:border-rose-300',
        className
      )}
      {...props}
    />
  )
})

export function Badge({
  tone = 'rose',
  children,
}: {
  tone?: 'rose' | 'green' | 'amber' | 'stone' | 'red'
  children: ReactNode
}) {
  const tones = {
    rose: 'bg-rose-100 text-rose-600',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    stone: 'bg-stone-100 text-stone-600',
    red: 'bg-red-100 text-red-500',
  }

  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone])}>
      {children}
    </span>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-[var(--background)] text-stone-900">
      {children}
    </div>
  )
}

export function SheetFrame({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-950/35 backdrop-blur-[2px]" />
      <div
        className="relative mx-auto w-full max-w-lg rounded-t-[2rem] bg-white pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2 pt-3">
          <div className="h-1 w-10 rounded-full bg-rose-100" />
        </div>
        {children}
      </div>
    </div>
  )
}

export { cx }
