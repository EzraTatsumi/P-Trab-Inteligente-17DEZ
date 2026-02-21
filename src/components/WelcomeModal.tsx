"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket, PlayCircle, Settings, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    hasOMs: boolean;
    hasLogistica: boolean;
    hasOperacional: boolean;
    logYear?: number | null;
    opYear?: number | null;
    isReady: boolean;
  } | null;
}

export const WelcomeModal = ({ open, onOpenChange, status }: WelcomeModalProps) => {
  const navigate = useNavigate();

  if (!status) return null;

  const handleNavigateToConfig = () => {
    // Lógica de navegação inteligente baseada no que falta
    if (!status.hasOMs) {
      navigate("/config/om");
    } else if (!status.hasLogistica) {
      navigate("/config/diretrizes");
    } else if (!status.hasOperacional) {
      navigate("/config/custos-operacionais");
    } else {
      // Se tudo estiver pronto, leva para a página de OMs por padrão ou fecha
      navigate("/config/om");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Rocket className="h-10 w-10 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Bem-vindo ao PTrab Inteligente!</DialogTitle>
          <DialogDescription className="text-center">
            Para que o sistema realize os cálculos corretamente, precisamos completar a Configuração Inicial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Checklist de Ativação</h4>
          <div className="space-y-3">
            <TaskItem 
              label="Cadastrar Organizações Militares (OM)" 
              completed={status.hasOMs} 
            />
            <TaskItem 
              label={`Diretrizes Logísticas ${status.logYear ? `(${status.logYear})` : '(Definir Ano Padrão)'}`} 
              completed={status.hasLogistica} 
            />
            <TaskItem 
              label={`Diretrizes Operacionais ${status.opYear ? `(${status.opYear})` : '(Definir Ano Padrão)'}`} 
              completed={status.hasOperacional} 
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            {status.isReady ? "Começar a Operar" : "Entendido, vou configurar"}
          </Button>
          <Button variant="outline" onClick={handleNavigateToConfig} className="w-full gap-2">
            <Settings className="h-4 w-4" /> 
            {status.isReady ? "Ir para Configurações" : "Próxima Configuração"}
            {!status.isReady && <ArrowRight className="h-4 w-4 ml-auto" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TaskItem = ({ label, completed }: { label: string; completed: boolean }) => (
  <div className="flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors">
    {completed ? (
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
    ) : (
      <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
    )}
    <span className={`text-sm font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>
      {label}
    </span>
  </div>
);