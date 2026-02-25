"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle } from "lucide-react";
import { exitGhostMode } from '@/lib/missionUtils';
import { useSession } from './SessionContextProvider';

export const GhostModeBanner = () => {
  const [active, setActive] = React.useState(false);
  const { user } = useSession();

  React.useEffect(() => {
    const checkGhost = () => {
      setActive(localStorage.getItem('is_ghost_mode') === 'true');
    };
    
    // Verifica inicialmente
    checkGhost();
    
    // Ouve mudanças no localStorage (útil entre abas ou mudanças programáticas)
    window.addEventListener('storage', checkGhost);
    
    // Custom event para quando o modo muda na mesma aba
    const handleModeChange = () => checkGhost();
    window.addEventListener('ghost-mode:change', handleModeChange);
    
    return () => {
      window.removeEventListener('storage', checkGhost);
      window.removeEventListener('ghost-mode:change', handleModeChange);
    };
  }, []);

  if (!active) return null;

  const handleExit = () => {
    exitGhostMode(user?.id);
  };

  return (
    <div className="bg-amber-600 text-white py-2 px-4 flex items-center justify-between shadow-md sticky top-0 z-[100] animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2 text-sm font-bold">
        <AlertTriangle className="h-4 w-4" />
        <span>MODO DE INSTRUÇÃO ATIVO: Você está operando em um ambiente de simulação.</span>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleExit}
        className="text-white hover:bg-white/20 h-8 gap-2 border border-white/30"
      >
        <XCircle className="h-4 w-4" />
        Sair da Simulação
      </Button>
    </div>
  );
};