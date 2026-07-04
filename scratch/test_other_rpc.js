import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwurywrlibakveqmyrcm.supabase.co';
const supabaseAnonKey = 'sb_publishable_vuR7wnOriFuWCbZqvXHhug_gcl4IG8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Calling check_admin_email...");
  try {
    const { data, error } = await supabase.rpc('check_admin_email', {
      p_email: 'test@univ.sn'
    });
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

test();
