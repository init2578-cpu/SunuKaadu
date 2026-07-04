import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cwurywrlibakveqmyrcm.supabase.co';
const supabaseAnonKey = 'sb_publishable_vuR7wnOriFuWCbZqvXHhug_gcl4IG8o';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log("Querying information_schema...");
  try {
    const { data, error } = await supabase
      .from('routines') // or information_schema.routines
      .select('*')
      .limit(5);
    console.log("Data:", data);
    console.log("Error:", error);
  } catch (err) {
    console.error("Exception:", err);
  }
}

test();
