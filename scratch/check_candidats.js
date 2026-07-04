import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env
const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Checking candidats table schema...");
  const { data: candidats, error: errorC } = await supabase.from('candidats').select('*').limit(1);
  if (errorC) {
    console.error("Error fetching candidats:", errorC);
  } else {
    console.log("Candidats sample record columns:", candidats.length > 0 ? Object.keys(candidats[0]) : "No records found");
  }

  console.log("Checking admins table...");
  const { data: admins, error: errorA } = await supabase.from('admins').select('*').limit(5);
  if (errorA) {
    console.error("Error fetching admins:", errorA);
  } else {
    console.log("Admins sample records:", admins);
  }
}

run().catch(console.error);
