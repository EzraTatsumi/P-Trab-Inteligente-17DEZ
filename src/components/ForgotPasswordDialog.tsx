import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { sanitizeError } from '@/lib/errorUtils';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido.' }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setLoading(true);
    setIsSubmitted(false);

    try {
      // Supabase envia o e-mail de recuperação. O redirectTo deve ser configurado para a página de redefinição.
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(sanitizeError(error));
        console.error("Password reset error:", error);
      } else {
        setIsSubmitted(true);
        toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (e) {
      toast.error('Ocorreu um erro inesperado ao tentar enviar o e-mail.');
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
          <DialogTitle>Recuperar Senha</DialogTitle>
          <DialogDescription>
            Insira seu e-mail para receber um link de redefinição de senha.
          </DialogDescription>
        </DialogHeader>
        
        {isSubmitted ? (
          <div className="text-center p-6 space-y-4">
            <Check className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
            </p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Entendi
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};