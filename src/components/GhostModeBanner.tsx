"use client";

import React, { useEffect, useState } from 'react';
import { Ghost, X, PlayCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isGhostMode, getActiveMission } from '@/lib/ghostStore';
import { exitGhostMode } from '@/lib/missionUtils';
import { cn } from '@/lib/utils';

export const GhostModeBanner: React.FC = () => {
  const [active, setActive] = useState(false);
  const [missionId, setMissionId] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = () => {
      setActive(isGhostMode());
      setMissionId(getActiveMission());
    };

    checkStatus();
    
    // Ouve mudanças no localStorage e eventos customizados
    window.addEventListener('ghost-mode:change', checkStatus);
    window.addEventListener('storage', checkStatus);
    
    return () => {
      window.removeEventListener('ghost-mode:change', checkStatus);
      window.removeEventListener('storage', checkStatus);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
      <div className="bg-primary/95 text-primary-foreground py-2 px-4 shadow-lg border-b border-white/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-1.5 rounded-full animate-pulse">
              <Ghost className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-bold flex items-center gap-2">
                MODO SIMULAÇÃO ATIVO
                <span className="hidden md:inline bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                  Missão {missionId}
                </span>
              </p>
              <p className="text-[10px] md:text-xs text-white/80 leading-tight">
                Você está navegando em um ambiente controlado para treinamento. Dados reais não serão afetados.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => exitGhostMode()}
              className="h-8 text-xs bg-white/10 border-white/30 hover:bg-white/20 hover:text-white"
            >
              <X className="h-3 w-3 mr-1.5" />
              Sair da Simulação
            </Button>
          </div>
        </div>
      </div>
      {/* Overlay sutil para indicar ambiente de teste */}
      <div className="pointer-events-none fixed inset-0 border-4 border-primary/20 z-[99]" />
    </div>
  );
};