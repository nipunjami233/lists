export type Item = {
  id: string
  name: string
  checked: boolean
  added_by: string | null
  category: string
  updated_at: string
  list_id: string
}

export type PendingOp =
  | { type: 'toggle'; id: string; checked: boolean; queued_at: string }
  | { type: 'add'; item: Item; queued_at: string }
  | { type: 'delete'; id: string; queued_at: string }
  | { type: 'rename'; id: string; name: string; queued_at: string }
