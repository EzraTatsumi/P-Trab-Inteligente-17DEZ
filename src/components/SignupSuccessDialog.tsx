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
import { MailCheck, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            Confirmação Necessária
          </DialogTitle>
          <DialogDescription>
            Sua conta foi criada com sucesso!
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Um link de confirmação foi enviado para o seu endereço de e-mail: <span className="font-semibold text-foreground">{email}</span>.
          </p>
          
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Próximo Passo</AlertTitle>
            <AlertDescription>
              Clique no link de confirmação no seu e-mail para ativar sua conta e poder fazer login. Verifique sua pasta de spam se não o encontrar.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};