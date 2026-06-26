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
          id: session.user.id, name: session.user.user_metadata?.full_name || "New Player", email: session.user.email || "No Email", total_score: 0 
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
          saved[p.match_number] = { home: p.pred_home_goals, away: p.pred_away_goals, winner: p.pred_winner, penalties: p.pred_penalties ? 'Yes' : 'No' }
        })
        setInputs(saved)
      }
    }
    init()
  }, [router])

  const savePred = async (m: any) => {
    if (!user) return
    const p = inputs[m.match_number] || {}
    
    // Mandatory Field Check
    if (p.home === undefined || p.home === '' || p.away === undefined || p.away === '' || !p.winner || !p.penalties) {
      alert("Please complete all fields (Home Goals, Away Goals, Winning Team, and Penalty Option) before saving.");
      return;
    }

    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id, match_number: m.match_number, pred_home_goals: parseInt(p.home), pred_away_goals: parseInt(p.away), pred_winner: p.winner, pred_penalties: p.penalties === 'Yes'
    }, { onConflict: 'user_id, match_number' })
    
    if (error) {
      alert("Error: " + error.message)
    } else {
      alert("Prediction Saved!")
      setAllPredictions(prev => {
        const filtered = prev.filter(pred => !(pred.user_id === user.id && pred.match_number === m.match_number))
        return [...filtered, { user_id: user.id, match_number: m.match_number, pred_home_goals: parseInt(p.home), pred_away_goals: parseInt(p.away), pred_winner: p.winner, pred_penalties: p.penalties === 'Yes' }]
      })
    }
  }

  const dailyReportMatches = allMatches.filter(m => m.match_number > 72 && getBhrDateString(new Date(m.kickoff_utc)) === selectedDate);

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-black">
      <div className="flex justify-between items-start mb-8">
        <h1 className="text-3xl font-black">McDonald's Bahrain World Cup Predictor</h1>
        {dbUser && (
          <div className="text-right font-bold text-sm bg-white p-2 border border-black">
            <div>{dbUser.name}</div>
            <div className="text-blue-600">ID: {dbUser.id.slice(-6).toUpperCase()}</div>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 font-black flex-wrap">
        {(['predictions', 'daily report', 'leaderboard', 'rules', 'matches'] as const).map(t => (
          <button key={t} onClick={() => {setActiveTab(t); setViewedUser(null)}} className={`px-4 py-2 uppercase ${activeTab === t ? 'underline bg-black text-white' : 'bg-white border-2 border-black'}`}>{t}</button>
        ))}
      </div>

      {activeTab === 'predictions' && matches.map(m => (
        <div key={m.match_number} className="bg-white p-6 mb-4 border-2 border-black">
          <p className="font-black text-xl mb-2">{m.home_team}(H) vs {m.away_team}(A)</p>
          <input type="number" value={inputs[m.match_number]?.home ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], home: e.target.value}})} className="border-2 border-black p-2 w-16" placeholder="H" />
          <input type="number" value={inputs[m.match_number]?.away ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], away: e.target.value}})} className="border-2 border-black p-2 w-16 ml-2" placeholder="A" />
          <select value={inputs[m.match_number]?.winner || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], winner: e.target.value}})} className="border-2 border-black p-2 w-full mt-2">
            <option value="">Select Winning Team</option>
            <option value={m.home_team}>{m.home_team}</option>
            <option value={m.away_team}>{m.away_team}</option>
          </select>
          <select value={inputs[m.match_number]?.penalties || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], penalties: e.target.value}})} className="border-2 border-black p-2 w-full mt-2">
            <option value="">Select Penalty Shootout Option</option>
            <option value="No">No Penalty Shootout</option>
            <option value="Yes">Yes, Match goes to Penalties</option>
          </select>
          <button onClick={() => savePred(m)} className="w-full bg-blue-600 text-white p-3 mt-4 font-black">SAVE PREDICTION</button>
        </div>
      ))}

      {activeTab === 'daily report' && (
        <div className="bg-white p-6 border-2 border-black">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="font-black">Filter by Date:</h2>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-2 border-black p-1" />
          </div>
          {dailyReportMatches.map(m => (
            <div key={m.match_number} className="mb-4">
              <h3 className="font-black">{m.home_team} vs {m.away_team}</h3>
              {allPredictions.filter(p => p.match_number === m.match_number).map(p => {
                const user = leaderboard.find(u => u.id === p.user_id);
                return <div key={p.user_id} className="bg-slate-100 p-2 border border-black mb-1 text-sm font-bold">{user?.name}: {p.pred_home_goals}-{p.pred_away_goals} | Win: {p.pred_winner} | Pen: {p.pred_penalties ? 'Yes' : 'No'}</div>
              })}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        leaderboard.filter(u => u.total_score > 0).map((u, i) => (
          <div key={u.id} className="bg-white p-4 mb-2 border-2 border-black font-black flex justify-between">
            {i + 1}. {u.name} <span>{u.total_score} pts</span>
          </div>
        ))
      )}

      {activeTab === 'rules' && (
        <div className="bg-white p-6 border-2 border-black font-bold">
          <h2 className="text-xl font-black mb-2">SCORING RULES</h2>
          <p><strong>Winning Team:</strong> Predict the winner of the match.</p>
          <p><strong>Exact Goals:</strong> Predict exact goals for both teams.</p>
          <p><strong>Penalty Shootout:</strong> +3 points for correct prediction.</p>
        </div>
      )}

      {activeTab === 'matches' && allMatches.filter(m => m.match_number > 72).map(m => (
        <div key={m.match_number} className="bg-white p-4 mb-2 border-2 border-black font-black">
          Match {m.match_number}: {m.home_team} vs {m.away_team}
        </div>
      ))}
    </div>
  )
}
