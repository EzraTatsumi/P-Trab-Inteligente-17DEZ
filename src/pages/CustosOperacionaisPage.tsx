import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Activity, Loader2, Save, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";

// Tipo derivado da nova tabela
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Valores padrão para inicialização
const defaultDiretrizes = (year: number): Partial<DiretrizOperacional> => ({
  ano_referencia: year,
  valor_diaria_padrao: 0,
  fator_passagens_aereas: 0,
  fator_servicos_terceiros: 0,
  valor_verba_operacional_dia: 0,
  valor_suprimentos_fundo_dia: 0,
  valor_complemento_alimentacao: 0,
  valor_fretamento_aereo_hora: 0,
  valor_locacao_estrutura_dia: 0,
  valor_locacao_viaturas_dia: 0,
  fator_material_consumo: 0,
  fator_concessionaria: 0,
  observacoes: "",
});

// Mapeamento de campos para rótulos e tipo de input (R$ ou Fator)
const OPERATIONAL_FIELDS = [
  { key: 'valor_diaria_padrao', label: 'Diária Padrão (R$)', type: 'currency' as const, placeholder: 'Ex: 100,00' },
  { key: 'fator_passagens_aereas', label: 'Passagens Aéreas (Fator)', type: 'factor' as const, placeholder: 'Ex: 1.5 (para 150%)' },
  { key: 'fator_servicos_terceiros', label: 'Serviços de Terceiros (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.10 (para 10%)' },
  { key: 'valor_verba_operacional_dia', label: 'Verba Operacional (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 50,00' },
  { key: 'valor_suprimentos_fundo_dia', label: 'Suprimentos de Fundos (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 20,00' },
  { key: 'valor_complemento_alimentacao', label: 'Complemento de Alimentação (R$)', type: 'currency' as const, placeholder: 'Ex: 15,00' },
  { key: 'valor_fretamento_aereo_hora', label: 'Fretamento Aéreo (R$/hora)', type: 'currency' as const, placeholder: 'Ex: 1.200,00' },
  { key: 'valor_locacao_estrutura_dia', label: 'Locação de Estrutura (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 300,00' },
  { key: 'valor_locacao_viaturas_dia', label: 'Locação de Viaturas (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 150,00' },
  { key: 'fator_material_consumo', label: 'Material de Consumo (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.02 (para 2%)' },
  { key: 'fator_concessionaria', label: 'Concessionária (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.01 (para 1%)' },
];

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  const [defaultYear, setDefaultYear] = useState<number | null>(null);
  
  // Estado para armazenar os inputs brutos (apenas dígitos) para campos monetários
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
  const { handleEnterToNextField } = useFormNavigation();

  useEffect(() => {
    checkAuthAndLoadYears();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
    }
  }, [selectedYear]);

  const loadDefaultYear = async (userId: string): Promise<number | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('default_diretriz_year')
        .eq('id', userId)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') throw error;
      
      const year = data?.default_diretriz_year || null;
      setDefaultYear(year);
      return year;
    } catch (error) {
      console.error("Erro ao carregar ano padrão:", error);
      setDefaultYear(null);
      return null;
    }
  };

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca anos disponíveis na nova tabela
      const { data, error } = await supabase
        .from("diretrizes_operacionais")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false });

      if (error) throw error;

      const years = data ? data.map(d => d.ano_referencia) : [];
      
      const uniqueYears = Array.from(new Set([...years, currentYear, defaultYearId || 0])).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

      let yearToSelect = currentYear;
      
      if (defaultYearId && uniqueYears.includes(defaultYearId)) {
          yearToSelect = defaultYearId;
      } else if (uniqueYears.length > 0) {
          yearToSelect = uniqueYears[0];
      }
      
      setSelectedYear(prevYear => prevYear !== yearToSelect ? yearToSelect : yearToSelect);

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    }
  };
  
  const checkAuthAndLoadYears = async () => {
    const { data: { session } = { session: null } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }
    
    const fetchedDefaultYear = await loadDefaultYear(session.user.id);
    await loadAvailableYears(fetchedDefaultYear);
  };

  const loadDiretrizesForYear = async (year: number) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca dados da nova tabela
      const { data, error } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .maybeSingle();

      if (error) throw error;

      const loadedData = data || defaultDiretrizes(year);
      
      // Mapear todos os campos NUMERIC para Number e atualizar o estado
      const numericData: Partial<DiretrizOperacional> = {
        ...loadedData,
        valor_diaria_padrao: Number(loadedData.valor_diaria_padrao || 0),
        fator_passagens_aereas: Number(loadedData.fator_passagens_aereas || 0),
        fator_servicos_terceiros: Number(loadedData.fator_servicos_terceiros || 0),
        valor_verba_operacional_dia: Number(loadedData.valor_verba_operacional_dia || 0),
        valor_suprimentos_fundo_dia: Number(loadedData.valor_suprimentos_fundo_dia || 0),
        valor_complemento_alimentacao: Number(loadedData.valor_complemento_alimentacao || 0),
        valor_fretamento_aereo_hora: Number(loadedData.valor_fretamento_aereo_hora || 0),
        valor_locacao_estrutura_dia: Number(loadedData.valor_locacao_estrutura_dia || 0),
        valor_locacao_viaturas_dia: Number(loadedData.valor_locacao_viaturas_dia || 0),
        fator_material_consumo: Number(loadedData.fator_material_consumo || 0),
        fator_concessionaria: Number(loadedData.fator_concessionaria || 0),
        observacoes: loadedData.observacoes || "",
      };
      
      setDiretrizes(numericData);
      
      // Inicializar raw inputs para campos monetários
      const initialRawInputs: Record<string, string> = {};
      OPERATIONAL_FIELDS.filter(f => f.type === 'currency').forEach(f => {
        initialRawInputs[f.key] = numberToRawDigits(numericData[f.key as keyof DiretrizOperacional] as number);
      });
      setRawInputs(initialRawInputs);
      
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes operacionais:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!diretrizes.ano_referencia) {
        toast.error("Informe o ano de referência");
        return;
      }
      
      // 1. Preparar dados para validação e salvamento
      const dataToValidate = {
        ...diretrizes,
        // Garantir que todos os campos numéricos estejam presentes para a validação Zod
        valor_diaria_padrao: diretrizes.valor_diaria_padrao || 0,
        fator_passagens_aereas: diretrizes.fator_passagens_aereas || 0,
        fator_servicos_terceiros: diretrizes.fator_servicos_terceiros || 0,
        valor_verba_operacional_dia: diretrizes.valor_verba_operacional_dia || 0,
        valor_suprimentos_fundo_dia: diretrizes.valor_suprimentos_fundo_dia || 0,
        valor_complemento_alimentacao: diretrizes.valor_complemento_alimentacao || 0,
        valor_fretamento_aereo_hora: diretrizes.valor_fretamento_aereo_hora || 0,
        valor_locacao_estrutura_dia: diretrizes.valor_locacao_estrutura_dia || 0,
        valor_locacao_viaturas_dia: diretrizes.valor_locacao_viaturas_dia || 0,
        fator_material_consumo: diretrizes.fator_material_consumo || 0,
        fator_concessionaria: diretrizes.fator_concessionaria || 0,
      };
      
      // 2. Validação Zod
      diretrizOperacionalSchema.parse(dataToValidate);

      // 3. Preparar dados para o Supabase (garantindo que os numéricos sejam strings se necessário, embora o Supabase aceite Number)
      const diretrizData: TablesInsert<'diretrizes_operacionais'> = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
        valor_diaria_padrao: dataToValidate.valor_diaria_padrao,
        fator_passagens_aereas: dataToValidate.fator_passagens_aereas,
        fator_servicos_terceiros: dataToValidate.fator_servicos_terceiros,
        valor_verba_operacional_dia: dataToValidate.valor_verba_operacional_dia,
        valor_suprimentos_fundo_dia: dataToValidate.valor_suprimentos_fundo_dia,
        valor_complemento_alimentacao: dataToValidate.valor_complemento_alimentacao,
        valor_fretamento_aereo_hora: dataToValidate.valor_fretamento_aereo_hora,
        valor_locacao_estrutura_dia: dataToValidate.valor_locacao_estrutura_dia,
        valor_locacao_viaturas_dia: dataToValidate.valor_locacao_viaturas_dia,
        fator_material_consumo: dataToValidate.fator_material_consumo,
        fator_concessionaria: dataToValidate.fator_concessionaria,
        observacoes: diretrizes.observacoes,
      };

      // 4. Salvar Diretrizes
      if (diretrizes.id) {
        const { error } = await supabase
          .from("diretrizes_operacionais")
          .update(diretrizData as TablesUpdate<'diretrizes_operacionais'>)
          .eq("id", diretrizes.id);
        if (error) throw error;
        toast.success("Diretrizes Operacionais atualizadas!");
      } else {
        const { error } = await supabase
          .from("diretrizes_operacionais")
          .insert([diretrizData as TablesInsert<'diretrizes_operacionais'>]);
        if (error) throw error;
        toast.success("Diretrizes Operacionais criadas!");
      }
      
      await loadAvailableYears(defaultYear);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error.code === '23505') {
        toast.error("Já existe uma diretriz para este ano");
      } else {
        toast.error(sanitizeError(error));
      }
    }
  };
  
  const handleSetDefaultYear = async () => {
    if (!diretrizes.ano_referencia) {
      toast.error("Selecione um ano de referência válido.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from('profiles')
        .update({ default_diretriz_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setDefaultYear(diretrizes.ano_referencia);
      toast.success(`Ano ${diretrizes.ano_referencia} definido como padrão para cálculos!`);
      
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiretrizes = async (sourceYear: number, targetYear: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Copiar Diretriz Operacional
      const { data: sourceOperacional, error: operacionalError } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear)
        .single();
        
      if (operacionalError || !sourceOperacional) throw new Error(`Diretriz operacional para o ano ${sourceYear} não encontrada.`);
      
      const { id: oldId, created_at, updated_at, ...restOperacional } = sourceOperacional;
      const newOperacional = { ...restOperacional, ano_referencia: targetYear, user_id: user.id };
      
      const { error: insertOperacionalError } = await supabase
        .from("diretrizes_operacionais")
        .insert([newOperacional as TablesInsert<'diretrizes_operacionais'>]);
      if (insertOperacionalError) throw insertOperacionalError;
      
      toast.success(`Diretrizes operacionais do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao copiar diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiretrizes = async (year: number) => {
    if (year === defaultYear) {
      toast.error("Não é possível excluir a diretriz do ano padrão.");
      return;
    }
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes operacionais para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Excluir Diretriz Operacional
      const { error: operacionalError } = await supabase
        .from("diretrizes_operacionais")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      if (operacionalError) throw operacionalError;

      toast.success(`Diretrizes operacionais do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      await loadAvailableYears(defaultYear);
      
    } catch (error: any) {
      console.error("Erro ao excluir diretrizes:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  // Handler para inputs monetários (R$)
  const handleCurrencyChange = (field: keyof DiretrizOperacional, rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    
    setRawInputs(prev => ({ ...prev, [field]: digits }));
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };
  
  // Handler para inputs de fator/percentual
  const handleFactorChange = (field: keyof DiretrizOperacional, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };

  // Função para renderizar um campo de diretriz
  const renderDiretrizField = (field: typeof OPERATIONAL_FIELDS[number]) => {
    const value = diretrizes[field.key as keyof DiretrizOperacional] as number;
    
    if (field.type === 'currency') {
      const rawDigits = rawInputs[field.key] || numberToRawDigits(value);
      const displayValue = formatCurrencyInput(rawDigits).formatted;
      
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <Input
              id={field.key}
              type="text"
              inputMode="numeric"
              className="pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={value === 0 && rawDigits.length === 0 ? "" : displayValue}
              onChange={(e) => handleCurrencyChange(field.key as keyof DiretrizOperacional, e.target.value)}
              onKeyDown={handleEnterToNextField}
              placeholder={field.placeholder}
            />
          </div>
        </div>
      );
    } else { // type === 'factor'
      return (
        <div className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Input
            id={field.key}
            type="number"
            step="0.01"
            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={value === 0 ? "" : value}
            onChange={(e) => handleFactorChange(field.key as keyof DiretrizOperacional, e.target.value)}
            placeholder={field.placeholder}
            onKeyDown={handleEnterToNextField}
          />
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/ptrab")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Planos de Trabalho
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsYearManagementDialogOpen(true)}
            disabled={loading}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gerenciar Anos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Configurações de Custos Operacionais
            </CardTitle>
            <CardDescription>
              Defina os valores e fatores de referência para o cálculo de despesas operacionais (GND 3).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDiretrizes(); }}>
              <div className="space-y-2 mb-6">
                <Label>Ano de Referência</Label>
                <Select
                  value={selectedYear.toString()}
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year} {year === defaultYear && "(Padrão)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <p className="text-sm text-muted-foreground pt-1">
                  Ano Padrão de Cálculo: 
                  <span className="font-semibold text-primary ml-1">
                    {defaultYear ? defaultYear : 'Não definido (usando o mais recente)'}
                  </span>
                  {defaultYear && defaultYear !== selectedYear && (
                    <span className="text-xs text-gray-500 ml-2">(Selecione este ano para editar o padrão)</span>
                  )}
                </p>
              </div>

              {/* SEÇÃO PRINCIPAL DE CUSTOS OPERACIONAIS */}
              <div className="border-t pt-4 mt-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {OPERATIONAL_FIELDS.map(field => (
                    <div key={field.key} className="col-span-1">
                      {renderDiretrizField(field)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4 mt-6">
                <Label>Observações</Label>
                <Textarea
                  value={diretrizes.observacoes || ""}
                  onChange={(e) => setDiretrizes({ ...diretrizes, observacoes: e.target.value })}
                  onKeyDown={handleEnterToNextField}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleSetDefaultYear} 
                  disabled={loading || diretrizes.ano_referencia === defaultYear || !diretrizes.ano_referencia}
                >
                  {diretrizes.ano_referencia === defaultYear ? "Padrão Atual" : "Adotar como Padrão"}
                </Button>
                
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Diretrizes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {/* Diálogo de Gerenciamento de Anos */}
      <YearManagementDialog
        open={isYearManagementDialogOpen}
        onOpenChange={setIsYearManagementDialogOpen}
        availableYears={availableYears}
        defaultYear={defaultYear}
        onCopy={handleCopyDiretrizes}
        onDelete={handleDeleteDiretrizes}
        loading={loading}
      />
    </div>
  );
};

export default CustosOperacionaisPage;