import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronDown, ChevronsUpDown, Sparkles, AlertCircle, Fuel, Package, HardHat, Plane, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { DiretrizEquipamento } from "@/types/diretrizesEquipamentos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getClasseIIIBadgeStyle, getClasseIIILabel } from "@/lib/classeIIIBadgeUtils";
import { 
    generateMemoriaCalculo, 
    generateDetalhamento,
    calculateTotalLitros,
    calculateTotalValor,
    calculateTotalLubrificante,
    calculateTotalLitrosLubrificante,
    formatFasesParaTexto,
    calculateTotalLitrosSemMargem,
} from "@/lib/classeIIIUtils";
import { defaultGeradorConfig, defaultEmbarcacaoConfig, defaultMotomecanizacaoConfig, defaultEquipamentosEngenhariaConfig } from "@/data/classeIIIData";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as z from "zod";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'MOTOMECANIZACAO' | 'EQUIPAMENTO_ENGENHARIA';
type TipoSuprimento = 'COMBUSTIVEL' | 'LUBRIFICANTE';

const CATEGORIAS_EQUIPAMENTO: TipoEquipamento[] = [
  "GERADOR",
  "EMBARCACAO",
  "MOTOMECANIZACAO",
  "EQUIPAMENTO_ENGENHARIA",
];

const CATEGORIAS_SUPRIMENTO: TipoSuprimento[] = [
  "COMBUSTIVEL",
  "LUBRIFICANTE",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  id: string;
  nome_equipamento: string;
  tipo_combustivel: 'GAS' | 'OD';
  consumo: number;
  unidade: 'L/h' | 'km/L';
  quantidade: number;
  potencia_hp?: number;
  horas_dia?: number;
  km_dia?: number;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itens: ItemClasseIII[]; // All items across all categories
  fase_atividade?: string; // Global
  preco_diesel: number;
  preco_gasolina: number;
  preco_lubrificante: number; // Preço global do lubrificante
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: TipoEquipamento | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO' | 'LUBRIFICANTE_CONSOLIDADO';
  tipo_suprimento: TipoSuprimento;
  organizacao: string; // OM de Destino do Recurso (RM ou OM)
  ug: string; // UG de Destino do Recurso
  om_detentora?: string | null; // NOVO CAMPO
  ug_detentora?: string | null; // NOVO CAMPO
  quantidade: number;
  potencia_hp?: number;
  horas_dia?: number;
  dias_operacao: number;
  consumo_hora?: number;
  consumo_km_litro?: number;
  km_dia?: number;
  tipo_combustivel: 'GAS' | 'OD';
  preco_litro: number;
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  total_litros_sem_margem?: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  preco_lubrificante?: number;
  consumo_lubrificante_litro?: number;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface CategoryAllocation {
  total_litros: number;
  total_valor: number;
  total_litros_sem_margem: number;
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialCategoryAllocations: Record<TipoEquipamento, CategoryAllocation> = CATEGORIAS_EQUIPAMENTO.reduce((acc, cat) => ({ 
    ...acc, 
    [cat]: { total_litros: 0, total_valor: 0, total_litros_sem_margem: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined } 
}), {} as Record<TipoEquipamento, CategoryAllocation>);

const ClasseIIIForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizEquipamento[]>([]);
  const [selectedEquipamentoTab, setSelectedEquipamentoTab] = useState<TipoEquipamento>(CATEGORIAS_EQUIPAMENTO[0]);
  const [selectedSuprimentoTab, setSelectedSuprimentoTab] = useState<TipoSuprimento>('COMBUSTIVEL');
  
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
    preco_diesel: 0,
    preco_gasolina: 0,
    preco_lubrificante: 0,
  });
  
  const [categoryAllocations, setCategoryAllocations] = useState<Record<TipoEquipamento, CategoryAllocation>>(initialCategoryAllocations);
  
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseIII[]>([]);
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  const formRef = useRef<HTMLDivElement>(null);
  
  // NOVO: Estado para rastrear a OM de destino temporária por categoria
  const [tempDestinations, setTempDestinations] = useState<Record<TipoEquipamento, { om: string, ug: string, id?: string }>>(
    CATEGORIAS_EQUIPAMENTO.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<TipoEquipamento, { om: string, ug: string, id?: string }>)
  );
  
  // NOVO: Estado para rastrear o input de preço (dígitos)
  const [rawDieselInput, setRawDieselInput] = useState<string>(numberToRawDigits(0));
  const [rawGasolinaInput, setRawGasolinaInput] = useState<string>(numberToRawDigits(0));
  const [rawLubrificanteInput, setRawLubrificanteInput] = useState<string>(numberToRawDigits(0));
  
  // NOVO: Lógica de Dirty Check (Simplificada para Classe III)
  const isCategoryAllocationDirty = useCallback((
      category: TipoEquipamento, 
      currentTotalValue: number, 
      allocation: CategoryAllocation, 
      tempDestinations: Record<TipoEquipamento, { om: string, ug: string, id?: string }>
  ): boolean => {
      // 1. Check for quantity/item change (total value mismatch)
      if (Math.abs(allocation.total_valor - currentTotalValue) > 0.01) {
          return true;
      }
      
      // 2. Check for Destination OM change
      const tempDest = tempDestinations[category];
      if (allocation.total_valor > 0 && (allocation.om_destino_recurso !== tempDest.om || allocation.ug_destino_recurso !== tempDest.ug)) {
          return true;
      }
      
      return false;
  }, []);

  // NOVO: Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    // Chama a função de navegação para a tecla Enter
    handleEnterToNextField(e);
  };

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadDiretrizes();
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);
  
  // Efeito para sincronizar os estados temporários (OM Destino) ao mudar de aba ou carregar/resetar o formulário.
  useEffect(() => {
      const savedAllocation = categoryAllocations[selectedEquipamentoTab];
      
      // 1. Sincronizar OM Destino
      if (savedAllocation.om_destino_recurso) {
          setTempDestinations(prev => ({
              ...prev,
              [selectedEquipamentoTab]: {
                  om: savedAllocation.om_destino_recurso,
                  ug: savedAllocation.ug_destino_recurso,
                  id: savedAllocation.selectedOmDestinoId,
              }
          }));
      } else if (form.organizacao) {
          // Se não houver alocação salva, mas houver OM Detentora, use a Detentora como padrão temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedEquipamentoTab]: {
                  om: form.organizacao,
                  ug: form.ug,
                  id: form.selectedOmId,
              }
          }));
      } else {
          // Se não houver OM Detentora, limpa o temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedEquipamentoTab]: { om: "", ug: "", id: undefined }
          }));
      }
      
  }, [selectedEquipamentoTab, categoryAllocations, form.organizacao, form.ug, form.selectedOmId]);

  useEffect(() => {
    if (diretrizes.length > 0) {
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedEquipamentoTab)
            .map(d => ({
                id: d.id,
                nome_equipamento: d.nome_equipamento,
                tipo_combustivel: d.tipo_combustivel,
                consumo: Number(d.consumo),
                unidade: d.unidade,
                quantidade: 0,
                potencia_hp: undefined,
                horas_dia: undefined,
                km_dia: undefined,
                consumo_lubrificante_litro: undefined,
                preco_lubrificante: undefined,
            }));

        const existingItemsMap = new Map<string, ItemClasseIII>();
        form.itens.filter(i => getClasseIIILabel(i.id) === selectedEquipamentoTab).forEach(item => {
            existingItemsMap.set(item.nome_equipamento, item);
        });

        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.nome_equipamento);
            if (existing) {
                // Preserva os campos de input do usuário (quantidade, horas/km, etc.)
                return {
                    ...availableItem,
                    ...existing,
                    // Garante que o consumo e unidade da diretriz sejam mantidos
                    consumo: availableItem.consumo,
                    unidade: availableItem.unidade,
                };
            }
            return availableItem;
        });

        setCurrentCategoryItems(mergedItems);
    } else {
        setCurrentCategoryItems([]);
    }
  }, [selectedEquipamentoTab, diretrizes, form.itens]);

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let anoReferencia: number | null = null;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_diretriz_year")
        .eq("id", user.id)
        .maybeSingle();
        
      if (profileData?.default_diretriz_year) {
          anoReferencia = profileData.default_diretriz_year;
      }

      if (!anoReferencia) {
          const { data: diretrizCusteio } = await supabase
            .from("diretrizes_custeio")
            .select("ano_referencia")
            .eq("user_id", user.id)
            .order("ano_referencia", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (diretrizCusteio) {
            anoReferencia = diretrizCusteio.ano_referencia;
          }
      }
      
      if (!anoReferencia) {
        toast.warning(`Diretriz de Custeio não encontrada. Usando valores padrão.`);
        setDiretrizes([...defaultGeradorConfig, ...defaultEmbarcacaoConfig, ...defaultMotomecanizacaoConfig, ...defaultEquipamentosEngenhariaConfig] as DiretrizEquipamento[]);
        return;
      }

      const { data: equipamentosData, error: eqError } = await supabase
        .from("diretrizes_equipamentos_classe_iii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true);

      if (eqError) throw eqError;

      const loadedDiretrizes = (equipamentosData || []).map(d => ({
        ...d,
        consumo: Number(d.consumo),
      })) as DiretrizEquipamento[];
      
      if (loadedDiretrizes.length > 0) {
        setDiretrizes(loadedDiretrizes);
      } else {
        setDiretrizes([...defaultGeradorConfig, ...defaultEmbarcacaoConfig, ...defaultMotomecanizacaoConfig, ...defaultEquipamentosEngenhariaConfig] as DiretrizEquipamento[]);
        toast.warning(`Diretrizes de Equipamentos Classe III não configuradas para o ano ${anoReferencia}. Usando valores padrão.`);
      }
      
      // Carregar Preços de Combustível e Fatores
      const { data: custeioData, error: custeioError } = await supabase
        .from("diretrizes_custeio")
        .select("classe_iii_fator_gerador, classe_iii_fator_embarcacao, classe_iii_fator_equip_engenharia")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .maybeSingle();
        
      if (custeioError) throw custeioError;
      
      // Carregar Preços LPC (se houver)
      const { data: lpcData } = await supabase
        .from("p_trab_ref_lpc")
        .select("preco_diesel, preco_gasolina")
        .eq("p_trab_id", ptrabId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
        
      const precoDiesel = Number(lpcData?.preco_diesel || 0);
      const precoGasolina = Number(lpcData?.preco_gasolina || 0);
      
      // Preço do Lubrificante (Hardcoded ou de uma diretriz futura)
      const precoLubrificante = 15.00; // Valor padrão

      setForm(prev => ({
        ...prev,
        preco_diesel: precoDiesel,
        preco_gasolina: precoGasolina,
        preco_lubrificante: precoLubrificante,
      }));
      
      setRawDieselInput(numberToRawDigits(precoDiesel));
      setRawGasolinaInput(numberToRawDigits(precoGasolina));
      setRawLubrificanteInput(numberToRawDigits(precoLubrificante));

    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      toast.error("Erro ao carregar diretrizes. Usando valores padrão.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, om_detentora, ug_detentora")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true })
      .order("tipo_equipamento", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    setRegistros((data || []) as ClasseIIIRegistro[]);
  };

  const resetFormFields = () => {
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
      preco_diesel: form.preco_diesel, // Mantém os preços
      preco_gasolina: form.preco_gasolina,
      preco_lubrificante: form.preco_lubrificante,
    });
    
    setCategoryAllocations(initialCategoryAllocations);
    setTempDestinations(
        CATEGORIAS_EQUIPAMENTO.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<TipoEquipamento, { om: string, ug: string, id?: string }>)
    );
    
    setCurrentCategoryItems([]);
    
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ 
        ...form, 
        selectedOmId: omData.id, 
        organizacao: omData.nome_om, // OM Detentora
        ug: omData.codug_om, // UG Detentora
      });
      
      // Initialize temporary destination OM for all categories to the OM Detentora (padrão)
      const newTempDestinations = CATEGORIAS_EQUIPAMENTO.reduce((acc, cat) => {
          acc[cat] = {
              om: omData.nome_om,
              ug: omData.codug_om,
              id: omData.id,
          };
          return acc;
      }, {} as Record<TipoEquipamento, { om: string, ug: string, id?: string }>);
      setTempDestinations(newTempDestinations);
      
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      });
      
      // Clear temporary destination OM for all categories
      setTempDestinations(
        CATEGORIAS_EQUIPAMENTO.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<TipoEquipamento, { om: string, ug: string, id?: string }>)
      );
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setTempDestinations(prev => ({
        ...prev,
        [selectedEquipamentoTab]: {
            om: omData?.nome_om || "",
            ug: omData?.codug_om || "",
            id: omData?.id,
        }
    }));
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  const handleItemChange = (itemIndex: number, field: keyof ItemClasseIII, value: any) => {
    const newItems = [...currentCategoryItems];
    
    // Garante que a quantidade e os campos numéricos sejam >= 0
    if (field === 'quantidade' || field === 'horas_dia' || field === 'km_dia' || field === 'potencia_hp') {
        newItems[itemIndex][field] = Math.max(0, value);
    } else {
        newItems[itemIndex][field] = value;
    }
    
    setCurrentCategoryItems(newItems);
  };
  
  const handlePriceChange = (field: 'preco_diesel' | 'preco_gasolina' | 'preco_lubrificante', rawValue: string) => {
    const { numericValue, digits } = formatCurrencyInput(rawValue);
    
    if (field === 'preco_diesel') {
        setRawDieselInput(digits);
        setForm(prev => ({ ...prev, preco_diesel: numericValue }));
    } else if (field === 'preco_gasolina') {
        setRawGasolinaInput(digits);
        setForm(prev => ({ ...prev, preco_gasolina: numericValue }));
    } else {
        setRawLubrificanteInput(digits);
        setForm(prev => ({ ...prev, preco_lubrificante: numericValue }));
    }
  };

  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.ug === "" || form.dias_operacao <= 0) {
        toast.error("Preencha a OM Detentora e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    const category = selectedEquipamentoTab;
    const currentTempDest = tempDestinations[category];
    
    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);
    
    if (itemsToKeep.length === 0) {
        // Se não houver itens, limpa a alocação e os itens do formulário
        const itemsFromOtherCategories = form.itens.filter(item => getClasseIIILabel(item.id) !== category);
        setForm({ ...form, itens: itemsFromOtherCategories });
        setCategoryAllocations(prev => ({ ...prev, [category]: initialCategoryAllocations[category] }));
        toast.success(`Itens de ${getClasseIIILabel(category)} removidos.`);
        return;
    }
    
    if (!currentTempDest.om || !currentTempDest.ug) {
        toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
        return;
    }

    // 1. Calcular totais para a categoria
    const { totalLitros, totalValor, totalLitrosSemMargem } = calculateTotalValor(
        itemsToKeep, 
        form.dias_operacao, 
        form.preco_diesel, 
        form.preco_gasolina
    );
    
    // 2. Atualizar o estado de alocação
    setCategoryAllocations(prev => ({
        ...prev,
        [category]: {
            total_litros: totalLitros,
            total_valor: totalValor,
            total_litros_sem_margem: totalLitrosSemMargem,
            om_destino_recurso: currentTempDest.om,
            ug_destino_recurso: currentTempDest.ug,
            selectedOmDestinoId: currentTempDest.id,
        }
    }));

    // 3. Atualizar o estado principal do formulário (itens)
    const itemsFromOtherCategories = form.itens.filter(item => getClasseIIILabel(item.id) !== category);
    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];

    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens e alocação de ${getClasseIIILabel(category)} atualizados!`);
  };
  
  // CÁLCULO GLOBAL
  const totalLitrosGeral = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.total_litros, 0);
  const totalValorGeral = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.total_valor, 0);
  
  // CÁLCULO LUBRIFICANTE (Consolidado)
  const lubrificanteItems = form.itens.filter(item => (item.consumo_lubrificante_litro || 0) > 0 && item.quantidade > 0);
  const { totalLitrosLubrificante, totalValorLubrificante } = calculateTotalLubrificante(
    lubrificanteItems, 
    form.dias_operacao, 
    form.preco_lubrificante
  );
  
  const totalValorFinal = totalValorGeral + totalValorLubrificante;

  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    const itemsByActiveCategory = form.itens.reduce((acc, item) => {
        const category = getClasseIIILabel(item.id) as TipoEquipamento;
        if (item.quantidade > 0 && CATEGORIAS_EQUIPAMENTO.includes(category)) {
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
        }
        return acc;
    }, {} as Record<TipoEquipamento, ItemClasseIII[]>);
    
    const categoriesToSave = Object.keys(itemsByActiveCategory) as TipoEquipamento[];
    
    if (categoriesToSave.length === 0 && lubrificanteItems.length === 0) {
        toast.error("Adicione pelo menos um item de Combustível ou Lubrificante.");
        return;
    }

    setLoading(true);
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Registros de Combustível (por categoria de equipamento)
    for (const categoria of categoriesToSave) {
        const itens = itemsByActiveCategory[categoria];
        const allocation = categoryAllocations[categoria];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error(`Selecione a OM de destino do recurso para a categoria: ${getClasseIIILabel(categoria)}.`);
            setLoading(false);
            return;
        }
        
        // Agrupar por tipo de combustível (OD/GAS)
        const itensPorCombustivel = itens.reduce((acc, item) => {
            const key = item.tipo_combustivel;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        }, {} as Record<'GAS' | 'OD', ItemClasseIII[]>);
        
        for (const tipoCombustivel of ['OD', 'GAS'] as const) {
            const itensCombustivel = itensPorCombustivel[tipoCombustivel];
            if (!itensCombustivel || itensCombustivel.length === 0) continue;
            
            const { totalLitros, totalValor, totalLitrosSemMargem } = calculateTotalValor(
                itensCombustivel, 
                form.dias_operacao, 
                form.preco_diesel, 
                form.preco_gasolina
            );
            
            if (totalValor === 0) continue;
            
            const precoLitro = tipoCombustivel === 'OD' ? form.preco_diesel : form.preco_gasolina;
            
            const detalhamento = generateDetalhamento(
                itensCombustivel, 
                form.dias_operacao, 
                tipoCombustivel, 
                precoLitro, 
                categoria,
                allocation.om_destino_recurso,
                allocation.ug_destino_recurso,
                faseFinalString
            );
            
            const registro: TablesInsert<'classe_iii_registros'> = {
                p_trab_id: ptrabId,
                tipo_equipamento: categoria,
                tipo_suprimento: 'COMBUSTIVEL',
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                om_detentora: form.organizacao, // OM Detentora
                ug_detentora: form.ug, // UG Detentora
                quantidade: itensCombustivel.reduce((sum, i) => sum + i.quantidade, 0),
                dias_operacao: form.dias_operacao,
                tipo_combustivel: tipoCombustivel,
                preco_litro: precoLitro,
                total_litros: totalLitros,
                total_litros_sem_margem: totalLitrosSemMargem,
                valor_total: totalValor,
                detalhamento: detalhamento,
                fase_atividade: faseFinalString,
                valor_nd_30: totalValor, // Classe III Combustível é sempre ND 30
                valor_nd_39: 0,
            };
            registrosParaSalvar.push(registro);
        }
    }
    
    // 2. Registro de Lubrificante (Consolidado)
    if (totalValorLubrificante > 0) {
        // O lubrificante é consolidado, mas precisa de uma OM de destino. Usamos a OM Detentora como padrão.
        const omDestinoLub = form.organizacao;
        const ugDestinoLub = form.ug;
        
        const detalhamentoLub = generateDetalhamento(
            lubrificanteItems, 
            form.dias_operacao, 
            'LUB', 
            form.preco_lubrificante, 
            'LUBRIFICANTE_CONSOLIDADO',
            omDestinoLub,
            ugDestinoLub,
            faseFinalString
        );
        
        const registroLub: TablesInsert<'classe_iii_registros'> = {
            p_trab_id: ptrabId,
            tipo_equipamento: 'LUBRIFICANTE_CONSOLIDADO',
            tipo_suprimento: 'LUBRIFICANTE',
            organizacao: omDestinoLub,
            ug: ugDestinoLub,
            om_detentora: form.organizacao, // OM Detentora
            ug_detentora: form.ug, // UG Detentora
            quantidade: lubrificanteItems.reduce((sum, i) => sum + i.quantidade, 0),
            dias_operacao: form.dias_operacao,
            tipo_combustivel: 'OD', // Default, não relevante para lubrificante
            preco_litro: form.preco_lubrificante,
            total_litros: totalLitrosLubrificante,
            total_litros_sem_margem: totalLitrosLubrificante,
            valor_total: totalValorLubrificante,
            detalhamento: detalhamentoLub,
            fase_atividade: faseFinalString,
            valor_nd_30: totalValorLubrificante, // Classe III Lubrificante é sempre ND 30
            valor_nd_39: 0,
        };
        registrosParaSalvar.push(registroLub);
    }

    try {
      // Deletar APENAS os registros de Classe III existentes para este PTrab E ESTA OM DETENTORA/UG DETENTORA
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", form.organizacao) // Filtra pela OM Detentora
        .eq("ug_detentora", form.ug); // Filtra pela UG Detentora
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe III salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Classe III:", error);
      toast.error("Erro ao salvar registros de Classe III");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseIIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    // 1. Usar a OM Detentora do registro clicado como filtro para carregar todos os registros relacionados
    const omDetentoraToEdit = registro.om_detentora || registro.organizacao;
    const ugDetentoraToEdit = registro.ug_detentora || registro.ug;
    
    // 2. Buscar TODOS os registros de CLASSE III (Combustível e Lubrificante) para este PTrab E ESTA OM/UG DETENTORA ESPECÍFICA
    const { data: allRecords, error: fetchAllError } = await supabase
        .from("classe_iii_registros")
        .select("*, om_detentora, ug_detentora")
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", omDetentoraToEdit) // FILTRO CHAVE: Apenas registros desta OM Detentora
        .eq("ug_detentora", ugDetentoraToEdit); // FILTRO CHAVE: Apenas registros desta UG Detentora
        
    if (fetchAllError) {
        toast.error("Erro ao carregar todos os registros para edição.");
        setLoading(false);
        return;
    }
    
    if (!allRecords || allRecords.length === 0) {
        toast.error("Nenhum registro encontrado para esta OM.");
        setLoading(false);
        return;
    }
    
    let consolidatedItems: ItemClasseIII[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    let tempDestinationsLoad: Record<TipoEquipamento, { om: string, ug: string, id?: string }> = { ...tempDestinations };
    
    // Os dados globais (dias, fases) devem ser consistentes entre os registros.
    const firstRecord = allRecords[0];
    const diasOperacao = firstRecord.dias_operacao;
    const faseAtividade = firstRecord.fase_atividade;
    
    // 3. Buscar ID da OM Detentora
    let selectedOmIdForEdit: string | undefined = undefined;
    try {
        const { data: omData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', omDetentoraToEdit)
            .eq('codug_om', ugDetentoraToEdit)
            .maybeSingle();
        selectedOmIdForEdit = omData?.id;
    } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    
    // 4. Processar registros e consolidar itens e alocações
    for (const r of (allRecords || [])) {
        const isLub = r.tipo_suprimento === 'LUBRIFICANTE';
        
        if (isLub) {
            // Lubrificante: Apenas atualiza o preço global e o consumo nos itens de combustível
            setForm(prev => ({
                ...prev,
                preco_lubrificante: Number(r.preco_litro),
            }));
            setRawLubrificanteInput(numberToRawDigits(Number(r.preco_litro)));
            continue;
        }
        
        // Combustível
        const categoria = r.tipo_equipamento as TipoEquipamento;
        
        // Tenta buscar a diretriz original para obter nome_equipamento, consumo e unidade
        const diretrizOriginal = diretrizes.find(d => d.categoria === categoria && d.tipo_combustivel === r.tipo_combustivel);
        
        if (diretrizOriginal) {
            const item: ItemClasseIII = {
                id: diretrizOriginal.id,
                nome_equipamento: diretrizOriginal.nome_equipamento,
                tipo_combustivel: r.tipo_combustivel,
                consumo: Number(diretrizOriginal.consumo),
                unidade: diretrizOriginal.unidade,
                quantidade: r.quantidade,
                potencia_hp: r.potencia_hp || undefined,
                horas_dia: r.horas_dia || undefined,
                km_dia: r.km_dia || undefined,
                consumo_lubrificante_litro: r.consumo_lubrificante_litro || undefined,
                preco_lubrificante: r.preco_lubrificante || undefined,
            };
            consolidatedItems.push(item);
        }
        
        // Atualizar alocação (apenas uma vez por categoria de equipamento)
        if (newAllocations[categoria] && newAllocations[categoria].total_valor === 0) {
            
            // Tenta buscar ID da OM de Destino
            let selectedOmDestinoId: string | undefined = undefined;
            if (r.organizacao && r.ug) {
                try {
                    const { data: omDestinoData } = await supabase
                        .from('organizacoes_militares')
                        .select('id')
                        .eq('nome_om', r.organizacao)
                        .eq('codug_om', r.ug)
                        .maybeSingle();
                    selectedOmDestinoId = omDestinoData?.id;
                } catch (e) { console.error("Erro ao buscar OM Destino ID:", e); }
            }
            
            // Recalcular o total da categoria (somando todos os combustíveis para essa categoria)
            const allCombustivelRecordsForCategory = allRecords.filter(rec => rec.tipo_equipamento === categoria && rec.tipo_suprimento === 'COMBUSTIVEL');
            
            const totalLitros = allCombustivelRecordsForCategory.reduce((sum, rec) => sum + Number(rec.total_litros), 0);
            const totalValor = allCombustivelRecordsForCategory.reduce((sum, rec) => sum + Number(rec.valor_total), 0);
            const totalLitrosSemMargem = allCombustivelRecordsForCategory.reduce((sum, rec) => sum + Number(rec.total_litros_sem_margem || rec.total_litros / 1.1), 0);

            newAllocations[categoria] = {
                total_litros: totalLitros,
                total_valor: totalValor,
                total_litros_sem_margem: totalLitrosSemMargem,
                om_destino_recurso: r.organizacao, // OM de Destino (campo 'organizacao' do DB)
                ug_destino_recurso: r.ug, // UG de Destino (campo 'ug' do DB)
                selectedOmDestinoId: selectedOmDestinoId,
            };
            
            tempDestinationsLoad[categoria] = {
                om: r.organizacao,
                ug: r.ug,
                id: selectedOmDestinoId,
            };
        }
    }
    
    // 5. Preencher o formulário principal com a OM Detentora
    setForm(prev => ({
      ...prev,
      selectedOmId: selectedOmIdForEdit,
      organizacao: omDetentoraToEdit, // OM Detentora
      ug: ugDetentoraToEdit, // UG Detentora
      dias_operacao: diasOperacao,
      itens: consolidatedItems,
    }));
    
    // 6. Preencher o estado de alocação e IDs de destino
    setCategoryAllocations(newAllocations);
    setTempDestinations(tempDestinationsLoad);
    
    // 7. Preencher fases e aba
    const fasesSalvas = (faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // 8. Selecionar a aba do registro clicado (se for combustível)
    if (CATEGORIAS_EQUIPAMENTO.includes(registro.tipo_equipamento as TipoEquipamento)) {
        setSelectedEquipamentoTab(registro.tipo_equipamento as TipoEquipamento);
        setSelectedSuprimentoTab('COMBUSTIVEL');
    } else {
        setSelectedSuprimentoTab('LUBRIFICANTE');
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        // Chave de agrupamento é a OM Detentora
        const omDetentora = registro.om_detentora || registro.organizacao;
        const ugDetentora = registro.ug_detentora || registro.ug;
        const key = `${omDetentora} (${formatCodug(ugDetentora)})`;
        
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseIIIRegistro[]>);
  }, [registros]);

  const handleIniciarEdicaoMemoria = (registro: ClasseIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    
    // 1. Gerar a memória automática mais recente
    const itensParaMemoria = form.itens.filter(item => 
        (registro.tipo_suprimento === 'LUBRIFICANTE' && (item.consumo_lubrificante_litro || 0) > 0) ||
        (registro.tipo_suprimento === 'COMBUSTIVEL' && getClasseIIILabel(item.id) === registro.tipo_equipamento && item.tipo_combustivel === registro.tipo_combustivel)
    );
    
    const precoLitro = registro.tipo_suprimento === 'LUBRIFICANTE' ? form.preco_lubrificante : (registro.tipo_combustivel === 'OD' ? form.preco_diesel : form.preco_gasolina);
    
    const memoriaAutomatica = generateMemoriaCalculo(
        itensParaMemoria, 
        registro.dias_operacao, 
        registro.tipo_suprimento === 'LUBRIFICANTE' ? 'LUB' : registro.tipo_combustivel, 
        precoLitro, 
        registro.tipo_equipamento,
        registro.organizacao, // OM Destino
        registro.ug, // UG Destino
        registro.fase_atividade || ''
    );
    
    // 2. Usar a customizada se existir, senão usar a automática recém-gerada
    setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja realmente restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      await fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const displayFases = useMemo(() => {
    return [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  }, [fasesAtividade, customFaseAtividade]);
  
  // Verifica se há alguma categoria de equipamento com itens > 0
  const hasActiveEquipmentCategories = useMemo(() => {
      return CATEGORIAS_EQUIPAMENTO.some(cat => {
          const items = form.itens.filter(item => getClasseIIILabel(item.id) === cat);
          return items.some(item => item.quantidade > 0);
      });
  }, [form.itens]);
  
  // Verifica se há alguma categoria de equipamento com alocação suja
  const isAnyCategoryDirty = useMemo(() => {
      return CATEGORIAS_EQUIPAMENTO.some(cat => {
          const items = form.itens.filter(item => getClasseIIILabel(item.id) === cat);
          const currentTotalValue = calculateTotalValor(items, form.dias_operacao, form.preco_diesel, form.preco_gasolina).total_valor;
          return isCategoryAllocationDirty(cat, currentTotalValue, categoryAllocations[cat], tempDestinations);
      });
  }, [form.itens, form.dias_operacao, form.preco_diesel, form.preco_gasolina, categoryAllocations, tempDestinations, isCategoryAllocationDirty]);


  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Classe III - Combustíveis e Lubrificantes
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para suprimento de Classe III (Combustível e Lubrificante).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização e Preços</h3>
              
              {/* PRIMEIRA LINHA: OM Detentora, UG Detentora, Dias de Atividade */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Equipamento *</Label>
                  <OmSelector
                    selectedOmId={form.selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione a OM..."
                    initialOmName={form.organizacao} // OM Detentora
                    initialOmUg={form.ug} // UG Detentora
                  />
                </div>

                <div className="space-y-2">
                  <Label>UG Detentora</Label>
                  <Input value={formatCodug(form.ug)} readOnly disabled onKeyDown={handleEnterToNextField} />
                </div>
                
                <div className="space-y-2">
                  <Label>Dias de Atividade *</Label>
                  <Input
                    type="number"
                    min="1"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                    value={form.dias_operacao || ""}
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 7"
                    onKeyDown={handleNumberInputKeyDown}
                  />
                </div>
              </div>
              
              {/* SEGUNDA LINHA: Fases e Preços */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label>Fase da Atividade *</Label>
                  <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        type="button"
                        className="w-full justify-between"
                      >
                        <span className="truncate">
                          {displayFases || "Selecione a(s) fase(s)..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandGroup>
                          {FASES_PADRAO.map((fase) => (
                            <CommandItem
                              key={fase}
                              value={fase}
                              onSelect={() => handleFaseChange(fase, !fasesAtividade.includes(fase))}
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  checked={fasesAtividade.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                                />
                                <Label>{fase}</Label>
                              </div>
                              {fasesAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <div className="p-2 border-t">
                          <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                          <Input
                            value={customFaseAtividade}
                            onChange={(e) => setCustomFaseAtividade(e.target.value)}
                            placeholder="Ex: Patrulhamento"
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label>Preço Diesel (R$/L) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(rawDieselInput).formatted}
                    onChange={(e) => handlePriceChange('preco_diesel', e.target.value)}
                    placeholder="0,00"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Preço Gasolina (R$/L) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(rawGasolinaInput).formatted}
                    onChange={(e) => handlePriceChange('preco_gasolina', e.target.value)}
                    placeholder="0,00"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
            </div>

            {/* 2. Adicionar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Configurar Suprimentos</h3>
                
                <Tabs value={selectedSuprimentoTab} onValueChange={(value) => setSelectedSuprimentoTab(value as TipoSuprimento)}>
                  <TabsList className="grid w-full grid-cols-2">
                    {CATEGORIAS_SUPRIMENTO.map(cat => (
                      <TabsTrigger key={cat} value={cat}>
                        {cat === 'COMBUSTIVEL' ? <Fuel className="h-4 w-4 mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                        {cat === 'COMBUSTIVEL' ? 'Combustível' : 'Lubrificante'}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {/* ABA COMBUSTÍVEL */}
                  <TabsContent value="COMBUSTIVEL" className="mt-4">
                    <Tabs value={selectedEquipamentoTab} onValueChange={(value) => setSelectedEquipamentoTab(value as TipoEquipamento)}>
                      <TabsList className="grid w-full grid-cols-4">
                        {CATEGORIAS_EQUIPAMENTO.map(cat => (
                          <TabsTrigger key={cat} value={cat}>{getClasseIIILabel(cat)}</TabsTrigger>
                        ))}
                      </TabsList>
                      
                      {CATEGORIAS_EQUIPAMENTO.map(cat => (
                        <TabsContent key={cat} value={cat} className="mt-4">
                          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                            
                            {/* Tabela de Itens */}
                            <div className="max-h-[400px] overflow-y-auto rounded-md border">
                                <Table className="w-full">
                                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                        <TableRow>
                                            <TableHead className="w-[30%]">Equipamento</TableHead>
                                            <TableHead className="w-[10%] text-center">Comb.</TableHead>
                                            <TableHead className="w-[10%] text-center">Consumo</TableHead>
                                            <TableHead className="w-[10%] text-center">Qtd</TableHead>
                                            <TableHead className="w-[15%] text-center">Horas/Km/Dia</TableHead>
                                            <TableHead className="w-[10%] text-right">Litros</TableHead>
                                            <TableHead className="w-[15%] text-right">Valor Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentCategoryItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-muted-foreground">
                                                    Nenhum item de diretriz encontrado para esta categoria.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentCategoryItems.map((item, index) => {
                                                const { totalLitros, totalValor } = calculateTotalValor(
                                                    [item], 
                                                    form.dias_operacao, 
                                                    form.preco_diesel, 
                                                    form.preco_gasolina
                                                );
                                                
                                                const isMotomecanizacao = cat === 'MOTOMECANIZACAO';
                                                const isGerador = cat === 'GERADOR';
                                                
                                                const inputField = isMotomecanizacao ? 'km_dia' : 'horas_dia';
                                                const inputLabel = isMotomecanizacao ? 'Km/Dia' : 'Horas/Dia';
                                                const inputValue = isMotomecanizacao ? item.km_dia : item.horas_dia;
                                                
                                                // Encontrar o índice original no array completo para permitir a atualização/remoção
                                                const indexInMainArray = form.itens.findIndex(i => i.nome_equipamento === item.nome_equipamento && getClasseIIILabel(i.id) === cat);
                                                
                                                return (
                                                    <TableRow key={item.nome_equipamento} className="h-12">
                                                        <TableCell className="font-medium text-sm py-1">
                                                            {item.nome_equipamento}
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs py-1">
                                                            <Badge variant="secondary" className={cn(item.tipo_combustivel === 'OD' ? 'bg-yellow-700 text-white' : 'bg-green-700 text-white')}>
                                                                {item.tipo_combustivel}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs text-muted-foreground py-1">
                                                            {formatNumber(item.consumo)} {item.unidade}
                                                        </TableCell>
                                                        <TableCell className="py-1">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                                value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                                                onChange={(e) => handleItemChange(index, 'quantidade', parseInt(e.target.value) || 0)}
                                                                placeholder="0"
                                                                onKeyDown={handleNumberInputKeyDown}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-1">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.1"
                                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                                value={inputValue === undefined || inputValue === 0 ? "" : inputValue.toString()}
                                                                onChange={(e) => handleItemChange(index, inputField, parseFloat(e.target.value) || 0)}
                                                                placeholder={inputLabel}
                                                                onKeyDown={handleNumberInputKeyDown}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-right font-medium text-sm py-1">
                                                            {formatNumber(totalLitros)} L
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold text-sm py-1">
                                                            {formatCurrency(totalValor)}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Totais da Categoria */}
                            <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                                <span className="font-bold text-sm">TOTAL DE COMBUSTÍVEL DA CATEGORIA</span>
                                <div className="flex flex-col items-end">
                                    <span className="font-extrabold text-lg text-primary">
                                        {formatCurrency(calculateTotalValor(currentCategoryItems, form.dias_operacao, form.preco_diesel, form.preco_gasolina).totalValor)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatNumber(calculateTotalValor(currentCategoryItems, form.dias_operacao, form.preco_diesel, form.preco_gasolina).totalLitros)} Litros
                                    </span>
                                </div>
                            </div>
                            
                            {/* BLOCO DE ALOCAÇÃO OM DE DESTINO */}
                            {calculateTotalValor(currentCategoryItems, form.dias_operacao, form.preco_diesel, form.preco_gasolina).totalValor > 0 && (
                                <div className="space-y-2 p-4 border rounded-lg bg-background">
                                    <h4 className="font-semibold text-sm">OM de Destino do Recurso (Combustível)</h4>
                                    <div className="space-y-2">
                                        <Label>OM de Destino do Recurso *</Label>
                                        <OmSelector
                                            selectedOmId={tempDestinations[cat].id}
                                            onChange={handleOMDestinoChange}
                                            placeholder="Selecione a OM que receberá o recurso..."
                                            disabled={!form.organizacao} 
                                            initialOmName={tempDestinations[cat].om}
                                            initialOmUg={tempDestinations[cat].ug}
                                        />
                                        {tempDestinations[cat].ug && (
                                            <p className="text-xs text-muted-foreground">
                                                UG de Destino: {formatCodug(tempDestinations[cat].ug)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* FIM BLOCO DE ALOCAÇÃO */}

                            <div className="flex justify-end">
                                <Button 
                                    type="button" 
                                    onClick={handleUpdateCategoryItems} 
                                    className="w-full md:w-auto" 
                                    disabled={!form.organizacao || form.dias_operacao <= 0 || (calculateTotalValor(currentCategoryItems, form.dias_operacao, form.preco_diesel, form.preco_gasolina).totalValor > 0 && !tempDestinations[cat].om)}
                                >
                                    Salvar Itens da Categoria
                                </Button>
                            </div>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </TabsContent>
                  
                  {/* ABA LUBRIFICANTE */}
                  <TabsContent value="LUBRIFICANTE" className="mt-4">
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <Alert variant="default">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Lubrificante Consolidado</AlertTitle>
                            <AlertDescription>
                                O cálculo de Lubrificante é feito de forma consolidada, baseado nos itens de Combustível que possuem consumo de lubrificante configurado. O recurso é destinado à OM Detentora.
                            </Description>
                        </Alert>
                        
                        <div className="space-y-2">
                            <Label>Preço do Lubrificante (R$/L) *</Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                value={formatCurrencyInput(rawLubrificanteInput).formatted}
                                onChange={(e) => handlePriceChange('preco_lubrificante', e.target.value)}
                                placeholder="0,00"
                                onKeyDown={handleEnterToNextField}
                            />
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                            <span className="font-bold text-sm">TOTAL DE LUBRIFICANTE</span>
                            <div className="flex flex-col items-end">
                                <span className="font-extrabold text-lg text-primary">
                                    {formatCurrency(totalValorLubrificante)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {formatNumber(totalLitrosLubrificante)} Litros
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <Button 
                                type="button" 
                                onClick={handleSalvarRegistros} 
                                className="w-full md:w-auto" 
                                disabled={loading || (!hasActiveEquipmentCategories && lubrificanteItems.length === 0)}
                            >
                                {loading ? "Aguarde..." : "Salvar Registros"}
                            </Button>
                        </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {(hasActiveEquipmentCategories || totalValorLubrificante > 0) && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Consolidação de Suprimentos</h3>
                
                {isAnyCategoryDirty && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium">
                            Atenção: A quantidade de itens ou a OM de destino foi alterada em uma ou mais categorias de Combustível. Clique em "Salvar Itens da Categoria" nas abas afetadas.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                  {/* Exibição de Combustível por Categoria */}
                  {CATEGORIAS_EQUIPAMENTO.map(cat => {
                    const allocation = categoryAllocations[cat];
                    if (allocation.total_valor === 0) return null;
                    
                    const isDirty = isCategoryAllocationDirty(cat, allocation.total_valor, allocation, tempDestinations);
                    const isDifferentOm = form.organizacao !== allocation.om_destino_recurso;
                    
                    return (
                      <Card key={cat} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">Combustível - {getClasseIIILabel(cat)}</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(allocation.total_valor)}</span>
                        </div>
                        
                        <div className="pt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Detentora:</span>
                                <span className="font-medium">{form.organizacao} ({formatCodug(form.ug)})</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className={cn("font-medium", isDifferentOm ? "text-red-600 font-bold" : "text-foreground")}>
                                    {allocation.om_destino_recurso} ({formatCodug(allocation.ug_destino_recurso)})
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Total Litros (C/ Margem):</span>
                                <span className="font-medium">{formatNumber(allocation.total_litros)} L</span>
                            </div>
                            {isDirty && (
                                <Alert variant="destructive" className="mt-2 p-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-semibold">Valores Desatualizados</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        A quantidade de itens ou a OM de destino foi alterada. Clique em "Salvar Itens da Categoria" na aba "{getClasseIIILabel(cat)}" para atualizar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                      </Card>
                    );
                  })}
                  
                  {/* Exibição de Lubrificante Consolidado */}
                  {totalValorLubrificante > 0 && (
                    <Card className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">Lubrificante (Consolidado)</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalValorLubrificante)}</span>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Detentora/Destino:</span>
                                <span className="font-medium">{form.organizacao} ({formatCodug(form.ug)})</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Total Litros:</span>
                                <span className="font-medium">{formatNumber(totalLitrosLubrificante)} L</span>
                            </div>
                        </div>
                    </Card>
                  )}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM (CLASSE III)</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(totalValorFinal)}
                  </span>
                </div>
                
                <div className="flex gap-3 pt-4 justify-end">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={resetFormFields}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros} 
                    disabled={loading || (!hasActiveEquipmentCategories && totalValorLubrificante === 0) || isAnyCategoryDirty}
                  >
                    {loading ? "Aguarde..." : "Salvar Registros"}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Registros Salvos (OMs Detentoras)
                </h2>
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    
                    // Agrupar por tipo de suprimento (Combustível/Lubrificante)
                    const gruposSuprimento = omRegistros.reduce((acc, r) => {
                        const key = r.tipo_suprimento;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(r);
                        return acc;
                    }, {} as Record<TipoSuprimento, ClasseIIIRegistro[]>);
                    
                    const totalOM = omRegistros.reduce((sum, r) => sum + r.valor_total, 0);
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    OM Detentora: {omName} (UG: {ug})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(totalOM)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {CATEGORIAS_SUPRIMENTO.map(suprimento => {
                                    const registrosSuprimento = gruposSuprimento[suprimento];
                                    if (!registrosSuprimento || registrosSuprimento.length === 0) return null;
                                    
                                    const totalSuprimento = registrosSuprimento.reduce((sum, r) => sum + r.valor_total, 0);
                                    const totalLitrosSuprimento = registrosSuprimento.reduce((sum, r) => sum + r.total_litros, 0);
                                    
                                    return (
                                        <div key={suprimento} className="space-y-2 border p-3 rounded-lg bg-background">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-semibold text-base flex items-center gap-2">
                                                    {suprimento === 'COMBUSTIVEL' ? <Fuel className="h-4 w-4 text-yellow-700" /> : <Package className="h-4 w-4 text-green-700" />}
                                                    {suprimento === 'COMBUSTIVEL' ? 'Combustível' : 'Lubrificante'}
                                                </h4>
                                                <span className="font-bold text-lg text-primary/80">{formatCurrency(totalSuprimento)}</span>
                                            </div>
                                            
                                            {registrosSuprimento.map(registro => {
                                                const isLub = registro.tipo_suprimento === 'LUBRIFICANTE';
                                                const om = registro.organizacao;
                                                const ug = registro.ug;
                                                const suprimento = isLub ? 'LUB' : registro.tipo_combustivel;
                                                const displayCategoryLabel = getClasseIIIBadgeStyle(registro.tipo_equipamento).label;
                                                const badgeClass = getClasseIIIBadgeStyle(suprimento).className;
                                                
                                                // Verifica se a OM Detentora é diferente da OM de Destino
                                                const isResourceDifferent = omName !== om;
                                                const resourceDestinationText = `Recurso destinado à OM: ${om} (${formatCodug(ug)})`;
                                                
                                                return (
                                                    <Card key={registro.id} className="p-3 bg-muted/50 border">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-semibold text-sm text-foreground">
                                                                        {displayCategoryLabel}
                                                                    </h4>
                                                                    <Badge variant="default" className={cn("w-fit shrink-0", badgeClass)}>
                                                                        {suprimento}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Dias: {registro.dias_operacao} | Litros: {formatNumber(registro.total_litros)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-base text-primary/80">
                                                                    {formatCurrency(registro.valor_total)}
                                                                </span>
                                                                <div className="flex gap-1">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8"
                                                                        onClick={() => handleEditarRegistro(registro)}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={() => {
                                                                            if (confirm(`Deseja realmente deletar o registro de Classe III para ${omName} (${displayCategoryLabel} - ${suprimento})?`)) {
                                                                                supabase.from("classe_iii_registros")
                                                                                    .delete()
                                                                                    .eq("id", registro.id)
                                                                                    .then(() => {
                                                                                        toast.success("Registro excluído!");
                                                                                        fetchRegistros();
                                                                                    })
                                                                                    .catch(err => {
                                                                                        toast.error(sanitizeError(err));
                                                                                    });
                                                                            }
                                                                        }}
                                                                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Detalhes da Alocação */}
                                                        {isResourceDifferent && (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                                <span className="text-xs font-medium text-red-600">
                                                                    {resourceDestinationText}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                    );
                })}
              </div>
            )}

            {/* 5. Memórias de Cálculos Detalhadas */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const omDetentora = registro.om_detentora || om;
                  const ugDetentora = registro.ug_detentora || ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  
                  const suprimento = registro.tipo_suprimento === 'LUBRIFICANTE' ? 'LUB' : registro.tipo_combustivel;
                  const displayCategoryLabel = getClasseIIIBadgeStyle(registro.tipo_equipamento).label;
                  const badgeClass = getClasseIIIBadgeStyle(suprimento).className;
                  const categoryBadgeStyle = getClasseIIIBadgeStyle(registro.tipo_equipamento);
                  
                  // Verifica se a OM Detentora é diferente da OM de Destino
                  const isResourceDifferent = omDetentora !== om;
                  const resourceDestinationText = `Recurso destinado à OM: ${om} (${formatCodug(ug)})`;
                  
                  const itensParaMemoria = form.itens.filter(item => 
                      (registro.tipo_suprimento === 'LUBRIFICANTE' && (item.consumo_lubrificante_litro || 0) > 0) ||
                      (registro.tipo_suprimento === 'COMBUSTIVEL' && getClasseIIILabel(item.id) === registro.tipo_equipamento && item.tipo_combustivel === registro.tipo_combustivel)
                  );
                  
                  const precoLitro = registro.tipo_suprimento === 'LUBRIFICANTE' ? form.preco_lubrificante : (registro.tipo_combustivel === 'OD' ? form.preco_diesel : form.preco_gasolina);
                  
                  const memoriaAutomatica = generateMemoriaCalculo(
                      itensParaMemoria, 
                      registro.dias_operacao, 
                      registro.tipo_suprimento === 'LUBRIFICANTE' ? 'LUB' : registro.tipo_combustivel, 
                      precoLitro, 
                      registro.tipo_equipamento,
                      registro.organizacao, // OM Destino
                      registro.ug, // UG Destino
                      registro.fase_atividade || ''
                  );
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                                <h4 className="text-base font-semibold text-foreground">
                                    OM Detentora: {omDetentora} ({formatCodug(ugDetentora)})
                                </h4>
                                {/* NOVO BADGE: Categoria do Material (com cor específica) */}
                                <Badge variant="default" className={cn("w-fit shrink-0", categoryBadgeStyle.className)}>
                                    {displayCategoryLabel}
                                </Badge>
                                {/* BADGE EXISTENTE: Tipo de Suprimento */}
                                <Badge variant="default" className={cn("w-fit shrink-0", badgeClass)}>
                                    {suprimento}
                                </Badge>
                            </div>
                            
                            {/* ALERTA DE RECURSO DIFERENTE (AGORA DENTRO DO FLEX-COL) */}
                            {isResourceDifferent && (
                                <div className="flex items-center gap-1 mt-1 mb-0">
                                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                                    <span className="text-sm font-medium text-red-600">
                                        {resourceDestinationText}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center justify-end gap-2 shrink-0">
                            
                            {!isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleIniciarEdicaoMemoria(registro)}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Editar Memória
                                  </Button>
                                  
                                  {hasCustomMemoria && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                      disabled={loading}
                                      className="gap-2 text-muted-foreground"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Restaurar Automática
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <Check className="h-4 w-4" />
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelarEdicaoMemoria}
                                    disabled={loading}
                                    className="gap-2"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Cancelar
                                  </Button>
                                </>
                              )}
                        </div>
                      </div>
                      
                      <Card className="p-4 bg-background rounded-lg border">
                        {isEditing ? (
                          <Textarea
                            value={memoriaEdit}
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            className="min-h-[300px] font-mono text-sm"
                            placeholder="Digite a memória de cálculo..."
                          />
                        ) : (
                          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                            {memoriaExibida}
                          </pre>
                        )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClasseIIIForm;