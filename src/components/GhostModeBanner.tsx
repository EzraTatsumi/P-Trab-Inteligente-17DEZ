"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, XCircle } from "lucide-react";

export const GhostModeBanner = () => {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const checkGhost = () => {
      setActive(localStorage.getItem('is_ghost_mode') === 'true');
    };
    checkGhost();
    window.addEventListener('storage', checkGhost);
    return () => window.removeEventListener('storage', checkGhost);
  }, []);

  if (!active) return null;

  const handleExit = () => {
    localStorage.removeItem('is_ghost_mode');
    localStorage.removeItem('active_mission_id');
    window.location.href = '/ptrab';
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