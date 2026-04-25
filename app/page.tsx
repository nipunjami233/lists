'use client'

import { useState, useEffect } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import LoginScreen from '@/components/LoginScreen'
import ListsScreen from '@/components/ListsScreen'
import ListScreen from '@/components/ListScreen'

type SelectedList = { id: string; name: string }

export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<SelectedList | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setSelectedList(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <LoginScreen />

  if (!selectedList) {
    return (
      <ListsScreen
        session={session}
        onSelectList={list => setSelectedList({ id: list.id, name: list.name })}
      />
    )
  }

  return (
    <ListScreen
      session={session}
      listId={selectedList.id}
      listName={selectedList.name}
      onBack={() => setSelectedList(null)}
    />
  )
}
