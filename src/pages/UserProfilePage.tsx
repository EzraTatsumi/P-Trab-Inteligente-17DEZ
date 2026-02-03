import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, User, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError, sanitizeAuthError } from "@/lib/errorUtils";
import { useSession } from "@/components/SessionContextProvider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import InputMask from 'react-input-mask';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDefaultLogisticaYear } from "@/lib/ptrabUtils";

// Lista de Postos/Graduações (deve ser a mesma do SignupDialog)
const MILITARY_RANKS = [
  "Gen Ex", "Gen Div", "Gen Bda", "Cel", "TC", "Maj", "Cap", 
  "1º Ten", "2º Ten", "Asp Of", "ST", "1º Sgt", "2º Sgt", 
  "3º Sgt", "Cb", "Sd"
] as const;

// Lista de anos para seleção de diretriz
const YEAR_OPTIONS = [
    { value: new Date().getFullYear(), label: `Ano Atual (${new Date().getFullYear()})` },
    { value: new Date().getFullYear() + 1, label: `Próximo Ano (${new Date().getFullYear() + 1})` },
    { value: new Date().getFullYear() - 1, label: `Ano Anterior (${new Date().getFullYear() - 1})` },
];

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  posto_graduacao: string;
  sigla_om: string;
  funcao_om: string;
  telefone: string;
  default_logistica_year: number | null;
  default_operacional_year: number | null;
}

/**
 * Busca os dados do perfil e os metadados de autenticação do usuário.
 */
const fetchProfile = async (userId: string): Promise<ProfileData> => {
  // 1. Buscar metadados do usuário (posto, om, função, telefone)
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !authUser) {
    throw new Error("Usuário não autenticado.");
  }
  
  const authMetaData = authUser.user_metadata as {
    posto_graduacao?: string;
    sigla_om?: string;
    funcao_om?: string;
    telefone?: string;
  } | undefined;

  // 2. Buscar dados da tabela profiles
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, default_logistica_year, default_operacional_year')
    .eq('id', userId)
    .single();

  if (profileError) {
    // Se o erro for 'No rows found' (PGRST116), significa que o perfil ainda não foi criado pelo trigger.
    // Isso pode acontecer se o trigger falhar ou se o usuário for criado manualmente.
    if (profileError.code === 'PGRST116') {
        console.warn("Perfil não encontrado, usando dados de autenticação como fallback.");
    } else {
        throw profileError;
    }
  }
  
  // 3. Consolidar dados
  const consolidatedProfileData = profileData || { 
      id: userId, 
      first_name: '', 
      last_name: '', 
      default_logistica_year: null,
      default_operacional_year: null,
  };

  // 4. Retornar dados consolidados
  return {
    id: consolidatedProfileData.id,
    first_name: consolidatedProfileData.first_name || '',
    last_name: consolidatedProfileData.last_name || '',
    // Usar metadados do authUser para campos institucionais
    posto_graduacao: authMetaData?.posto_graduacao || '',
    sigla_om: authMetaData?.sigla_om || '',
    funcao_om: authMetaData?.funcao_om || '',
    telefone: authMetaData?.telefone || '', 
    default_logistica_year: consolidatedProfileData.default_logistica_year,
    default_operacional_year: consolidatedProfileData.default_operacional_year,
  };
};

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, isLoading: loadingSession } = useSession();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState<Omit<ProfileData, 'id' | 'default_logistica_year' | 'default_operacional_year'>>({
    first_name: "",
    last_name: "",
    posto_graduacao: "",
    sigla_om: "",
    funcao_om: "",
    telefone: "",
  });
  const [loading, setLoading] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  
  const { handleEnterToNextField } = useFormNavigation();
  const phoneMask = "(99) 999999999";

  // Query para buscar os dados do perfil
  const { data, isLoading: isLoadingProfile, isError, error, refetch } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Query para buscar o ano padrão de logística (usado para preencher o Select)
  const { data: defaultLogisticaYear, isLoading: isLoadingDefaultYear } = useQuery({
    queryKey: ['defaultLogisticaYear', user?.id],
    queryFn: () => fetchDefaultLogisticaYear(),
    enabled: !!user?.id,
    initialData: null,
  });

  useEffect(() => {
    if (data) {
      setProfileData(data);
      setForm({
        first_name: data.first_name,
        last_name: data.last_name,
        posto_graduacao: data.posto_graduacao,
        sigla_om: data.sigla_om,
        funcao_om: data.funcao_om,
        // O telefone é a string de dígitos (sem máscara)
        telefone: data.telefone, 
      });
    }
    if (isError) {
        setSubmissionError(sanitizeError(error));
        toast.error("Falha ao carregar dados do perfil.");
    }
  }, [data, isError, error]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setSubmissionError(null);
  };
  
  const handleSelectChange = (name: keyof Omit<ProfileData, 'id'>, value: string) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };
  
  const handleYearSelectChange = (name: 'default_logistica_year' | 'default_operacional_year', value: string) => {
    const yearValue = value === 'null_year' ? null : Number(value);
    setProfileData(prev => prev ? ({ ...prev, [name]: yearValue }) : null);
    setSubmissionError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileData) return;

    setLoading(true);
    setSubmissionError(null);

    try {
      const normalizedTelefone = form.telefone.replace(/\D/g, "");
      
      // 1. Atualizar a tabela profiles (first_name, last_name, default_year)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          default_logistica_year: profileData.default_logistica_year,
          default_operacional_year: profileData.default_operacional_year,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Atualizar metadados do usuário (posto, om, função, telefone)
      const { error: authUpdateError } = await supabase.auth.updateUser({
        data: {
          posto_graduacao: form.posto_graduacao,
          sigla_om: form.sigla_om,
          funcao_om: form.funcao_om,
          telefone: normalizedTelefone,
        },
      });

      if (authUpdateError) {
        // Trata erros de metadados como erros de autenticação
        throw authUpdateError;
      }

      // 3. Sucesso
      toast.success("Perfil atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
      queryClient.invalidateQueries({ queryKey: ['defaultLogisticaYear', user.id] });
      refetch(); // Recarrega os dados para garantir a sincronia
      
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      const msg = sanitizeAuthError(error) || sanitizeError(error);
      setSubmissionError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  
  const allYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<number>();
    
    // Adiciona os anos padrão
    YEAR_OPTIONS.forEach(opt => years.add(opt.value));
    
    // Adiciona os anos salvos no perfil
    if (profileData?.default_logistica_year) years.add(profileData.default_logistica_year);
    if (profileData?.default_operacional_year) years.add(profileData.default_operacional_year);
    
    // Adiciona o ano atual se não estiver presente
    years.add(currentYear);
    
    return Array.from(years).sort((a, b) => b - a); // Ordena do mais novo para o mais antigo
  }, [profileData]);

  if (loadingSession || isLoadingProfile || isLoadingDefaultYear || !profileData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando perfil...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/ptrab')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <User className="h-6 w-6 text-primary" />
              Meu Perfil
            </CardTitle>
            <CardDescription>
              Atualize suas informações pessoais e institucionais.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <form onSubmit={handleSave} className="space-y-6">
              
              {submissionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao Salvar</AlertTitle>
                  <AlertDescription>{submissionError}</AlertDescription>
                </Alert>
              )}

              {/* Dados Pessoais */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Dados Pessoais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      autocomplete="name"
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
                      autocomplete="nickname"
                    />
                  </div>
                </div>
              </div>

              {/* Dados Institucionais */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Dados Institucionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Posto/Graduação */}
                  <div className="space-y-2">
                    <Label htmlFor="posto_graduacao">Posto/Graduação *</Label>
                    <Select
                      value={form.posto_graduacao}
                      onValueChange={(value) => handleSelectChange("posto_graduacao", value)}
                      disabled={loading}
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
                  
                  {/* Sigla da OM (CORRIGIDO: AGORA INPUT SIMPLES) */}
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
                      autocomplete="organization"
                    />
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
                      autocomplete="organization-title"
                    />
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
                          autocomplete="tel"
                        />
                      )}
                    </InputMask>
                  </div>
                </div>
              </div>
              
              {/* Configurações Padrão */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Configurações Padrão</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Ano Padrão Logística */}
                    <div className="space-y-2">
                        <Label htmlFor="default_logistica_year">Ano Padrão Logística</Label>
                        <Select
                            value={String(profileData.default_logistica_year ?? 'null_year')}
                            onValueChange={(value) => handleYearSelectChange("default_logistica_year", value)}
                            disabled={loading}
                        >
                            <SelectTrigger id="default_logistica_year" className="justify-start">
                                <SelectValue placeholder="Usar ano atual" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="null_year">Usar ano atual (Padrão)</SelectItem>
                                {allYears.map((year) => (
                                    <SelectItem key={year} value={String(year)}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Define o ano de referência para as diretrizes de custeio (Classes I, II, III, V, VI, VII, VIII, IX).
                        </p>
                    </div>
                    
                    {/* Ano Padrão Operacional */}
                    <div className="space-y-2">
                        <Label htmlFor="default_operacional_year">Ano Padrão Operacional</Label>
                        <Select
                            value={String(profileData.default_operacional_year ?? 'null_year')}
                            onValueChange={(value) => handleYearSelectChange("default_operacional_year", value)}
                            disabled={loading}
                        >
                            <SelectTrigger id="default_operacional_year" className="justify-start">
                                <SelectValue placeholder="Usar ano atual" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="null_year">Usar ano atual (Padrão)</SelectItem>
                                {allYears.map((year) => (
                                    <SelectItem key={year} value={String(year)}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Define o ano de referência para as diretrizes operacionais (Diárias, Passagens, Verba).
                        </p>
                    </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? (
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
      </div>
    </div>
  );
};

export default UserProfilePage;