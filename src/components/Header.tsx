import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Settings } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const Header = () => {
  const { session } = useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Sessão encerrada.");
      navigate('/');
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      toast.error("Falha ao sair.");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between max-w-7xl">
        <Link to="/" className="flex items-center space-x-2">
          <span className="inline-block font-bold text-lg text-primary">P Trab Inteligente</span>
        </Link>
        
        <nav className="flex items-center space-x-2">
          {session ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/ptrab')}>
                <FileText className="h-4 w-4 mr-2" />
                P Trabs
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/config/om')}>
                <Settings className="h-4 w-4 mr-2" />
                Config
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/config/profile')}>
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/login')}>
              Acessar
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};