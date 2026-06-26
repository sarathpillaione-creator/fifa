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
  const [allPredictions, setAllPredictions] = useState<any[]>([]) 
  const [viewedUser, setViewedUser] = useState<any[] | null>(null)
  const [activeTab, setActiveTab] = useState<'predictions' | 'daily report' | 'leaderboard' | 'rules' | 'matches'>('predictions')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const router = useRouter()

  const getBhrDateString = (dateObj: Date) => {
    const bhrTime = new Date(dateObj.toLocaleString("en-US", { timeZone: "Asia/Bahrain" }));
    return `${bhrTime.getFullYear()}-${String(bhrTime.getMonth() + 1).padStart(2, '0')}-${String(bhrTime.getDate()).padStart(2, '0')}`;
  };

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

      const tomorrowBhr = new Date();
      tomorrowBhr.setDate(tomorrowBhr.getDate() + 1);
      const tomorrowStr = getBhrDateString(tomorrowBhr);
      setSelectedDate(tomorrowStr);

      const { data: mData } = await supabase.from('matches').select('*').order('kickoff_utc', { ascending: true })
      const { data: uData } = await supabase.from('users').select('*').order('total_score', { ascending: false })
      const { data: allPData } = await supabase.from('predictions').select('*') 
      
      if (mData) {
        setAllMatches(mData)
        setMatches(mData.filter(m => m.match_number > 72 && getBhrDateString(new Date(m.kickoff_utc)) === tomorrowStr))
      }
      if (uData) setLeaderboard(uData)
      if (allPData) {
        setAllPredictions(allPData)
        const saved: any = {}
        allPData.filter(p => p.user_id === session.user.id).forEach(p => {
          saved[p.match_number] = { home: p.pred_home_goals?.toString(), away: p.pred_away_goals?.toString(), winner: p.pred_winner, penalties: p.pred_penalties ? 'Yes' : 'No' }
        })
        setInputs(saved)
      }
    }
    init()
  }, [router])

  const savePred = async (m: any) => {
    if (!user) return
    const p = inputs[m.match_number] || {}
    if (!p.home || !p.away || !p.winner || !p.penalties) {
      alert("Please complete all fields before saving.");
      return;
    }
    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id, match_number: m.match_number, pred_home_goals: parseInt(p.home), pred_away_goals: parseInt(p.away), pred_winner: p.winner, pred_penalties: p.penalties === 'Yes'
    }, { onConflict: 'user_id, match_number' })
    if (!error) alert("Prediction Saved!")
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-black">
      <h1 className="text-3xl font-black mb-6">McDonald's Bahrain World Cup Predictor</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['predictions', 'daily report', 'leaderboard', 'rules', 'matches'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 uppercase font-black ${activeTab === t ? 'underline bg-black text-white' : 'bg-white border-2 border-black'}`}>{t}</button>
        ))}
      </div>

      {activeTab === 'predictions' && matches.map(m => (
        <div key={m.match_number} className="bg-white p-6 mb-4 border-2 border-black">
          <p className="font-black text-xl">{m.home_team}(H) vs {m.away_team}(A)</p>
          <input type="number" value={inputs[m.match_number]?.home ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], home: e.target.value}})} className="border-2 border-black p-2 w-16" placeholder="H" />
          <input type="number" value={inputs[m.match_number]?.away ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], away: e.target.value}})} className="border-2 border-black p-2 w-16 ml-2" placeholder="A" />
          <select value={inputs[m.match_number]?.winner || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], winner: e.target.value}})} className="border-2 border-black p-2 w-full mt-2">
            <option value="">Select Winning Team</option>
            <option value={m.home_team}>{m.home_team}</option>
            <option value={m.away_team}>{m.away_team}</option>
          </select>
          <button onClick={() => savePred(m)} className="w-full bg-blue-600 text-white p-3 mt-2 font-black">SAVE</button>
        </div>
      ))}

      {activeTab === 'leaderboard' && (
        leaderboard.filter(u => u.total_score > 0).length === 0 
          ? <div className="p-4 border-2 border-black font-black text-center">No scores yet.</div>
          : leaderboard.filter(u => u.total_score > 0).map((u, i) => (
              <div key={u.id} className="bg-white p-4 mb-2 border-2 border-black font-black flex justify-between">
                {i + 1}. {u.name} <span>{u.total_score} pts</span>
              </div>
            ))
      )}
    </div>
  )
}
