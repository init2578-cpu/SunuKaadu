import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Self-healing: clear stale/invalid session causing 401 errors
const checkAndClearStaleSession = async () => {
  try {
    const keys = Object.keys(localStorage);
    const hasSbSession = keys.some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    
    if (hasSbSession) {
      // Test querying a public table to check token validity
      const { error } = await supabase.from('amicales').select('id').limit(1);
      if (error && ((error as any).status === 401 || error.message?.includes('JWT') || error.message?.includes('Unauthorized'))) {
        console.warn("Stale or invalid Supabase session detected, clearing auth storage...");
        await supabase.auth.signOut();
        keys.forEach(key => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        window.location.reload();
      }
    }
  } catch (e) {
    console.error("Error checking session validity:", e);
  }
};

if (typeof window !== 'undefined') {
  setTimeout(checkAndClearStaleSession, 100);
}

export default supabase;
