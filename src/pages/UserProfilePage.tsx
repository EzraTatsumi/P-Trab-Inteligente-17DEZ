"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User, Loader2, Check, Eye, EyeOff, X, Trash2, AlertTriangle } from "lucide-react";
import { sanitizeError, sanitizeAuthError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useSession } from "@/components/SessionContextProvider";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "@/components/ui/alert-dialog"; // Importar AlertDialog

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  posto_graduacao: string;
  sigla_om: string;
  funcao_om: string;
  telefone: string;
  default_diretriz_year: number | null;
}

const MILITARY_RANKS = [
  "Gen Ex", "Gen Div", "Gen Bda", "Cel", "TC", "Maj", "Cap", 
  "1º Ten", "2º Ten", "Asp Of", "ST", "1º Sgt", "2º Sgt", 
  "3º Sgt", "Cb", "Sd"
] as const;

// Schema de validação para a senha (reutilizado do SignupDialog)
const passwordSchema = z.object({
  password: z.string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula.")
    .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula.")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número.")
    .regex(/[^a-zA-Z0-9]/, "A senha deve conter pelo menos um caractere especial.")
    .optional()
    .or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
}).refine((data) => {
    // Se a nova senha for preenchida, a confirmação deve ser igual
    if (data.password && data.password.length > 0) {
        return data.password === data.confirmPassword;
    }
    // Se a nova senha não for preenchida, a confirmação também deve estar vazia
    return !data.confirmPassword || data.confirmPassword.length === 0;
}, {
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

const fetchProfile = async (userId: string): Promise<ProfileData> => {
  // 1. Buscar dados da tabela profiles
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_diretriz_year')
    .eq('id', userId)
    .single();

  if (profileError) throw profileError;

  // 2. Buscar o objeto user completo para obter os metadados mais recentes
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
      // Se não conseguir o usuário autenticado, lançamos um erro, pois os metadados
      // institucionais (posto, om, função) estão no objeto authUser.
      throw new Error("Sessão de usuário inválida ou expirada. Por favor, faça login novamente.");
  }
  
  // 3. Consolidar metadados: Usar metadados do authUser (mais recentes)
  const authMetaData = authUser.user_metadata as any;
  
  // 4. Retornar dados consolidados
  return {
    id: profileData.id,
    first_name: profileData.first_name || '',
    last_name: profileData.last_name || '',
    // Usar metadados do authUser para campos institucionais
    posto_graduacao: authMetaData?.posto_graduacao || '',
    sigla_om: authMetaData?.sigla_om || '',
    funcao_om: authMetaData?.funcao_om || '',
    telefone: authMetaData?.telefone || '', 
    default_diretriz_year: profileData.default_diretriz_year,
  };
};

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState<Omit<ProfileData, 'id'>>({
    first_name: "",
    last_name: "",
    posto_graduacao: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
    default_diretriz_year: null, // Mantido no estado, mas não usado na UI
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  
  const [loading, setLoading] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string | undefined>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false); // NOVO ESTADO
  
  const { handleEnterToNextField } = useFormNavigation();
  // NOTE: useMilitaryOrganizations retorna OMData[], que é compatível com MilitaryOrganization
  const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
  
  const userId = user?.id;

  // Query para buscar dados do perfil
  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });

  // Efeito para preencher o formulário quando os dados do perfil são carregados
  useEffect(() => {
    if (profileData) {
      // Adicionado log para verificar o preenchimento
      console.log("Setting form data from profileData:", profileData);
      
      setForm({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        posto_graduacao: profileData.posto_graduacao,
        sigla_om: profileData.sigla_om,
        funcao_om: profileData.funcao_om,
        // O telefone é a string de dígitos (sem máscara)
        telefone: profileData.telefone, 
        default_diretriz_year: profileData.default_diretriz_year,
      });
    }
  }, [profileData]); // Depende apenas de profileData

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    setPasswordErrors(prev => ({ ...prev, [name]: undefined }));
  };
  
  const handleSelectChange = (name: keyof Omit<ProfileData, 'id'>, value: string) => {
    if (name === 'default_diretriz_year') {
        const yearValue = value === 'null_year' ? null : Number(value);
        setForm(prev => ({ ...prev, default_diretriz_year: yearValue }));
    } else {
        setForm(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const checkPasswordCriteria = (password: string): PasswordCriteria => ({
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    specialChar: /[^a-zA-Z0-9]/.test(password),
  });

  const passwordCriteria = useMemo(() => checkPasswordCriteria(passwordForm.newPassword), [passwordForm.newPassword]);
  
  const criteriaList = useMemo(() => [
    { label: 'Mínimo de 8 caracteres', met: passwordCriteria.minLength },
    { label: 'Uma letra maiúscula (A-Z)', met: passwordCriteria.uppercase },
    { label: 'Uma letra minúscula (a-z)', met: passwordCriteria.lowercase },
    { label: 'Um número (0-9)', met: passwordCriteria.number },
    { label: 'Um caractere especial (!@#$%^&*)', met: passwordCriteria.specialChar },
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    setPasswordErrors({});

    try {
      // 1. Validação de Senha (se preenchida)
      const isPasswordChangeRequested = passwordForm.newPassword.length > 0 || passwordForm.confirmNewPassword.length > 0;
      
      if (isPasswordChangeRequested) {
        const validationResult = passwordSchema.safeParse({
            password: passwordForm.newPassword,
            confirmPassword: passwordForm.confirmNewPassword,
        });
        
        if (!validationResult.success) {
            const errors = validationResult.error.flatten().fieldErrors;
            const fieldErrors: Record<string, string | undefined> = {};
            
            Object.keys(errors).forEach(key => {
                fieldErrors[key] = errors[key]?.[0];
            });
            setPasswordErrors(fieldErrors);
            
            toast.error(validationResult.error.errors[0].message);
            setLoading(false);
            return;
        }
      }
      
      // 2. Atualizar a tabela 'profiles'
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          default_diretriz_year: form.default_diretriz_year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) throw profileError;
      
      // 3. Atualizar os metadados do usuário (para sigla_om, funcao_om, telefone, posto_graduacao)
      const { error: userMetaError } = await supabase.auth.updateUser({
        data: {
          posto_graduacao: form.posto_graduacao,
          sigla_om: form.sigla_om,
          funcao_om: form.funcao_om,
          // Salva o telefone sem máscara (apenas dígitos)
          telefone: form.telefone.replace(/\D/g, ''), 
        }
      });
      
      if (userMetaError) throw userMetaError;
      
      // 4. Atualizar a senha (se solicitada)
      if (passwordForm.newPassword.length > 0) {
        const { error: passwordUpdateError } = await supabase.auth.updateUser({
            password: passwordForm.newPassword
        });
        
        if (passwordUpdateError) {
            // Trata erros específicos de senha (ex: senha fraca)
            throw new Error(sanitizeAuthError(passwordUpdateError));
        }
      }

      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      setPasswordForm({ newPassword: "", confirmNewPassword: "" }); // Limpa campos de senha
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      toast.error(error.message || sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // 1. Invocar a Edge Function para exclusão do usuário (requer Service Role Key)
      const { error: invokeError } = await supabase.functions.invoke('delete-user');

      if (invokeError) {
        console.error("Erro ao invocar Edge Function de exclusão:", invokeError);
        throw new Error(invokeError.message || "Falha na exclusão do usuário.");
      }
      
      // 2. Se a Edge Function for bem-sucedida, forçamos o logout local
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        console.error("Erro ao fazer logout após exclusão:", signOutError);
      }
      
      toast.success("Sua conta e todos os dados relacionados foram excluídos permanentemente.");
      
      // 3. Redireciona para a página inicial
      navigate("/");
      
    } catch (error: any) {
      console.error("Erro ao excluir conta:", error);
      toast.error(error.message || "Erro ao tentar excluir a conta. Tente novamente.");
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (loadingSession || isLoadingProfile || isLoadingOms) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando perfil...</span>
      </div>
    );
  }
  
  // Removido phoneMask

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Gerenciamento
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Editar Perfil do Usuário
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e institucionais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* Seção 1: Dados Pessoais */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nome Completo</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nome de Guerra</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  
                  {/* NOVO CAMPO: Posto/Graduação */}
                  <div className="space-y-2">
                    <Label htmlFor="posto_graduacao">Posto/Graduação</Label>
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Não Editável)</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      name="telefone"
                      type="text"
                      value={form.telefone}
                      onChange={handleChange}
                      placeholder="Ex: (99) 99999-9999"
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </div>
              </div>
              
              {/* Seção 2: Dados Institucionais */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Dados Institucionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sigla_om">Sigla da OM</Label>
                    <Select
                      value={form.sigla_om}
                      onValueChange={(value) => handleSelectChange("sigla_om", value)}
                      disabled={isLoadingOms}
                    >
                      <SelectTrigger id="sigla_om" className="justify-start">
                        <SelectValue placeholder="Selecione a OM">
                          {form.sigla_om || "Selecione a OM"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {oms?.map((om) => (
                          <SelectItem key={om.id} value={om.nome_om}>
                            {om.nome_om}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="funcao_om">Função na OM</Label>
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
                </div>
              </div>
              
              {/* Seção 3: Alterar Senha */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Alterar Senha (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showPassword1 ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="••••••••"
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
                    {passwordErrors.password && <p className="text-xs text-destructive">{passwordErrors.password}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmNewPassword">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmNewPassword"
                        name="confirmNewPassword"
                        type={showPassword2 ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordForm.confirmNewPassword}
                        onChange={handlePasswordChange}
                        placeholder="••••••••"
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
                    {passwordErrors.confirmNewPassword && <p className="text-xs text-destructive">{passwordErrors.confirmNewPassword}</p>}
                  </div>
                </div>
                
                {/* Critérios de Senha (Apenas se a nova senha estiver sendo digitada) */}
                {passwordForm.newPassword.length > 0 && (
                    <Alert className="mt-2 p-3">
                        <AlertDescription className="text-xs text-muted-foreground">
                            <span className="font-bold text-foreground block mb-1">Critérios de Nova Senha:</span>
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 ml-2 mt-1">
                                {criteriaList.map(item => renderCriteriaItem(item.label, item.met))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
              </div>

              {/* Rodapé do Formulário: Excluir | Salvar | Cancelar */}
              <div className="flex justify-between pt-4">
                {/* Botão de Exclusão (Lado Esquerdo) */}
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Minha Conta
                </Button>
                
                {/* Botões de Ação (Lado Direito) */}
                <div className="flex gap-3">
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/ptrab")}>
                      Cancelar
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Diálogo de Confirmação de Exclusão */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Confirmação de Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você tem certeza que deseja excluir permanentemente sua conta? Todos os seus Planos de Trabalho, diretrizes e dados de perfil serão perdidos.
                <br/><br/>
                **Atenção:** Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={handleDeleteAccount} disabled={loading} className="bg-destructive hover:bg-destructive/90">
                {loading ? "Excluindo..." : "Sim, Excluir Permanentemente"}
              </AlertDialogAction>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default UserProfilePage;