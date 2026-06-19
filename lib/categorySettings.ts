import { supabase } from './supabase'
import { DEFAULT_CATEGORIES, normalizeCategoryName } from './categories'
import type { CategoryConfig, CategoryColor } from './categories'
import { isMissingMigration } from './household'

type CategoryRow = {
  id: string
  name: string
  color: CategoryColor
  keywords: string[] | null
  position: number
}

function fromRow(row: CategoryRow): CategoryConfig {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    keywords: row.keywords ?? [],
    position: row.position,
  }
}

export async function getHouseholdCategories(householdId?: string | null): Promise<CategoryConfig[]> {
  if (!householdId) return DEFAULT_CATEGORIES

  const { data, error } = await supabase
    .from('household_categories')
    .select('id, name, color, keywords, position')
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (isMissingMigration(error)) return DEFAULT_CATEGORIES
  if (error) throw error
  if (!data || data.length === 0) return DEFAULT_CATEGORIES

  return data.map(row => fromRow(row as CategoryRow))
}

export async function addHouseholdCategory(
  householdId: string,
  category: Pick<CategoryConfig, 'name' | 'color' | 'keywords' | 'position'>
) {
  const cleanName = normalizeCategoryName(category.name)
  if (!cleanName) throw new Error('Category name is required')

  const { error } = await supabase
    .from('household_categories')
    .insert({
      household_id: householdId,
      name: cleanName,
      color: category.color,
      keywords: category.keywords,
      position: category.position,
    })

  if (error) throw error
}

export async function saveHouseholdCategory(category: CategoryConfig) {
  if (!category.id) throw new Error('Category id is required')
  const cleanName = normalizeCategoryName(category.name)
  if (!cleanName) throw new Error('Category name is required')

  const { error } = await supabase.rpc('rename_household_category', {
    category_id: category.id,
    new_name: cleanName,
    new_color: category.color,
    new_keywords: category.keywords,
    new_position: category.position,
  })

  if (error) throw error
}

export async function deleteHouseholdCategory(categoryId: string) {
  const { error } = await supabase.rpc('delete_household_category', {
    category_id: categoryId,
    fallback_name: 'Other',
  })

  if (error) throw error
}

export async function reorderHouseholdCategories(categories: CategoryConfig[]) {
  const results = await Promise.all(
    categories
      .filter(category => category.id)
      .map((category, position) =>
        supabase
          .from('household_categories')
          .update({ position })
          .eq('id', category.id!)
      )
  )
  const failed = results.find(result => result.error)
  if (failed?.error) throw failed.error
}
