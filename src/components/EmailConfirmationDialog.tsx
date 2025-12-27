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
import { MailCheck, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MailCheck className="h-5 w-5" />
            Confirme seu E-mail
          </DialogTitle>
          <DialogDescription>
            Por favor, verifique se o endereço abaixo está correto antes de finalizar o cadastro.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Alert variant="default" className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-700" />
            <AlertTitle className="text-blue-700">E-mail para Cadastro</AlertTitle>
            <AlertDescription className="text-lg font-bold text-blue-900 break-all">
              {email}
            </AlertDescription>
          </Alert>
          
          <p className="text-sm text-muted-foreground">
            Um link de confirmação será enviado para este endereço. Você não poderá fazer login até confirmá-lo.
          </p>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          {/* Botão de Confirmação (Ação Primária) - Movido para a esquerda */}
          <Button 
            onClick={onConfirm} 
            disabled={loading}
            className="w-full sm:w-auto order-1 sm:order-none"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Confirmar e Cadastrar"
            )}
          </Button>
          {/* Botão de Voltar (Ação Secundária) - Movido para a direita */}
          <Button 
            type="button" 
            variant="outline" 
            onClick={onBack}
            disabled={loading}
            className="w-full sm:w-auto order-2 sm:order-none"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar e Corrigir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};