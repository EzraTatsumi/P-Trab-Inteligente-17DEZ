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
import { MailCheck, Info, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeAuthError } from '@/lib/errorUtils';

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onEmailCorrected: (correctedEmail: string) => void; // Novo prop para notificar o Login.tsx
}

export const EmailVerificationDialog: React.FC<EmailVerificationDialogProps> = ({
  open,
  onOpenChange,
  email,
  onEmailCorrected,
}) => {
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(email);
  const [isEditing, setIsEditing] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  // Sincroniza o email do prop com o estado local quando o diálogo abre
  React.useEffect(() => {
    if (open) {
      setCurrentEmail(email);
      setIsEditing(false);
      setResendCount(0);
    }
  }, [open, email]);

  const handleResend = async () => {
    setLoading(true);
    try {
      // Reenvia o link de confirmação para o e-mail atual
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: currentEmail,
      });

      if (error) throw error;

      setResendCount(prev => prev + 1);
      toast.success("Link de confirmação reenviado!", {
        description: `Verifique a caixa de entrada de ${currentEmail}.`,
      });
    } catch (error: any) {
      console.error("Resend error:", error);
      toast.error(sanitizeAuthError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateEmail = async () => {
    setLoading(true);
    try {
        // 1. Validação básica de formato
        if (!currentEmail.includes('@') || !currentEmail.includes('.')) {
            toast.error("Por favor, insira um e-mail válido.");
            setLoading(false);
            return;
        }
        
        // 2. Atualiza o e-mail do usuário (requer que o usuário esteja logado, o que acontece após o signup)
        // Nota: O Supabase enviará um novo link de confirmação para o novo e-mail.
        const { error } = await supabase.auth.updateUser({
            email: currentEmail,
        });
        
        if (error) throw error;
        
        // 3. Notifica o componente pai (Login.tsx) sobre a correção
        onEmailCorrected(currentEmail);
        
        toast.success("E-mail corrigido e novo link de confirmação enviado!", {
            description: `Verifique a caixa de entrada de ${currentEmail}.`,
            duration: 8000,
        });
        
        setIsEditing(false);
        setResendCount(0);
        
    } catch (error: any) {
        console.error("Update email error:", error);
        toast.error(sanitizeAuthError(error));
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
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
          
          {/* Exibição/Edição do E-mail */}
          <div className="space-y-2">
            <Label htmlFor="current-email">E-mail de Destino</Label>
            <div className="flex gap-2">
              <Input
                id="current-email"
                type="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                disabled={!isEditing || loading}
                className="flex-1"
              />
              <Button 
                variant={isEditing ? "secondary" : "outline"} 
                onClick={() => setIsEditing(!isEditing)}
                disabled={loading}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Loader2 className="h-4 w-4 mr-2" />}
                {isEditing ? "Cancelar" : "Corrigir"}
              </Button>
            </div>
            {isEditing && (
                <Button 
                    onClick={handleUpdateEmail} 
                    disabled={loading || currentEmail === email}
                    className="w-full mt-2"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Salvar Correção e Reenviar"}
                </Button>
            )}
          </div>
          
          {/* Alerta de Instruções */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Importante!</AlertTitle>
            <AlertDescription>
              Se não encontrar o e-mail, verifique também sua pasta de spam ou lixo eletrônico. Você só poderá fazer login após a confirmação.
            </AlertDescription>
          </Alert>
          
          {/* Botão de Reenvio */}
          <Button 
            onClick={handleResend} 
            disabled={loading || isEditing || resendCount >= 3}
            variant="outline"
            className="w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MailCheck className="h-4 w-4 mr-2" />}
            {resendCount > 0 ? `Reenviar Link (${resendCount}/3)` : "Reenviar Link de Confirmação"}
          </Button>
          {resendCount >= 3 && (
            <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                    Limite de reenvios atingido. Tente novamente mais tarde ou corrija o e-mail.
                </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} disabled={loading}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};