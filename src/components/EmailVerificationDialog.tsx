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
import { MailWarning, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  open,
  onOpenChange,
  email,
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleResendEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/ptrab`,
        }
      });

      if (error) throw error;
      toast.success("E-mail de confirmação reenviado!");
    } catch (error: any) {
      toast.error("Erro ao reenviar e-mail: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
              <MailWarning className="h-8 w-8 text-amber-600" />
            </div>
          </div>
          <DialogTitle className="text-center">E-mail não confirmado</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Você ainda não confirmou seu endereço de e-mail:
            <br />
            <span className="font-bold text-primary break-all">{email}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Para acessar o sistema, você precisa clicar no link enviado para sua caixa de entrada.</p>
          <p className="text-xs italic">Dica: Verifique também sua pasta de Spam.</p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button 
            variant="outline" 
            onClick={handleResendEmail} 
            disabled={loading}
            className="w-full sm:flex-1"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Reenviar E-mail
          </Button>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:flex-1">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};