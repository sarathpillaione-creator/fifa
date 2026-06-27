"use client"
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const [matches, setMatches] = useState<any[]>([])
  const [authorized, setAuthorized] = useState(false)
  const ADMIN_EMAILS = ["sarathpillaione@gmail.com"]

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session && ADMIN_EMAILS.includes(session.user.email || "")) {
        setAuthorized(true)
        const { data } = await supabase.from('matches').select('*').gt('match_number', 72).order('kickoff_utc', { ascending: true })
        setMatches(data || [])
      }
    }
    init()
  }, [])

  const updateTeams = async (m: any) => {
    const ht = (document.getElementById(`ht-${m.match_number}`) as any).value;
    const at = (document.getElementById(`at-${m.match_number}`) as any).value;
    const { error } = await supabase.from('matches').update({ home_team: ht, away_team: at }).eq('match_number', m.match_number);
    if (error) alert("Error: " + error.message);
    else { alert("Teams Updated!"); window.location.reload(); }
  }

  const save = async (m: any) => {
    const h = (document.getElementById(`h-${m.match_number}`) as any).value;
    const a = (document.getElementById(`a-${m.match_number}`) as any).value;
    const win = (document.getElementById(`w-${m.match_number}`) as any).value;
    const pens = (document.getElementById(`pen-${m.match_number}`) as any).value === 'Yes';
    
    await supabase.from('matches').update({ 
      actual_home_goals: h, actual_away_goals: a, actual_winner: win, actual_penalties: pens, is_completed: true 
    }).eq('match_number', m.match_number);
    
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_number', m.match_number);
    const mNum = m.match_number;
    let wP = 0, gP = 0;
    
    if (mNum <= 88) { wP = 2; gP = 3; }
    else if (mNum <= 96) { wP = 3; gP = 4; }
    else if (mNum <= 100) { wP = 4; gP = 6; }
    else if (mNum <= 102) { wP = 5; gP = 8; }
    else { wP = 10; gP = 15; }

    for (let p of preds!) {
      let points = 0;
      if (p.pred_winner === win) points += wP;
      if (parseInt(p.pred_home_goals) === parseInt(h)) points += gP;
      if (parseInt(p.pred_away_goals) === parseInt(a)) points += gP;
      if (p.pred_penalties === pens) points += 3;
      
      const { data: user } = await supabase.from('users').select('total_score').eq('id', p.user_id).single();
      await supabase.from('users').update({ total_score: (user?.total_score || 0) + points }).eq('id', p.user_id);
    }
    alert("Match Result & Scores Updated!");
  }

  if (!authorized) return <div className="p-8 text-2xl font-black text-black">Access Denied</div>

  return (
    <div className="p-8 bg-slate-50 min-h-screen text-black">
      <h1 className="text-3xl font-black mb-8">ADMIN PANEL</h1>
      {matches.map(m => (
        <div key={m.match_number} className="bg-white p-6 mb-6 rounded-2xl shadow-sm border-4 border-black">
          
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            <input type="text" id={`ht-${m.match_number}`} defaultValue={m.home_team} className="border-2 border-black p-2 font-black text-xl text-black w-full" />
            <span className="font-black text-xl text-black self-center">VS</span>
            <input type="text" id={`at-${m.match_number}`} defaultValue={m.away_team} className="border-2 border-black p-2 font-black text-xl text-black w-full" />
            <button onClick={() => updateTeams(m)} className="bg-blue-600 text-white px-4 py-2 font-black text-lg border-2 border-black whitespace-nowrap hover:bg-blue-700">UPDATE TEAMS</button>
          </div>

          {/* Date is restored right here */}
          <p className="text-sm font-bold text-slate-700 mb-4">{new Date(m.kickoff_utc).toLocaleString()}</p>
          
          <div className="flex flex-col gap-2 mb-4 bg-slate-100 p-4 border-2 border-black">
            <div className="flex gap-2 w-full">
              <input type="number" id={`h-${m.match_number}`} defaultValue={m.actual_home_goals} className="border-2 border-black p-3 w-24 font-black text-xl text-black" placeholder="H Gls" />
              <input type="number" id={`a-${m.match_number}`} defaultValue={m.actual_away_goals} className="border-2 border-black p-3 w-24 font-black text-xl text-black" placeholder="A Gls" />
              <select id={`w-${m.match_number}`} defaultValue={m.actual_winner} className="w-full p-3 border-2 border-black font-black text-xl text-black">
                <option value="">Select Winning Team</option>
                <option value={m.home_team}>{m.home_team}</option>
                <option value={m.away_team}>{m.away_team}</option>
              </select>
            </div>
            <select id={`pen-${m.match_number}`} defaultValue={m.actual_penalties ? 'Yes' : 'No'} className="w-full p-3 border-2 border-black font-black text-xl text-blue-800 mt-2">
              <option value="No">No Penalty Shootout</option>
              <option value="Yes">Yes, Match went to Penalties</option>
            </select>
          </div>
          <button onClick={() => save(m)} className="w-full bg-black text-white p-4 font-black text-xl uppercase hover:bg-slate-800 transition-colors">SAVE MATCH RESULT</button>
        </div>
      ))}
    </div>
  )
}
