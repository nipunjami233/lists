import { supabase } from './supabase'
import type { HouseholdAccess, ListSummary } from './types'

export function isMissingMigration(error: { message?: string; code?: string } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return error.code === '42P01' || message.includes('does not exist') || message.includes('schema cache')
}

export async function getHouseholdAccess(userId: string): Promise<HouseholdAccess> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (isMissingMigration(error)) return { status: 'legacy' }
  if (error) throw error
  if (!data) return { status: 'none' }

  const household = data.households as { name?: string } | { name?: string }[] | null
  const householdName = Array.isArray(household) ? household[0]?.name : household?.name

  return {
    status: 'member',
    householdId: data.household_id as string,
    householdName: householdName ?? 'NK Household',
  }
}

export async function getListSummariesLegacy(): Promise<ListSummary[]> {
  const { data: listsData } = await supabase
    .from('lists')
    .select('*')
    .order('created_at', { ascending: true })

  if (!listsData) return []

  const withCounts = await Promise.all(
    listsData.map(async list => {
      const { count: total } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id)
      const { count: unchecked } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', list.id)
        .eq('checked', false)
      const { data: latest } = await supabase
        .from('items')
        .select('updated_at')
        .eq('list_id', list.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        id: list.id,
        name: list.name,
        emoji: list.emoji,
        created_at: list.created_at,
        household_id: list.household_id ?? null,
        item_count: total ?? 0,
        unchecked_count: unchecked ?? 0,
        last_activity: latest?.updated_at ?? null,
      }
    })
  )

  return withCounts.sort((a, b) => {
    if (!a.last_activity && !b.last_activity) return a.name.localeCompare(b.name)
    if (!a.last_activity) return 1
    if (!b.last_activity) return -1
    return b.last_activity.localeCompare(a.last_activity)
  })
}

export async function getListSummaries(): Promise<ListSummary[]> {
  const { data, error } = await supabase.rpc('get_list_summaries')

  if (isMissingMigration(error)) return getListSummariesLegacy()
  if (error) throw error

  return (data ?? []).map((list: ListSummary) => ({
    ...list,
    item_count: Number(list.item_count ?? 0),
    unchecked_count: Number(list.unchecked_count ?? 0),
  }))
}

export async function recordItemHistory(itemName: string, householdId: string | null) {
  if (householdId) {
    const { error } = await supabase.rpc('upsert_item_history', {
      item_name: itemName,
      target_household_id: householdId,
    })
    if (!isMissingMigration(error)) return
  }

  await supabase.rpc('upsert_item_history', { item_name: itemName })
}

export async function upsertRecurringItem(itemName: string, isRecurring: boolean, householdId: string | null) {
  if (householdId) {
    const { error } = await supabase
      .from('item_history')
      .upsert(
        { household_id: householdId, name: itemName, is_recurring: isRecurring },
        { onConflict: 'household_id,name' }
      )

    if (!isMissingMigration(error)) return
  }

  await supabase
    .from('item_history')
    .upsert({ name: itemName, is_recurring: isRecurring }, { onConflict: 'name' })
}
