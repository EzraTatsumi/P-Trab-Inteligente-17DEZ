"use client";

import React from 'react';
import { AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isGhostMode, exitGhostMode } from "@/lib/ghostStore";

export const GhostModeBanner = () => {
  if (!isGhostMode()) return null;

  const handleExit = () => {
    exitGhostMode();
    window.location.reload();
  };

  return (
    <div className="bg-amber-500 text-white py-2 px-4 flex items-center justify-between sticky top-0 z-[100] shadow-md w-full">
      <div className="flex items-center gap-2 max-w-[80%]">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium leading-tight">
          <span className="font-bold">Modo Simulação Ativo:</span> Você está em um ambiente de treinamento com dados fictícios. Nenhuma alteração afetará seus Planos de Trabalho reais.
        </p>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleExit}
        className="text-white hover:bg-amber-600 hover:text-white border-white/20 ml-4 h-8 gap-2"
      >
        <XCircle className="h-4 w-4" />
        Sair do Treinamento
      </Button>
    </div>
  );
};