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
import { AlertTriangle, Settings, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface RequirementsAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    hasOMs: boolean;
    hasLogistica: boolean;
    hasOperacional: boolean;
    logYear?: number | null;
    opYear?: number | null;
  } | null;
}

export const RequirementsAlert = ({ open, onOpenChange, status }: RequirementsAlertProps) => {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-2 border-destructive/20">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 text-destructive mb-2">
            <AlertTriangle className="h-6 w-6" />
            <AlertDialogTitle className="text-xl">Configuração Incompleta</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-foreground/80">
            Não é possível criar um novo P Trab. O sistema identificou que os alicerces de custeio ainda não foram estabelecidos para os anos padrão:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg space-y-3 my-2 border">
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
          * Certifique-se de salvar as diretrizes e clicar em <strong>"Adotar como Padrão"</strong> em cada tela de configuração.
        </p>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => navigate("/config/om")} className="bg-primary">
            <Settings className="mr-2 h-4 w-4" /> Configurar agora
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