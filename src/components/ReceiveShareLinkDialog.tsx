import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { sanitizeError } from '@/lib/errorUtils';
import { Alert } from '@/components/ui/alert';

const shareLinkSchema = z.object({
  link: z.string().url("Link inválido.").refine(
    (url) => url.includes('/share?ptrabId=') && url.includes('&token='),
    "O link deve ser um URL de compartilhamento válido do PTrab Inteligente."
  ),
});

type ShareLinkFormValues = z.infer<typeof shareLinkSchema>;

interface ReceiveShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const ReceiveShareLinkDialog: React.FC<ReceiveShareLinkDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { user } = useSession();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const form = useForm<ShareLinkFormValues>({
    resolver: zodResolver(shareLinkSchema),
    defaultValues: {
      link: '',
    },
  });

  const parseLink = (link: string) => {
    try {
      const url = new URL(link);
      const ptrabId = url.searchParams.get('ptrabId');
      const token = url.searchParams.get('token');
      return { ptrabId, token };
    } catch {
      return { ptrabId: null, token: null };
    }
  };

  const onSubmit = async (data: ShareLinkFormValues) => {
    if (!user) {
      toast.error("Você precisa estar logado para receber um P Trab compartilhado.");
      return;
    }
    
    setLoading(true);
    setStatus('idle');
    
    const { ptrabId, token } = parseLink(data.link);

    if (!ptrabId || !token) {
      form.setError('link', { message: "Link inválido. Certifique-se de que contém ptrabId e token." });
      setLoading(false);
      return;
    }

    try {
      // Chama a função RPC (Remote Procedure Call) no Supabase
      const { data: success, error } = await supabase.rpc('add_user_to_shared_with', {
        p_ptrab_id: ptrabId,
        p_share_token: token,
        p_user_id: user.id,
      });

      if (error) {
        throw new Error(error.message || "Falha na validação do token ou no acesso ao banco de dados.");
      }
      
      if (success === false) {
          throw new Error("Token de compartilhamento inválido ou expirado.");
      }

      setStatus('success');
      toast.success("Acesso concedido! O P Trab foi adicionado à sua lista.");
      onSuccess();
      
    } catch (e: any) {
      setStatus('error');
      const errorMessage = sanitizeError(e);
      toast.error(errorMessage);
      form.setError('link', { message: errorMessage });
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset();
      setStatus('idle');
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Receber P Trab Compartilhado
          </DialogTitle>
          <DialogDescription>
            Cole o link de compartilhamento que você recebeu para obter acesso de edição ao Plano de Trabalho.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link de Compartilhamento</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`${window.location.origin}/share?ptrabId=...`}
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {status === 'success' && (
                <Alert className="bg-green-500/10 border-green-500 text-green-700">
                    <Check className="h-4 w-4" />
                    <div className="text-sm font-medium">Acesso concedido com sucesso! O P Trab está na sua lista.</div>
                </Alert>
            )}

            <DialogFooter>
              <Button type="submit" disabled={loading || status === 'success'}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Receber P Trab"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
                Cancelar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};