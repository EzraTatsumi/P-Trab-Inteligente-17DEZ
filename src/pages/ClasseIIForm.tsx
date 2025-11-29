import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Package, Pencil, Trash2, XCircle, Check, ChevronDown, ClipboardList, Sparkles, DollarSign, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { DiretrizClasseII } from "@/types/diretrizesClasseII";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultClasseIIConfig } from "@/data/classeIIData";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Categoria = 'Equipamento Individual' | 'Proteção Balística' | 'Material de Estacionamento';

const CATEGORIAS: Categoria[] = [
  "Equipamento Individual",
  "Proteção Balística",
  "Material de Estacionamento",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: Categoria;
  memoria_customizada?: string | null;
}

interface FormDataClasseII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itens: ItemClasseII[]; // All items across all categories
  fase_atividade?: string; // Global
}

interface ClasseIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30)
  ug: string; // UG de Destino do Recurso (ND 30)
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[]; // Tipo corrigido
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  // NOVOS CAMPOS DO DB
  valor_nd_30: number;
  valor_nd_39: number;
}

interface CategoryAllocation {
  total_valor: number;
  nd_39_input: string; // User input string for ND 39
  nd_30_value: number; // Calculated ND 30 value
  nd_39_value: number; // Calculated ND 39 value
  // NEW: Destination fields (Per Category)
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialCategoryAllocations: Record<Categoria, CategoryAllocation> = {
    'Equipamento Individual': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Proteção Balística': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Material de Estacionamento': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
};

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Helper para agrupar itens de um registro por categoria
const groupRecordItemsByCategory = (items: ItemClasseII[]) => {
    return items.reduce((acc, item) => {
        if (!acc[item.categoria]) {
            acc[item.categoria] = [];
        }
        acc[item.categoria].push(item);
        return acc;
    }, {} as Record<Categoria, ItemClasseII[]>);
};

// Função para formatar fases (MOVIDA PARA O TOPO)
const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
  if (!faseCSV) return 'operação';
  
  const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
  
  if (fases.length === 0) return 'operação';
  if (fases.length === 1) return fases[0];
  if (fases.length === 2) return `${fases[0]} e ${fases[1]}`;
  
  const ultimaFase = fases[fases.length - 1];
  const demaisFases = fases.slice(0, -1).join(', ');
  return `${demaisFases} e ${ultimaFase}`;
};

// NOVO: Gera a memória de cálculo detalhada para uma categoria
const generateCategoryMemoriaCalculo = (categoria: Categoria, itens: ItemClasseII[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string | null | undefined): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const totalValor = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * diasOperacao), 0);

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        detalhamentoItens += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.\n`;
    });

    return `33.90.30 - Aquisição de Material de Intendência (${categoria})
OM de Destino: ${organizacao} (UG: ${ug})
Período: ${diasOperacao} dias de ${faseFormatada}
Total de Itens na Categoria: ${totalQuantidade}

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

Detalhes dos Itens:
${detalhamentoItens.trim()}

Valor Total da Categoria: ${formatCurrency(totalValor)}.`;
};

const generateDetalhamento = (itens: ItemClasseII[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string, omDestino: string, ugDestino: string, valorND30: number, valorND39: number): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;

    // 1. Agrupar itens por categoria e calcular o subtotal de valor por categoria
    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria;
        const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValor: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValor += valorItem;
        acc[categoria].totalQuantidade += item.quantidade;
        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.`
        );
        
        return acc;
    }, {} as Record<Categoria, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    // 2. Formatar a seção de cálculo agrupada
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        detalhamentoItens += `\n--- ${categoria.toUpperCase()} (${grupo.totalQuantidade} ITENS) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `33.90.30 / 33.90.39 - Aquisição de Material de Intendência (Diversos) para ${totalItens} itens, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;
  };


export default function ClasseIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  
  // NOVO ESTADO: Rastreia a alocação de ND por categoria
  const [categoryAllocations, setCategoryAllocations] = useState<Record<Categoria, CategoryAllocation>>(initialCategoryAllocations);
  // NOVO ESTADO: Input temporário para ND 39 da aba atual
  const [currentND39Input, setCurrentND39Input] = useState<string>("");
  
  // NOVO ESTADO: Lista de itens da categoria atual com quantidades editáveis
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseII[]>([]);
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  const formRef = useRef<HTMLDivElement>(null);

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
  
  // Efeito para sincronizar o input ND 39 ao mudar de aba
  useEffect(() => {
    setCurrentND39Input(categoryAllocations[selectedTab].nd_39_input);
  }, [selectedTab, categoryAllocations]);

  // Efeito para gerenciar a lista de itens da categoria atual
  useEffect(() => {
    // Só carrega se as diretrizes estiverem prontas e a OM estiver selecionada (para evitar resetar o form.itens)
    if (diretrizes.length > 0 && form.organizacao) {
        // 1. Obter todos os itens disponíveis para a aba atual
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedTab)
            .map(d => ({
                item: d.item,
                quantidade: 0, // Quantidade padrão
                valor_mnt_dia: Number(d.valor_mnt_dia),
                categoria: d.categoria as Categoria,
                memoria_customizada: null,
            }));

        // 2. Mapear itens existentes no formulário principal para a categoria atual
        const existingItemsMap = new Map<string, ItemClasseII>();
        form.itens.filter(i => i.categoria === selectedTab).forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        // 3. Mesclar: usar o item existente (com quantidade e memória) ou o item disponível (com quantidade 0)
        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.item);
            return existing || availableItem;
        });

        setCurrentCategoryItems(mergedItems);
    } else if (diretrizes.length > 0 && !form.organizacao) {
        // Se a OM não estiver selecionada, apenas mostra os itens disponíveis com quantidade 0
        const availableItems = diretrizes
            .filter(d => d.categoria === selectedTab)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                categoria: d.categoria as Categoria,
                memoria_customizada: null,
            }));
        setCurrentCategoryItems(availableItems);
    } else {
        setCurrentCategoryItems([]);
    }
  }, [selectedTab, diretrizes, form.itens, form.organizacao, form.dias_operacao]);


  const itensDisponiveis = useMemo(() => {
    return diretrizes.filter(d => d.categoria === selectedTab);
  }, [diretrizes, selectedTab]);
  
  // MEMO: Agrupa os itens do formulário por categoria para exibição consolidada
  const itensAgrupadosPorCategoria = useMemo(() => {
    return form.itens.reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<Categoria, ItemClasseII[]>);
  }, [form.itens]);
  

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentYear = new Date().getFullYear();
      let anoReferencia = currentYear;

      const { data: diretrizCusteio } = await supabase
        .from("diretrizes_custeio")
        .select("ano_referencia")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (diretrizCusteio) {
        anoReferencia = diretrizCusteio.ano_referencia;
      } else {
        toast.warning(`Diretriz de Custeio não encontrada para o ano ${currentYear}. Por favor, configure em 'Configurações > Diretriz de Custeio'.`);
      }

      const { data: classeIIData, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true);

      if (error) throw error;

      if (classeIIData && classeIIData.length > 0) {
        setDiretrizes((classeIIData || []) as DiretrizClasseII[]);
      } else {
        setDiretrizes(defaultClasseIIConfig as DiretrizClasseII[]);
        toast.warning(`Itens de Classe II não configurados para o ano ${anoReferencia}. Usando valores padrão.`);
      }
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizes(defaultClasseIIConfig as DiretrizClasseII[]);
      toast.error("Erro ao carregar diretrizes. Usando valores padrão.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_ii_registros")
      .select("*, itens_equipamentos, detalhamento_customizado, valor_nd_30, valor_nd_39")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true }) // Ordenar por OM
      .order("categoria", { ascending: true }); // E depois por categoria

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    // A edição agora é feita por registro (que representa uma categoria)
    const uniqueRecordsMap = new Map<string, ClasseIIRegistro>();
    (data || []).forEach(r => {
        const key = `${r.organizacao}-${r.ug}-${r.categoria}`; // Chave única por OM de destino E Categoria
        const record = {
            ...r,
            itens_equipamentos: (r.itens_equipamentos || []) as ItemClasseII[],
            valor_nd_30: Number(r.valor_nd_30),
            valor_nd_39: Number(r.valor_nd_39),
        } as ClasseIIRegistro;
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
    
    setCategoryAllocations(initialCategoryAllocations); // Reset allocations
    setCurrentND39Input(""); // Reset current input
    
    setCurrentCategoryItems([]);
    
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ 
        ...form, 
        selectedOmId: omData.id, 
        organizacao: omData.nome_om, 
        ug: omData.codug_om,
      });
      
      // Initialize destination OM for all categories to the OM Detentora
      const newAllocations = CATEGORIAS.reduce((acc, cat) => {
          acc[cat] = {
              ...categoryAllocations[cat],
              om_destino_recurso: omData.nome_om,
              ug_destino_recurso: omData.codug_om,
              selectedOmDestinoId: omData.id,
          };
          return acc;
      }, {} as Record<Categoria, CategoryAllocation>);
      setCategoryAllocations(newAllocations);
      
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      });
      
      // Clear destination OM for all categories
      const newAllocations = CATEGORIAS.reduce((acc, cat) => {
          acc[cat] = {
              ...categoryAllocations[cat],
              om_destino_recurso: "",
              ug_destino_recurso: "",
              selectedOmDestinoId: undefined,
          };
          return acc;
      }, {} as Record<Categoria, CategoryAllocation>);
      setCategoryAllocations(newAllocations);
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setCategoryAllocations(prev => ({
        ...prev,
        [selectedTab]: {
            ...prev[selectedTab],
            om_destino_recurso: omData?.nome_om || "",
            ug_destino_recurso: omData?.codug_om || "",
            selectedOmDestinoId: omData?.id,
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

  // NOVO HANDLER: Atualiza a quantidade de um item na lista expandida
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    // Garante que a quantidade não seja negativa
    newItems[itemIndex].quantidade = Math.max(0, quantity);
    setCurrentCategoryItems(newItems);
  };

  // ND Calculation and Input Handlers (Temporary for current tab)
  const currentCategoryTotalValue = currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
  const nd39ValueTemp = Math.min(currentCategoryTotalValue, Math.max(0, parseInputToNumber(currentND39Input)));
  const nd30ValueTemp = currentCategoryTotalValue - nd39ValueTemp;

  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setCurrentND39Input(formatInputWithThousands(rawValue));
  };

  const handleND39InputBlur = () => {
      const numericValue = parseInputToNumber(currentND39Input);
      const finalND39Value = Math.min(currentCategoryTotalValue, Math.max(0, numericValue));
      setCurrentND39Input(formatNumberForInput(finalND39Value, 2));
  };

  // NOVO HANDLER: Salva os itens da lista expandida para o form.itens principal
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    // 1. Calculate total value for items currently in the tab
    const categoryTotalValue = currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);

    // 2. Calculate final ND split for this category based on current input
    const numericInput = parseInputToNumber(currentND39Input);
    const finalND39Value = Math.min(categoryTotalValue, Math.max(0, numericInput));
    const finalND30Value = categoryTotalValue - finalND39Value;
    
    if (categoryTotalValue > 0 && !areNumbersEqual(finalND30Value + finalND39Value, categoryTotalValue)) {
        toast.error("Erro de cálculo: A soma de ND 30 e ND 39 deve ser igual ao Total da Categoria.");
        return;
    }
    
    if (categoryTotalValue > 0 && (!categoryAllocations[selectedTab].om_destino_recurso || !categoryAllocations[selectedTab].ug_destino_recurso)) {
        toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
        return;
    }

    // 3. Itens válidos da categoria atual (quantidade > 0)
    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);

    // 4. Itens de outras categorias no formulário principal
    const otherCategoryItems = form.itens.filter(item => item.categoria !== selectedTab);

    // 5. Mesclar as listas
    const newFormItems = [...otherCategoryItems, ...itemsToKeep];

    // 6. Update allocation state for the current category (including destination fields which might have been updated)
    setCategoryAllocations(prev => ({
        ...prev,
        [selectedTab]: {
            ...prev[selectedTab], // Keep existing destination fields
            total_valor: categoryTotalValue,
            nd_39_input: formatNumberForInput(finalND39Value, 2), // Store the final formatted input
            nd_30_value: finalND30Value,
            nd_39_value: finalND39Value,
        }
    }));

    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens e alocação de ND para ${selectedTab} atualizados!`);
  };
  
  // Lógica de cálculo de alocação (Global Totals)
  const valorTotalForm = form.itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);

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
    
    // 1. Agrupar itens por categoria que possuem quantidade > 0
    const itemsByActiveCategory = form.itens.reduce((acc, item) => {
        if (item.quantidade > 0) {
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
    
    // 2. Iterar sobre as categorias ativas e criar um registro para cada
    for (const categoria of categoriesToSave) {
        const itens = itemsByActiveCategory[categoria];
        const allocation = categoryAllocations[categoria];
        
        if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
            toast.error(`Selecione a OM de destino do recurso para a categoria: ${categoria}.`);
            setLoading(false);
            return;
        }
        
        const valorTotalCategoria = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
        
        // Final check: Ensure total allocated matches total calculated value for this category
        if (!areNumbersEqual(valorTotalCategoria, (allocation.nd_30_value + allocation.nd_39_value))) {
            toast.error(`Erro de alocação na categoria ${categoria}: O valor total dos itens (${formatCurrency(valorTotalCategoria)}) não corresponde ao total alocado (${formatCurrency(allocation.nd_30_value + allocation.nd_39_value)}). Salve a categoria novamente.`);
            setLoading(false);
            return;
        }
        
        const detalhamento = generateDetalhamento(
            itens, 
            form.dias_operacao, 
            form.organizacao, // OM Detentora
            form.ug, // UG Detentora
            faseFinalString,
            allocation.om_destino_recurso, // OM de Destino do Recurso (ND 30/39)
            allocation.ug_destino_recurso, // UG de Destino do Recurso (ND 30/39)
            allocation.nd_30_value,
            allocation.nd_39_value
        );
        
        const registro: TablesInsert<'classe_ii_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso, // OM de destino do recurso (ND 30/39)
            ug: allocation.ug_destino_recurso, // UG de destino do recurso
            dias_operacao: form.dias_operacao,
            categoria: categoria, // Salvar a categoria como o tipo de registro
            itens_equipamentos: itens as any,
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
      // 3. Deletar TODOS os registros existentes para o PTrab (pois estamos salvando por categoria)
      const { error: deleteError } = await supabase
        .from("classe_ii_registros")
        .delete()
        .eq("p_trab_id", ptrabId);
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      // 4. Inserir os novos registros (um por categoria ativa)
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

  const handleEditarRegistro = async (registro: ClasseIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    // 1. Buscar TODOS os registros para este PTrab (pois a edição é consolidada)
    const { data: allRecords, error: fetchAllError } = await supabase
        .from("classe_ii_registros")
        .select("*, itens_equipamentos, valor_nd_30, valor_nd_39")
        .eq("p_trab_id", ptrabId);
        
    if (fetchAllError) {
        toast.error("Erro ao carregar todos os registros para edição.");
        setLoading(false);
        return;
    }
    
    // 2. Consolidar todos os itens em um único array (form.itens)
    let consolidatedItems: ItemClasseII[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    let firstOmDetentora: { nome: string, ug: string } | null = null;
    
    (allRecords || []).forEach(r => {
        const category = r.categoria as Categoria;
        const items = (r.itens_equipamentos || []) as ItemClasseII[];
        
        // Adicionar itens ao array consolidado
        consolidatedItems = consolidatedItems.concat(items);
        
        // Preencher a alocação para a categoria
        if (newAllocations[category]) {
            const totalValor = items.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * r.dias_operacao), 0);
            
            newAllocations[category] = {
                total_valor: totalValor,
                nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
                nd_30_value: Number(r.valor_nd_30),
                nd_39_value: Number(r.valor_nd_39),
                om_destino_recurso: r.organizacao,
                ug_destino_recurso: r.ug,
                selectedOmDestinoId: undefined, // Será preenchido abaixo
            };
        }
        
        // Capturar a OM Detentora (assumindo que é a mesma que a OM de Destino do Recurso)
        if (!firstOmDetentora) {
            // Nota: O campo 'organizacao' no DB é a OM de Destino do Recurso.
            // Para fins de edição, assumimos que a OM Detentora é a mesma que a OM de Destino do Recurso (organizacao/ug)
            firstOmDetentora = { nome: r.organizacao, ug: r.ug };
        }
    });
    
    // 3. Buscar IDs das OMs de Destino e Detentora
    let selectedOmIdForEdit: string | undefined = undefined;
    
    if (firstOmDetentora) {
        try {
            const { data: omData } = await supabase
                .from('organizacoes_militares')
                .select('id')
                .eq('nome_om', firstOmDetentora.nome)
                .eq('codug_om', firstOmDetentora.ug)
                .maybeSingle();
            selectedOmIdForEdit = omData?.id;
        } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    }
    
    // 4. Preencher o formulário principal
    setEditingId(registro.id); 
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: firstOmDetentora?.nome || "",
      ug: firstOmDetentora?.ug || "",
      dias_operacao: registro.dias_operacao,
      itens: consolidatedItems,
    });
    
    // 5. Preencher o estado de alocação e buscar IDs de destino
    const categoriesToLoad = Object.keys(newAllocations) as Categoria[];
    for (const cat of categoriesToLoad) {
        const alloc = newAllocations[cat];
        if (alloc.om_destino_recurso) {
            try {
                const { data: omData } = await supabase
                    .from('organizacoes_militares')
                    .select('id')
                    .eq('nome_om', alloc.om_destino_recurso)
                    .eq('codug_om', alloc.ug_destino_recurso)
                    .maybeSingle();
                alloc.selectedOmDestinoId = omData?.id;
            } catch (e) { console.error(`Erro ao buscar OM Destino ID para ${cat}:`, e); }
        }
    }
    setCategoryAllocations(newAllocations);
    
    // 6. Preencher fases e aba
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    if (consolidatedItems.length > 0) {
        setSelectedTab(consolidatedItems[0].categoria);
    } else {
        setSelectedTab(CATEGORIAS[0]);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  // NOVO MEMO: Agrupa os registros por OM de Destino
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${registro.ug})`;
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
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Equipamento *</Label>
                  <OmSelector
                    selectedOmId={form.selectedOmId}
                    onChange={handleOMChange}
                    placeholder="Selecione a OM..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>UG Detentora</Label>
                  <Input value={form.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
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
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
              
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
                        {fasesAtividade.length === 0 && !customFaseAtividade.trim()
                          ? "Selecione as fases..."
                          : [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ')}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                              <span>{fase}</span>
                              <Checkbox
                                checked={fasesAtividade.includes(fase)}
                                onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                              />
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
              </div>
            </div>

            {/* 2. Adicionar Itens por Categoria (Aba) - REESTRUTURADO PARA TABELA */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-3">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                            <Table className="w-full">
                                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead className="w-[50%]">Item</TableHead>
                                        <TableHead className="w-[20%] text-right">Valor/Dia</TableHead>
                                        <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                                        <TableHead className="w-[15%] text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentCategoryItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                Nenhum item de diretriz encontrado para esta categoria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentCategoryItems.map((item, index) => {
                                            const itemTotal = item.quantidade * item.valor_mnt_dia * form.dias_operacao;
                                            
                                            return (
                                                <TableRow key={item.item} className="h-12">
                                                    <TableCell className="font-medium text-sm py-1">
                                                        {item.item}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                        {formatCurrency(item.valor_mnt_dia)}
                                                    </TableCell>
                                                    <TableCell className="py-1">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                            value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                                            placeholder="0"
                                                            onKeyDown={handleEnterToNextField}
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
                            <span className="font-bold text-sm">TOTAL DA CATEGORIA</span>
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(currentCategoryTotalValue)}
                            </span>
                        </div>
                        
                        {/* NOVO BLOCO DE ALOCAÇÃO ND 30/39 */}
                        {currentCategoryTotalValue > 0 && (
                            <div className="space-y-4 p-4 border rounded-lg bg-background">
                                <h4 className="font-semibold text-sm">Alocação de Recursos para {cat}</h4>
                                
                                {/* CAMPO: OM de Destino do Recurso */}
                                <div className="space-y-2">
                                    <Label>OM de Destino do Recurso *</Label>
                                    <OmSelector
                                        selectedOmId={categoryAllocations[cat].selectedOmDestinoId}
                                        onChange={handleOMDestinoChange}
                                        placeholder="Selecione a OM que receberá o recurso..."
                                        disabled={!form.organizacao} 
                                    />
                                    {categoryAllocations[cat].ug_destino_recurso && (
                                        <p className="text-xs text-muted-foreground">
                                            UG de Destino: {categoryAllocations[cat].ug_destino_recurso}
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
                                                className="pl-8 text-lg font-bold bg-green-500/10 text-green-600 disabled:opacity-100"
                                            />
                                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                                                value={currentND39Input}
                                                onChange={handleND39InputChange}
                                                onBlur={handleND39InputBlur}
                                                placeholder="0,00"
                                                className="pl-8 text-lg"
                                                disabled={currentCategoryTotalValue === 0}
                                                onKeyDown={handleEnterToNextField}
                                            />
                                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                        {/* FIM NOVO BLOCO DE ALOCAÇÃO */}

                        <div className="flex justify-end">
                            <Button 
                                type="button" 
                                onClick={handleUpdateCategoryItems} 
                                className="w-full md:w-auto" 
                                disabled={!form.organizacao || form.dias_operacao <= 0 || !areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) || (currentCategoryTotalValue > 0 && !categoryAllocations[cat].om_destino_recurso)}
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
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.length})</h3>
                
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
                    const totalCategoria = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
                    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                    
                    // Busca a alocação salva para esta categoria
                    const allocation = categoryAllocations[categoria as Categoria];
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{categoria} ({totalQuantidade} itens)</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => (
                            <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                              <span className="font-medium">{item.item}</span>
                              <span className="text-right">
                                {item.quantidade} un. x {formatCurrency(item.valor_mnt_dia)}/dia = {formatCurrency(item.quantidade * item.valor_mnt_dia * form.dias_operacao)}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Exibe a alocação salva */}
                        <div className="pt-2 border-t mt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className="font-medium text-foreground">
                                    {allocation.om_destino_recurso} ({allocation.ug_destino_recurso})
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
                            {!areNumbersEqual(allocation.total_valor, totalCategoria) && (
                                <p className="text-xs text-destructive flex items-center gap-1 pt-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Valores desatualizados. Salve a categoria novamente.
                                </p>
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
                    const totalOM = omRegistros.reduce((sum, r) => sum + r.valor_total, 0);
                    const omName = omKey.split(' (')[0];
                    const ug = omKey.split(' (')[1].replace(')', '');
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    {omName} (UG: {ug})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(totalOM)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {omRegistros.map((registro) => {
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <h4 className="font-semibold text-base text-foreground">
                                                        {registro.categoria}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {registro.dias_operacao} | Fases: {fases}
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

            {/* 5. Memórias de Cálculos Detalhadas - AGORA POR CATEGORIA */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Memórias de Cálculos Detalhadas (Por Categoria)
                </h2>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  const memoriaExibida = registro.detalhamento_customizado || registro.detalhamento || "";
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      <h4 className="text-lg font-semibold text-foreground">
                        OM Destino: {om} ({ug}) - Categoria: {registro.categoria}
                      </h4>
                      
                      <div className="flex items-center justify-end gap-2 mb-4">
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