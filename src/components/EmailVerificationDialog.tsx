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
import { MailCheck, Info, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
  
  const handleDeleteAccount = async () => {
    setLoading(true);
    setShowDeleteConfirm(false);

    try {
      // 1. Obter o token JWT do usuário atual (mesmo que não confirmado, ele tem uma sessão temporária)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error("Sessão não encontrada. Tente fazer login novamente.");
      }
      
      const token = session.access_token;
      
      // 2. Chamar a Edge Function para exclusão (requer Service Role Key)
      const { error: invokeError } = await supabase.functions.invoke('delete-user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Falha ao excluir conta via Edge Function.");
      }
      
      // 3. Logout forçado (embora a Edge Function já tenha excluído o usuário)
      await supabase.auth.signOut();

      toast.success("Conta excluída com sucesso. Você pode se cadastrar novamente com o e-mail correto.");
      onOpenChange(false); // Fecha o diálogo
      
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error(error.message || "Erro ao excluir conta. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
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
            
            <Alert variant="destructive" className="mt-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>E-mail Incorreto?</AlertTitle>
              <AlertDescription className="text-sm">
                Se você suspeita que digitou o e-mail errado, clique em "Excluir Conta" para remover este registro e tentar o cadastro novamente.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button 
              onClick={() => setShowDeleteConfirm(true)} 
              disabled={loading}
              variant="destructive"
              className="w-full sm:w-auto bg-destructive/80 hover:bg-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Conta
            </Button>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão da Conta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta associada a <span className="font-bold text-foreground">{email}</span>? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};