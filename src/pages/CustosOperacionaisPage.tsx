import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Settings, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { YearManagementDialog } from "@/components/YearManagementDialog";
import { formatCurrencyInput, numberToRawDigits } from "@/lib/formatUtils";
import { useSession } from "@/components/SessionContextProvider";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { diretrizOperacionalSchema } from "@/lib/validationSchemas";
import * as z from "zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import CurrencyInput from "@/components/CurrencyInput";
import PassagemDiretrizFormDialog from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow"; 
import ConcessionariaDiretrizFormDialog from "@/components/ConcessionariaDiretrizFormDialog";
import ConcessionariaDiretrizRow from "@/components/ConcessionariaDiretrizRow";
import MaterialConsumoDiretrizFormDialog from "@/components/MaterialConsumoDiretrizFormDialog";
import MaterialConsumoDiretrizRow from "@/components/MaterialConsumoDiretrizRow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Importações de tipos necessários
import { DiretrizPassagem, TrechoPassagem } from "@/types/diretrizesPassagens";
import { DiretrizConcessionaria, DiretrizConcessionariaForm, CATEGORIAS_CONCESSIONARIA, CategoriaConcessionaria } from "@/types/diretrizesConcessionaria";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

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
  { key: 'fator_servicos_terceiros', label: 'Serviços de Terceiros (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.10 (para 10%)' },
  { key: 'valor_complemento_alimentacao', label: 'Complemento de Alimentação (R$)', type: 'currency' as const, placeholder: 'Ex: 15,00' },
  { key: 'valor_fretamento_aereo_hora', label: 'Fretamento Aéreo (R$/hora)', type: 'currency' as const, placeholder: 'Ex: 1.200,00' },
  { key: 'valor_locacao_estrutura_dia', label: 'Locação de Estrutura (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 300,00' },
  { key: 'valor_locacao_viaturas_dia', label: 'Locação de Viaturas (R$/dia)', type: 'currency' as const, placeholder: 'Ex: 150,00' },
  { key: 'fator_material_consumo', label: 'Material de Consumo (Fator)', type: 'factor' as const, placeholder: 'Ex: 0.02 (para 2%)' },
];

// Valores padrão para inicialização (incluindo os novos campos de diária)
const defaultDiretrizes = (year: number): Partial<DiretrizOperacional> => ({
  ano_referencia: year,
  fator_passagens_aereas: 0,
  fator_servicos_terceiros: 0,
  valor_complemento_alimentacao: 0,
  valor_fretamento_aereo_hora: 0,
  valor_locacao_estrutura_dia: 0,
  valor_locacao_viaturas_dia: 0,
  fator_material_consumo: 0,
  fator_concessionaria: 0, // Mantido no default para compatibilidade com o schema DB
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
  const location = useLocation();
  const { user } = useSession();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(true);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isYearManagementDialogOpen, setIsYearManagementDialogOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // --- ESTADOS PRINCIPAIS ---
  const [diretrizes, setDiretrizes] = useState<Partial<DiretrizOperacional>>(defaultDiretrizes(selectedYear));
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    OPERATIONAL_FIELDS.forEach(field => {
      initialState[field.key as string] = false;
    });
    
    const shouldOpenPassagens = location.state && (location.state as { openPassagens?: boolean }).openPassagens;
    const shouldOpenConcessionaria = location.state && (location.state as { openConcessionaria?: boolean }).openConcessionaria;
    const shouldOpenMaterialConsumo = location.state && (location.state as { openMaterialConsumo?: boolean }).openMaterialConsumo;
    
    initialState['diarias_detalhe'] = false; 
    initialState['passagens_detalhe'] = shouldOpenPassagens || false; 
    initialState['concessionaria_detalhe'] = shouldOpenConcessionaria || false;
    initialState['material_consumo_detalhe'] = shouldOpenMaterialConsumo || false;
    initialState['outros_fatores'] = false; // Novo estado para agrupar fatores simples
    return initialState;
  });
  
  // --- ESTADOS DE DIRETRIZES DE DETALHE ---
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<DiretrizPassagem[]>([]);
  const [isPassagemFormOpen, setIsPassagemFormOpen] = useState(false);
  const [diretrizToEdit, setDiretrizToEdit] = useState<DiretrizPassagem | null>(null);
  
  const [diretrizesConcessionaria, setDiretrizesConcessionaria] = useState<DiretrizConcessionaria[]>([]);
  const [isConcessionariaFormOpen, setIsConcessionariaFormOpen] = useState(false);
  const [diretrizConcessionariaToEdit, setDiretrizConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);
  const [selectedConcessionariaTab, setSelectedConcessionariaTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);
  
  const [diretrizesMaterialConsumo, setDiretrizesMaterialConsumo] = useState<DiretrizMaterialConsumo[]>([]);
  const [isMaterialConsumoFormOpen, setIsMaterialConsumoFormOpen] = useState(false);
  const [diretrizMaterialConsumoToEdit, setDiretrizMaterialConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
  
  // --- HOOKS DE DADOS ---
  const { data: defaultYearData, isLoading: isLoadingDefaultYear, setDefaultYear } = useDefaultDiretrizYear('operacional');
  const defaultYear = defaultYearData?.defaultYear || null;

  // --- FUNÇÕES DE CARREGAMENTO ---
  
  const loadAvailableYears = useCallback(async (defaultYearId: number | null) => {
    if (!user?.id) return;
    try {
      const currentYear = new Date().getFullYear();
      
      const [
          { data: opData },
          { data: passagensData },
          { data: concessionariaData },
          { data: materialConsumoData }
      ] = await Promise.all([
          supabase.from("diretrizes_operacionais").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_passagens").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_concessionaria").select("ano_referencia").eq("user_id", user.id),
          supabase.from("diretrizes_material_consumo").select("ano_referencia").eq("user_id", user.id),
      ]);

      const opYears = opData ? opData.map(d => d.ano_referencia) : [];
      const passagensYears = passagensData ? passagensData.map(d => d.ano_referencia) : [];
      const concessionariaYears = concessionariaData ? concessionariaData.map(d => d.ano_referencia) : [];
      const materialConsumoYears = materialConsumoData ? materialConsumoData.map(d => d.ano_referencia) : [];

      const yearsToInclude = new Set([...opYears, ...passagensYears, ...concessionariaYears, ...materialConsumoYears]);
      
      if (defaultYearId && !yearsToInclude.has(defaultYearId)) {
          yearsToInclude.add(defaultYearId);
      }
      
      if (yearsToInclude.size === 0) {
          yearsToInclude.add(currentYear);
      }
      
      const uniqueYears = Array.from(yearsToInclude).filter(y => y > 0).sort((a, b) => b - a);
      setAvailableYears(uniqueYears);
      
      // Define o ano selecionado se for a primeira carga
      if (uniqueYears.length > 0 && !selectedYear) {
          setSelectedYear(defaultYearId || uniqueYears[0]);
      } else if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
          // Se o ano selecionado não existir mais, volta para o padrão ou o mais recente
          setSelectedYear(defaultYearId || uniqueYears[0]);
      }

    } catch (error: any) {
      console.error("Erro ao carregar anos disponíveis:", error);
      toast.error("Erro ao carregar anos disponíveis");
    }
  }, [user?.id, selectedYear]);
  
  const loadDiretrizesForYear = useCallback(async (year: number) => {
    if (!user?.id) return;
    try {
      setLoading(true);

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
        // Garante que todos os campos numéricos sejam tratados como number
        fator_passagens_aereas: Number(loadedData.fator_passagens_aereas || 0),
        fator_servicos_terceiros: Number(loadedData.fator_servicos_terceiros || 0),
        fator_material_consumo: Number(loadedData.fator_material_consumo || 0),
        fator_concessionaria: Number(loadedData.fator_concessionaria || 0),
        
        valor_complemento_alimentacao: Number(loadedData.valor_complemento_alimentacao || 0),
        valor_fretamento_aereo_hora: Number(loadedData.valor_fretamento_aereo_hora || 0),
        valor_locacao_estrutura_dia: Number(loadedData.valor_locacao_estrutura_dia || 0),
        valor_locacao_viaturas_dia: Number(loadedData.valor_locacao_viaturas_dia || 0),
        
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
        
        taxa_embarque: Number(loadedData.taxa_embarque || 0),
        
        observacoes: loadedData.observacoes || "",
        diaria_referencia_legal: loadedData.diaria_referencia_legal || defaultDiretrizes(year).diaria_referencia_legal,
      };
      
      setDiretrizes(numericData);
      
      const initialRawInputs: Record<string, string> = {};
      
      // Mapeamento de campos para rawInputs
      const allCurrencyFields: (keyof DiretrizOperacional)[] = [
        'valor_complemento_alimentacao', 'valor_fretamento_aereo_hora', 'valor_locacao_estrutura_dia', 'valor_locacao_viaturas_dia', 'taxa_embarque',
        'diaria_of_gen_bsb', 'diaria_of_gen_capitais', 'diaria_of_gen_demais',
        'diaria_of_sup_bsb', 'diaria_of_sup_capitais', 'diaria_of_sup_demais',
        'diaria_of_int_sgt_bsb', 'diaria_of_int_sgt_capitais', 'diaria_of_int_sgt_demais',
        'diaria_demais_pracas_bsb', 'diaria_demais_pracas_capitais', 'diaria_demais_pracas_demais',
      ];
      
      allCurrencyFields.forEach(key => {
        initialRawInputs[key as string] = numberToRawDigits(numericData[key] as number);
      });
      
      setRawInputs(initialRawInputs);
      
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes operacionais:", error);
      toast.error("Erro ao carregar diretrizes para o ano selecionado");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  
  const loadDiretrizesPassagens = useCallback(async (year: number) => {
    if (!user?.id) return;
    try {
        const { data, error } = await supabase
            .from('diretrizes_passagens')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('om_referencia', { ascending: true });
            
        if (error) throw error;
        
        const typedData: DiretrizPassagem[] = (data || []).map(d => ({
            ...d,
            trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
            data_inicio_vigencia: d.data_inicio_vigencia || null,
            data_fim_vigencia: d.data_fim_vigencia || null,
        }));
        
        setDiretrizesPassagens(typedData);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de passagens:", error);
        toast.error("Erro ao carregar contratos de passagens.");
    }
  }, [user?.id]);
  
  const loadDiretrizesConcessionaria = useCallback(async (year: number) => {
    if (!user?.id) return;
    try {
        const { data, error } = await supabase
            .from('diretrizes_concessionaria')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('categoria', { ascending: true })
            .order('nome_concessionaria', { ascending: true });
            
        if (error) throw error;
        
        const typedData: DiretrizConcessionaria[] = (data || []).map((d: Tables<'diretrizes_concessionaria'>) => ({
            ...d,
            consumo_pessoa_dia: Number(d.consumo_pessoa_dia),
            custo_unitario: Number(d.custo_unitario),
        }));
        
        setDiretrizesConcessionaria(typedData);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de concessionária:", error);
        toast.error("Erro ao carregar diretrizes de concessionária.");
    }
  }, [user?.id]);
  
  const loadDiretrizesMaterialConsumo = useCallback(async (year: number) => {
    if (!user?.id) return;
    try {
        const { data, error } = await supabase
            .from('diretrizes_material_consumo')
            .select('*')
            .eq('user_id', user.id)
            .eq('ano_referencia', year)
            .order('nr_subitem', { ascending: true });
            
        if (error) throw error;
        
        const typedData: DiretrizMaterialConsumo[] = (data || []).map(d => ({
            ...d,
            itens_aquisicao: (d.itens_aquisicao as unknown as ItemAquisicao[]) || [],
        }));
        
        setDiretrizesMaterialConsumo(typedData);
        
    } catch (error) {
        console.error("Erro ao carregar diretrizes de material de consumo:", error);
        toast.error("Erro ao carregar diretrizes de material de consumo.");
    }
  }, [user?.id]);

  // --- EFEITOS DE CARREGAMENTO ---
  
  useEffect(() => {
    if (!isLoadingDefaultYear && defaultYearData) {
        loadAvailableYears(defaultYearData.defaultYear);
        setSelectedYear(defaultYearData.year);
    }
  }, [isLoadingDefaultYear, defaultYearData, loadAvailableYears]);

  useEffect(() => {
    if (selectedYear && user?.id) {
      loadDiretrizesForYear(selectedYear);
      loadDiretrizesPassagens(selectedYear); 
      loadDiretrizesConcessionaria(selectedYear);
      loadDiretrizesMaterialConsumo(selectedYear);
    }
  }, [selectedYear, user?.id, loadDiretrizesForYear, loadDiretrizesPassagens, loadDiretrizesConcessionaria, loadDiretrizesMaterialConsumo]);

  // --- HANDLERS DE INPUT ---
  
  const handleCurrencyChange = (field: keyof DiretrizOperacional, rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    
    setRawInputs(prev => ({ ...prev, [field as string]: digits }));
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };
  
  const handleFactorChange = (field: keyof DiretrizOperacional, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setDiretrizes(prev => ({ ...prev, [field]: numericValue }));
  };
  
  const handleInputChange = (field: keyof DiretrizOperacional, value: string) => {
    setDiretrizes(prev => ({ ...prev, [field]: value }));
  };

  // --- CRUD PRINCIPAL (Diretrizes Operacionais) ---
  
  const handleSaveDiretrizes = async () => {
    try {
      if (!user?.id) {
        toast.error("Usuário não autenticado");
        return;
      }

      if (!diretrizes.ano_referencia) {
        toast.error("Informe o ano de referência");
        return;
      }
      
      setLoading(true);

      const dataToValidate = {
        ...diretrizes,
        // Garante que todos os campos numéricos estejam presentes para validação Zod
        fator_passagens_aereas: diretrizes.fator_passagens_aereas || 0,
        fator_servicos_terceiros: diretrizes.fator_servicos_terceiros || 0,
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
    } finally {
        setLoading(false);
    }
  };
  
  const handleSetDefaultYear = async () => {
    if (!diretrizes.ano_referencia) {
      toast.error("Selecione um ano de referência válido.");
      return;
    }
    
    setLoading(true);
    try {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from('profiles')
        .update({ default_operacional_year: diretrizes.ano_referencia })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setDefaultYear(diretrizes.ano_referencia);
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
      if (!user?.id) throw new Error("Usuário não autenticado");
      
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
        .select("om_referencia, ug_referencia, numero_pregao, trechos, ativo, data_inicio_vigencia, data_fim_vigencia")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (passagensError) throw passagensError;
      
      if (sourcePassagens && sourcePassagens.length > 0) {
          const newPassagens = sourcePassagens.map(p => ({
              ...p,
              ano_referencia: targetYear,
              user_id: user.id,
              trechos: p.trechos, 
          }));
          
          const { error: insertPassagensError } = await supabase
            .from("diretrizes_passagens")
            .insert(newPassagens as TablesInsert<'diretrizes_passagens'>[]);
          if (insertPassagensError) throw insertPassagensError;
      }
      
      // 3. Copiar Diretrizes de Concessionária
      const { data: sourceConcessionaria, error: concessionariaError } = await supabase
        .from("diretrizes_concessionaria")
        .select("categoria, nome_concessionaria, consumo_pessoa_dia, fonte_consumo, custo_unitario, fonte_custo, unidade_custo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (concessionariaError) throw concessionariaError;
      
      if (sourceConcessionaria && sourceConcessionaria.length > 0) {
          const newConcessionaria = (sourceConcessionaria as Tables<'diretrizes_concessionaria'>[]).map(c => {
              const { id, created_at, updated_at, ...restOfConcessionaria } = c as any;
              return {
                  ...restOfConcessionaria,
                  ano_referencia: targetYear,
                  user_id: user.id,
              };
          });
          
          const { error: insertConcessionariaError } = await supabase
            .from("diretrizes_concessionaria")
            .insert(newConcessionaria as TablesInsert<'diretrizes_concessionaria'>[]);
          if (insertConcessionariaError) throw insertConcessionariaError;
      }
      
      // 4. Copiar Diretrizes de Material de Consumo
      const { data: sourceMaterialConsumo, error: materialConsumoError } = await supabase
        .from("diretrizes_material_consumo")
        .select("nr_subitem, nome_subitem, descricao_subitem, itens_aquisicao, ativo")
        .eq("user_id", user.id)
        .eq("ano_referencia", sourceYear);
        
      if (materialConsumoError) throw materialConsumoError;
      
      if (sourceMaterialConsumo && sourceMaterialConsumo.length > 0) {
          const newMaterialConsumo = (sourceMaterialConsumo as Tables<'diretrizes_material_consumo'>[]).map(m => {
              const { id, created_at, updated_at, ...restOfMaterialConsumo } = m as any;
              return {
                  ...restOfMaterialConsumo,
                  ano_referencia: targetYear,
                  user_id: user.id,
                  itens_aquisicao: m.itens_aquisicao,
              };
          });
          
          const { error: insertMaterialConsumoError } = await supabase
            .from("diretrizes_material_consumo")
            .insert(newMaterialConsumo as TablesInsert<'diretrizes_material_consumo'>[]);
          if (insertMaterialConsumoError) throw insertMaterialConsumoError;
      }
      
      toast.success(`Diretrizes operacionais, de passagens, concessionária e material de consumo do ano ${sourceYear} copiadas com sucesso para o ano ${targetYear}!`);
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
    
    if (!confirm(`Tem certeza que deseja EXCLUIR TODAS as diretrizes operacionais, de passagens, concessionária e material de consumo para o ano ${year}? Esta ação é irreversível.`)) return;

    try {
      if (!user?.id) throw new Error("Usuário não autenticado");
      
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
        
      // 3. Excluir Diretrizes de Concessionária
      await supabase
        .from("diretrizes_concessionaria")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);
        
      // 4. Excluir Diretrizes de Material de Consumo
      await supabase
        .from("diretrizes_material_consumo")
        .delete()
        .eq("user_id", user.id)
        .eq("ano_referencia", year);

      toast.success(`Diretrizes operacionais, de passagens, concessionária e material de consumo do ano ${year} excluídas com sucesso!`);
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

  // --- RENDERIZAÇÃO DE SEÇÕES ---
  
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
  
  const renderDiariaTable = () => {
    const handleDiariaChange = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais', rawValue: string) => {
      const fieldKey = `diaria_${rankKey}_${destination}` as keyof DiretrizOperacional;
      handleCurrencyChange(fieldKey, rawValue);
    };
    
    const getDiariaProps = (rankKey: string, destination: 'bsb' | 'capitais' | 'demais') => {
      const fieldKey = `${DIARIA_RANKS_CONFIG.find(r => r.key === rankKey)?.fieldPrefix}_${destination}` as keyof DiretrizOperacional;
      const value = diretrizes[fieldKey] as number;
      const rawDigits = rawInputs[fieldKey as string] || numberToRawDigits(value);
      
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
              value={diretrizes.diaria_referencia_legal || ""}
              onChange={(e) => handleInputChange('diaria_referencia_legal', e.target.value)}
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
  
  const renderPassagensSection = () => {
      
      return (
          <div className="space-y-4">
              
              {diretrizesPassagens.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Contratos Cadastrados</CardTitle>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>OM Referência</TableHead>
                                  <TableHead>Pregão</TableHead>
                                  <TableHead className="text-center">Vigência</TableHead>
                                  <TableHead className="text-center">Trechos</TableHead>
                                  <TableHead className="w-[100px] text-center">Ações</TableHead>
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
                      Nenhum contrato de passagens cadastrado para o ano de referência.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewPassagem}
                      disabled={loading}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Contrato
                  </Button>
              </div>
          </div>
      );
  };
  
  const renderConcessionariaList = (category: CategoriaConcessionaria) => {
      const filteredDiretrizes = diretrizesConcessionaria.filter(d => d.categoria === category);
      
      return (
          <div className="space-y-4">
              {filteredDiretrizes.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Diretrizes Cadastradas</CardTitle>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Concessionária</TableHead>
                                  <TableHead className="text-center">Consumo/Pessoa/Dia</TableHead>
                                  <TableHead className="text-right">Custo Unitário</TableHead>
                                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {filteredDiretrizes.map(d => (
                                  <ConcessionariaDiretrizRow
                                      key={d.id}
                                      diretriz={d}
                                      onEdit={handleStartEditConcessionaria}
                                      onDelete={handleDeleteConcessionaria}
                                      loading={loading}
                                  />
                              ))}
                          </TableBody>
                      </Table>
                  </Card>
              ) : (
                  <Card className="p-4 text-center text-muted-foreground">
                      Nenhuma diretriz de {category} cadastrada para o ano de referência.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={() => handleOpenNewConcessionaria(category)}
                      disabled={loading}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Nova Diretriz de {category}
                  </Button>
              </div>
          </div>
      );
  };
  
  const renderConcessionariaSection = () => {
      return (
          <Card>
              <CardContent className="pt-4">
                  <Tabs value={selectedConcessionariaTab} onValueChange={(value) => setSelectedConcessionariaTab(value as CategoriaConcessionaria)}>
                      <TabsList className="grid w-full grid-cols-2">
                          {CATEGORIAS_CONCESSIONARIA.map(cat => (
                              <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                          ))}
                      </TabsList>
                      
                      {CATEGORIAS_CONCESSIONARIA.map(cat => (
                          <TabsContent key={cat} value={cat}>
                              {renderConcessionariaList(cat)}
                          </TabsContent>
                      ))}
                  </Tabs>
              </CardContent>
          </Card>
      );
  };
  
  const renderMaterialConsumoSection = () => {
      return (
          <div className="space-y-4">
              
              {diretrizesMaterialConsumo.length > 0 ? (
                  <Card className="p-4">
                      <CardTitle className="text-base font-semibold mb-3">Subitens da ND Cadastrados</CardTitle>
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Subitem ND</TableHead>
                                  <TableHead className="w-[40%]">Descrição</TableHead>
                                  <TableHead className="text-center">Itens</TableHead>
                                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {diretrizesMaterialConsumo.map(d => (
                                  <MaterialConsumoDiretrizRow
                                      key={d.id}
                                      diretriz={d}
                                      onEdit={handleStartEditMaterialConsumo}
                                      onDelete={handleDeleteMaterialConsumo}
                                      loading={loading}
                                  />
                              ))}
                          </TableBody>
                      </Table>
                  </Card>
              ) : (
                  <Card className="p-4 text-center text-muted-foreground">
                      Nenhum subitem da ND cadastrado para o ano de referência.
                  </Card>
              )}
              
              <div className="flex justify-end">
                  <Button 
                      type="button" 
                      onClick={handleOpenNewMaterialConsumo}
                      disabled={loading}
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                  >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Novo Subitem da ND
                  </Button>
              </div>
          </div>
      );
  };
  
  // --- CRUD DE DETALHE (Passagens) ---
  
  const handleSavePassagem = async (data: Partial<DiretrizPassagem> & { ano_referencia: number, om_referencia: string, ug_referencia: string }) => {
      try {
          setLoading(true);
          if (!user?.id) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_passagens'> = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              om_referencia: data.om_referencia,
              ug_referencia: data.ug_referencia,
              numero_pregao: data.numero_pregao || null,
              trechos: data.trechos as unknown as Json,
              ativo: data.ativo ?? true,
              data_inicio_vigencia: data.data_inicio_vigencia || null,
              data_fim_vigencia: data.data_fim_vigencia || null,
          };
          
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
  
  // --- CRUD DE DETALHE (Concessionária) ---
  
  const handleSaveConcessionaria = async (data: DiretrizConcessionariaForm & { id?: string }) => {
      try {
          setLoading(true);
          if (!user?.id) throw new Error("Usuário não autenticado");
          
          const consumoValue = Number(data.consumo_pessoa_dia);

          const dbData: TablesInsert<'diretrizes_concessionaria'> = {
              user_id: user.id,
              ano_referencia: selectedYear,
              categoria: data.categoria,
              nome_concessionaria: data.nome_concessionaria,
              consumo_pessoa_dia: consumoValue,
              fonte_consumo: data.fonte_consumo || null,
              custo_unitario: data.custo_unitario,
              fonte_custo: data.fonte_custo || null,
              unidade_custo: data.unidade_custo,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_concessionaria')
                  .update(dbData as TablesUpdate<'diretrizes_concessionaria'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Diretriz de Concessionária atualizada!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_concessionaria')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Nova Diretriz de Concessionária cadastrada!");
          }
          
          await loadDiretrizesConcessionaria(selectedYear);
          setDiretrizConcessionariaToEdit(null);
          setIsConcessionariaFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
  };
  
  // --- CRUD DE DETALHE (Material de Consumo) ---
  
  const handleSaveMaterialConsumo = async (data: Partial<DiretrizMaterialConsumo> & { ano_referencia: number }) => {
      try {
          setLoading(true);
          if (!user?.id) throw new Error("Usuário não autenticado");
          
          const dbData: TablesInsert<'diretrizes_material_consumo'> = {
              user_id: user.id,
              ano_referencia: data.ano_referencia,
              nr_subitem: data.nr_subitem!,
              nome_subitem: data.nome_subitem!,
              descricao_subitem: data.descricao_subitem || null,
              itens_aquisicao: data.itens_aquisicao as unknown as Json,
              ativo: data.ativo ?? true,
          };

          if (data.id) {
              const { error } = await supabase
                  .from('diretrizes_material_consumo')
                  .update(dbData as TablesUpdate<'diretrizes_material_consumo'>)
                  .eq('id', data.id);
              if (error) throw error;
              toast.success("Subitem da ND atualizado!");
          } else {
              const { error } = await supabase
                  .from('diretrizes_material_consumo')
                  .insert([dbData]);
              if (error) throw error;
              toast.success("Novo Subitem da ND cadastrado!");
          }
          
          await loadDiretrizesMaterialConsumo(selectedYear);
          setDiretrizMaterialConsumoToEdit(null);
          setIsMaterialConsumoFormOpen(false);
          
      } catch (error: any) {
          toast.error(sanitizeError(error));
      } finally {
          setLoading(false);
      }
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
                  
                  {/* Diretrizes de Concessionária */}
                  <Collapsible 
                    open={fieldCollapseState['concessionaria_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['concessionaria_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          Concessionária (Água/Esgoto e Energia Elétrica)
                        </h4>
                        {fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderConcessionariaSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* Diretrizes de Material de Consumo */}
                  <Collapsible 
                    open={fieldCollapseState['material_consumo_detalhe']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['material_consumo_detalhe']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium flex items-center gap-2">
                          <Package className="h-4 w-4 mr-1 text-orange-500" />
                          Material de Consumo (Subitens da ND)
                        </h4>
                        {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2">
                        {renderMaterialConsumoSection()}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  {/* OUTROS CAMPOS OPERACIONAIS (Fatores e Valores Simples) */}
                  <Collapsible 
                    open={fieldCollapseState['outros_fatores']} 
                    onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['outros_fatores']: open }))}
                    className="border-b pb-4 last:border-b-0 last:pb-0"
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer py-2">
                        <h4 className="text-base font-medium">
                          Outros Fatores e Valores
                        </h4>
                        {fieldCollapseState['outros_fatores'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        {OPERATIONAL_FIELDS.map(field => (
                          <React.Fragment key={field.key}>
                            {renderDiretrizField(field)}
                          </React.Fragment>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
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
      
      {/* Diálogo de Formulário de Concessionária */}
      <ConcessionariaDiretrizFormDialog
          open={isConcessionariaFormOpen}
          onOpenChange={setIsConcessionariaFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizConcessionariaToEdit}
          onSave={handleSaveConcessionaria}
          loading={loading}
          initialCategory={selectedConcessionariaTab}
      />
      
      {/* Diálogo de Formulário de Material de Consumo */}
      <MaterialConsumoDiretrizFormDialog
          open={isMaterialConsumoFormOpen}
          onOpenChange={setIsMaterialConsumoFormOpen}
          selectedYear={selectedYear}
          diretrizToEdit={diretrizMaterialConsumoToEdit}
          onSave={handleSaveMaterialConsumo}
          loading={loading}
      />
    </div>
  );
};

export default CustosOperacionaisPage;