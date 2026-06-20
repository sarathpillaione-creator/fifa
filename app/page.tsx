"use client"

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Auto-redirect if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }
    checkSession()

    // Listen for the return trip from Google
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.push('/dashboard')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })
    if (error) console.error("Error logging in:", error)
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-xl text-black">LOADING...</div>

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-black">
      <div className="bg-white p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center max-w-md w-full">
        <h1 className="text-4xl font-black mb-4 uppercase">McDonald's Bahrain<br/>World Cup Predictor</h1>
        <p className="text-lg font-bold mb-8 text-slate-700">Sign in to predict matches and check the leaderboard.</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-blue-600 text-white font-black text-xl p-4 border-2 border-black hover:bg-blue-700 hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
        >
          SIGN IN WITH GOOGLE
        </button>
      </div>
    </div>
  )
}
