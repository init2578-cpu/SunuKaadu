import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwurywrlibakveqmyrcm.supabase.co';
const supabaseAnonKey = 'sb_publishable_vuR7wnOriFuWCbZqvXHhug_gcl4IG8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Calling check_and_save_representative...");
  try {
    // Try passing it as a single unnamed JSONB parameter by passing the object directly to rpc
    const payload = {
      p_candidate_id: '98fc06fd-451b-444c-9636-fbfd0de3e584',
      p_nom: 'TestNom',
      p_prenom: 'TestPrenom',
      p_email: 'test_rep_unique_xyz@univ.sn',
      p_auth_user_id: null,
      p_password: 'TestPassword123',
      p_created_by: null
    };
    
    console.log("Trying with unnamed body parameter...");
    const { data, error } = await supabase.rpc('check_and_save_representative', {
      value: payload
    });
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

test();
