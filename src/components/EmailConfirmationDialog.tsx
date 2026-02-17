"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, AlertTriangle } from "lucide-react";

interface EmailConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onConfirm: () => void;
  onBack: () => void;
  loading: boolean;
}

export const EmailConfirmationDialog: React.FC<EmailConfirmationDialogProps> = ({
  open,
  onOpenChange,
  email,
  onConfirm,
  onBack,
  loading,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Confirme seu E-mail
          </DialogTitle>
          <DialogDescription>
            Verifique com atenção se o endereço abaixo está correto.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 space-y-3">
          <p className="text-xl font-bold text-primary break-all text-center">{email}</p>
          <div className="flex items-start gap-2 text-amber-600 bg-amber-50 p-2 rounded text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Se o e-mail estiver incorreto, você não receberá o link de ativação e não conseguirá acessar o sistema.</p>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="outline" 
            onClick={onBack} 
            disabled={loading} 
            className="w-full sm:flex-1"
          >
            Voltar e Corrigir
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={loading} 
            className="w-full sm:flex-1 bg-green-600 hover:bg-green-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Está Correto, Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};