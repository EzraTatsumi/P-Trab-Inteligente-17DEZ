"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Rocket, Settings, ArrowRight, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    hasMissions: boolean;
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

  const handleNavigateToStep = () => {
    if (!status.hasMissions) {
      // Dispara evento para abrir o hub de instrução na página principal
      window.dispatchEvent(new CustomEvent('instruction-hub:open'));
      onOpenChange(false);
      return;
    }

    // Se missões ok, segue para as configs reais
    if (!status.hasOMs) {
      navigate("/config/om");
    } else if (!status.hasLogistica) {
      navigate("/config/diretrizes");
    } else if (!status.hasOperacional) {
      navigate("/config/custos-operacionais");
    } else {
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
            Siga o roteiro abaixo para habilitar todas as funcionalidades do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wider">Passo a Passo de Ativação</h4>
          <div className="space-y-3">
            <TaskItem 
              label="Concluir Missões do Centro de Instrução" 
              completed={status.hasMissions}
              icon={<GraduationCap className={`h-5 w-5 ${status.hasMissions ? "text-green-500" : "text-primary"}`} />}
            />
            <div className="h-px bg-border my-2" />
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
            {status.isReady ? "Começar a Operar" : "Entendido, vou prosseguir"}
          </Button>
          <Button variant="outline" onClick={handleNavigateToStep} className="w-full gap-2">
            {!status.hasMissions ? <GraduationCap className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            {status.isReady 
              ? "Ir para Configurações" 
              : !status.hasMissions 
                ? "Iniciar Missões de Treinamento" 
                : "Próxima Configuração Real"}
            {!status.isReady && <ArrowRight className="h-4 w-4 ml-auto" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TaskItem = ({ label, completed, icon }: { label: string; completed: boolean; icon?: React.ReactNode }) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${completed ? "bg-card border-green-100" : "bg-muted/30 border-dashed"}`}>
    {completed ? (
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
    ) : (
      icon || <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
    )}
    <span className={`text-sm font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>
      {label}
    </span>
  </div>
);