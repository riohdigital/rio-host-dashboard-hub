import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://cwcauobnbmzjpqjmmomc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN3Y2F1b2JuYm16anBxam1tb21jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTIzMDEsImV4cCI6MjA2NzU4ODMwMX0.o8hINdVYx2w7kI15hvnKHUzV5FjiIeqfCV4VOpkasow";

// Utiliza localStorage nativo e síncrono para garantir persistência contínua
// e evitar encerramentos de sessão ou perda de tokens por timeout de postMessage
const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});