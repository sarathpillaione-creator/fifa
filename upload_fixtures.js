const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Paste your actual URL and Legacy Anon Key here
const supabaseUrl = 'https://duteybsrpkkrytvohtwe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dGV5YnNycGtrcnl0dm9odHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NDE4OSwiZXhwIjoyMDk3NDQwMTg5fQ.0s2UgVEqXM4u1BNIAlDVOFu04xRFpcZi-0t1TIJcv8Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadMatches() {
    console.log("Reading fixtures file...");
    const rawData = fs.readFileSync('world-cup-2026-fixtures.json');
    const data = JSON.parse(rawData);

    const matchesToInsert = [];

    for (const match of data.fixtures) {
        matchesToInsert.push({
            match_number: match.matchNumber,
            kickoff_utc: match.kickoffUtc,
            stage: match.stage,
            home_team: match.homeTeam,
            away_team: match.awayTeam,
            actual_home_goals: null,
            actual_away_goals: null,
            actual_winner: null,
            actual_shootout: null,
            is_completed: false
        });
    }

    console.log(`Uploading ${matchesToInsert.length} matches to Supabase...`);
    
    // 2. THIS IS THE FIXED LINE: changed .table() to .from()
    const { error } = await supabase.from('matches').insert(matchesToInsert);

    if (error) {
        console.error("Error uploading matches:", error.message);
    } else {
        console.log("Success! All 104 matches have been uploaded.");
    }
}

uploadMatches();