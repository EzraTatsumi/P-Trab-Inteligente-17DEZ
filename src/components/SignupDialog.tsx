"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Exportação nomeada para garantir compatibilidade
export const SignupDialog: React.FC<SignupDialogProps> = ({ open, onOpenChange }) => {
  const steps = [
    "Preencha seus dados básicos",
    "Confirme seu e-mail institucional",
    "Aguarde a liberação do administrador",
    "Comece a criar seus P Trabs"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Solicitar Acesso
          </DialogTitle>
          <DialogDescription>
            Siga os passos abaixo para obter acesso ao P Trab Inteligente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <Alert variant="default" className="bg-blue-50 border-blue-200 mb-4">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Importante</AlertTitle>
            <AlertDescription className="text-blue-700 text-xs">
              O acesso é restrito a militares autorizados.
            </AlertDescription>
          </Alert>

          <ul className="space-y-3">
            {steps.map((step, index) => (
              <li key={`signup-step-${index}`} className="flex items-start gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-muted-foreground">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignupDialog;