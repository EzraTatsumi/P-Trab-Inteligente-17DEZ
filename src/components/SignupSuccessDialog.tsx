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
import { CheckCircle2, Mail } from "lucide-react";

interface SignupSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export const SignupSuccessDialog: React.FC<SignupSuccessDialogProps> = ({
  open,
  onOpenChange,
  email,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Conta Criada com Sucesso!</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Um e-mail de confirmação foi enviado para:
            <br />
            <span className="font-bold text-primary break-all">{email}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <div className="flex gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Próximo passo:</p>
              <p className="text-muted-foreground">Acesse sua caixa de entrada e clique no link de ativação para liberar seu acesso ao sistema.</p>
            </div>
          </div>
          <p className="text-xs text-amber-600 italic text-center">Não esqueça de verificar a pasta de Spam/Lixo Eletrônico.</p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Entendi, vou verificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};