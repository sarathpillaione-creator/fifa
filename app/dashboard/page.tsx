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

  const handlePredictionChange = async (m: any, field: string, value: string) => {
    if (!user) return;
    
    const currentPred = inputs[m.match_number] || {};
    const updatedPred = { ...currentPred, [field]: value };
    
    setInputs((prev: any) => ({ ...prev, [m.match_number]: updatedPred }));
    
    if (
      updatedPred.home !== undefined && updatedPred.home !== '' &&
      updatedPred.away !== undefined && updatedPred.away !== '' &&
      updatedPred.winner &&
      updatedPred.penalties
    ) {
      
      const hG = parseInt(updatedPred.home);
      const aG = parseInt(updatedPred.away);
      
      if (updatedPred.penalties === 'No') {
        if (hG > aG && updatedPred.winner === m.away_team) { alert("Invalid selection."); return; }
        if (aG > hG && updatedPred.winner === m.home_team) { alert("Invalid selection."); return; }
        if (hG === aG) { alert("Invalid: Equal goals require Penalty Shootout = 'Yes'."); return; }
      } else if (updatedPred.penalties === 'Yes') {
        if (hG !== aG) { alert("Invalid: Penalty Shootout requires equal goals."); return; }
      }

      const { error } = await supabase.from('predictions').upsert({
        user_id: user.id,
        match_number: m.match_number,
        pred_home_goals: hG,
        pred_away_goals: aG,
        pred_winner: updatedPred.winner,
        pred_penalties: updatedPred.penalties === 'Yes'
      }, { onConflict: 'user_id, match_number' });
      
      if (!error) {
        setAllPredictions(prev => {
          const filtered = prev.filter(pred => !(pred.user_id === user.id && pred.match_number === m.match_number));
          return [...filtered, { 
            user_id: user.id, 
            match_number: m.match_number, 
            pred_home_goals: hG, 
            pred_away_goals: aG, 
            pred_winner: updatedPred.winner, 
            pred_penalties: updatedPred.penalties === 'Yes' 
          }];
        });
      }
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
          {matches.length === 0 && <p className="font-bold text-xl p-4 bg-white border-2 border-black">One Family Prediciton App Loading....</p>}
          {matches.map(m => (
            <div key={m.match_number} className="bg-white p-6 mb-4 border-2 border-black rounded shadow-sm">
              <p className="text-xs font-bold text-green-600 mb-4">* Predict each team’s goals by full time (excluding penalty shootout)</p>
              <p className="font-black text-xl mb-1">{m.home_team}(H) vs {m.away_team}(A)</p>
              <p className="text-sm font-bold text-slate-500 mb-2">{new Date(m.kickoff_utc).toLocaleString()}</p>
              <input type="number" value={inputs[m.match_number]?.home ?? ''} onChange={(e) => handlePredictionChange(m, 'home', e.target.value)} className="border-2 border-black p-3 w-20 font-black text-lg" placeholder="H" />
              <input type="number" value={inputs[m.match_number]?.away ?? ''} onChange={(e) => handlePredictionChange(m, 'away', e.target.value)} className="border-2 border-black p-3 w-20 font-black text-lg ml-2" placeholder="A" />
              <select value={inputs[m.match_number]?.winner || ''} onChange={(e) => handlePredictionChange(m, 'winner', e.target.value)} className="border-2 border-black p-3 w-full mt-2 font-black text-lg">
                <option value="">Select Winning Team</option>
                <option value={m.home_team}>{m.home_team}</option>
                <option value={m.away_team}>{m.away_team}</option>
              </select>
              <select value={inputs[m.match_number]?.penalties || ''} onChange={(e) => handlePredictionChange(m, 'penalties', e.target.value)} className="border-2 border-black p-3 w-full mt-2 font-black text-lg text-blue-800">
                <option value="">Select Penalty Shootout</option>
                <option value="No">No Penalty Shootout</option>
                <option value="Yes">Yes, Match goes to Penalties</option>
              </select>
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
          {dailyReportMatches.map(m => (
            <div key={m.match_number} className="mb-8 border-b-4 border-slate-200 pb-6 last:border-0">
              <h3 className="text-2xl font-black mb-1">{m.home_team} vs {m.away_team}</h3>
              {allPredictions.filter(p => p.match_number === m.match_number).map(p => {
                const u = leaderboard.find(u => u.id === p.user_id);
                return <div key={p.user_id} className="bg-slate-100 p-3 mb-1 border-2 border-black font-black">{u?.name}: {p.pred_home_goals}-{p.pred_away_goals} | Win: {p.pred_winner} | Pen: {p.pred_penalties ? 'Yes' : 'No'}</div>
              })}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'leaderboard' && (viewedUser ? 
        <div className="bg-white p-6 border-2 border-black">
          <button onClick={() => setViewedUser(null)} className="font-black mb-4">← BACK</button>
          {viewedUser.map(p => <div key={p.id} className="border-b py-2 font-bold text-lg">Match {p.match_number}: {p.pred_home_goals}-{p.pred_away_goals} ({p.pred_winner}) {p.pred_penalties ? ' [Penalties: Yes]' : ''}</div>)}
        </div> : 
        leaderboard.filter(u => u.total_score > 0).map((u, i) => <div key={u.id} onClick={async () => { const {data} = await supabase.from('predictions').select('*').eq('user_id', u.id); setViewedUser(data); }} className="bg-white p-4 mb-2 border-2 border-black font-black text-lg cursor-pointer flex justify-between">{i+1}. {u.name} <span>{u.total_score} pts</span></div>)
      )}

      {activeTab === 'rules' && (
        <div className="bg-white p-8 border-2 border-black font-bold text-lg leading-relaxed">
          <h2 className="text-2xl font-black mb-6 border-b-2 border-black pb-2">SCORING RULES</h2>
          <div className="mb-6"><h3 className="text-xl font-black mb-2 text-blue-700">How You Earn Points</h3>
            <ul className="list-disc pl-6 space-y-3 text-slate-700">
              <li><strong className="text-black">Winning Team:</strong> Correctly predicting which team wins the match or advances to the next round.</li>
              <li><strong className="text-black">Exact Goals:</strong> Correctly predicting the exact number of goals scored by <em>each</em> team (Home/Away scored separately).</li>
              <li><strong className="text-black">Penalty Shootout:</strong> Correctly predicting whether the match will be decided by a penalty shootout gives a flat <strong>+3 points</strong> across all stages.</li>
            </ul>
          </div>
          <div><h3 className="text-xl font-black mb-4 text-blue-700">Points By Stage</h3>
            <ul className="space-y-2 bg-slate-50 p-4 border-2 border-black text-base md:text-lg">
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2"><span><strong>Group Stage:</strong></span> <span className="text-slate-600">Winner: 1 pt | Goals: 2 pts</span></li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2"><span><strong>Round of 32:</strong></span> <span className="text-slate-600">Winner: 2 pts | Goals: 3 pts</span></li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2"><span><strong>Round of 16:</strong></span> <span className="text-slate-600">Winner: 3 pts | Goals: 4 pts</span></li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2"><span><strong>Quarter-Finals:</strong></span> <span className="text-slate-600">Winner: 4 pts | Goals: 6 pts</span></li>
              <li className="flex flex-col md:flex-row md:justify-between border-b border-slate-300 pb-2 pt-2"><span><strong>Semi-Finals & Third Place:</strong></span> <span className="text-slate-600">Winner: 5 pts | Goals: 8 pts</span></li>
              <li className="flex flex-col md:flex-row md:justify-between pt-2"><span><strong>Finals:</strong></span> <span className="text-slate-600">Winner: 10 pts | Goals: 15 pts</span></li>
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
