"use client"

import { supabase } from '../lib/supabase'

export default function Home() {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })
    if (error) console.error("Error logging in:", error)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
        <h1 className="text-3xl font-bold mb-2 text-slate-800">World Cup Predictor</h1>
        <p className="text-slate-500 mb-8">Compete with friends to predict the 2026 World Cup.</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center items-center gap-2"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}