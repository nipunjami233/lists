'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900">{APP_NAME}</h1>
          <p className="text-gray-400 mt-2">{APP_TAGLINE}</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            className="w-full px-4 py-4 rounded-xl border border-gray-200 text-base outline-none focus:border-green-400 bg-white"
            autoCapitalize="none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            className="w-full px-4 py-4 rounded-xl border border-gray-200 text-base outline-none focus:border-green-400 bg-white"
          />

          {error && (
            <p className={`text-sm px-1 ${error.includes('created') ? 'text-green-600' : 'text-red-500'}`}>
              {error}
            </p>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-4 bg-green-400 text-white font-semibold rounded-xl text-base mt-2 disabled:opacity-60 active:bg-green-500"
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>

          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="w-full text-center text-gray-400 text-sm py-2"
          >
            {isSignUp ? 'Already have an account? Sign in' : 'First time? Create an account'}
          </button>
        </div>
      </div>
    </div>
  )
}
