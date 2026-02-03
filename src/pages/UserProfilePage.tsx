"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Save, AlertTriangle, Eye, EyeOff, Check, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeAuthError, sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useSession } from "@/components/SessionContextProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
import InputMask from 'react-input-mask';

// Tipagem para os metadados do usuário (armazenados em raw_user_meta_data)
interface UserMetadata {
  first_name?: string;
  last_name?: string;
  posto_graduacao?: string;
  sigla_om?: string;
  funcao_om?: string;
  telefone?: string;
}

// Tipagem para o perfil (tabela profiles)
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  raw_user_meta_data: UserMetadata | null;
}

const MILITARY_RANKS = [
  "Gen Ex", "Gen Div", "Gen Bda", "Cel", "TC", "Maj", "Cap", 
  "1º Ten", "2º Ten", "Asp Of", "ST", "1º Sgt", "2º Sgt", 
  "3º Sgt", "Cb", "Sd"
] as const;

const profileSchema = z.object({
  email: z.string().email("E-mail inválido."),
  first_name: z.string().min(1, "Nome completo é obrigatório."),
  last_name: z.string().min(1, "Nome de Guerra é obrigatório."),
  posto_graduacao: z.enum(MILITARY_RANKS, { message: "Posto/Graduação é obrigatório." }),
  sigla_om: z.string().min(2, "Sigla da OM é obrigatória."),
  funcao_om: z.string().min(2, "Função na OM é obrigatória."),
  telefone: z.string().regex(/^\(?\d{2}\)?\s?\d{9}$/, "Telefone inválido (Ex: (99) 999999999).").optional().or(z.literal('')),
});

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
    .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
    .regex(/[^a-zA-Z0-9]/, "A senha deve conter pelo menos um caractere especial."),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

interface PasswordCriteria {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  specialChar: boolean;
}

const UserProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoading: isLoadingSession } = useSession();
  
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    posto_graduacao: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
  });
  
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordCriteria, setPasswordCriteria] = useState<PasswordCriteria>({
    minLength: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string | undefined>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // NOVO ESTADO
  
  const { handleEnterToNextField } = useFormNavigation();
  
  const userId = user?.id;

  // Query para buscar dados do perfil
  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // 1. Buscar dados do perfil (tabela profiles)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, raw_user_meta_data')
        .eq('id', userId)
        .single();
        
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }
      
      // 2. Buscar dados do usuário (auth.users)
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw userError;
      }
      
      const authUser = userData.user;
      
      // Consolidar dados
      const rawMetadata = (profile?.raw_user_meta_data || authUser?.user_metadata) as UserMetadata;
      
      return {
        email: authUser?.email || "",
        first_name: profile?.first_name || rawMetadata.first_name || "",
        last_name: profile?.last_name || rawMetadata.last_name || "",
        posto_graduacao: rawMetadata.posto_graduacao || "",
        sigla_om: rawMetadata.sigla_om || "",
        funcao_om: rawMetadata.funcao_om || "",
        telefone: rawMetadata.telefone || "",
      };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (profileData) {
      setForm(profileData);
    }
  }, [profileData]);

  const checkPasswordCriteria = (password: string) => {
    setPasswordCriteria({
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[^a-zA-Z0-9]/.test(password),
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm({ ...passwordForm, [name]: value });
    setPasswordErrors(prev => ({ ...prev, [name]: undefined }));
    
    if (name === 'newPassword') {
      checkPasswordCriteria(value);
    }
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setIsSaving(true);
    
    try {
      // 1. Validação Zod
      const normalizedForm = {
        ...form,
        telefone: form.telefone.replace(/\D/g, ""),
      };
      
      const parsed = profileSchema.safeParse({
        ...normalizedForm,
        telefone: normalizedForm.telefone || "",
      });

      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const firstError = parsed.error.errors[0].message;
        toast.error(firstError);
        return;
      }
      
      const { first_name, last_name, posto_graduacao, sigla_om, funcao_om, telefone } = parsed.data;

      // 2. Atualizar tabela profiles (first_name, last_name)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: first_name,
          last_name: last_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
        
      if (profileError) throw profileError;
      
      // 3. Atualizar metadados do usuário (posto_graduacao, sigla_om, funcao_om, telefone)
      const { error: userUpdateError } = await supabase.auth.updateUser({
        data: {
          posto_graduacao,
          sigla_om,
          funcao_om,
          telefone,
        }
      });
      
      if (userUpdateError) throw userUpdateError;

      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      toast.error(sanitizeError(error));
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setPasswordErrors({});
    
    try {
      // 1. Validação Zod
      const parsed = passwordSchema.safeParse(passwordForm);

      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const fieldErrors: Record<string, string | undefined> = {};

        Object.entries(errors).forEach(([key, value]) => {
          if (value?.[0]) fieldErrors[key] = value[0];
        });

        setPasswordErrors(fieldErrors);
        const firstError = parsed.error.errors[0].message;
        toast.error(firstError);
        return;
      }
      
      // 2. Atualizar senha
      const { error } = await supabase.auth.updateUser({
        password: parsed.data.newPassword,
      });
      
      if (error) throw error;
      
      toast.success("Senha atualizada com sucesso!");
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      checkPasswordCriteria("");
      
    } catch (error: any) {
      console.error("Erro ao atualizar senha:", error);
      toast.error(sanitizeAuthError(error));
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!userId) return;
    
    setIsSaving(true);
    setShowDeleteDialog(false);

    try {
      // 1. Tenta obter a sessão.
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      // 2. Chamar a Edge Function para exclusão
      const { error: invokeError, data: invokeData } = await supabase.functions.invoke('delete-user', {
        headers: token ? {
          Authorization: `Bearer ${token}`,
        } : {},
        body: {
          // Envia o ID do usuário para garantir a exclusão correta
          userId: userId, 
        },
      });

      if (invokeError) {
        let errorMessage = invokeError.message || "Falha ao excluir conta via Edge Function.";
        
        if (invokeData && typeof invokeData === 'object' && 'error' in invokeData) {
            errorMessage = (invokeData as { error: string }).error;
        } else if (errorMessage.includes("non-2xx status code")) {
            errorMessage = "Falha na comunicação com o servidor. Tente novamente mais tarde.";
        }
        
        throw new Error(errorMessage);
      }
      
      // 3. Logout forçado e redirecionamento
      await supabase.auth.signOut();
      toast.success("Conta excluída com sucesso.");
      navigate("/");
      
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error(error.message || "Erro ao excluir conta. Tente novamente mais tarde.");
    } finally {
      setIsSaving(false);
    }
  };

  const phoneMask = "(99) 999999999";
  
  const criteriaList = useMemo(() => [
    { key: 'minLength', label: 'Mínimo de 8 caracteres', met: passwordCriteria.minLength },
    { key: 'uppercase', label: 'Uma letra maiúscula (A-Z)', met: passwordCriteria.uppercase },
    { key: 'lowercase', label: 'Uma letra minúscula (a-z)', met: passwordCriteria.lowercase },
    { key: 'number', label: 'Um número (0-9)', met: passwordCriteria.number },
    { key: 'specialChar', label: 'Um caractere especial (!@#$%^&*)', met: passwordCriteria.specialChar },
  ], [passwordCriteria]);

  const renderCriteriaItem = (label: string, met: boolean) => (
    <li className={cn(
      "flex items-center gap-2 transition-colors", 
      met ? "text-green-600" : "text-destructive"
    )}>
      {met ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      {label}
    </li>
  );

  if (isLoadingProfile || isLoadingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando perfil...</span>
      </div>
    );
  }
  
  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Button>
            variant="ghost"
            onClick={() => navigate('/ptrab')}
            < Voltar
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            Meu Perfil
          </h1>
        </div>

        {/* Seção 1: Dados Pessoais e Institucionais */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Dados Pessoais e Institucionais</CardTitle>
            <CardDescription>Atualize suas informações de contato e institucionais.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProfile} className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={form.email}
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    O e-mail não pode ser alterado.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="first_name">Nome Completo *</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    placeholder="Seu nome completo"
                    required
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nome de Guerra *</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    placeholder="Seu nome de guerra"
                    required
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="posto_graduacao">Posto/Graduação *</Label>
                  <Select
                    value={form.posto_graduacao}
                    onValueChange={(value) => handleSelectChange("posto_graduacao", value)}
                  >
                    <SelectTrigger id="posto_graduacao" className="justify-start">
                      <SelectValue placeholder="Seu Posto/Grad">
                        {form.posto_graduacao || "Seu Posto/Grad"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MILITARY_RANKS.map((rank) => (
                        <SelectItem key={rank} value={rank}>
                          {rank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* CAMPO SIGLA DA OM (AGORA INPUT) */}
                  <div className="space-y-2">
                    <Label htmlFor="sigla_om">Sigla da OM</Label>
                    <Input
                      id="sigla_om"
                      name="sigla_om"
                      value={form.sigla_om}
                      onChange={handleChange}
                      placeholder="Ex: Cia C/Ap"
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                
                <div className="space-y-2">
                  <Label htmlFor="funcao_om">Função na OM *</Label>
                  <Input
                    id="funcao_om"
                    name="funcao_om"
                    value={form.funcao_om}
                    onChange={handleChange}
                    placeholder="Ex: S4, Ch Sec Log"
                    required
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone (Opcional)</Label>
                  <InputMask
                    mask={phoneMask}
                    value={form.telefone}
                    onChange={handleChange}
                    maskChar={null}
                  >
                    {(inputProps: any) => (
                      <Input
                        {...inputProps}
                        id="telefone"
                        name="telefone"
                        placeholder="(99) 999999999"
                        onKeyDown={handleEnterToNextField}
                      />
                    )}
                  </InputMask>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Seção 2: Alterar Senha */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Alterar Senha</CardTitle>
            <CardDescription>Use uma senha forte para proteger sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha *</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      name="newPassword"
                      type={showPassword1 ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="pr-10"
                      onKeyDown={handleEnterToNextField}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onMouseDown={() => setShowPassword1(true)}
                      onMouseUp={() => setShowPassword1(false)}
                      tabIndex={-1}
                    >
                      {showPassword1 ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {passwordErrors.newPassword && <p className="text-xs text-destructive">{passwordErrors.newPassword}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPassword2 ? "text" : "password"}
                      autoComplete="new-password"
                      value={passwordForm.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="pr-10"
                      onKeyDown={handleEnterToNextField}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onMouseDown={() => setShowPassword2(true)}
                      onMouseUp={() => setShowPassword2(false)}
                      tabIndex={-1}
                    >
                      {showPassword2 ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  {passwordErrors.confirmPassword && <p className="text-xs text-destructive">{passwordErrors.confirmPassword}</p>}
                </div>
              </div>
              
              {/* Critérios de Senha */}
              <div className="md:col-span-2">
                <div className="p-3 border rounded-md bg-muted/20">
                  <p className="font-bold text-sm text-foreground block mb-1">Critérios de Senha:</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1 ml-2 mt-1 text-xs">
                    {criteriaList.map(item => renderCriteriaItem(item.label, item.met))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSaving || !passwordForm.newPassword.trim()}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Atualizar Senha
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Seção 3: Excluir Conta */}
        <Card className="shadow-lg border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              A exclusão da conta é permanente e não pode ser desfeita.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteDialog(true)}
              disabled={isSaving}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir Minha Conta
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão da Conta
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir sua conta permanentemente? Todos os seus Planos de Trabalho e dados de perfil serão removidos. Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={handleDeleteAccount}
              disabled={isSaving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir Permanentemente
            </AlertDialogAction>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserProfilePage;