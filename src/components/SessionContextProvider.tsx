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
        
        // --- Lógica de Confirmação de E-mail ---
        if (!currentSession.user.email_confirmed_at) {
            // Se o usuário está logado mas o e-mail não está confirmado, 
            // forçamos o logout e redirecionamos para /login.
            // O componente Login.tsx detectará o status e abrirá o EmailVerificationDialog.
            if (event !== 'SIGNED_OUT' && event !== 'USER_UPDATED') {
                await supabase.auth.signOut();
                setSession(null);
                setUser(null);
                toast.warning("Confirme seu e-mail para acessar a plataforma.");
                navigate('/login');
                return;
            }
        }
        
        // Redirecionar usuários autenticados para /ptrab, exceto se já estiverem lá ou em /login
        if (window.location.pathname === '/login' || window.location.pathname === '/') {
          navigate('/ptrab');
          if (event === 'SIGNED_IN') {
            toast.success("Login realizado com sucesso!");
          }
        } else if (event === 'USER_UPDATED' && currentSession.user.email_confirmed_at) {
          // Este evento ocorre após o usuário clicar no link de confirmação
          toast.success("Seu e-mail foi confirmado com sucesso! Faça login para continuar.");
          navigate('/login'); 
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
        // Verifica a confirmação do e-mail na sessão inicial
        if (!initialSession.user.email_confirmed_at) {
            supabase.auth.signOut().then(() => {
                setSession(null);
                setUser(null);
                setLoading(false);
                if (window.location.pathname !== '/login') {
                    toast.warning("Confirme seu e-mail para acessar a plataforma.");
                    navigate('/login');
                }
            });
            return;
        }
        
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