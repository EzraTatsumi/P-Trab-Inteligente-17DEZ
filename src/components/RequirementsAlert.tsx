"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Settings, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RequirementsAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    hasMissions: boolean;
    hasOMs: boolean;
    hasLogistica: boolean;
    hasOperacional: boolean;
    logYear?: number | null;
    opYear?: number | null;
  } | null;
}

export const RequirementsAlert = ({ open, onOpenChange, status }: RequirementsAlertProps) => {
  const navigate = useNavigate();

  const handleNavigateToConfig = () => {
    if (!status) return;

    // Se faltam as missões, abre o hub de instrução em vez de mudar de página
    if (!status.hasMissions) {
      window.dispatchEvent(new CustomEvent('instruction-hub:open'));
      onOpenChange(false);
      return;
    }
    
    if (!status.hasOMs) {
      navigate("/config/om");
    } else if (!status.hasLogistica) {
      navigate("/config/diretrizes");
    } else if (!status.hasOperacional) {
      navigate("/config/custos-operacionais");
    } else {
      navigate("/config/om");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-2 border-destructive/20">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <AlertDialogTitle className="text-xl">Acesso Restrito</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-foreground/80">
            Não é possível criar um novo P Trab. Complete as missões de treinamento e as configurações iniciais de custeio:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg space-y-3 my-2 border">
          <StatusLine label="Missões do Centro de Instrução" ok={status?.hasMissions ?? false} />
          <StatusLine label="Organizações Militares (OM)" ok={status?.hasOMs ?? false} />
          <StatusLine 
            label={`Diretrizes Logísticas ${status?.logYear ? `(${status.logYear})` : ''}`} 
            ok={status?.hasLogistica ?? false} 
          />
          <StatusLine 
            label={`Diretrizes Operacionais ${status?.opYear ? `(${status.opYear})` : ''}`} 
            ok={status?.hasOperacional ?? false} 
          />
        </div>
        
        <p className="text-xs text-muted-foreground italic">
          * Certifique-se de concluir as missões e, nas configurações, salvar e clicar em <strong>"Adotar como Padrão"</strong>.
        </p>
        
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleNavigateToConfig} className="bg-primary">
            {!status?.hasMissions ? (
              <><GraduationCap className="mr-2 h-4 w-4" /> Iniciar Treinamento</>
            ) : (
              <><Settings className="mr-2 h-4 w-4" /> Configurar agora</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const StatusLine = ({ label, ok }: { label: string; ok: boolean }) => (
  <div className="flex items-center justify-between text-sm">
    <span className={ok ? "text-foreground" : "text-destructive font-medium"}>{label}</span>
    {ok ? (
      <span className="text-green-600 font-bold text-[10px] bg-green-100 px-2 py-0.5 rounded uppercase">OK</span>
    ) : (
      <span className="text-destructive font-bold text-[10px] bg-destructive/10 px-2 py-0.5 rounded uppercase">Faltando</span>
    )}
  </div>
);