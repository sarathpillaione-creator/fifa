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
    const yr = bhrTime.getFullYear();
    const mo = String(bhrTime.getMonth() + 1).padStart(2, '0');
    const da = String(bhrTime.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
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

      const today = new Date();
      const tomorrowBhr = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Bahrain" }));
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
          saved[p.match_number] = { 
            home: p.pred_home_goals?.toString(), 
            away: p.pred_away_goals?.toString(), 
            winner: p.pred_winner,
            penalties: p.pred_penalties ? 'Yes' : 'No'
          }
        })
        setInputs(saved)
      }
    }
    init()
  }, [router])

  const savePred = async (m: any) => {
    if (!user) return
    const p = inputs[m.match_number] || {}

    // Mandatory Field Validation Check
    if (
      p.home === undefined || p.home === '' ||
      p.away === undefined || p.away === '' ||
      !p.winner ||
      !p.penalties
    ) {
      alert("Please complete all fields (Home Goals, Away Goals, Winning Team, and Penalty Shootout) before saving.");
      return;
    }

    const { error } = await supabase.from('predictions').upsert({
      user_id: user.id,
      match_number: m.match_number,
      pred_home_goals: parseInt(p.home),
      pred_away_goals: parseInt(p.away),
      pred_winner: p.winner,
      pred_penalties: p.penalties === 'Yes'
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

      <div className="flex gap-2 mb-6 text-lg font-black flex-wrap">
        {(['predictions', 'daily report', 'leaderboard', 'rules', 'matches'] as const).map(t => (
          <button key={t} onClick={() => {setActiveTab(t); setViewedUser(null)}} className={`px-4 py-2 uppercase ${activeTab === t ? 'underline bg-black text-white' : 'bg-white border-2 border-black'}`}>{t}</button>
        ))}
      </div>

      {activeTab === 'predictions' && (
        <>
          {matches.length === 0 && <p className="font-bold text-xl p-4 bg-white border-2 border-black">No matches scheduled for tomorrow.</p>}
          {matches.map(m => (
            <div key={m.match_number} className="bg-white p-6 mb-4 border-2 border-black rounded shadow-sm">
              <p className="font-black text-xl mb-1">{m.home_team} vs {m.away_team}</p>
              <p className="text-sm font-bold text-slate-500 mb-2">{new Date(m.kickoff_utc).toLocaleString()}</p>
              
              <p className="text-xs font-bold text-red-600 mb-4">* Predict each team’s goals by full time (excluding penalty shootout)</p>
              
              <input type="number" value={inputs[m.match_number]?.home ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], home: e.target.value}})} className="border-2 border-black p-3 w-20 font-black text-lg" placeholder="H" />
              <input type="number" value={inputs[m.match_number]?.away ?? ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], away: e.target.value}})} className="border-2 border-black p-3 w-20 font-black text-lg ml-2" placeholder="A" />
              
              <select value={inputs[m.match_number]?.winner || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], winner: e.target.value}})} className="border-2 border-black p-3 w-full mt-2 font-black text-lg">
                <option value="">Select Winning Team</option>
                <option value={m.home_team}>{m.home_team}</option>
                <option value={m.away_team}>{m.away_team}</option>
              </select>

              <select value={inputs[m.match_number]?.penalties || ''} onChange={(e) => setInputs({...inputs, [m.match_number]: {...inputs[m.match_number], penalties: e.target.value}})} className="border-2 border-black p-3 w-full mt-2 font-black text-lg text-blue-800">
                <option value="">Select Penalty Shootout Option</option>
                <option value="No">No Penalty Shootout</option>
                <option value="Yes">Yes, Match goes to Penalties</option>
              </select>

              <button onClick={() => savePred(m)} className="w-full bg-blue-600 text-white p-4 mt-4 font-black text-lg hover:bg-blue-700">SAVE PREDICTION</button>
            </div>
          ))}
        </>
      )}

      {activeTab === 'daily report' && (
        <div className="bg-white p-6 border-2 border-black rounded shadow-sm">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-black">
            <h2 className="text-2xl font-black">Filter by Date:</h2>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-2 border-black p-2 font-black text-lg" />
          </div>

          {dailyReportMatches.length === 0 && <p className="font-bold text-xl text-slate-500">No knockout matches found for this date.</p>}

          {dailyReportMatches.map(m => (
            <div key={m.match_number} className="mb-8 border-b-4 border-slate-200 pb-6 last:border-0">
              <h3 className="text-2xl font-black mb-1">{m.home_team} vs {m.away_team}</h3>
              <p className="text-sm font-bold text-slate-500 mb-4">{new Date(m.kickoff_utc).toLocaleString()}</p>
              
              <div className="flex flex-col gap-2">
                {allPredictions.filter(p => p.match_number === m.match_number).length === 0 ? (
                  <p className="italic font-bold text-slate-400">No predictions submitted yet.</p>
                ) : (
                  allPredictions.filter(p => p.match_number === m.match_number).map(p => {
                    const predUser = leaderboard.find(u => u.id === p.user_id);
                    return (
                      <div key={p.user_id} className="bg-slate-100 p-3 border-2 border-black flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                        <span className="font-black text-lg">{predUser?.name || 'Unknown User'}</span>
                        <div className="flex flex-wrap gap-4 text-sm font-bold bg-white px-3 py-1 border border-black">
                          <span><span className="text-slate-500">Winner:</span> {p.pred_winner}</span>
                          <span><span className="text-slate-500">Goals:</span> {p.pred_home_goals} - {p.pred_away_goals}</span>
                          <span><span className="text-slate-500">Penalties:</span> <span className={p.pred_penalties ? 'text-red-600' : 'text-blue-600'}>{p.pred_penalties ? 'Yes' : 'No'}</span></span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (viewedUser ? 
        <div className="bg-white p-6 border-2 border-black">
          <button onClick={() => setViewedUser(null)} className="font-black mb-4">← BACK</button>
          <div className="font-black text-lg mb-4 text-blue-600">User ID: {viewedUser[0]?.user_id.slice(-6).toUpperCase()}</div>
          {viewedUser.map(p => <div key={p.id} className="border-b py-2 font-bold text-lg">Match {p.match_number}: {p.pred_home_goals}-{p.pred_away_goals} ({p.pred_winner}) {p.pred_penalties ? ' [Penalties: Yes]' : ''}</div>)}
        </div> : 
        (leaderboard.filter(u => u.total_score > 0).length === 0 ? 
          <div className="bg-white p-8 border-2 border-black font-black text-xl text-center text-slate-600">No scores yet. Check back after the first match!</div> 
          : 
          leaderboard.filter(u => u.total_score > 0).map((u, i) => <div key={u.id} onClick={async () => { const {data} = await supabase.from('predictions').select('*').eq('user_id', u.id); setViewedUser(data); }} className="bg-white p-4 mb-2 border-2 border-black font-black text-lg cursor-pointer flex justify-between">{i+1}. {u.name} <span>{u.total_score} pts</span></div>)
        )
      )}

      {activeTab === 'rules' && (
        <div className="bg-white p-8 border-2 border-black font-bold text-lg leading-relaxed">
          <h2 className="text-2xl font-black mb-6 border-b-2 border-black pb-2">SCORING RULES</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-black mb-2 text-blue-700">How You Earn Points</h3>
            <ul className="list-disc pl-6 space-y-3 text-slate-700">
              <li><strong className="text-black">Winning Team:</strong> Correctly predicting which team wins the match or advances to the next round.</li>
              <li><strong className="text-black">Exact Goals:</strong> Correctly predicting the exact number of goals scored by <em>both</em> teams by the end of the match (excluding penalty shootouts).</li>
              <li><strong className="text-black">Penalty Shootout:</strong> Correctly predicting whether the match will be decided by a penalty shootout gives a flat <strong>+3 points</strong> across all stages.</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-black mb-4 text-blue-700">Points By Stage</h3>
            <ul className="space-y-2 bg-slate-50 p-4 border-2 border-black text-base md:text-lg">
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2">
                <span><strong>Round of 32:</strong></span> 
                <span className="text-slate-600">Winner: <strong className="text-black">2 pts</strong> <span className="mx-2">|</span> Goals: <strong className="text-black">3 pts</strong></span>
              </li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2">
                <span><strong>Round of 16:</strong></span> 
                <span className="text-slate-600">Winner: <strong className="text-black">3 pts</strong> <span className="mx-2">|</span> Goals: <strong className="text-black">4 pts</strong></span>
              </li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2">
                <span><strong>Quarter-Finals:</strong></span> 
                <span className="text-slate-600">Winner: <strong className="text-black">4 pts</strong> <span className="mx-2">|</span> Goals: <strong className="text-black">6 pts</strong></span>
              </li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2">
                <span><strong>Semi-Finals & Third Place:</strong></span> 
                <span className="text-slate-600">Winner: <strong className="text-black">5 pts</strong> <span className="mx-2">|</span> Goals: <strong className="text-black">8 pts</strong></span>
              </li>
              <li className="flex flex-col md:flex-row md:justify-between pt-2">
                <span><strong>Finals:</strong></span> 
                <span className="text-slate-600">Winner: <strong className="text-black">10 pts</strong> <span className="mx-2">|</span> Goals: <strong className="text-black">15 pts</strong></span>
              </li>
            </ul>
          </div>
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
