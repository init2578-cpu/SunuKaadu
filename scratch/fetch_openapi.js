const supabaseUrl = 'https://cwurywrlibakveqmyrcm.supabase.co';
const supabaseAnonKey = 'sb_publishable_vuR7wnOriFuWCbZqvXHhug_gcl4IG8o';

async function run() {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
