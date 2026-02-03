"use client";

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2 } from 'lucide-react';

const Index: React.FC = () => {
  const navigate = useNavigate();
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      if (session) {
        // Usuário autenticado, redireciona para o gerenciador de PTrabs
        navigate('/ptrab', { replace: true });
      } else {
        // Usuário não autenticado, redireciona para a página de login
        navigate('/login', { replace: true });
      }
    }
  }, [session, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default Index;