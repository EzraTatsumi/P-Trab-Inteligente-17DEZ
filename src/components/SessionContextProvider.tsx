import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        
        // Redirecionar usuários autenticados para /ptrab, exceto se já estiverem lá ou em /login
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          navigate('/ptrab');
          toast.success("Login realizado com sucesso!");
        } else if (event === 'SIGNED_IN') {
          toast.success("Login realizado com sucesso!");
        } else if (event === 'USER_UPDATED' && currentSession.user.email_confirmed_at) {
          toast.success("Seu e-mail foi confirmado com sucesso! Faça login para continuar.");
          navigate('/login'); // Redireciona para login após confirmação de e-mail
        }
      } else {
        setSession(null);
        setUser(null);
        // Redirecionar usuários não autenticados para /login, exceto se já estiverem lá ou em /
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          navigate('/login');
        }
      }
      setLoading(false);
    });

    // Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSession) {
        setSession(initialSession);
        setUser(initialSession.user);
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          navigate('/ptrab');
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <SessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};