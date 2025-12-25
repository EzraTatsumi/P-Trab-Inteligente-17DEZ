import React, { useState, useEffect, useMemo } from 'react';
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
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema } from '@/lib/validationSchemas';
import * as z from 'zod';
import { OmSelector } from './OmSelector';
import { OMData } from '@/lib/omUtils';
import { sanitizeAuthError } from '@/lib/errorUtils';

type SignupFormData = z.infer<typeof signupSchema>;

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (email: string) => void;
}

// Mapeamento de erros comuns de domínio
const DOMAIN_CORRECTIONS: Record<string, string> = {
    "gamil.com": "gmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "yaho.com": "yahoo.com",
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
};

export const SignupDialog: React.FC<SignupDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOm, setSelectedOm] = useState<OMData | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      posto_graduacao: '',
      nome_guerra: '',
      nome_om: '',
    },
  });
  
  const watchedEmail = watch('email');
  
  // Lógica de Sugestão de Domínio
  const suggestedEmailCorrection = useMemo(() => {
    if (!watchedEmail || !watchedEmail.includes('@')) return null;
    
    const parts = watchedEmail.split('@');
    if (parts.length !== 2) return null;
    
    const domain = parts[1].toLowerCase();
    
    for (const [typo, correct] of Object.entries(DOMAIN_CORRECTIONS)) {
        if (domain === typo) {
            return `${parts[0]}@${correct}`;
        }
    }
    return null;
  }, [watchedEmail]);


  useEffect(() => {
    if (open) {
      reset();
      setSelectedOm(undefined);
      setError(null);
    }
  }, [open, reset]);
  
  // Sync OmSelector changes to React Hook Form state
  const handleOmChange = (omData: OMData | undefined) => {
    setSelectedOm(omData);
    setValue('nome_om', omData?.nome_om || '', { shouldValidate: true });
  };

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    
    if (!selectedOm) {
        setError("Selecione a OM de vinculação na lista.");
        return;
    }
    
    // Camada 1: Bloqueio se houver sugestão de correção de domínio
    if (suggestedEmailCorrection) {
        setError(`O e-mail digitado parece incorreto. Você quis dizer ${suggestedEmailCorrection}? Por favor, corrija antes de continuar.`);
        return;
    }

    setLoading(true);
    try {
      // 1. Prepara os metadados do usuário
      const userMetadata = {
        posto_graduacao: data.posto_graduacao,
        nome_guerra: data.nome_guerra,
        nome_om: data.nome_om,
        codug_om: selectedOm.codug_om,
        rm_vinculacao: selectedOm.rm_vinculacao,
        codug_rm_vinculacao: selectedOm.codug_rm_vinculacao,
      };
      
      // 2. Tenta o registro
      const { data: { user }, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: userMetadata,
          emailRedirectTo: `${window.location.origin}/ptrab`, // Redireciona para /ptrab após a confirmação
        },
      });

      if (signupError) {
        throw signupError;
      }
      
      if (user && !user.email_confirmed_at) {
        // Sucesso no registro, mas a confirmação de e-mail é necessária
        onSuccess(data.email);
        toast.success("Cadastro realizado!", {
            description: "Um link de confirmação foi enviado para seu e-mail. Por favor, confirme para acessar.",
            duration: 8000,
        });
      } else {
        // Caso raro onde o e-mail é confirmado imediatamente (não deve ocorrer com o fluxo padrão)
        onSuccess(data.email);
      }

    } catch (err: any) {
      console.error("Erro de Cadastro:", err);
      setError(sanitizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Criar Nova Conta
          </DialogTitle>
          <DialogDescription>
            Preencha seus dados para acessar a plataforma.
          </DialogDescription>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de Cadastro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu.email@dominio.com"
                disabled={loading}
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              
              {/* Alerta de Sugestão de Domínio */}
              {suggestedEmailCorrection && (
                  <Alert variant="default" className="mt-2 p-2 bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-700" />
                      <AlertDescription className="text-xs text-yellow-700">
                          Domínio incorreto? Sugestão: 
                          <button 
                              type="button" 
                              className="font-semibold underline ml-1"
                              onClick={() => setValue('email', suggestedEmailCorrection, { shouldValidate: true })}
                          >
                              {suggestedEmailCorrection}
                          </button>
                      </AlertDescription>
                  </Alert>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha (mínimo 8 caracteres) *</Label>
              <Input
                id="password"
                type="password"
                disabled={loading}
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="posto_graduacao">Posto/Graduação *</Label>
              <Input
                id="posto_graduacao"
                placeholder="Ex: Maj, Cap, 1º Sgt"
                disabled={loading}
                {...register('posto_graduacao')}
              />
              {errors.posto_graduacao && <p className="text-xs text-destructive">{errors.posto_graduacao.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome_guerra">Nome de Guerra *</Label>
              <Input
                id="nome_guerra"
                placeholder="Ex: Tatsumi"
                disabled={loading}
                {...register('nome_guerra')}
              />
              {errors.nome_guerra && <p className="text-xs text-destructive">{errors.nome_guerra.message}</p>}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="nome_om">OM de Vinculação *</Label>
            <OmSelector
                selectedOmId={selectedOm?.id}
                onChange={handleOmChange}
                placeholder="Selecione sua OM..."
                disabled={loading}
            />
            {errors.nome_om && <p className="text-xs text-destructive">{errors.nome_om.message}</p>}
            {selectedOm && (
                <p className="text-xs text-muted-foreground">
                    CODUG: {selectedOm.codug_om} | RM: {selectedOm.rm_vinculacao}
                </p>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="submit" disabled={loading || !!suggestedEmailCorrection}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar Conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};