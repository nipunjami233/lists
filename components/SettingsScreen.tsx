'use client'

import { useEffect, useState } from 'react'
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_SWATCHES,
  DEFAULT_CATEGORIES,
  formatKeywords,
  normalizeCategoryName,
  parseKeywords,
} from '@/lib/categories'
import type { CategoryColor, CategoryConfig } from '@/lib/categories'
import {
  addHouseholdCategory,
  deleteHouseholdCategory,
  getHouseholdCategories,
  reorderHouseholdCategories,
  saveHouseholdCategory,
} from '@/lib/categorySettings'
import { AppShell, Button, IconButton, TextInput } from './ui'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'

type CategoryDraft = CategoryConfig & {
  keywordText: string
}

function toDraft(category: CategoryConfig): CategoryDraft {
  return {
    ...category,
    keywordText: formatKeywords(category.keywords),
  }
}

function fromDraft(draft: CategoryDraft): CategoryConfig {
  return {
    id: draft.id,
    name: normalizeCategoryName(draft.name),
    color: draft.color,
    keywords: parseKeywords(draft.keywordText),
    position: draft.position,
  }
}

export default function SettingsScreen({
  householdId,
  householdName,
  onBack,
}: {
  householdId?: string | null
  householdName?: string
  onBack: () => void
}) {
  const [categories, setCategories] = useState<CategoryDraft[]>(DEFAULT_CATEGORIES.map(toDraft))
  const [newName, setNewName] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newColor, setNewColor] = useState<CategoryColor>('rose')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const data = await getHouseholdCategories(householdId)
        if (!active) return
        setCategories(data.map(toDraft))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [householdId])

  function updateDraft(index: number, patch: Partial<CategoryDraft>) {
    setCategories(prev => prev.map((category, i) => i === index ? { ...category, ...patch } : category))
  }

  function duplicateName(name: string, currentId?: string) {
    const cleanName = normalizeCategoryName(name).toLowerCase()
    return categories.some(category => category.id !== currentId && category.name.toLowerCase() === cleanName)
  }

  async function refresh(savedMessage: string) {
    const data = await getHouseholdCategories(householdId)
    setCategories(data.map(toDraft))
    setMessage(savedMessage)
    setTimeout(() => setMessage(''), 2500)
  }

  async function addCategory() {
    if (!householdId) return
    const cleanName = normalizeCategoryName(newName)
    if (!cleanName || duplicateName(cleanName)) return

    await addHouseholdCategory(householdId, {
      name: cleanName,
      color: newColor,
      keywords: parseKeywords(newKeywords),
      position: categories.length,
    })
    setNewName('')
    setNewKeywords('')
    setNewColor('rose')
    await refresh('Category added')
  }

  async function saveCategory(index: number) {
    const draft = categories[index]
    if (!draft?.id) return
    const category = fromDraft(draft)
    if (!category.name || duplicateName(category.name, category.id)) return

    setSavingId(category.id ?? null)
    try {
      await saveHouseholdCategory(category)
      await refresh('Category saved')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteCategory(index: number) {
    const category = categories[index]
    if (!category?.id || category.name === 'Other') return
    const ok = window.confirm(`Delete "${category.name}"? Items in this category will move to Other.`)
    if (!ok) return

    await deleteHouseholdCategory(category.id)
    await refresh('Category deleted')
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= categories.length) return

    const reordered = [...categories]
    const current = reordered[index]
    const swap = reordered[nextIndex]
    reordered[index] = { ...swap, position: index }
    reordered[nextIndex] = { ...current, position: nextIndex }
    setCategories(reordered)
    await reorderHouseholdCategories(reordered.map(fromDraft))
  }

  return (
    <AppShell>
      <div className="safe-top sticky top-0 z-20 bg-[var(--background)]/95 px-5 pb-3 backdrop-blur">
        <button
          onClick={onBack}
          className="mb-3 -ml-1 flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-medium text-stone-500 active:bg-rose-50"
        >
          <ArrowLeft size={16} />
          Lists
        </button>
        <h1 className="text-3xl font-black text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-500">{householdName ?? 'Household'} categories</p>
      </div>

      {message && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg">
          {message}
        </div>
      )}

      <div className="flex-1 space-y-4 px-4 pb-10">
        {!householdId ? (
          <div className="rounded-[1.4rem] bg-white p-5 text-sm leading-6 text-stone-500 shadow-sm shadow-rose-100">
            Category settings are available after household access is enabled.
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-rose-300 border-t-transparent" />
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <div className="px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-stone-400">Add Category</h2>
              </div>
              <div className="space-y-3 rounded-[1.4rem] bg-white p-4 shadow-sm shadow-rose-100">
                <TextInput
                  placeholder="Category name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
                <TextInput
                  placeholder="Keywords, comma separated"
                  value={newKeywords}
                  onChange={e => setNewKeywords(e.target.value)}
                />
                <ColorPicker color={newColor} onChange={setNewColor} />
                <Button
                  onClick={addCategory}
                  disabled={!normalizeCategoryName(newName) || duplicateName(newName)}
                  className="w-full"
                >
                  <Plus size={18} />
                  Add category
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <div className="px-1">
                <h2 className="text-sm font-bold uppercase tracking-wide text-stone-400">Manage Categories</h2>
              </div>
              {categories.map((category, index) => {
                const isOther = category.name === 'Other'
                const hasDuplicate = duplicateName(category.name, category.id)
                return (
                  <div key={category.id ?? category.name} className="space-y-3 rounded-[1.4rem] bg-white p-4 shadow-sm shadow-rose-100">
                    <div className="flex items-center gap-3">
                      <span className={`h-3 w-3 rounded-full ${CATEGORY_SWATCHES[category.color].bg}`} />
                      <TextInput
                        value={category.name}
                        disabled={isOther}
                        onChange={e => updateDraft(index, { name: e.target.value })}
                        className="flex-1 py-3 disabled:bg-stone-50 disabled:text-stone-400"
                      />
                    </div>

                    <TextInput
                      value={category.keywordText}
                      placeholder="Keywords, comma separated"
                      onChange={e => updateDraft(index, { keywordText: e.target.value })}
                      className="py-3"
                    />

                    <ColorPicker color={category.color} onChange={color => updateDraft(index, { color })} />

                    {hasDuplicate && (
                      <p className="px-1 text-xs font-medium text-red-500">Another category already uses this name.</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-2">
                        <IconButton
                          label={`Move ${category.name} up`}
                          onClick={() => moveCategory(index, -1)}
                          disabled={index === 0}
                          className="disabled:opacity-30"
                        >
                          <ArrowUp size={17} />
                        </IconButton>
                        <IconButton
                          label={`Move ${category.name} down`}
                          onClick={() => moveCategory(index, 1)}
                          disabled={index === categories.length - 1}
                          className="disabled:opacity-30"
                        >
                          <ArrowDown size={17} />
                        </IconButton>
                      </div>
                      <div className="flex gap-2">
                        <IconButton
                          label={`Delete ${category.name}`}
                          onClick={() => deleteCategory(index)}
                          disabled={isOther}
                          className="text-red-500 disabled:text-stone-200 disabled:opacity-60"
                        >
                          <Trash2 size={17} />
                        </IconButton>
                        <Button
                          onClick={() => saveCategory(index)}
                          disabled={!normalizeCategoryName(category.name) || hasDuplicate || savingId === category.id}
                        >
                          <Save size={17} />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </section>
          </>
        )}
      </div>
    </AppShell>
  )
}

function ColorPicker({
  color,
  onChange,
}: {
  color: CategoryColor
  onChange: (color: CategoryColor) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {CATEGORY_COLOR_OPTIONS.map(option => (
        <button
          key={option}
          type="button"
          aria-label={CATEGORY_SWATCHES[option].label}
          title={CATEGORY_SWATCHES[option].label}
          onClick={() => onChange(option)}
          className={`flex h-9 items-center justify-center rounded-xl border ${
            color === option ? 'border-stone-800 bg-stone-50' : 'border-rose-100 bg-white'
          }`}
        >
          <span className={`h-4 w-4 rounded-full ${CATEGORY_SWATCHES[option].bg}`} />
        </button>
      ))}
    </div>
  )
}
