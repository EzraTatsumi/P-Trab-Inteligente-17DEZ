"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ArrowLeft, User, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from "@/components/SessionContextProvider";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import InputMask from 'react-input-mask';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { z } from "zod";

// Lista de Postos/Graduações (copiada do SignupDialog para validação)
const MILITARY_RANKS = [
  "Gen Ex", "Gen Div", "Gen Bda", "Cel", "TC", "Maj", "Cap", 
  "1º Ten", "2º Ten", "Asp Of", "ST", "1º Sgt", "2º Sgt", 
  "3º Sgt", "Cb", "Sd"
] as const;

// Schema de validação para o perfil
const profileSchema = z.object({
  first_name: z.string().min(5, "Nome completo é obrigatório."),
  last_name: z.string().min(2, "Nome de Guerra é obrigatório."),
  posto_graduacao: z.enum(MILITARY_RANKS, { message: "Posto/Graduação é obrigatório." }),
  sigla_om: z.string().min(2, "Sigla da OM é obrigatória."),
  funcao_om: z.string().min(2, "Função na OM é obrigatória."),
  telefone: z.string().regex(/^\(?\d{2}\)?\s?\d{9}$/, "Telefone inválido (Ex: (99) 999999999).").optional().or(z.literal('')),
});

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: isLoadingSession } = useSession();
  const { handleEnterToNextField } = useFormNavigation();
  
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    posto_graduacao: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
  });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  
  // Removido: const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

  const loadProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // 1. Buscar dados do perfil (tabela 'profiles')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name, raw_user_meta_data')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116: No rows found
        throw profileError;
      }
      
      // 2. Usar metadados do Auth (fallback) ou do Profile (preferencial)
      const metadata = profileData?.raw_user_meta_data || user.user_metadata;
      
      setForm({
        first_name: profileData?.first_name || metadata?.first_name || "",
        last_name: profileData?.last_name || metadata?.last_name || "",
        posto_graduacao: metadata?.posto_graduacao || "",
        sigla_om: metadata?.sigla_om || "",
        funcao_om: metadata?.funcao_om || "",
        telefone: metadata?.telefone || "",
      });

    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      toast.error("Falha ao carregar dados do perfil.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user, loadProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setValidationErrors(prev => ({ ...prev, [name]: undefined }));
  };
  
  const handleSelectChange = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
    setValidationErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setValidationErrors({});

    try {
      // 1. Normalização e Validação Zod
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
        const fieldErrors: Record<string, string | undefined> = {};

        Object.entries(errors).forEach(([key, value]) => {
          if (value?.[0]) fieldErrors[key] = value[0];
        });

        setValidationErrors(fieldErrors);
        toast.error(parsed.error.errors[0].message);
        setLoading(false);
        return;
      }
      
      const { first_name, last_name, posto_graduacao, sigla_om, funcao_om, telefone } = parsed.data;

      // 2. Atualizar metadados do usuário (Auth)
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name,
          last_name,
          posto_graduacao,
          sigla_om,
          funcao_om,
          telefone,
        },
      });

      if (authError) throw authError;
      
      // 3. Atualizar tabela 'profiles' (para persistência de first_name/last_name e metadados)
      // Nota: O trigger handle_new_user já insere first_name/last_name no profiles.
      // Aqui, atualizamos explicitamente o profiles para garantir que first_name/last_name sejam sincronizados.
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          first_name,
          last_name,
          updated_at: new Date().toISOString(),
          // O raw_user_meta_data é atualizado pelo trigger do Supabase, mas podemos forçar a atualização aqui se necessário.
          // Para simplificar, confiamos no update do auth.user para sincronizar os metadados.
        })
        .eq('id', user.id);
        
      if (profileUpdateError) {
          console.error("Erro ao atualizar tabela profiles:", profileUpdateError);
          // Não lançamos erro fatal, mas avisamos
          toast.warning("Dados salvos, mas houve um erro na sincronização do perfil.");
      }

      toast.success("Perfil atualizado com sucesso!");
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingSession || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando perfil...</span>
      </div>
    );
  }
  
  const phoneMask = "(99) 999999999";

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/ptrab')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gerenciamento
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <User className="h-6 w-6 text-primary" />
              Meu Perfil
            </CardTitle>
            <CardDescription>
              Edite suas informações pessoais e institucionais.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-6">
              
              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-700" />
                <AlertTitle className="text-blue-700">E-mail de Acesso</AlertTitle>
                <AlertDescription className="text-sm font-bold text-blue-900 break-all">
                  {user?.email}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Nome Completo */}
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
                  {validationErrors.first_name && <p className="text-xs text-destructive">{validationErrors.first_name}</p>}
                </div>
                
                {/* Nome de Guerra */}
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
                  {validationErrors.last_name && <p className="text-xs text-destructive">{validationErrors.last_name}</p>}
                </div>
                
                {/* Posto/Graduação */}
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
                  {validationErrors.posto_graduacao && <p className="text-xs text-destructive">{validationErrors.posto_graduacao}</p>}
                </div>
                
                {/* Sigla da OM (MODIFICADO PARA INPUT) */}
                <div className="space-y-2">
                  <Label htmlFor="sigla_om">Sigla da OM *</Label>
                  <Input
                    id="sigla_om"
                    name="sigla_om"
                    value={form.sigla_om}
                    onChange={handleChange}
                    placeholder="Ex: 1ª RM, CML"
                    required
                    onKeyDown={handleEnterToNextField}
                  />
                  {validationErrors.sigla_om && <p className="text-xs text-destructive">{validationErrors.sigla_om}</p>}
                </div>
                
                {/* Função na OM */}
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
                  {validationErrors.funcao_om && <p className="text-xs text-destructive">{validationErrors.funcao_om}</p>}
                </div>
                
                {/* Telefone */}
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
                  {validationErrors.telefone && <p className="text-xs text-destructive">{validationErrors.telefone}</p>}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;