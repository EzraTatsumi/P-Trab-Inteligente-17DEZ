import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { sanitizeAuthError } from '@/lib/errorUtils';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const deleteAccountSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido.' }),
});

type DeleteAccountFormValues = z.infer<typeof deleteAccountSchema>;

interface DeleteUnconfirmedAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DeleteUnconfirmedAccountDialog: React.FC<DeleteUnconfirmedAccountDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: DeleteAccountFormValues) => {
    setLoading(true);
    setIsSubmitted(false);

    try {
      // Chama a Edge Function para exclusão, passando apenas o email.
      // A Edge Function verificará se o usuário existe e se a conta NÃO está confirmada.
      const { error: invokeError, data: invokeData } = await supabase.functions.invoke('delete-user', {
        body: {
          email: data.email,
        },
      });

      if (invokeError) {
        let errorMessage = invokeError.message || "Falha ao excluir conta via Edge Function.";
        if (invokeData && typeof invokeData === 'object' && 'error' in invokeData) {
            errorMessage = (invokeData as { error: string }).error;
        }
        throw new Error(errorMessage);
      }
      
      // Se a função retornar 404 (User not found), tratamos como sucesso para o usuário
      // que queria limpar o registro, mas com uma mensagem informativa.
      if (invokeData && typeof invokeData === 'object' && 'error' in invokeData && (invokeData as { error: string }).error.includes('User not found')) {
          toast.info('Nenhuma conta não confirmada encontrada com este e-mail.');
      } else {
          setIsSubmitted(true);
          toast.success('Solicitação de exclusão enviada. Se a conta não estava confirmada, ela foi removida.');
      }
      
    } catch (e: any) {
      console.error("Account deletion error:", e);
      
      let userMessage = e.message;
      
      if (e.message.includes('Unauthorized: Confirmed users')) {
          userMessage = "Esta conta já está confirmada. Você deve fazer login e excluir a conta pelo Perfil do Usuário.";
      } else if (e.message.includes('User not found')) {
          userMessage = "Nenhuma conta não confirmada encontrada com este e-mail.";
      } else {
          userMessage = "Ocorreu um erro ao tentar excluir a conta. Tente novamente.";
      }
      
      toast.error(userMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset();
      setIsSubmitted(false);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Conta Não Confirmada
          </DialogTitle>
          <DialogDescription>
            Use esta opção se você criou uma conta com um e-mail incorreto e não consegue fazer login.
          </DialogDescription>
        </DialogHeader>
        
        {isSubmitted ? (
          <div className="text-center p-6 space-y-4">
            <Check className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Se a conta estava pendente de confirmação, ela foi removida. Você pode tentar o cadastro novamente.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Entendi
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <DialogDescription className="text-xs">
                    Esta ação só funciona para contas que ainda não foram confirmadas por e-mail.
                </DialogDescription>
              </Alert>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail que você tentou cadastrar</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="seu@email.com"
                        type="email"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-destructive hover:bg-destructive/90" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Excluir Conta'}
              </Button>
            </form>
          </Form>
        )}
        <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                Cancelar
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};