import React, { useState, useEffect } from 'react';
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
import { Loader2, UserPlus, Mail, Lock, Briefcase, Users, Building2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError } from "@/lib/errorUtils";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { SignupSuccessDialog } from './SignupSuccessDialog';
import { EmailConfirmationDialog } from './EmailConfirmationDialog';

type SignupFormValues = z.infer<typeof signupSchema>;

// Mapeamento de erros de digitação comuns em domínios de e-mail
const DOMAIN_CORRECTIONS: Record<string, string> = {
    "gamil.com": "gmail.com",
    "gmai.com": "gmail.com",
    "hotmal.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "outloock.com": "outlook.com",
    "outlookcom": "outlook.com",
    "live.com.br": "live.com",
    "yaho.com": "yahoo.com",
    "yhoo.com": "yahoo.com",
    "bol.com.br": "bol.com.br",
    "uol.com.br": "uol.com.br",
    "terra.com.br": "terra.com.br",
    "ig.com.br": "ig.com.br",
    "eb.mil.br": "eb.mil.br",
    "exercito.mil.br": "exercito.mil.br",
    "mil.br": "mil.br",
};

const correctEmailTypo = (email: string): string => {
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    
    const [username, domain] = parts;
    const correctedDomain = DOMAIN_CORRECTIONS[domain.toLowerCase()];
    
    if (correctedDomain) {
        return `${username}@${correctedDomain}`;
    }
    return email;
};

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginRedirect: () => void;
}

export const SignupDialog: React.FC<SignupDialogProps> = ({ open, onOpenChange, onLoginRedirect }) => {
  const [loading, setLoading] = useState(false);
  const [omData, setOmData] = useState<OMData | undefined>(undefined);
  
  // Estados para o fluxo de confirmação
  const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
  const [showSignupSuccessDialog, setShowSignupSuccessDialog] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      posto_graduacao: "",
      nome_guerra: "",
      nome_om: "",
    },
  });
  
  const watchedEmail = watch('email');
  const watchedNomeOM = watch('nome_om');

  // Efeito para sincronizar o nome da OM no formulário com o seletor
  useEffect(() => {
    if (omData) {
      setValue('nome_om', omData.nome_om, { shouldValidate: true });
    } else if (watchedNomeOM && !omData) {
        // Se o usuário digitou algo e não selecionou, limpa o valor para forçar a seleção
        // Mas só se o campo não estiver vazio (para permitir o placeholder)
        // Não fazemos nada aqui, a validação Zod cuida disso no submit.
    }
  }, [omData, setValue, watchedNomeOM]);

  const handleOMChange = (selectedOm: OMData | undefined) => {
    setOmData(selectedOm);
    if (selectedOm) {
        // Preenche os campos de metadados que serão enviados ao Supabase
        setValue('nome_om', selectedOm.nome_om, { shouldValidate: true });
    } else {
        setValue('nome_om', '', { shouldValidate: true });
    }
  };
  
  const handleConfirmEmail = () => {
      setShowEmailConfirmDialog(false);
      handleSubmit(onSubmit)();
  };
  
  const handleBackToForm = () => {
      setShowEmailConfirmDialog(false);
  };

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    clearErrors();
    
    // 1. Correção de digitação do e-mail
    const correctedEmail = correctEmailTypo(data.email);
    
    // 2. Se o e-mail foi corrigido, avisa o usuário e pede confirmação
    if (correctedEmail !== data.email && !showEmailConfirmDialog) {
        setValue('email', correctedEmail);
        setPendingEmail(correctedEmail);
        setShowEmailConfirmDialog(true);
        setLoading(false);
        return;
    }
    
    // 3. Se a OM não foi selecionada, o Zod já deve ter pego, mas reforçamos
    if (!omData) {
        setError('nome_om', { message: "Selecione a OM na lista." });
        setLoading(false);
        return;
    }
    
    // 4. Se a confirmação foi dada (ou não era necessária), prossegue com o cadastro
    try {
      const { data: { user }, error } = await supabase.auth.signUp({
        email: correctedEmail,
        password: data.password,
        options: {
          data: {
            posto_graduacao: data.posto_graduacao,
            nome_guerra: data.nome_guerra,
            nome_om: omData.nome_om,
            codug_om: omData.codug_om,
            rm_vinculacao: omData.rm_vinculacao,
            codug_rm_vinculacao: omData.codug_rm_vinculacao,
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        throw error;
      }
      
      // 5. Sucesso: Exibe o diálogo de sucesso e redireciona para login
      setPendingEmail(correctedEmail);
      setShowSignupSuccessDialog(true);
      onOpenChange(false); // Fecha o diálogo de cadastro
      
    } catch (error: any) {
      const errorMessage = sanitizeAuthError(error);
      
      if (errorMessage.includes('já está cadastrado')) {
          setError('email', { message: errorMessage });
      } else {
          toast.error(errorMessage);
      }
      
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
              <UserPlus className="h-5 w-5 text-primary" />
              Criar Nova Conta
            </DialogTitle>
            <DialogDescription>
              Preencha seus dados para acessar a plataforma PTrab Inteligente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(); }} className="grid gap-4 py-4">
            
            {/* E-mail */}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@exercito.mil.br"
                  className="pl-10"
                  disabled={loading}
                  {...register("email")}
                />
              </div>
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Senha */}
            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className="pl-10"
                  disabled={loading}
                  {...register("password")}
                />
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            
            {/* Posto/Graduação */}
            <div className="space-y-2">
              <Label htmlFor="posto_graduacao">Posto / Graduação *</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="posto_graduacao"
                  placeholder="Ex: Cap, 1º Sgt, Gen Bda"
                  className="pl-10"
                  disabled={loading}
                  {...register("posto_graduacao")}
                />
              </div>
              {errors.posto_graduacao && <p className="text-xs text-destructive">{errors.posto_graduacao.message}</p>}
            </div>
            
            {/* Nome de Guerra */}
            <div className="space-y-2">
              <Label htmlFor="nome_guerra">Nome de Guerra *</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nome_guerra"
                  placeholder="Ex: TATSUMI"
                  className="pl-10"
                  disabled={loading}
                  {...register("nome_guerra")}
                />
              </div>
              {errors.nome_guerra && <p className="text-xs text-destructive">{errors.nome_guerra.message}</p>}
            </div>
            
            {/* OM de Vinculação (Seletor) */}
            <div className="space-y-2">
              <Label htmlFor="nome_om">OM de Vinculação *</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                <OmSelector
                    selectedOmId={omData?.id}
                    onChange={handleOMChange}
                    placeholder="Selecione sua OM..."
                    disabled={loading}
                />
              </div>
              {errors.nome_om && <p className="text-xs text-destructive">{errors.nome_om.message}</p>}
              {omData && (
                <p className="text-xs text-muted-foreground">
                    CODUG: {omData.codug_om} | RM: {omData.rm_vinculacao}
                </p>
              )}
            </div>

            <DialogFooter className="mt-4 flex flex-col sm:flex-row sm:justify-between gap-2">
              <Button 
                type="button" 
                variant="link" 
                onClick={onLoginRedirect}
                className="p-0 h-auto text-sm text-muted-foreground hover:text-primary justify-start"
                disabled={loading}
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Já tenho conta
              </Button>
              
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {loading ? "Cadastrando..." : "Criar Conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de Confirmação de E-mail (Pré-cadastro) */}
      <EmailConfirmationDialog
        open={showEmailConfirmDialog}
        onOpenChange={setShowEmailConfirmDialog}
        email={pendingEmail}
        onConfirm={handleConfirmEmail}
        onBack={handleBackToForm}
        loading={loading}
      />
      
      {/* Diálogo de Sucesso (Pós-cadastro) */}
      <SignupSuccessDialog
        open={showSignupSuccessDialog}
        onOpenChange={setShowSignupSuccessDialog}
        email={pendingEmail}
      />
    </>
  );
};