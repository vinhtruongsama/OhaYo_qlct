import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ftkzkdjeorerlncbeodn.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-MzF6jkJhmE-4DLbqZG30g_IKkNeHjW'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Missing Supabase credentials in .env file, using public client-side fallbacks!")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
