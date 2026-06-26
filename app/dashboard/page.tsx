"use client"
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [dbUser, setDbUser] = useState<any>(null)
  const [allMatches, setAllMatches] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [inputs, setInputs] = useState<any>({})
  const [viewedUser, setViewedUser] = useState<any[] | null>(null)
  const [activeTab, setActiveTab] = useState<'predictions' | 'leaderboard' | 'rules' | 'matches'>('predictions')
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return; }
      setUser(session.user)

      let { data: existingUser } = await supabase.from('users').select('*').eq('id', session.user.id).single()
      if (!existingUser) {
        const { data: newUser } = await supabase.from('users').insert({ 
          id: session.user.id, 
          name: session.user.user_metadata?.full_name || "New Player",
          email: session.user.email || "No Email",
          total_score: 0 
        }).select().single()
        existingUser = newUser
      }
      setDbUser(existingUser)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrowEnd = new Date(today)
      tomorrowEnd.setDate(today.getDate() + 2)

      const { data: mData } = await supabase.from('matches').select('*').order('kickoff_utc', { ascending: true })
      const { data: uData } = await supabase.from('users').select('*').order('total_score', { ascending: false })
      const { data: pData } = await supabase.from('predictions').select('*').eq('user_id', session.user.id)
      
      if (mData) {
        setAllMatches(mData) // Save ALL matches for the Matches tab
        
        // Filter only today and tomorrow for the Predictions tab
        setMatches(mData.filter(m => {
          const mDate = new Date(m.kickoff_utc)
          return mDate >= today && mDate < tomorrowEnd
        }))
      }
      
      if (uData) setLeaderboard(uData)
      if (pData) {
        const saved: any = {}
        pData.forEach(p => saved[p.match_number] = { home: p.pred_home_goals, away: p.pred_away_goals, winner: p.pred_winner })
        setInputs(saved)
      }
    }
    init()
  }, [router])

  const savePred = async (m: any) => {
    if (!user) return
    const p = inputs[m.match_number] || {}
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_number: m.match_number,
      pred_home_goals: parseInt(p.home || 0),
      pred_away_goals: parseInt(p.away || 0),
      pred_winner: p.winner || null
    }, { onConflict: 'user_id, match_number' })
    
    if (error) alert("Error: " + error.message)
    else alert("Prediction Saved!")
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-black">
      <div className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-black">McDonald's Bahrain World Cup Predictor</h1>
        <h3 className="text-3xl font-red">Predict each team’s goals by full time (excluding penalty shootout)</h3>
        {dbUser && (
          <div className="text-right font-bold text-sm bg-white p-2 border border-black">
            <div>{dbUser.name}</div>
            <div className="text-blue-600">ID: {dbUser.id.slice(-6).toUpperCase()}</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 text-lg font-black flex-wrap">
        {(['predictions', 'leaderboard', 'rules', 'matches'] as const).map(t => (
          <button key={t} onClick={() => {setActiveTab(t); setViewedUser(null)}} className={`px-4 py-2 ${activeTab === t ? 'underline' : ''}`}>{t.toUpperCase()}</button>
        ))}
      </div>

      {activeTab === 'predictions' && matches.map(m => (
        <div key={m.match_number} className="bg-white p-6 mb-4 border-2 border-black rounded shadow-sm">
          <p className="font-black text-xl mb-1">{m.home_team} vs {m.away_team}</p>
          <p className="text-sm font-bold text-slate-500 mb-4">{new Date(m.kickoff_utc).toLocaleString()}</p>
          <input type="number" value={inputs[m.match_number]?.home || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], home: e.target.value}})} className="border-2 border-black p-3 w-20 font-black text-lg" placeholder="H" />
          <input type="number" value={inputs[m.match_number]?.away || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], away: e.target.value}})} className="border-2 border-black p-3 w-20 font-black text-lg ml-2" placeholder="A" />
          <select value={inputs[m.match_number]?.winner || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], winner: e.target.value}})} className="border-2 border-black p-3 w-full mt-2 font-black text-lg">
            <option value="">Select Winner</option>
            <option value={m.home_team}>{m.home_team}</option>
            <option value={m.away_team}>{m.away_team}</option>
          </select>
          <button onClick={() => savePred(m)} className="w-full bg-blue-600 text-white p-4 mt-4 font-black text-lg">SAVE PREDICTION</button>
        </div>
      ))}

      {activeTab === 'leaderboard' && (viewedUser ? 
        <div className="bg-white p-6 border-2 border-black">
          <button onClick={() => setViewedUser(null)} className="font-black mb-4">← BACK</button>
          <div className="font-black text-lg mb-4 text-blue-600">User ID: {viewedUser[0]?.user_id.slice(-6).toUpperCase()}</div>
          {viewedUser.map(p => <div key={p.id} className="border-b py-2 font-bold text-lg">Match {p.match_number}: {p.pred_home_goals}-{p.pred_away_goals} ({p.pred_winner})</div>)}
        </div> : 
        leaderboard.map((u, i) => <div key={u.id} onClick={async () => { const {data} = await supabase.from('predictions').select('*').eq('user_id', u.id); setViewedUser(data); }} className="bg-white p-4 mb-2 border-2 border-black font-black text-lg cursor-pointer flex justify-between">{i+1}. {u.name} <span>{u.total_score} pts</span></div>)
      )}

      {activeTab === 'rules' && (
        <div className="bg-white p-8 border-2 border-black font-bold text-lg leading-relaxed">
          <h2 className="text-2xl font-black mb-6">SCORING RULES</h2>
          <ul className="space-y-3">
            <li>Group Stage: Winner (1), Goals (2)</li>
            <li>Round of 32: Winner (2), Goals (3)</li>
            <li>Round of 16: Winner (3), Goals (4)</li>
            <li>Quarter-Finals: Winner (4), Goals (6)</li>
            <li>Semis/Losers: Winner (5), Goals (8)</li>
            <li>Finals: Winner (10), Goals (15)</li>
            <li>Penalty Shootout: Correct pick (+3)</li>
          </ul>
        </div>
      )}

      {activeTab === 'matches' && allMatches.filter(m => m.match_number > 72).map(m => (
        <div key={m.match_number} className="bg-white p-4 mb-2 border-2 border-black font-black text-lg">
          Match {m.match_number}: {m.home_team} vs {m.away_team} <span className="text-blue-600">({new Date(m.kickoff_utc).toLocaleDateString()})</span>
        </div>
      ))}
    </div>
  )
}
