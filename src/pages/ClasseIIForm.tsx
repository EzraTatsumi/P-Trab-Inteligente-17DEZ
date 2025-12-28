import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
} from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import {
  formatCurrency,
  parseInputToNumber,
  formatNumberForInput,
  formatCurrencyInput,
  numberToRawDigits,
  formatCodug,
} from "@/lib/formatUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";
import { TablesInsert } from "@/integrations/supabase/types";
import { defaultClasseIIConfig } from "@/data/classeIIData";
import {
  generateClasseIIMemoriaCalculo,
  generateDetalhamento,
} from "@/lib/classeIIUtils";
import { ClasseIIFormHeader } from "@/components/classeII/ClasseIIFormHeader";
import { ClasseIICategoryItems } from "@/components/classeII/ClasseIICategoryItems";
import { ClasseIIFormSummary } from "@/components/classeII/ClasseIIFormSummary";
import { ClasseIIMemoriaViewer } from "@/components/classeII/ClasseIIMemoriaViewer";

type Categoria = "Equipamento Individual" | "Proteção Balística" | "Material de Estacionamento";

const CATEGORIAS: Categoria[] = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

interface ClasseIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  om_detentora: string; // OM Detentora (Source)
  ug_detentora: string; // UG Detentora (Source)
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
  efetivo: number;
}

interface CategoryAllocation {
  total_valor: number;
  nd_39_input: string;
  nd_30_value: number;
  nd_39_value: number;
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

interface TempDestination {
    om: string;
    ug: string;
    id?: string;
}

const initialCategoryAllocations: Record<Categoria, CategoryAllocation> = {
    'Equipamento Individual': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Proteção Balística': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Material de Estacionamento': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
};

const initialTempDestinations: Record<Categoria, TempDestination> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: { om: "", ug: "", id: undefined } }), {} as Record<Categoria, TempDestination>);
const initialTempND39Inputs: Record<Categoria, string> = CATEGORIAS.reduce((acc, cat) => ({ ...acc, [cat]: "" }), {} as Record<Categoria, string>);

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

const getTempND39NumericValue = (category: Categoria, tempInputs: Record<Categoria, string>): number => {
    const digits = tempInputs[category] || "";
    return formatCurrencyInput(digits).numericValue;
};

const ClasseIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // --- Global Form State (OM Detentora, Dias, Efetivo, Itens Consolidados) ---
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [organizacao, setOrganizacao] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  const [efetivo, setEfetivo] = useState<number>(0);
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [formItems, setFormItems] = useState<ItemClasseII[]>([]);
  
  // --- Header State ---
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // --- Allocation State (Saved) ---
  const [categoryAllocations, setCategoryAllocations] = useState<Record<Categoria, CategoryAllocation>>(initialCategoryAllocations);
  
  // --- Allocation State (Temporary/Unsaved) ---
  const [tempND39Inputs, setTempND39Inputs] = useState<Record<Categoria, string>>(initialTempND39Inputs);
  const [tempDestinations, setTempDestinations] = useState<Record<Categoria, TempDestination>>(initialTempDestinations);
  
  // --- Current Tab State ---
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseII[]>([]);

  // --- Handlers for Header Component ---
  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };
  
  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setOrganizacao(omData.nome_om);
      setUg(omData.codug_om);
      
      // Initialize temporary destination OM for all categories to the OM Detentora
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
      setSelectedOmId(undefined);
      setOrganizacao("");
      setUg("");
      setTempDestinations(initialTempDestinations);
    }
  };
  // --- End Handlers for Header Component ---

  // --- Handlers for Category Items Component ---
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    newItems[itemIndex].quantidade = Math.max(0, quantity);
    setCurrentCategoryItems(newItems);
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
  
  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const { digits } = formatCurrencyInput(rawValue);
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: digits
      }));
  };

  const handleND39InputBlur = () => {
      const numericInput = getTempND39NumericValue(selectedTab, tempND39Inputs);
      const currentCategoryTotalValue = currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
      const nd39ValueTemp = Math.min(currentCategoryTotalValue, Math.max(0, numericInput));
      
      const finalDigits = String(Math.round(nd39ValueTemp * 100));
      setTempND39Inputs(prev => ({
          ...prev,
          [selectedTab]: finalDigits
      }));
  };
  
  const handleUpdateCategoryItems = () => {
    if (!organizacao || ug === "" || diasOperacao <= 0) {
        toast.error("Preencha a OM Detentora e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    const categoryTotalValue = currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

    const numericInput = getTempND39NumericValue(selectedTab, tempND39Inputs);
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
    const itemsFromOtherCategories = formItems.filter(item => item.categoria !== selectedTab);
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

    setFormItems(newFormItems);
    toast.success(`Itens e alocação de ND para ${getCategoryLabel(selectedTab)} atualizados!`);
  };
  // --- End Handlers for Category Items Component ---

  // --- Global Calculations ---
  const currentCategoryTotalValue = useMemo(() => {
      return currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
  }, [currentCategoryItems, diasOperacao]);
  
  const nd39NumericValue = useMemo(() => getTempND39NumericValue(selectedTab, tempND39Inputs), [selectedTab, tempND39Inputs]);
  const nd39ValueTemp = useMemo(() => {
      return Math.min(currentCategoryTotalValue, Math.max(0, nd39NumericValue));
  }, [currentCategoryTotalValue, nd39NumericValue]);
  const nd30ValueTemp = useMemo(() => currentCategoryTotalValue - nd39ValueTemp, [currentCategoryTotalValue, nd39ValueTemp]);
  
  const formattedND39Value = useMemo(() => {
      const digits = tempND39Inputs[selectedTab] || "";
      return formatCurrencyInput(digits).formatted;
  }, [selectedTab, tempND39Inputs]);
  
  const getCurrentFaseFinalString = useMemo(() => {
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    return fasesFinais.filter(f => f).join('; ');
  }, [fasesAtividade, customFaseAtividade]);
  
  const isCategoryAllocationDirty = useCallback((
      category: Categoria, 
      currentTotal: number, 
      allocation: CategoryAllocation, 
      tempInputs: Record<Categoria, string>, 
      tempDestinations: Record<Categoria, TempDestination>
  ): boolean => {
      if (!areNumbersEqual(allocation.total_valor, currentTotal)) {
          return true;
      }
      
      const tempND39Value = getTempND39NumericValue(category, tempInputs);
      if (!areNumbersEqual(tempND39Value, allocation.nd_39_value)) {
          return true;
      }
      
      const tempDest = tempDestinations[category];
      if (allocation.om_destino_recurso !== tempDest.om || allocation.ug_destino_recurso !== tempDest.ug) {
          if (currentTotal > 0) {
              return true;
          }
      }
      
      return false;
  }, []);
  // --- End Global Calculations ---

  // --- Data Fetching and Initialization ---
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
        setDiretrizes(defaultClasseIIConfig as DiretrizClasseII[]);
        return;
      }

      const { data: classeIIData, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", CATEGORIAS);

      if (error) throw error;

      if (classeIIData && classeIIData.length > 0) {
        setDiretrizes((classeIIData || []) as DiretrizClasseII[]);
      } else {
        setDiretrizes(defaultClasseIIConfig as DiretrizClasseII[]);
      }
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizes(defaultClasseIIConfig as DiretrizClasseII[]);
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_ii_registros")
      .select("*, itens_equipamentos, detalhamento_customizado, valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora")
      .eq("p_trab_id", ptrabId)
      .in("categoria", CATEGORIAS)
      .order("om_detentora", { ascending: true })
      .order("categoria", { ascending: true });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    const uniqueRecordsMap = new Map<string, ClasseIIRegistro>();
    (data || []).forEach(r => {
        const omDetentora = r.om_detentora || r.organizacao;
        const ugDetentora = r.ug_detentora || r.ug;
        const key = `${omDetentora}-${ugDetentora}-${r.categoria}`; 
        const record = {
            ...r,
            itens_equipamentos: (r.itens_equipamentos || []) as ItemClasseII[],
            valor_nd_30: Number(r.valor_nd_30),
            valor_nd_39: Number(r.valor_nd_39),
            efetivo: r.efetivo || 0, 
            om_detentora: omDetentora,
            ug_detentora: ugDetentora,
        } as ClasseIIRegistro;
        uniqueRecordsMap.set(key, record);
    });

    setRegistros(Array.from(uniqueRecordsMap.values()));
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
  
  // Efeito para sincronizar itens da aba atual e alocações temporárias
  useEffect(() => {
    // 1. Sincronizar itens da aba atual
    if (diretrizes.length > 0) {
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedTab)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                categoria: d.categoria as Categoria,
                memoria_customizada: null,
            }));

        const existingItemsMap = new Map<string, ItemClasseII>();
        formItems.filter(i => i.categoria === selectedTab).forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.item);
            return existing || availableItem;
        });

        setCurrentCategoryItems(mergedItems);
    } else {
        setCurrentCategoryItems([]);
    }
    
    // 2. Sincronizar alocações temporárias (ND 39 Input e OM Destino)
    const savedAllocation = categoryAllocations[selectedTab];
    
    const numericValue = parseInputToNumber(savedAllocation.nd_39_input);
    const digits = String(Math.round(numericValue * 100));
    
    setTempND39Inputs(prev => ({
        ...prev,
        [selectedTab]: digits
    }));
    
    if (savedAllocation.om_destino_recurso) {
        setTempDestinations(prev => ({
            ...prev,
            [selectedTab]: {
                om: savedAllocation.om_destino_recurso,
                ug: savedAllocation.ug_destino_recurso,
                id: savedAllocation.selectedOmDestinoId,
            }
        }));
    } else if (organizacao) {
        setTempDestinations(prev => ({
            ...prev,
            [selectedTab]: {
                om: organizacao,
                ug: ug,
                id: selectedOmId,
            }
        }));
    } else {
        setTempDestinations(prev => ({
            ...prev,
            [selectedTab]: { om: "", ug: "", id: undefined }
        }));
    }
      
  }, [selectedTab, diretrizes, formItems, categoryAllocations, organizacao, ug, selectedOmId]);
  // --- End Data Fetching and Initialization ---

  // --- Form Actions ---
  const resetFormFields = () => {
    setEditingId(null);
    setSelectedOmId(undefined);
    setOrganizacao("");
    setUg("");
    setEfetivo(0);
    setDiasOperacao(0);
    setFormItems([]);
    setCategoryAllocations(initialCategoryAllocations);
    setTempND39Inputs(initialTempND39Inputs);
    setTempDestinations(initialTempDestinations);
    setCurrentCategoryItems([]);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleEditarRegistro = async (registro: ClasseIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    const omDetentoraToEdit = registro.om_detentora;
    const ugDetentoraToEdit = registro.ug_detentora;
    const globalEfetivo = Number(registro.efetivo || 0);
    const globalDiasOperacao = Number(registro.dias_operacao || 0);
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    
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
    
    const { data: recordsForDetentora, error: fetchError } = await supabase
        .from("classe_ii_registros")
        .select("*, itens_equipamentos, valor_nd_30, valor_nd_39, efetivo, om_detentora, ug_detentora, dias_operacao, fase_atividade, organizacao, ug")
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", omDetentoraToEdit)
        .eq("ug_detentora", ugDetentoraToEdit)
        .in("categoria", CATEGORIAS);
        
    if (fetchError) {
        toast.error("Erro ao carregar todos os registros para edição.");
        setLoading(false);
        return;
    }
    
    let consolidatedItems: ItemClasseII[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    let tempND39Load: Record<Categoria, string> = { ...initialTempND39Inputs };
    let tempDestinationsLoad: Record<Categoria, TempDestination> = { ...initialTempDestinations };

    for (const r of (recordsForDetentora || [])) {
        const category = r.categoria as Categoria;

        const items: ItemClasseII[] = (r.itens_equipamentos as any[] || []).map(item => ({
            item: item.item,
            quantidade: Number(item.quantidade || 0),
            valor_mnt_dia: Number(item.valor_mnt_dia || 0),
            categoria: item.categoria,
            memoria_customizada: item.memoria_customizada || null,
        }));

        consolidatedItems = consolidatedItems.concat(items);

        let selectedOmDestinoId: string | undefined = undefined;
        if (r.organizacao && r.ug) {
            try {
                const { data: omData } = await supabase
                    .from('organizacoes_militares')
                    .select('id')
                    .eq('nome_om', r.organizacao)
                    .eq('codug_om', r.ug)
                    .maybeSingle();
                selectedOmDestinoId = omData?.id;
            } catch (e) { console.error(`Erro ao buscar OM Destino ID para ${category}:`, e); }
        }

        if (newAllocations[category]) {
            const currentDiasOperacao = globalDiasOperacao;
            const totalValor = items.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * currentDiasOperacao), 0);

            newAllocations[category] = {
                total_valor: totalValor,
                nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
                nd_30_value: Number(r.valor_nd_30),
                nd_39_value: Number(r.valor_nd_39),
                om_destino_recurso: r.organizacao,
                ug_destino_recurso: r.ug,
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
    
    setEditingId(registro.id); 
    setSelectedOmId(selectedOmIdForEdit);
    setOrganizacao(omDetentoraToEdit);
    setUg(ugDetentoraToEdit);
    setEfetivo(globalEfetivo); 
    setDiasOperacao(globalDiasOperacao); 
    setFormItems(consolidatedItems);
    
    setCategoryAllocations(newAllocations);
    setTempND39Inputs(tempND39Load); 
    setTempDestinations(tempDestinationsLoad);
    
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    if (consolidatedItems.length > 0) {
        setSelectedTab(registro.categoria as Categoria);
    } else {
        setSelectedTab(CATEGORIAS[0]);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };

  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!organizacao || ug === "") { toast.error("Selecione uma OM detentora"); return; }
    if (diasOperacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (efetivo <= 0) { toast.error("Efetivo deve ser maior que zero"); return; }
    if (formItems.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    const faseFinalString = getCurrentFaseFinalString;
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    const valorTotalForm = formItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
    const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
    const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);
    const totalAlocado = totalND30Final + totalND39Final;
    
    if (!areNumbersEqual(valorTotalForm, totalAlocado)) {
        toast.error("O valor total dos itens não corresponde ao total alocado. Clique em 'Salvar Itens da Categoria' em todas as abas ativas.");
        return;
    }

    setLoading(true);
    
    const itemsByActiveCategory = formItems.reduce((acc, item) => {
        if (item.quantidade > 0 && CATEGORIAS.includes(item.categoria as Categoria)) {
            if (!acc[item.categoria]) {
                acc[item.categoria] = [];
            }
            acc[item.categoria].push(item);
        }
        return acc;
    }, {} as Record<Categoria, ItemClasseII[]>);
    
    const categoriesToSave = Object.keys(itemsByActiveCategory) as Categoria[];
    
    if (categoriesToSave.length === 0) {
        toast.error("Nenhum item com quantidade maior que zero foi configurado.");
        setLoading(false);
        return;
    }
    
    const registrosParaSalvar: TablesInsert<'classe_ii_registros'>[] = [];
    
    for (const categoria of categoriesToSave) {
        const itens = itemsByActiveCategory[categoria];
        const allocation = categoryAllocations[categoria];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error(`Selecione a OM de destino do recurso para a categoria: ${getCategoryLabel(categoria)}.`);
            setLoading(false);
            return;
        }
        
        const valorTotalCategoria = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);
        
        if (!areNumbersEqual(valorTotalCategoria, (allocation.nd_30_value + allocation.nd_39_value))) {
            toast.error(`Erro de alocação na categoria ${getCategoryLabel(categoria)}: O valor total dos itens (${formatCurrency(valorTotalCategoria)}) não corresponde ao total alocado (${formatCurrency(allocation.nd_30_value + allocation.nd_39_value)}). Salve a categoria novamente.`);
            setLoading(false);
            return;
        }
        
        const detalhamento = generateDetalhamento(
            itens, 
            diasOperacao, 
            organizacao,
            ug,
            faseFinalString,
            allocation.om_destino_recurso,
            allocation.ug_destino_recurso,
            allocation.nd_30_value,
            allocation.nd_39_value,
            efetivo
        );
        
        const registro: TablesInsert<'classe_ii_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso,
            ug: allocation.ug_destino_recurso,
            om_detentora: organizacao,
            ug_detentora: ug,
            dias_operacao: diasOperacao,
            categoria: categoria,
            itens_equipamentos: itens as any,
            valor_total: valorTotalCategoria,
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            detalhamento_customizado: null,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
            efetivo: efetivo,
        };
        registrosParaSalvar.push(registro);
    }

    try {
      const { error: deleteError } = await supabase
        .from("classe_ii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("om_detentora", organizacao)
        .eq("ug_detentora", ug)
        .in("categoria", CATEGORIAS); 
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      const { error: insertError } = await supabase.from("classe_ii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success(editingId ? "Registros de Classe II atualizados com sucesso!" : "Registros de Classe II salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Classe II:", error);
      toast.error("Erro ao salvar registros de Classe II");
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string, memoria: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          detalhamento_customizado: memoria.trim() || null,
        })
        .eq("id", registroId);

      if (error) throw error;
      toast.success("Memória de cálculo atualizada com sucesso!");
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
        .from("classe_ii_registros")
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
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const omDetentora = registro.om_detentora;
        const ugDetentora = registro.ug_detentora;
        const key = `${omDetentora} (${ugDetentora})`;
        
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseIIRegistro[]>);
  }, [registros]);


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
              Classe II - Material de Intendência
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para manutenção de material de intendência.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <ClasseIIFormHeader
                selectedOmId={selectedOmId}
                organizacao={organizacao}
                ug={ug}
                efetivo={efetivo}
                dias_operacao={diasOperacao}
                fasesAtividade={fasesAtividade}
                customFaseAtividade={customFaseAtividade}
                isPopoverOpen={isPopoverOpen}
                onOMChange={handleOMChange}
                onEfetivoChange={setEfetivo}
                onDiasOperacaoChange={setDiasOperacao}
                onFaseChange={handleFaseChange}
                onCustomFaseChange={setCustomFaseAtividade}
                onPopoverOpenChange={setIsPopoverOpen}
            />

            {/* 2. Adicionar Itens por Categoria (Aba) */}
            {organizacao && diasOperacao > 0 && efetivo > 0 && (
              <ClasseIICategoryItems
                diasOperacao={diasOperacao}
                selectedTab={selectedTab}
                currentCategoryItems={currentCategoryItems}
                currentCategoryTotalValue={currentCategoryTotalValue}
                nd30ValueTemp={nd30ValueTemp}
                nd39ValueTemp={nd39ValueTemp}
                formattedND39Value={formattedND39Value}
                tempDestinations={tempDestinations}
                organizacaoDetentora={organizacao}
                onTabChange={setSelectedTab}
                onQuantityChange={handleQuantityChange}
                onND39InputChange={handleND39InputChange}
                onND39InputBlur={handleND39InputBlur}
                onOMDestinoChange={handleOMDestinoChange}
                onUpdateCategoryItems={handleUpdateCategoryItems}
              />
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {formItems.length > 0 && (
              <ClasseIIFormSummary
                loading={loading}
                editingId={editingId}
                organizacaoDetentora={organizacao}
                ugDetentora={ug}
                diasOperacao={diasOperacao}
                efetivo={efetivo}
                formItems={formItems}
                categoryAllocations={categoryAllocations}
                selectedTab={selectedTab}
                onFinalSave={handleSalvarRegistros}
                onResetForm={resetFormFields}
                isCategoryAllocationDirty={isCategoryAllocationDirty}
                tempND39Inputs={tempND39Inputs}
                tempDestinations={tempDestinations}
                currentCategoryItems={currentCategoryItems}
                currentCategoryTotalValue={currentCategoryTotalValue}
              />
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    const totalOM = omRegistros.reduce((sum, r) => sum + r.valor_total, 0);
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    const efetivo = omRegistros[0].efetivo; 
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    OM Detentora: {omName} (UG: {formatCodug(ug)})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(totalOM)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {omRegistros.map((registro) => {
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
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
                                                        Efetivo: {efetivo} | Dias: {registro.dias_operacao}
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
                                                                if (confirm(`Deseja realmente deletar o registro de Classe II para ${omName} (${registro.categoria})?`)) {
                                                                    supabase.from("classe_ii_registros")
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
                                                    <span className="text-muted-foreground">OM Destino:</span>
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
              <ClasseIIMemoriaViewer
                registros={registros}
                loading={loading}
                onSalvarMemoriaCustomizada={handleSalvarMemoriaCustomizada}
                onRestaurarMemoriaAutomatica={handleRestaurarMemoriaAutomatica}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ClasseIIForm;