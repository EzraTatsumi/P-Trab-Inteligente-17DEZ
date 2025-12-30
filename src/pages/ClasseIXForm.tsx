import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronDown, ChevronsUpDown, Sparkles, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { DiretrizClasseIX } from "@/types/diretrizesClasseIX";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCategoryBadgeStyle, getCategoryLabel } from "@/lib/badgeUtils";
import { 
    generateCategoryMemoriaCalculo as generateClasseIXMemoriaCalculo, 
    generateDetalhamento as generateClasseIXDetalhamento,
    calculateItemTotalClasseIX,
    formatFasesParaTexto,
} from "@/lib/classeIXUtils"; // Importando utilitários da Classe IX

type Categoria = 'Vtr Administrativa' | 'Vtr Operacional' | 'Motocicleta' | 'Vtr Blindada';

const CATEGORIAS: Categoria[] = [
  "Vtr Administrativa",
  "Vtr Operacional",
  "Motocicleta",
  "Vtr Blindada",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// --- TIPOS TEMPORÁRIOS (UNSAVED CHANGES) ---
interface TempDestination {
    om: string;
    ug: string;
    id?: string;
}
const initialTempDestinations: Record<Categoria, TempDestination> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<Categoria, TempDestination>);
const initialTempND39Inputs: Record<Categoria, string> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: "" }), {} as Record<Categoria, string>);
// --- FIM TIPOS TEMPORÁRIOS ---

interface ItemClasseIX {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  categoria: string;
  memoria_customizada?: string | null;
}

interface FormDataClasseIX {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itens: ItemClasseIX[]; // All items across all categories
  fase_atividade?: string; // Global
}

interface ClasseIXRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  om_detentora: string; 
  ug_detentora: string; 
  dias_operacao: number;
  categoria: string;
  itens_motomecanizacao: ItemClasseIX[]; // Tipo corrigido
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface CategoryAllocation {
  total_valor: number; // Valor calculado (C/ Acionamento)
  nd_39_input: string; // User input string for ND 39 (Formatted string for persistence)
  nd_30_value: number; // Calculated ND 30 value
  nd_39_value: number; // Calculated ND 39 value
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialCategoryAllocations: Record<Categoria, CategoryAllocation> = CATEGORIAS.reduce((acc, cat) => ({ 
    ...acc, 
    [cat]: { 
        total_valor: 0, 
        nd_39_input: "", 
        nd_30_value: 0, 
        nd_39_value: 0, 
        om_destino_recurso: "", 
        ug_destino_recurso: "", 
        selectedOmDestinoId: undefined 
    } 
}), {} as Record<Categoria, CategoryAllocation>);

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper function to get the numeric ND 39 value from the temporary input digits
const getTempND39NumericValue = (category: Categoria, tempInputs: Record<Categoria, string>): number => {
    const digits = tempInputs[category] || "";
    return formatCurrencyInput(digits).numericValue;
};


const ClasseIXForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIXRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseIX[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseIX>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  
  const [categoryAllocations, setCategoryAllocations] = useState<Record<Categoria, CategoryAllocation>>(initialCategoryAllocations);
  
  // NOVOS ESTADOS: Rastreia o input ND 39 (dígitos) temporário por categoria
  const [tempND39Inputs, setTempND39Inputs] = useState<Record<Categoria, string>>(initialTempND39Inputs);
  // NOVOS ESTADOS: Rastreia a OM de destino temporária por categoria
  const [tempDestinations, setTempDestinations] = useState<Record<Categoria, TempDestination>>(initialTempDestinations);
  
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseIX[]>([]);
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  const formRef = useRef<HTMLDivElement>(null);
  
  // NOVO: Função para desativar setas e manter navegação por Enter
  const handleNumberInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    handleEnterToNextField(e);
  };

  // NOVO: Dirty Check Logic
  const isCategoryAllocationDirty = useCallback((
      category: Categoria, 
      currentTotalValue: number, // Total calculated from the items being checked (C/ Acionamento)
      allocation: CategoryAllocation, 
      tempInputs: Record<Categoria, string>, 
      tempDestinations: Record<Categoria, TempDestination>
  ): boolean => {
      // 1. Check for quantity/item change (total value mismatch)
      if (!areNumbersEqual(allocation.total_valor, currentTotalValue)) {
          return true;
      }
      
      // 2. Check for ND 39 allocation change
      const tempND39Value = getTempND39NumericValue(category, tempInputs);
      if (!areNumbersEqual(tempND39Value, allocation.nd_39_value)) {
          return true;
      }
      
      // 3. Check for Destination OM change
      const tempDest = tempDestinations[category];
      if (allocation.om_destino_recurso !== tempDest.om || allocation.ug_destino_recurso !== tempDest.ug) {
          // Only consider it dirty if the category has items (i.e., total > 0)
          if (currentTotalValue > 0) {
              return true;
          }
      }
      
      return false;
  }, []);

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
  
  // Efeito para sincronizar os estados temporários (ND 39 Input e OM Destino)
  useEffect(() => {
      const savedAllocation = categoryAllocations[selectedTab];
      
      // 1. Sincronizar ND 39 Input (dígitos)
      const numericValue = parseInputToNumber(savedAllocation.nd_39_input);
      const digits = String(Math.round(numericValue * 100));
      
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: digits
      }));
      
      // 2. Sincronizar OM Destino
      if (savedAllocation.om_destino_recurso) {
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: {
                  om: savedAllocation.om_destino_recurso,
                  ug: savedAllocation.ug_destino_recurso,
                  id: savedAllocation.selectedOmDestinoId,
              }
          }));
      } else if (form.organizacao) {
          // Se não houver alocação salva, mas houver OM Detentora, use a Detentora como padrão temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: {
                  om: form.organizacao,
                  ug: form.ug,
                  id: form.selectedOmId,
              }
          }));
      } else {
          // Se não houver OM Detentora, limpa o temporário
          setTempDestinations(prev => ({
              ...prev,
              [selectedTab]: { om: "", ug: "", id: undefined }
          }));
      }
      
  }, [selectedTab, categoryAllocations, form.organizacao, form.ug, form.selectedOmId]);

  useEffect(() => {
    if (diretrizes.length > 0 && form.organizacao) {
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedTab)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                valor_acionamento_mensal: Number(d.valor_acionamento_mensal),
                categoria: d.categoria as Categoria,
                memoria_customizada: null,
            }));

        const existingItemsMap = new Map<string, ItemClasseIX>();
        form.itens.filter(i => i.categoria === selectedTab).forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.item);
            return existing || availableItem;
        });

        setCurrentCategoryItems(mergedItems);
    } else if (diretrizes.length > 0 && !form.organizacao) {
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedTab)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                valor_acionamento_mensal: Number(d.valor_acionamento_mensal),
                categoria: d.categoria as Categoria,
                memoria_customizada: null,
            }));
        setCurrentCategoryItems(availableItems);
    } else {
        setCurrentCategoryItems([]);
    }
  }, [selectedTab, diretrizes, form.itens, form.organizacao, form.dias_operacao]);

  const itensAgrupadosPorCategoria = useMemo(() => {
    return form.itens.reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<Categoria, ItemClasseIX[]>);
  }, [form.itens]);
  

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
        // Se não houver ano de referência, não podemos carregar diretrizes personalizadas
        setDiretrizes([]);
        toast.warning(`Diretriz de Custeio não encontrada. Configure o ano de referência.`);
        return;
      }

      const { data: classeIXData, error } = await supabase
        .from("diretrizes_classe_ix")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", CATEGORIAS); 

      if (error) throw error;

      if (classeIXData && classeIXData.length > 0) {
        setDiretrizes((classeIXData || []) as DiretrizClasseIX[]);
      } else {
        setDiretrizes([]);
        toast.warning(`Itens de Classe IX não configurados para o ano ${anoReferencia}.`);
      }
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizes([]);
      toast.error("Erro ao carregar diretrizes.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_ix_registros")
      .select("*, itens_motomecanizacao, detalhamento_customizado, valor_nd_30, valor_nd_39, om_detentora, ug_detentora")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true })
      .order("categoria", { ascending: true });

    if (error) {
      // Adicionando tratamento de erro detalhado
      console.error("Erro ao carregar registros de Classe IX:", error);
      toast.error(`Erro ao carregar registros: ${sanitizeError(error)}`);
      return;
    }

    const uniqueRecordsMap = new Map<string, ClasseIXRegistro>();
    (data || []).forEach(r => {
        // Chave de unicidade deve ser OM Detentora + UG Detentora + Categoria
        const omDetentora = r.om_detentora || r.organizacao;
        const ugDetentora = r.ug_detentora || r.ug;
        const key = `${omDetentora}-${ugDetentora}-${r.categoria}`;
        
        const record = {
            ...r,
            itens_motomecanizacao: (r.itens_motomecanizacao || []) as ItemClasseIX[],
            valor_nd_30: Number(r.valor_nd_30),
            valor_nd_39: Number(r.valor_nd_39),
            om_detentora: omDetentora,
            ug_detentora: ugDetentora,
        } as ClasseIXRegistro;
        uniqueRecordsMap.set(key, record);
    });

    setRegistros(Array.from(uniqueRecordsMap.values()));
  };

  const resetFormFields = () => {
    setEditingId(null);
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    
    setCategoryAllocations(initialCategoryAllocations);
    setTempND39Inputs(initialTempND39Inputs); 
    setTempDestinations(initialTempDestinations); 
    
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
      const newTempDestinations = CATEGORIAS.reduce((acc, cat) => {
          acc[cat] = {
              om: omData.nome_om,
              ug: omData.codug_om,
              id: omData.id,
          };
          return acc;
      }, {} as Record<Categoria, TempDestination>);
      setTempDestinations(newTempDestinations);
      
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      });
      
      // Clear temporary destination OM for all categories
      setTempDestinations(initialTempDestinations);
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setTempDestinations(prev => ({
        ...prev,
        [selectedTab]: {
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

  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    newItems[itemIndex].quantidade = Math.max(0, quantity);
    setCurrentCategoryItems(newItems);
  };

  // CÁLCULO DA CATEGORIA ATUAL (Classe IX: Base + Acionamento)
  const currentCategoryTotalValue = useMemo(() => {
    if (form.dias_operacao <= 0) return 0;
    return currentCategoryItems.reduce((sum, item) => {
        const { total } = calculateItemTotalClasseIX(item, form.dias_operacao);
        return sum + total;
    }, 0);
  }, [currentCategoryItems, form.dias_operacao]);

  // ND Calculation and Input Handlers (Temporary for current tab)
  const currentND39InputDigits = tempND39Inputs[selectedTab] || "";
  
  const nd39NumericValue = useMemo(() => {
    return getTempND39NumericValue(selectedTab, tempND39Inputs);
  }, [currentND39InputDigits, selectedTab, tempND39Inputs]);

  const nd39ValueTemp = Math.min(currentCategoryTotalValue, Math.max(0, nd39NumericValue));
  const nd30ValueTemp = currentCategoryTotalValue - nd39ValueTemp;

  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const { digits } = formatCurrencyInput(rawValue);
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: digits
      }));
  };

  const handleND39InputBlur = () => {
      const finalDigits = String(Math.round(nd39ValueTemp * 100));
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: finalDigits
      }));
  };
  
  const { formatted: formattedND39Value } = formatCurrencyInput(currentND39InputDigits);

  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.ug === "" || form.dias_operacao <= 0) {
        toast.error("Preencha a OM Detentora e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    const categoryTotalValue = currentCategoryTotalValue;

    const numericInput = nd39NumericValue;
    const finalND39Value = Math.min(categoryTotalValue, Math.max(0, numericInput));
    const finalND30Value = categoryTotalValue - finalND39Value;
    
    if (categoryTotalValue > 0 && !areNumbersEqual(finalND30Value + finalND39Value, categoryTotalValue)) {
        toast.error("Erro de cálculo: A soma de ND 30 e ND 39 deve ser igual ao Total da Categoria.");
        return;
    }
    
    const currentTempDest = tempDestinations[selectedTab];
    if (categoryTotalValue > 0 && (!currentTempDest.om || !currentTempDest.ug)) {
        toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
        return;
    }

    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);

    const itemsFromOtherCategories = form.itens.filter(item => item.categoria !== selectedTab);

    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];

    setCategoryAllocations(prev => ({
        ...prev,
        [selectedTab]: {
            ...prev[selectedTab],
            total_valor: categoryTotalValue,
            nd_39_input: formatNumberForInput(finalND39Value, 2),
            nd_30_value: finalND30Value,
            nd_39_value: finalND39Value,
            om_destino_recurso: currentTempDest.om,
            ug_destino_recurso: currentTempDest.ug,
            selectedOmDestinoId: currentTempDest.id,
        }
    }));

    const finalDigits = String(Math.round(finalND39Value * 100));
    setTempND39Inputs(prev => ({
        ...prev,
        [selectedTab]: finalDigits
    }));

    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens e alocação de ND para ${getCategoryLabel(selectedTab)} atualizados!`);
  };
  
  // CÁLCULO GLOBAL
  const valorTotalForm = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.total_valor, 0);

  const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
  const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);

  const totalAlocado = totalND30Final + totalND39Final;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalAlocado);


  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    if (!isTotalAlocadoCorrect) {
        toast.error("O valor total dos itens não corresponde ao total alocado. Clique em 'Salvar Itens da Categoria' em todas as abas ativas.");
        return;
    }

    setLoading(true);
    
    const itemsByActiveCategory = form.itens.reduce((acc, item) => {
        if (item.quantidade > 0 && CATEGORIAS.includes(item.categoria as Categoria)) {
            if (!acc[item.categoria]) {
                acc[item.categoria] = [];
            }
            acc[item.categoria].push(item);
        }
        return acc;
    }, {} as Record<Categoria, ItemClasseIX[]>);
    
    const categoriesToSave = Object.keys(itemsByActiveCategory) as Categoria[];
    
    if (categoriesToSave.length === 0) {
        toast.error("Nenhum item com quantidade maior que zero foi configurado.");
        setLoading(false);
        return;
    }
    
    const registrosParaSalvar: TablesInsert<'classe_ix_registros'>[] = [];
    
    for (const categoria of categoriesToSave) {
        const itens = itemsByActiveCategory[categoria];
        const allocation = categoryAllocations[categoria];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error(`Selecione a OM de destino do recurso para a categoria: ${getCategoryLabel(categoria)}.`);
            setLoading(false);
            return;
        }
        
        const valorTotalCategoria = allocation.total_valor;
        
        if (!areNumbersEqual(valorTotalCategoria, (allocation.nd_30_value + allocation.nd_39_value))) {
            toast.error(`Erro de alocação na categoria ${getCategoryLabel(categoria)}: O valor total dos itens (${formatCurrency(valorTotalCategoria)}) não corresponde ao total alocado (${formatCurrency(allocation.nd_30_value + allocation.nd_39_value)}). Salve a categoria novamente.`);
            setLoading(false);
            return;
        }
        
        const detalhamento = generateClasseIXDetalhamento(
            itens, 
            form.dias_operacao, 
            form.organizacao, // OM Detentora
            form.ug, // UG Detentora
            faseFinalString,
            allocation.om_destino_recurso,
            allocation.ug_destino_recurso,
            allocation.nd_30_value,
            allocation.nd_39_value
        );
        
        const registro: TablesInsert<'classe_ix_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso,
            ug: allocation.ug_destino_recurso,
            om_detentora: form.organizacao, // Salvando OM Detentora
            ug_detentora: form.ug, // Salvando UG Detentora
            dias_operacao: form.dias_operacao,
            categoria: categoria,
            itens_motomecanizacao: itens as any,
            valor_total: valorTotalCategoria, 
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            detalhamento_customizado: null,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
        };
        registrosParaSalvar.push(registro);
    }

    try {
      // Deletar APENAS os registros de Classe IX existentes para este PTrab E ESTA OM DETENTORA/UG DETENTORA
      const { error: deleteError } = await supabase
        .from("classe_ix_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", form.organizacao) // Filtra pela OM Detentora
        .eq("ug_detentora", form.ug); // Filtra pela UG Detentora
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      const { error: insertError } = await supabase.from("classe_ix_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success(editingId ? "Registros de Classe IX atualizados com sucesso!" : "Registros de Classe IX salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Classe IX:", error);
      toast.error("Erro ao salvar registros de Classe IX");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseIXRegistro) => {
    setLoading(true);
    resetFormFields();
    
    const omDetentoraToEdit = registro.om_detentora;
    const ugDetentoraToEdit = registro.ug_detentora;
    
    // Buscar TODOS os registros de CLASSE IX para este PTrab E ESTA OM/UG DETENTORA ESPECÍFICA
    const { data: allRecords, error: fetchAllError } = await supabase
        .from("classe_ix_registros")
        .select("*, itens_motomecanizacao, valor_nd_30, valor_nd_39, dias_operacao, fase_atividade, organizacao, ug, om_detentora, ug_detentora")
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", omDetentoraToEdit) 
        .eq("ug_detentora", ugDetentoraToEdit); 
        
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
    
    let consolidatedItems: ItemClasseIX[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    let tempND39Load: Record<Categoria, string> = { ...initialTempND39Inputs };
    let tempDestinationsLoad: Record<Categoria, TempDestination> = { ...initialTempDestinations };
    
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
    
    for (const r of (allRecords || [])) {
        const category = r.categoria as Categoria;
        const items = (r.itens_motomecanizacao as any[] || []).map(item => ({
            item: item.item,
            quantidade: Number(item.quantidade || 0),
            valor_mnt_dia: Number(item.valor_mnt_dia || 0),
            valor_acionamento_mensal: Number(item.valor_acionamento_mensal || 0),
            categoria: item.categoria,
            memoria_customizada: item.memoria_customizada || null,
        })) as ItemClasseIX[];
        
        consolidatedItems = consolidatedItems.concat(items);
        
        if (newAllocations[category]) {
            // Recalcular o total da categoria com base nos itens carregados
            const totalValor = items.reduce((sum, item) => {
                const { total } = calculateItemTotalClasseIX(item, diasOperacao);
                return sum + total;
            }, 0);
            
            // Tenta buscar o ID da OM de Destino (r.organizacao/r.ug)
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
            
            newAllocations[category] = {
                total_valor: totalValor,
                nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
                nd_30_value: Number(r.valor_nd_30),
                nd_39_value: Number(r.valor_nd_39),
                om_destino_recurso: r.organizacao, // OM de Destino (campo 'organizacao' do DB)
                ug_destino_recurso: r.ug, // UG de Destino (campo 'ug' do DB)
                selectedOmDestinoId: selectedOmDestinoId,
            };
            
            const savedND39Value = Number(r.valor_nd_39);
            const savedDigits = String(Math.round(savedND39Value * 100));
            tempND39Load[category] = savedDigits;
            
            tempDestinationsLoad[category] = {
                om: r.organizacao,
                ug: r.ug,
                id: selectedOmDestinoId,
            };
        }
    }
    
    // 4. Preencher o formulário principal com a OM Detentora
    setEditingId(registro.id); 
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: omDetentoraToEdit, // OM Detentora
      ug: ugDetentoraToEdit, // UG Detentora
      dias_operacao: diasOperacao,
      itens: consolidatedItems,
    });
    
    // 5. Preencher o estado de alocação e IDs de destino
    setCategoryAllocations(newAllocations);
    setTempND39Inputs(tempND39Load); 
    setTempDestinations(tempDestinationsLoad);
    
    // 6. Preencher fases e aba
    const fasesSalvas = (faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // 7. Selecionar a aba do registro clicado
    setSelectedTab(registro.categoria as Categoria);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        // Chave de agrupamento é a OM Detentora
        const omDetentora = registro.om_detentora;
        const ugDetentora = registro.ug_detentora;
        const key = `${omDetentora} (${formatCodug(ugDetentora)})`;
        
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseIXRegistro[]>);
  }, [registros]);

  const handleIniciarEdicaoMemoria = (registro: ClasseIXRegistro) => {
    setEditingMemoriaId(registro.id);
    
    // 1. Gerar a memória automática mais recente
    const memoriaAutomatica = generateClasseIXMemoriaCalculo({
        ...registro,
        itens_motomecanizacao: registro.itens_motomecanizacao as ItemClasseIX[],
    } as ClasseIXRegistro);
    
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
        .from("classe_ix_registros")
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
        .from("classe_ix_registros")
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
  
  // Helper para calcular o total de um item na tabela de itens
  const calculateItemTotalDisplay = (item: ItemClasseIX) => {
    if (form.dias_operacao <= 0) return 0;
    const { total } = calculateItemTotalClasseIX(item, form.dias_operacao);
    return total;
  };

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
              Classe IX - Motomecanização
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para manutenção de material de Classe IX (Viaturas).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
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
              
              {/* SEGUNDA LINHA: Fase da Atividade (Colunas 1 e 2) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-2">
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
                    {/* Espaço vazio */}
                </div>
              </div>
            </div>

            {/* 2. Adicionar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Configurar Viaturas por Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-4">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{getCategoryLabel(cat)}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                            <Table className="w-full">
                                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead className="w-[30%]">Viatura</TableHead>
                                        <TableHead className="w-[15%] text-right">Mnt/Dia Op</TableHead>
                                        <TableHead className="w-[15%] text-right">Acionamento/Mês</TableHead>
                                        <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                                        <TableHead className="w-[25%] text-right">Total (Base + Acionamento)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentCategoryItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                Nenhuma diretriz de viatura encontrada para esta categoria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentCategoryItems.map((item, index) => {
                                            const itemTotal = calculateItemTotalDisplay(item);
                                            
                                            return (
                                                <TableRow key={item.item} className="h-12">
                                                    <TableCell className="font-medium text-sm py-1">
                                                        {item.item}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                        {formatCurrency(item.valor_mnt_dia)}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                        {formatCurrency(item.valor_acionamento_mensal)}
                                                    </TableCell>
                                                    <TableCell className="py-1">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                            value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                                            placeholder="0"
                                                            // APLICANDO A FUNÇÃO AQUI
                                                            onKeyDown={handleNumberInputKeyDown} 
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right font-semibold text-sm py-1">
                                                        {formatCurrency(itemTotal)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                            <span className="font-bold text-sm">TOTAL DA CATEGORIA (C/ Acionamento)</span>
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(currentCategoryTotalValue)}
                            </span>
                        </div>
                        
                        {/* BLOCO DE ALOCAÇÃO ND 30/39 */}
                        {currentCategoryTotalValue > 0 && (
                            <div className="space-y-4 p-4 border rounded-lg bg-background">
                                <h4 className="font-semibold text-sm">Alocação de Recursos para {getCategoryLabel(cat)} (Valor Total: {formatCurrency(currentCategoryTotalValue)})</h4>
                                
                                {/* CAMPO: OM de Destino do Recurso */}
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
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {/* ND 30 (Material) - ESQUERDA */}
                                    <div className="space-y-2">
                                        <Label>ND 33.90.30 (Material)</Label>
                                        <div className="relative">
                                            <Input
                                                value={formatNumberForInput(nd30ValueTemp, 2)}
                                                readOnly
                                                disabled
                                                className="pl-12 text-lg font-bold bg-green-500/10 text-green-600 disabled:opacity-100"
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Calculado por diferença (Total - ND 39).
                                        </p>
                                    </div>
                                    {/* ND 39 (Serviço) - DIREITA */}
                                    <div className="space-y-2">
                                        <Label htmlFor="nd39-input">ND 33.90.39 (Serviço)</Label>
                                        <div className="relative">
                                            <Input
                                                id="nd39-input"
                                                type="text"
                                                inputMode="decimal"
                                                value={formattedND39Value}
                                                onChange={handleND39InputChange}
                                                onBlur={handleND39InputBlur}
                                                placeholder="0,00"
                                                className="pl-12 text-lg"
                                                disabled={currentCategoryTotalValue === 0}
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-lg text-foreground">R$</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Valor alocado para contratação de serviço.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm font-bold border-t pt-2">
                                    <span>TOTAL ALOCADO:</span>
                                    <span className={cn(areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) ? "text-primary" : "text-destructive")}>
                                        {formatCurrency(nd30ValueTemp + nd39ValueTemp)}
                                    </span>
                                </div>
                            </div>
                        )}
                        {/* FIM BLOCO DE ALOCAÇÃO */}

                        <div className="flex justify-end">
                            <Button 
                                type="button" 
                                onClick={handleUpdateCategoryItems} 
                                className="w-full md:w-auto" 
                                disabled={!form.organizacao || form.dias_operacao <= 0 || !areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) || (currentCategoryTotalValue > 0 && !tempDestinations[cat].om)}
                            >
                                Salvar Itens da Categoria
                            </Button>
                        </div>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {form.itens.length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Viaturas Adicionadas ({form.itens.length})</h3>
                
                {/* Alerta de Validação Final */}
                {!isTotalAlocadoCorrect && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium">
                            Atenção: O Custo Total dos Itens ({formatCurrency(valorTotalForm)}) não corresponde ao Total Alocado ({formatCurrency(totalAlocado)}). 
                            Clique em "Salvar Itens da Categoria" em todas as abas ativas.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                  {Object.entries(itensAgrupadosPorCategoria).map(([categoria, itens]) => {
                    const totalCategoria = itens.reduce((sum, item) => {
                        const { total } = calculateItemTotalClasseIX(item, form.dias_operacao);
                        return sum + total;
                    }, 0);
                    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                    
                    const allocation = categoryAllocations[categoria as Categoria];
                    
                    // NOVO CÁLCULO: Obtém o total atual para a categoria
                    const currentItemsForCheck = categoria === selectedTab ? currentCategoryItems.filter(i => i.quantidade > 0) : itens;
                    const currentTotalValueForCheck = currentItemsForCheck.reduce((sum, item) => {
                        const { total } = calculateItemTotalClasseIX(item, form.dias_operacao);
                        return sum + total;
                    }, 0);
                    
                    // NOVO: Verifica se a categoria está "suja" (itens ou alocação alterados)
                    const isDirty = isCategoryAllocationDirty(
                        categoria as Categoria, 
                        currentTotalValueForCheck, 
                        allocation, 
                        tempND39Inputs, 
                        tempDestinations
                    );
                    
                    // Verifica se a OM Detentora é diferente da OM de Destino
                    const isDifferentOm = form.organizacao !== allocation.om_destino_recurso;
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{getCategoryLabel(categoria)} ({totalQuantidade} Vtr)</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const { base, acionamento, total } = calculateItemTotalClasseIX(item, form.dias_operacao);
                            const nrMeses = Math.ceil(form.dias_operacao / 30);
                            
                            return (
                                <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                                  <span className="font-medium text-foreground">{item.item} ({item.quantidade} un.)</span>
                                  <span className="text-right text-xs flex flex-col items-end">
                                    <span className="font-bold text-sm text-primary/80">Total: {formatCurrency(total)}</span>
                                    <span className="text-muted-foreground">
                                        Base ({formatCurrency(item.valor_mnt_dia)}/dia x {form.dias_operacao}d x {item.quantidade} Vtr): {formatCurrency(base)}
                                    </span>
                                    <span className="text-muted-foreground">
                                        Acionamento ({formatCurrency(item.valor_acionamento_mensal)}/mês x {nrMeses}m x {item.quantidade} Vtr): {formatCurrency(acionamento)}
                                    </span>
                                  </span>
                                </div>
                            );
                          })}
                        </div>
                        
                        <div className="pt-2 border-t mt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className={cn("font-medium", isDifferentOm ? "text-red-600 font-bold" : "text-foreground")}>
                                    {allocation.om_destino_recurso} ({formatCodug(allocation.ug_destino_recurso)})
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                <span className="font-medium text-green-600">{formatCurrency(allocation.nd_30_value)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                <span className="font-medium text-blue-600">{formatCurrency(allocation.nd_39_value)}</span>
                            </div>
                            {isDirty && (
                                <Alert variant="destructive" className="mt-2 p-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle className="text-xs font-semibold">Valores Desatualizados</AlertTitle>
                                    <AlertDescription className="text-xs">
                                        A quantidade de viaturas, a alocação de ND ou a OM de destino foi alterada. Clique em "Salvar Itens da Categoria" na aba "{getCategoryLabel(categoria)}" para atualizar.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(valorTotalForm)}
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
                    disabled={loading || !form.organizacao || form.itens.length === 0 || !isTotalAlocadoCorrect}
                  >
                    {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    const totalOM = omRegistros.reduce((sum, r) => r.valor_total + sum, 0);
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    
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
                                {omRegistros.map((registro) => {
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
                                    const badgeStyle = getCategoryBadgeStyle(registro.categoria);
                                    
                                    // Verifica se a OM Detentora é diferente da OM de Destino
                                    const isDifferentOm = registro.om_detentora !== registro.organizacao;
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {getCategoryLabel(registro.categoria)}
                                                        </h4>
                                                        <Badge variant="outline" className="text-xs font-semibold">
                                                            {fases}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {registro.dias_operacao}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg text-primary/80">
                                                        {formatCurrency(totalCategoria)}
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
                                                                if (confirm(`Deseja realmente deletar o registro de Classe IX para ${omName} (${registro.categoria})?`)) {
                                                                    supabase.from("classe_ix_registros")
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
                                            <div className="pt-2 border-t mt-2">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">OM Destino Recurso:</span>
                                                    <span className={cn("font-medium", isDifferentOm ? "text-red-600 font-bold" : "text-foreground")}>
                                                        {registro.organizacao} ({formatCodug(registro.ug)})
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                                    <span className="font-medium text-blue-600">{formatCurrency(registro.valor_nd_39)}</span>
                                                </div>
                                            </div>
                                        </Card>
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
                  const omDetentora = registro.om_detentora;
                  const ugDetentora = registro.ug_detentora;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  
                  // Verifica se a OM Detentora é diferente da OM de Destino
                  const isDifferentOm = omDetentora !== registro.organizacao;
                  
                  const memoriaAutomatica = generateClasseIXMemoriaCalculo({
                      ...registro,
                      itens_motomecanizacao: registro.itens_motomecanizacao as ItemClasseIX[],
                  } as ClasseIXRegistro);
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  const badgeStyle = getCategoryBadgeStyle(registro.categoria);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                  <h4 className="text-base font-semibold text-foreground">
                                    OM Detentora: {omDetentora} (UG: {formatCodug(ugDetentora)})
                                  </h4>
                                  <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                      {badgeStyle.label}
                                  </Badge>
                                  {hasCustomMemoria && !isEditing && (
                                    <Badge variant="outline" className="text-xs">
                                      Editada manualmente
                                    </Badge>
                                  )}
                              </div>
                              {isDifferentOm ? (
                                  <div className="flex items-center gap-1 mt-1">
                                      <AlertCircle className="h-4 w-4 text-red-600" />
                                      <span className="text-sm font-medium text-red-600">
                                          Recurso destinado à OM: {registro.organizacao} ({formatCodug(registro.ug)})
                                      </span>
                                  </div>
                              ) : null}
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

export default ClasseIXForm;