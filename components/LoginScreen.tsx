'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'
import { Button, TextInput } from './ui'
import { Heart, LogIn, Mail, Sparkles } from 'lucide-react'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')

  async function handleAuth() {
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setError('Account created! You can now sign in.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--background)] px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-9">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-rose-400 via-pink-400 to-orange-300 text-white shadow-lg shadow-rose-200">
            <Heart size={34} fill="currentColor" />
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-500 shadow-sm shadow-rose-100">
            <Sparkles size={13} />
            Private household lists
          </div>
          <h1 className="text-4xl font-black text-stone-900">{APP_NAME}</h1>
          <p className="text-stone-500 mt-2">{APP_TAGLINE}</p>
        </div>

        <div className="space-y-3">
          <TextInput
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            autoCapitalize="none"
          />
          <TextInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
          />

          {error && (
            <p className={`text-sm px-1 ${error.includes('created') ? 'text-emerald-600' : 'text-red-500'}`}>
              {error}
            </p>
          )}

          <Button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-4 text-base mt-2"
          >
            {isSignUp ? <Mail size={18} /> : <LogIn size={18} />}
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="w-full text-center text-stone-400 text-sm py-2"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'First time? Create an account'}
          </button>

          <p className="px-2 pt-4 text-center text-xs leading-5 text-stone-400">
            New accounts need to be added to the NK Household before they can see shared lists.
          </p>
        </div>
      </div>
    </div>
  )
}
