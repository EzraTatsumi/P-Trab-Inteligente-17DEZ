import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Activity, Loader2, Save, Settings, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Plane } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { formatCurrencyInput, numberToRawDigits, formatCurrency, formatCodug } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte, DiretrizPassagemForm } from "@/types/diretrizesPassagens";
import CurrencyInput from "@/components/CurrencyInput";
import { Switch } from "@/components/ui/switch";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import PassagemDiretrizFormDialog from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow"; // NOVO IMPORT

// Tipo derivado da nova tabela
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

// Estrutura de dados para a tabela de diárias
const DIARIA_RANKS_CONFIG = [
  { key: 'of_gen', label: 'Of Gen', fieldPrefix: 'diaria_of_gen' },
  { key: 'of_sup', label: 'Of Sup', fieldPrefix: 'diaria_of_sup' },
  { key: 'of_int_sgt', label: 'Of Int/Sub/Asp Of/ST/Sgt', fieldPrefix: 'diaria_of_int_sgt' },
  { key: 'demais_pracas', label: 'Demais Praças', fieldPrefix: 'diaria_demais_pracas' },
];

// Mapeamento de campos para rótulos e tipo de input (R$ ou Fator)
const OPERATIONAL_FIELDS = [
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

// Valores padrão para inicialização (incluindo os novos campos de diária)
const defaultDiretrizes = (year: number): Partial<DiretrizOperacional> => ({
  ano_referencia: year,
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
  
  diaria_referencia_legal: 'Decreto Nº 12.324 de 19DEZ24',
  diaria_of_gen_bsb: 600.00,
  diaria_of_gen_capitais: 515.00,
  diaria_of_gen_demais: 455.00,
  diaria_of_sup_bsb: 510.00,
  diaria_of_sup_capitais: 450.00,
  diaria_of_sup_demais: 395.00,
  diaria_of_int_sgt_bsb: 425.00,
  diaria_of_int_sgt_capitais: 380.00,
  diaria_of_int_sgt_demais: 335.00,
  diaria_demais_pracas_bsb: 355.00,
  diaria_demais_pracas_capitais: 315.00,
  diaria_demais_pracas_demais: 280.00,
  
  taxa_embarque: 95.00,
});

const CustosOperacionaisPage = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  
  const currentYear = new Date().getFullYear();
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(currentYear));
  
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const { data: defaultYearData, isLoading: isLoadingDefaultYear } = useDefaultDiretrizYear();
  const defaultYear = defaultYearData?.defaultYear || null;
  
  // Estado para armazenar os inputs brutos (apenas dígitos) para campos monetários
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  
  // Estado para controlar a expansão individual de cada campo
  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    OPERATIONAL_FIELDS.forEach(field => {
      initialState[field.key as string] = false;
    });
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = false; 
    return initialState;
  });
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // --- ESTADOS DE DIRETRIZES DE PASSAGENS ---
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<DiretrizPassagem[]>([]);
  const [isPassagemFormOpen, setIsPassagemFormOpen] = useState(false);
  const [diretrizToEdit, setDiretrizToEdit] = useState<DiretrizPassagem | null>(null);
  
  // Efeito para rolar para o topo na montagem
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Efeito para carregar anos disponíveis e definir o ano selecionado
  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData) {
        const checkAuthAndLoadYears = async () => {
            const { data: { session } = { session: null } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Você precisa estar autenticado");
                navigate("/login");
                return;
            }
            
            await loadAvailableYears(defaultYearData.defaultYear);
            setSelectedYear(defaultYearData.year);
        };
        checkAuthAndLoadYears();
    }
  }, [isLoadingDefaultYear, defaultYearData]);

  useEffect(() => {
    if (selectedYear) {
      loadDiretrizesForYear(selectedYear);
      loadDiretrizesPassagens(selectedYear); 
    }
  }, [selectedYear]);

  const loadAvailableYears = async (defaultYearId: number | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca anos disponíveis nas duas tabelas
      const [
          { data: opData, error: opError },
          { data: passagensData, error: passagensError }
      ] = await Promise.all([
          supabase.from("diretrizes_operacionais").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_passagens").select("ano_referencia").eq("user_id", user.id),
      ]);

      if (opError || passagensError) throw opError || passagensError;

      const opYears = opData ? opData.map(d => d.ano_referencia) : [];
      const passagensYears = passagensData ? passagensData.map(d => d.ano_referencia) : [];
      
      const yearsToInclude = new Set([...opYears, ...passagensYears]);
      
      if (defaultYearId && !yearsToInclude.has(defaultYearId)) {
          yearsToInclude.add(defaultYearId);
      }
      
      if (yearsToInclude.size === 0) {
          yearsToInclude.add(currentYear);
      }
      
      const uniqueYears = Array.from(yearsToInclude).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    }
  };
  
  const loadDiretrizesForYear = async (year: number) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_operacionais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", year)
        .maybeSingle();

      if (error) throw error;

      const loadedData = data || defaultDiretrizes(year);
      
      const numericData: Partial<DiretrizOperacional> = {
        ...loadedData,
        fator_passagens_aereas: Number(loadedData.fator_passagens_aereas || 0),
        fator_servicos_terceiros: Number(loadedData.fator_servicos_terceiros || 0),
        fator_material_consumo: Number(loadedData.fator_material_consumo || 0),
        fator_concessionaria: Number(loadedData.fator_concessionaria || 0),
        
        valor_verba_operacional_dia: Number(loadedData.valor_verba_operacional_dia || 0),
        valor_suprimentos_fundo_dia: Number(loadedData.valor_suprimentos_fundo_dia || 0),
        valor_complemento_alimentacao: Number(loadedData.valor_complemento_alimentacao || 0),
        valor_fretamento_aereo_hora: Number(loadedData.valor_fretamento_aereo_hora || 0),
        valor_locacao_estrutura_dia: Number(loadedData.valor_locacao_estrutura_dia || 0),
        valor_locacao_viaturas_dia: Number(loadedData.valor_locacao_viaturas_dia || 0),
        
        diaria_referencia_legal: loadedData.diaria_referencia_legal || defaultDiretrizes(year).diaria_referencia_legal,
        diaria_of_gen_bsb: Number(loadedData.diaria_of_gen_bsb || 0),
        diaria_of_gen_capitais: Number(loadedData.diaria_of_gen_capitais || 0),
        diaria_of_gen_demais: Number(loadedData.diaria_of_gen_demais || 0),
        diaria_of_sup_bsb: Number(loadedData.diaria_of_sup_bsb || 0),
        diaria_of_sup_capitais: Number(loadedData.diaria_of_sup_capitais || 0),
        diaria_of_sup_demais: Number(loadedData.diaria_of_sup_demais || 0),
        diaria_of_int_sgt_bsb: Number(loadedData.diaria_of_int_sgt_bsb || 0),
        diaria_of_int_sgt_capitais: Number(loadedData.diaria_of_int_sgt_capitais || 0),
        diaria_of_int_sgt_demais: Number(loadedData.diaria_of_int_sgt_demais || 0),
        diaria_demais_pracas_bsb: Number(loadedData.diaria_demais_pracas_bsb || 0),
        diaria_demais_pracas_capitais: Number(loadedData.diaria_demais_pracas_capitais || 0),
        diaria_demais_pracas_demais: Number(loadedData.diaria_demais_pracas_demais || 0),
        
        taxa_embarque: Number(loadedData.taxa_embarque || defaultDiretrizes(year).taxa_embarque),
        
        observacoes: loadedData.observacoes || "",
      };
      
      setDiretrizes(numericData);
      
      const initialRawInputs: Record<string, string> = {};
      
      OPERATIONAL_FIELDS.filter(f => f.type === 'currency').forEach(f => {
        initialRawInputs[f.key as string] = numberToRawDigits(numericData[f.key as keyof DiretrizOperacional] as number);
      });
      
      DIARIA_RANKS_CONFIG.forEach(rank => {
        initialRawInputs[`diaria_${rank.key}_bsb`] = numberToRawDigits(numericData[`diaria_${rank.key}_bsb` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_capitais`] = numberToRawDigits(numericData[`diaria_${rank.key}_capitais` as keyof DiretrizOperacional] as number);
        initialRawInputs[`diaria_${rank.key}_demais`] = numberToRawDigits(numericData[`diaria_${rank.key}_demais` as keyof DiretrizOperacional] as number);
      });
      
      initialRawInputs['taxa_embarque'] = numberToRawDigits(numericData.taxa_embarque as number);
      
      setRawInputs(initialRawInputs);
      
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes operacionais:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  };
  
  const loadDiretrizesPassagens = async (year: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('diretrizes_passagens')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('om_referencia', { ascending: true });
            
        if (error) throw error;
        
        setDiretrizesPassagens(data as DiretrizPassagem[]);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de passagens:", error);
        toast.error("Erro ao carregar contratos de passagens.");
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
      
      const dataToValidate = {
        ...diretrizes,
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
        diaria_of_gen_bsb: diretrizes.diaria_of_gen_bsb || 0,
        diaria_of_gen_capitais: diretrizes.diaria_of_gen_capitais || 0,
        diaria_of_gen_demais: diretrizes.diaria_of_gen_demais || 0,
        diaria_of_sup_bsb: diretrizes.diaria_of_sup_bsb || 0,
        diaria_of_sup_capitais: diretrizes.diaria_of_sup_capitais || 0,
        diaria_of_sup_demais: diretrizes.diaria_of_sup_demais || 0,
        diaria_of_int_sgt_bsb: diretrizes.diaria_of_int_sgt_bsb || 0,
        diaria_of_int_sgt_capitais: diretrizes.diaria_of_int_sgt_capitais || 0,
        diaria_of_int_sgt_demais: diretrizes.diaria_of_int_sgt_demais || 0,
        diaria_demais_pracas_bsb: diretrizes.diaria_demais_pracas_bsb || 0,
        diaria_demais_pracas_capitais: diretrizes.diaria_demais_pracas_capitais || 0,
        diaria_demais_pracas_demais: diretrizes.diaria_demais_pracas_demais || 0,
        taxa_embarque: diretrizes.taxa_embarque || 0,
      };
      
      diretrizOperacionalSchema.parse(dataToValidate);

      const diretrizData: TablesInsert<'diretrizes_operacionais'> = {
        user_id: user.id,
        ano_referencia: diretrizes.ano_referencia,
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
        
        diaria_referencia_legal: diretrizes.diaria_referencia_legal,
        diaria_of_gen_bsb: diretrizes.diaria_of_gen_bsb,
        diaria_of_gen_capitais: diretrizes.diaria_of_gen_capitais,
        diaria_of_gen_demais: diretrizes.diaria_of_gen_demais,
        diaria_of_sup_bsb: diretrizes.diaria_of_sup_bsb,
        diaria_of_sup_capitais: diretrizes.diaria_of_sup_capitais,
        diaria_of_sup_demais: diretrizes.diaria_of_sup_demais,
        diaria_of_int_sgt_bsb: diretrizes.diaria_of_int_sgt_bsb,
        diaria_of_int_sgt_capitais: diretrizes.diaria_of_int_sgt_capitais,
        diaria_of_int_sgt_demais: diretrizes.diaria_of_int_sgt_demais,
        diaria_demais_pracas_bsb: diretrizes.diaria_demais_pracas_bsb,
        diaria_demais_pracas_capitais: diretrizes.diaria_demais_pracas_capitais,
        diaria_demais_pracas_demais: diretrizes.diaria_demais_pracas_demais,
        
        taxa_embarque: diretrizes.taxa_embarque,
      };

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
      
      queryClient.invalidateQueries({ queryKey: ["diretrizesOperacionais", diretrizes.ano_referencia] });
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
        .update({ default_operacional_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
      
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
        .maybeSingle();
        
      if (operacionalError) throw operacionalError;
      
      if (sourceOperacional) {
          const { id: oldId, created_at, updated_at, ...restOperacional } = sourceOperacional;
          const newOperacional = { ...restOperacional, ano_referencia: targetYear, user_id: user.id };
          
          const { error: insertOperacionalError } = await supabase
            .from("diretrizes_operacionais")
            .insert([newOperacional as TablesInsert<'diretrizes_operacionais'>]);
          if (insertOperacionalError) throw insertOperacionalError;
      }
      
      // 2. Copiar Diretrizes de Passagens
      const { data: sourcePassagens, error: passagensError } = await supabase
        .from("diretrizes_passagens")
        .select("om_referencia, ug_referencia, numero_pregao, trechos, ativo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (passagensError) throw passagensError;
      
      if (sourcePassagens && sourcePassagens.length > 0) {
          const newPassagens = sourcePassagens.map(p => ({
              ...p,
              ano_referencia: targetYear,
              user_id: user.id,
              trechos: p.trechos, // JSONB é copiado diretamente
          }));
          
          const { error: insertPassagensError } = await supabase
            .from("diretrizes_passagens")
            .insert(newPassagens as TablesInsert<'diretrizes_passagens'>[]);
          if (insertPassagensError) throw insertPassagensError;
      }
      
      toast.success(`Diretrizes operacionais e de passagens do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
      setIsYearManagementDialogOpen(false);
      setSelectedYear(targetYear);
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
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
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes operacionais e de passagens para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      setLoading(true);
      
      // 1. Excluir Diretriz Operacional
      await supabase
        .from("diretrizes_operacionais")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 2. Excluir Diretrizes de Passagens
      await supabase
        .from("diretrizes_passagens")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      toast.success(`Diretrizes operacionais e de passagens do ano ${year} excluídas com sucesso!`);
      setIsYearManagementDialogOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ["defaultOperacionalYear", user.id] });
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
  const renderDiretrizField = (field: { key: string, label: string, type: 'currency' | 'factor', placeholder: string }) => {
    const value = diretrizes[field.key as keyof DiretrizOperacional] as number;
    
    if (field.type === 'currency') {
      const rawDigits = rawInputs[field.key] || numberToRawDigits(value);
      const { formatted: displayValue } = formatCurrencyInput(rawDigits);
      
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
  
  // Função para renderizar a tabela de diárias
  const renderDiariaTable = () => {
    const handleDiariaChange = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais', rawValue: string) => {
      const fieldKey = `diaria_${rankKey}_${destination}` as keyof DiretrizOperacional;
      handleCurrencyChange(fieldKey, rawValue);
    };
    
    const getDiariaProps = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais') => {
      const fieldKey = `${DIARIA_RANKS_CONFIG.find(r => r.key === rankKey)?.fieldPrefix}_${destination}` as keyof DiretrizOperacional;
      const value = diretrizes[fieldKey] as number;
      const rawDigits = rawInputs[fieldKey as string] || numberToRawDigits(value);
      const { formatted: displayValue } = formatCurrencyInput(rawDigits);
      
      return {
        rawDigits: rawDigits,
        onChange: (digits: string) => handleDiariaChange(rankKey, destination, digits),
        onKeyDown: handleEnterToNextField,
        placeholder: "0,00",
        className: "text-center",
      };
    };
    
    // Props para Taxa de Embarque
    const taxaEmbarqueProps = renderDiretrizField({
        key: 'taxa_embarque', 
        label: 'Taxa de Embarque (R$)', 
        type: 'currency', 
        placeholder: 'Ex: 95,00'
    });
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="diaria_referencia_legal">Referência Legal (Lei/Portaria)</Label>
            <Input
              id="diaria_referencia_legal"
              value={diretrizes.diaria_referencia_legal || ''}
              onChange={(e) => setDiretrizes({ ...diretrizes, diaria_referencia_legal: e.target.value })}
              placeholder="Decreto Nº 12.324 de 19DEZ24"
              onKeyDown={handleEnterToNextField}
            />
          </div>
          {taxaEmbarqueProps}
        </div>
        
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Posto/Graduação</TableHead>
              <TableHead className="text-center">Dslc BSB/MAO/RJ/SP</TableHead>
              <TableHead className="text-center">Dslc demais capitais</TableHead>
              <TableHead className="text-center">Demais Dslc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {DIARIA_RANKS_CONFIG.map((rank) => (
              <TableRow key={rank.key}>
                <TableCell className="font-medium whitespace-nowrap">{rank.label}</TableCell>
                <TableCell>
                  <CurrencyInput
                    {...getDiariaProps(rank.key, 'bsb')}
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    {...getDiariaProps(rank.key, 'capitais')}
                  />
                </TableCell>
                <TableCell>
                  <CurrencyInput
                    {...getDiariaProps(rank.key, 'demais')}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  // --- LÓGICA DE PASSAGENS ---
  
  const handleSavePassagem = async (data: Partial<DiretrizPassagem> & { ano_referencia: number, om_referencia: string, ug_referencia: string }) => {
      try {
          setLoading(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_passagens'> = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              om_referencia: data.om_referencia,
              ug_referencia: data.ug_referencia,
              numero_pregao: data.numero_pregao || null,
              trechos: data.trechos || [],
              ativo: data.ativo ?? true,
          } as TablesInsert<'diretrizes_passagens'>;
          
          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_passagens')
                  .update(dbData as TablesUpdate<'diretrizes_passagens'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Contrato de Passagens atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_passagens')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Contrato de Passagens cadastrado!");
          }
          
          await loadDiretrizesPassagens(selectedYear);
          setDiretrizToEdit(null);
          setIsPassagemFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const handleStartEditPassagem = (diretriz: DiretrizPassagem) => {
      setDiretrizToEdit(diretriz);
      setIsPassagemFormOpen(true);
  };
  
  const handleOpenNewPassagem = () => {
      setDiretrizToEdit(null);
      setIsPassagemFormOpen(true);
  };
  
  const handleDeletePassagem = async (id: string, omName: string) => {
      if (!confirm(`Tem certeza que deseja excluir o contrato de passagens da OM ${omName}?`)) return;
      
      try {
          setLoading(true);
          await supabase.from('diretrizes_passagens').delete().eq('id', id);
          toast.success("Contrato de Passagens excluído!");
          await loadDiretrizesPassagens(selectedYear);
      } catch (error) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  const renderPassagensSection = () => {
      
      return (
          <div className="space-y-4">
              
              {/* Lista de Contratos Existentes */}
              {diretrizesPassagens.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Contratos Cadastrados para {selectedYear}</CardTitle>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>OM Referência</TableHead>
                                  <TableHead>Pregão</TableHead>
                                  <TableHead className="text-center">Trechos</TableHead>
                                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {diretrizesPassagens.map(d => (
                                  <PassagemDiretrizRow
                                      key={d.id}
                                      diretriz={d}
                                      onEdit={handleStartEditPassagem}
                                      onDelete={handleDeletePassagem}
                                      loading={loading}
                                  />
                              ))}
                          </TableBody>
                      </Table>
                  </Card>
              ) : (
                  <Card className="p-4 text-center text-muted-foreground">
                      Nenhum contrato de passagens cadastrado para o ano {selectedYear}.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewPassagem}
                      disabled={loading}
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Contrato
                  </Button>
              </div>
          </div>
      );
  };

  // Adicionando a verificação de carregamento
  if (loading || isLoadingDefaultYear) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground ml-2">Carregando configurações...</p>
      </div>
    );
  }

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
            disabled={loading || isLoadingDefaultYear}
          >
            <Settings className="mr-2 h-4 w-4" />
            Gerenciar Anos
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configurações de Custos Operacionais</CardTitle>
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

              {/* SEÇÃO PRINCIPAL DE CUSTOS OPERACIONAIS (ITENS INDIVIDUAIS COLAPSÁVEIS) */}
              <div className="border-t pt-4 mt-6">
                <div className="space-y-4">
                  
                  {/* Pagamento de Diárias */}
                  <Collapsible 
                    open={fieldCollapseState['diarias_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['diarias_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium">
                          Pagamento de Diárias
                        </h4>
                        {fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderDiariaTable()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Diretrizes de Passagens (Contratos/Trechos) */}
                  <Collapsible 
                    open={fieldCollapseState['passagens_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['passagens_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Passagens (Contratos/Trechos)
                        </h4>
                        {fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderPassagensSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* OUTROS CAMPOS OPERACIONAIS */}
                  {OPERATIONAL_FIELDS.map(field => {
                    const fieldKey = field.key as string;
                    const isOpen = fieldCollapseState[fieldKey] ?? false;
                    
                    return (
                      <Collapsible 
                        key={fieldKey} 
                        open={isOpen} 
                        onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, [fieldKey]: open }))}
                        className="border-b pb-4 last:border-b-0 last:pb-0"
                      >
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between cursor-pointer py-2">
                            <h4 className="text-base font-medium">
                              {field.label}
                            </h4>
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2">
                            {renderDiretrizField(field)}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
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
      
      {/* Diálogo de Formulário de Passagens */}
      <PassagemDiretrizFormDialog
          open={isPassagemFormOpen}
          onOpenChange={setIsPassagemFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizToEdit}
          onSave={handleSavePassagem}
          loading={loading}
      />
    </div>
  );
};

export default CustosOperacionaisPage;