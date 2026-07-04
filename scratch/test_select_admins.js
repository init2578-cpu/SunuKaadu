import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwurywrlibakveqmyrcm.supabase.co';
const supabaseAnonKey = 'sb_publishable_vuR7wnOriFuWCbZqvXHhug_gcl4IG8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Selecting candidat_id from admins...");
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id, email, candidat_id')
      .limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

test();
