import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ADIÇÃO 1: Definir a função de logout
  // Ela simplesmente chama a função signOut do Supabase.
  const signOut = async () => {
    await supabase.auth.signOut();
    // Não precisamos fazer setUser(null) aqui, pois o listener onAuthStateChange
    // abaixo já detectará a mudança e fará isso automaticamente.
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ADIÇÃO 2: Incluir a função signOut no objeto de retorno do hook
  return { user, session, loading, signOut };
};
