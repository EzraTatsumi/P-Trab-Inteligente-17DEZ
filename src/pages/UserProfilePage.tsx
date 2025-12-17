"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, User, Loader2, Check } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useSession } from "@/components/SessionContextProvider";
import { useMilitaryOrganizations, MilitaryOrganization } from "@/hooks/useMilitaryOrganizations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InputMask from 'react-input-mask';
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  sigla_om: string;
  funcao_om: string;
  telefone: string;
  default_diretriz_year: number | null;
}

const fetchProfile = async (userId: string): Promise<ProfileData> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_diretriz_year, raw_user_meta_data')
    .eq('id', userId)
    .single();

  if (error) throw error;

  const metaData = data.raw_user_meta_data as any;
  
  return {
    id: data.id,
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    default_diretriz_year: data.default_diretriz_year,
    sigla_om: metaData?.sigla_om || '',
    funcao_om: metaData?.funcao_om || '',
    telefone: metaData?.telefone || '',
  };
};

const fetchAvailableYears = async (userId: string): Promise<number[]> => {
    const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", userId)
        .order("ano_referencia", { ascending: false });

    if (error) {
        console.error("Error fetching available years:", error);
        return [];
    }
    
    const years = data ? data.map(d => d.ano_referencia) : [];
    const currentYear = new Date().getFullYear();
    const uniqueYears = Array.from(new Set([...years, currentYear])).filter(y => y > 0).sort((a, b) => b - a);
    return uniqueYears;
};


const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState<Omit<ProfileData, 'id'>>({
    first_name: "",
    last_name: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
    default_diretriz_year: null,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const { handleEnterToNextField } = useFormNavigation();
  const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
  
  const userId = user?.id;

  // Query para buscar dados do perfil
  const { data: profileData, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
  
  // Query para buscar anos disponíveis
  const { data: availableYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ['availableYears', userId],
    queryFn: () => fetchAvailableYears(userId!),
    enabled: !!userId,
  });

  useEffect(() => {
    if (profileData && isInitialLoad) {
      setForm({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        sigla_om: profileData.sigla_om,
        funcao_om: profileData.funcao_om,
        telefone: profileData.telefone,
        default_diretriz_year: profileData.default_diretriz_year,
      });
      setIsInitialLoad(false);
    }
  }, [profileData, isInitialLoad]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };
  
  const handleSelectChange = (name: keyof ProfileData, value: string | number | null) => {
    if (name === 'default_diretriz_year') {
        setForm(prev => ({ ...prev, default_diretriz_year: value ? Number(value) : null }));
    } else {
        setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setLoading(true);
    try {
      // 1. Atualizar a tabela 'profiles'
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
      
      // 2. Atualizar os metadados do usuário (para sigla_om, funcao_om, telefone)
      const { error: userError } = await supabase.auth.updateUser({
        data: {
          sigla_om: form.sigla_om,
          funcao_om: form.funcao_om,
          telefone: form.telefone.replace(/\D/g, ''), // Salva o telefone sem máscara
        }
      });
      
      if (userError) throw userError;

      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
      
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loadingSession || isLoadingProfile || isLoadingOms || isLoadingYears) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando perfil...</span>
      </div>
    );
  }
  
  const phoneMask = "(99) 999999999";

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
                      <SelectTrigger id="sigla_om">
                        <SelectValue placeholder="Selecione a OM">
                          {form.sigla_om || "Selecione a OM"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {oms?.map((om: MilitaryOrganization) => (
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
              
              {/* Seção 3: Configurações Padrão */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configurações Padrão</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_diretriz_year">Ano Padrão da Diretriz de Custeio</Label>
                    <Select
                      value={form.default_diretriz_year?.toString() || ''}
                      onValueChange={(value) => handleSelectChange("default_diretriz_year", value)}
                      disabled={isLoadingYears}
                    >
                      <SelectTrigger id="default_diretriz_year">
                        <SelectValue placeholder="Usar o ano mais recente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Usar o ano mais recente</SelectItem>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Define qual ano de diretriz será carregado por padrão ao criar um novo P Trab.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
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
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;