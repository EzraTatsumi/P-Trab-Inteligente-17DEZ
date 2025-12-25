import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MailCheck, Info, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";

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
  const [loading, setLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResendEmail = async () => {
    setLoading(true);
    setResendSuccess(false);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setResendSuccess(true);
      toast.success("Novo link de verificação enviado! Verifique sua caixa de entrada.");
      
    } catch (error: any) {
      toast.error(sanitizeAuthError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            Verifique seu E-mail
          </DialogTitle>
          <DialogDescription>
            Um link de confirmação foi enviado para o seu endereço de e-mail.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            Por favor, verifique a caixa de entrada de <span className="font-semibold text-foreground">{email}</span> para confirmar sua conta.
          </p>
          
          {resendSuccess && (
            <Alert variant="default" className="bg-green-50 border-green-200 text-green-800">
                <MailCheck className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                    Link reenviado com sucesso! Verifique sua caixa de entrada novamente.
                </AlertDescription>
            </Alert>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Importante!</AlertTitle>
            <AlertDescription>
              Se não encontrar o e-mail, verifique também sua pasta de spam ou lixo eletrônico. Você só poderá fazer login após a confirmação.
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button 
            onClick={handleResendEmail} 
            disabled={loading}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Reenviar E-mail"
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};