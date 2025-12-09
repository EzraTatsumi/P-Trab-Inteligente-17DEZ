import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronsUpDown, Sparkles, AlertCircle, HeartPulse, PawPrint } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCategoryBadgeStyle, getCategoryLabel } from "@/lib/badgeUtils";
import { defaultClasseVIIISaudeConfig, defaultClasseVIIIRemontaConfig } from "@/data/classeVIIIData";

type Categoria = 'Saúde' | 'Remonta/Veterinária';

const CATEGORIAS: Categoria[] = [
  "Saúde",
  "Remonta/Veterinária",
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemSaude {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: 'Saúde';
}

interface ItemRemonta {
  item: string;
  quantidade: number; // Quantidade de itens (ex: selas, ração)
  quantidade_animais: number; // Quantidade de animais (Equino ou Canino)
  valor_mnt_dia: number;
  categoria: 'Remonta/Veterinária';
}

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itensSaude: ItemSaude[];
  itensRemonta: ItemRemonta[];
  fase_atividade?: string; // Global
}

interface ClasseVIIIRegistroSaude {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string; // 'Saúde - KPSI/KPT'
  itens_saude: ItemSaude[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface ClasseVIIIRegistroRemonta {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string; // 'Remonta/Veterinária'
  animal_tipo: 'Equino' | 'Canino';
  quantidade_animais: number;
  itens_remonta: ItemRemonta[];
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

type ClasseVIIIRegistro = ClasseVIIIRegistroSaude | ClasseVIIIRegistroRemonta;

interface CategoryAllocation {
  total_valor: number;
  nd_39_input: string; // User input string for ND 39
  nd_30_value: number; // Calculated ND 30 value
  nd_39_value: number; // Calculated ND 39 value
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialCategoryAllocations: Record<Categoria, CategoryAllocation> = {
    'Saúde': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
    'Remonta/Veterinária': { total_valor: 0, nd_39_input: "", nd_30_value: 0, nd_39_value: 0, om_destino_recurso: "", ug_destino_recurso: "", selectedOmDestinoId: undefined },
};

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

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

// --- Cálculo de Itens ---

const calculateSaudeItemTotal = (item: ItemSaude, diasOperacao: number): number => {
    // Saúde: Valor Mnt/Dia * Quantidade de Kits
    return item.valor_mnt_dia * item.quantidade;
};

const calculateRemontaItemTotal = (item: ItemRemonta): number => {
    // Remonta: Valor Mnt/Dia * Quantidade de Animais (ou 1 se for item anual/mensal)
    // A lógica de cálculo é complexa e depende da unidade (Diário, Mensal, Anual).
    // Por enquanto, vamos assumir que o valor_mnt_dia já reflete o custo total do item para o período.
    // Se o item for diário, multiplicamos pelos dias de operação.
    
    const isDiario = item.item.includes('(Diário)');
    const isMensal = item.item.includes('(Mensal)');
    const isAnual = item.item.includes('(Anual)');
    
    let total = 0;
    
    if (isDiario) {
        // Custo Mnt/Dia Op (Diário) * Qtd Animais * Dias de Operação
        total = item.valor_mnt_dia * item.quantidade_animais * item.quantidade;
    } else if (isMensal) {
        // Custo Mensal * Qtd Animais * (Dias de Operação / 30)
        // Simplificação: Custo Mensal * Qtd Animais
        total = item.valor_mnt_dia * item.quantidade_animais * item.quantidade;
    } else if (isAnual) {
        // Custo Anual * Qtd Animais
        total = item.valor_mnt_dia * item.quantidade_animais * item.quantidade;
    } else {
        // Default: Valor Mnt/Dia * Qtd Animais * Qtd Itens
        total = item.valor_mnt_dia * item.quantidade_animais * item.quantidade;
    }
    
    return total;
};

// --- Geração de Memória ---

const generateSaudeMemoriaCalculo = (itens: ItemSaude[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string, omDestino: string, ugDestino: string, valorND30: number, valorND39: number): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = calculateSaudeItemTotal(item, diasOperacao);
        detalhamentoItens += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/un = ${formatCurrency(valorItem)}.\n`;
    });

    return `33.90.30 / 33.90.39 - Aquisição de Material de Saúde (Classe VIII) para ${totalItens} kits, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula Base: Nr Kits x Valor Mnt/Dia.

Detalhes dos Itens:
${detalhamentoItens.trim()}

Valor Total da Categoria: ${formatCurrency(valorTotal)}.`;
};

const generateRemontaMemoriaCalculo = (animalTipo: 'Equino' | 'Canino', itens: ItemRemonta[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string, omDestino: string, ugDestino: string, valorND30: number, valorND39: number): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const nrAnimais = itens[0]?.quantidade_animais || 0;
    const valorTotal = valorND30 + valorND39;

    let detalhamentoItens = "";
    itens.forEach(item => {
        const valorItem = calculateRemontaItemTotal(item);
        detalhamentoItens += `- ${item.quantidade} ${item.item} x ${nrAnimais} animais = ${formatCurrency(valorItem)}.\n`;
    });

    return `33.90.30 / 33.90.39 - Aquisição de Material de Remonta/Veterinária (Classe VIII) para ${nrAnimais} ${animalTipo}(s), durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Animais.

Detalhes dos Itens:
${detalhamentoItens.trim()}

Valor Total da Categoria: ${formatCurrency(valorTotal)}.`;
};


const ClasseVIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseVIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itensSaude: [],
    itensRemonta: [],
  });
  
  const [categoryAllocations, setCategoryAllocations] = useState<Record<Categoria, CategoryAllocation>>(initialCategoryAllocations);
  const [currentND39Input, setCurrentND39Input] = useState<string>("");
  
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemSaude[] | ItemRemonta[]>([]);
  
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
  
  useEffect(() => {
    setCurrentND39Input(categoryAllocations[selectedTab].nd_39_input);
  }, [selectedTab, categoryAllocations]);

  // Efeito para carregar itens da aba atual
  useEffect(() => {
    if (diretrizes.length > 0 && form.organizacao) {
        const categoryKey = selectedTab;
        const isSaude = categoryKey === 'Saúde';
        const currentItems = isSaude ? form.itensSaude : form.itensRemonta;
        
        const availableItems = diretrizes
            .filter(d => d.categoria === categoryKey)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                quantidade_animais: 0, // Apenas para Remonta
                valor_mnt_dia: Number(d.valor_mnt_dia),
                categoria: categoryKey,
            }));

        const existingItemsMap = new Map<string, ItemSaude | ItemRemonta>();
        currentItems.forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        const mergedItems = availableItems.map(availableItem => {
            const existing = existingItemsMap.get(availableItem.item);
            if (existing) {
                return existing;
            }
            // Garante que o tipo correto seja retornado
            return availableItem as ItemSaude | ItemRemonta;
        });

        setCurrentCategoryItems(mergedItems);
    } else if (diretrizes.length > 0 && !form.organizacao) {
        const categoryKey = selectedTab;
        const availableItems = diretrizes
            .filter(d => d.categoria === categoryKey)
            .map(d => ({
                item: d.item,
                quantidade: 0,
                quantidade_animais: 0,
                valor_mnt_dia: Number(d.valor_mnt_dia),
                categoria: categoryKey,
            }));
        setCurrentCategoryItems(availableItems as ItemSaude[] | ItemRemonta[]);
    } else {
        setCurrentCategoryItems([]);
    }
  }, [selectedTab, diretrizes, form.itensSaude, form.itensRemonta, form.organizacao, form.dias_operacao]);

  const itensAgrupadosPorCategoria = useMemo(() => {
    const allItems = [...form.itensSaude, ...form.itensRemonta];
    return allItems.reduce((acc, item) => {
      const category = item.categoria;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<Categoria, (ItemSaude | ItemRemonta)[]>);
  }, [form.itensSaude, form.itensRemonta]);
  

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
        setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaConfig] as DiretrizClasseII[]);
        return;
      }

      const { data: classeVIIIData, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", CATEGORIAS);

      if (error) throw error;

      if (classeVIIIData && classeVIIIData.length > 0) {
        setDiretrizes((classeVIIIData || []) as DiretrizClasseII[]);
      } else {
        setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaConfig] as DiretrizClasseII[]);
        toast.warning(`Itens de Classe VIII não configurados para o ano ${anoReferencia}. Usando valores padrão.`);
      }
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaConfig] as DiretrizClasseII[]);
      toast.error("Erro ao carregar diretrizes. Usando valores padrão.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const [
        { data: saudeData, error: saudeError },
        { data: remontaData, error: remontaError }
    ] = await Promise.all([
        supabase
            .from("classe_viii_saude_registros")
            .select("*, detalhamento_customizado, valor_nd_30, valor_nd_39"),
        supabase
            .from("classe_viii_remonta_registros")
            .select("*, detalhamento_customizado, valor_nd_30, valor_nd_39"),
    ]);

    if (saudeError) { console.error("Erro ao carregar registros de Saúde:", saudeError); }
    if (remontaError) { console.error("Erro ao carregar registros de Remonta:", remontaError); }

    const allRecords: ClasseVIIIRegistro[] = [
        ...(saudeData || []).map(r => ({ ...r, itens_saude: (r.itens_saude || []) as ItemSaude[] }) as ClasseVIIIRegistroSaude),
        ...(remontaData || []).map(r => ({ ...r, itens_remonta: (r.itens_remonta || []) as ItemRemonta[] }) as ClasseVIIIRegistroRemonta),
    ];

    setRegistros(allRecords.sort((a, b) => a.organizacao.localeCompare(b.organizacao)));
  };

  const reconstructFormState = (records: ClasseVIIIRegistro[]) => {
    if (records.length === 0) {
        resetFormFields();
        return;
    }
    
    // Agrupar por OM/UG
    const groupedByOm = records.reduce((acc, r) => {
        const key = `${r.organizacao}-${r.ug}`;
        if (!acc[key]) acc[key] = { saude: [], remonta: [] };
        if (r.categoria === 'Saúde - KPSI/KPT') {
            acc[key].saude.push(r as ClasseVIIIRegistroSaude);
        } else {
            acc[key].remonta.push(r as ClasseVIIIRegistroRemonta);
        }
        return acc;
    }, {} as Record<string, { saude: ClasseVIIIRegistroSaude[], remonta: ClasseVIIIRegistroRemonta[] }>);
    
    // Assumimos que estamos editando a primeira OM encontrada
    const firstOmKey = Object.keys(groupedByOm)[0];
    const firstOmGroup = groupedByOm[firstOmKey];
    
    const firstRecord = firstOmGroup.saude[0] || firstOmGroup.remonta[0];
    if (!firstRecord) {
        resetFormFields();
        return;
    }
    
    // 1. Extrair dados globais
    const omName = firstRecord.organizacao;
    const ug = firstRecord.ug;
    const diasOperacao = firstRecord.dias_operacao;
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    // 2. Consolidar Itens e Alocações
    let consolidatedSaude: ItemSaude[] = [];
    let consolidatedRemonta: ItemRemonta[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    
    // Saúde
    if (firstOmGroup.saude.length > 0) {
        const r = firstOmGroup.saude[0];
        consolidatedSaude = r.itens_saude;
        const totalValor = consolidatedSaude.reduce((sum, item) => sum + calculateSaudeItemTotal(item, diasOperacao), 0);
        newAllocations['Saúde'] = {
            total_valor: totalValor,
            nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
            nd_30_value: Number(r.valor_nd_30),
            nd_39_value: Number(r.valor_nd_39),
            om_destino_recurso: r.organizacao,
            ug_destino_recurso: r.ug,
            selectedOmDestinoId: undefined,
        };
    }
    
    // Remonta
    if (firstOmGroup.remonta.length > 0) {
        const totalRemonta = firstOmGroup.remonta.reduce((sum, r) => sum + r.valor_total, 0);
        const totalND30 = firstOmGroup.remonta.reduce((sum, r) => sum + r.valor_nd_30, 0);
        const totalND39 = firstOmGroup.remonta.reduce((sum, r) => sum + r.valor_nd_39, 0);
        
        // Consolidar itens de Remonta (Equino e Canino)
        firstOmGroup.remonta.forEach(r => {
            consolidatedRemonta = consolidatedRemonta.concat(r.itens_remonta);
        });
        
        const r = firstOmGroup.remonta[0];
        newAllocations['Remonta/Veterinária'] = {
            total_valor: totalRemonta,
            nd_39_input: formatNumberForInput(totalND39, 2),
            nd_30_value: totalND30,
            nd_39_value: totalND39,
            om_destino_recurso: r.organizacao,
            ug_destino_recurso: r.ug,
            selectedOmDestinoId: undefined,
        };
    }
    
    // 3. Fetch OM IDs
    const fetchOmId = async (nome: string, ug: string) => {
      if (!nome || !ug) return undefined;
      const { data } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', nome)
        .eq('codug_om', ug)
        .maybeSingle();
      return data?.id;
    };
    
    Promise.all([
      fetchOmId(omName, ug),
      fetchOmId(newAllocations['Saúde'].om_destino_recurso, newAllocations['Saúde'].ug_destino_recurso),
      fetchOmId(newAllocations['Remonta/Veterinária'].om_destino_recurso, newAllocations['Remonta/Veterinária'].ug_destino_recurso),
    ]).then(([omDataId, saudeOmId, remontaOmId]) => {
      setForm({
        selectedOmId: omDataId,
        organizacao: omName,
        ug: ug,
        dias_operacao: diasOperacao,
        itensSaude: consolidatedSaude,
        itensRemonta: consolidatedRemonta,
      });
      
      setCategoryAllocations(prev => ({
        ...prev,
        'Saúde': { ...newAllocations['Saúde'], selectedOmDestinoId: saudeOmId },
        'Remonta/Veterinária': { ...newAllocations['Remonta/Veterinária'], selectedOmDestinoId: remontaOmId },
      }));
      
      setEditingId(firstRecord.id);
      setSelectedTab(firstOmGroup.saude.length > 0 ? 'Saúde' : 'Remonta/Veterinária');
    });
  };

  const resetFormFields = () => {
    setEditingId(null);
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itensSaude: [],
      itensRemonta: [],
    });
    
    setCategoryAllocations(initialCategoryAllocations);
    setCurrentND39Input("");
    
    setCurrentCategoryItems([]);
    
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm(prev => ({ 
        ...prev, 
        selectedOmId: omData.id, 
        organizacao: omData.nome_om, 
        ug: omData.codug_om,
      }));
      
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
      setForm(prev => ({ 
        ...prev, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      }));
      
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

  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    const item = newItems[itemIndex];
    
    if (item.categoria === 'Saúde') {
        (item as ItemSaude).quantidade = Math.max(0, quantity);
    } else {
        (item as ItemRemonta).quantidade = Math.max(0, quantity);
    }
    setCurrentCategoryItems(newItems);
  };
  
  const handleQuantityAnimalsChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    const item = newItems[itemIndex];
    
    if (item.categoria === 'Remonta/Veterinária') {
        // Atualiza a quantidade de animais em TODOS os itens de Remonta
        const updatedItems = (newItems as ItemRemonta[]).map(i => ({
            ...i,
            quantidade_animais: Math.max(0, quantity),
        }));
        setCurrentCategoryItems(updatedItems);
    }
  };
  
  const handleDiasOperacaoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value.replace(/\D/g, '')) || 0;
    setForm({ ...form, dias_operacao: value });
  };

  const valorTotalSaude = form.itensSaude.reduce((sum, item) => sum + calculateSaudeItemTotal(item, form.dias_operacao), 0);
  const valorTotalRemonta = form.itensRemonta.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
  
  const currentCategoryTotalValue = selectedTab === 'Saúde' 
    ? (currentCategoryItems as ItemSaude[]).reduce((sum, item) => sum + calculateSaudeItemTotal(item, form.dias_operacao), 0)
    : (currentCategoryItems as ItemRemonta[]).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);

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

  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Atividade (Global) antes de salvar itens.");
        return;
    }
    
    const categoryTotalValue = currentCategoryItems.reduce((sum, item) => 
        item.categoria === 'Saúde' 
            ? sum + calculateSaudeItemTotal(item as ItemSaude, form.dias_operacao)
            : sum + calculateRemontaItemTotal(item as ItemRemonta)
    , 0);

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

    const itemsToKeep = currentCategoryItems.filter(item => 
        item.categoria === 'Saúde' 
            ? (item as ItemSaude).quantidade > 0
            : (item as ItemRemonta).quantidade > 0 && (item as ItemRemonta).quantidade_animais > 0
    );

    setCategoryAllocations(prev => ({
        ...prev,
        [selectedTab]: {
            ...prev[selectedTab],
            total_valor: categoryTotalValue,
            nd_39_input: formatNumberForInput(finalND39Value, 2),
            nd_30_value: finalND30Value,
            nd_39_value: finalND39Value,
        }
    }));
    
    if (selectedTab === 'Saúde') {
        setForm({ ...form, itensSaude: itemsToKeep as ItemSaude[] });
    } else {
        setForm({ ...form, itensRemonta: itemsToKeep as ItemRemonta[] });
    }
    
    toast.success(`Itens e alocação de ND para ${getCategoryLabel(selectedTab)} atualizados!`);
  };
  
  const valorTotalForm = valorTotalSaude + valorTotalRemonta;

  const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
  const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);

  const totalAlocado = totalND30Final + totalND39Final;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalAlocado);

  // --- Save Records to Database ---
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de Atividade (Global) deve ser maior que zero"); return; }
    if (form.itensSaude.length === 0 && form.itensRemonta.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    if (!isTotalAlocadoCorrect) {
        toast.error("O valor total dos itens não corresponde ao total alocado. Clique em 'Salvar Itens da Categoria' em todas as abas ativas.");
        return;
    }

    setLoading(true);
    
    try {
      const omToSave = form.organizacao;
      const ugToSave = form.ug;
      
      // 1. Deletar registros antigos APENAS para a OM/UG que está sendo salva
      await supabase.from("classe_viii_saude_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", omToSave) // <-- NOVO FILTRO
        .eq("ug", ugToSave); // <-- NOVO FILTRO
        
      await supabase.from("classe_viii_remonta_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", omToSave) // <-- NOVO FILTRO
        .eq("ug", ugToSave); // <-- NOVO FILTRO
      
      // 2. Inserir Saúde
      if (form.itensSaude.length > 0) {
        const allocation = categoryAllocations['Saúde'];
        const valorTotal = valorTotalSaude;
        
        const detalhamento = generateSaudeMemoriaCalculo(
            form.itensSaude, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
            allocation.om_destino_recurso, allocation.ug_destino_recurso, allocation.nd_30_value, allocation.nd_39_value
        );
        
        const registroSaude: TablesInsert<'classe_viii_saude_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso,
            ug: allocation.ug_destino_recurso,
            dias_operacao: form.dias_operacao,
            categoria: 'Saúde - KPSI/KPT',
            itens_saude: form.itensSaude as any,
            valor_total: valorTotal,
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
        };
        await supabase.from("classe_viii_saude_registros").insert([registroSaude]);
      }
      
      // 3. Inserir Remonta/Veterinária
      if (form.itensRemonta.length > 0) {
        const allocation = categoryAllocations['Remonta/Veterinária'];
        const totalRemonta = valorTotalRemonta;
        
        // Agrupar itens por tipo de animal (Equino e Canino)
        const remontaItemsGrouped = form.itensRemonta.reduce((acc, item) => {
            const type = item.item.includes('Equino') ? 'Equino' : 'Canino';
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        const registrosParaInserir: TablesInsert<'classe_viii_remonta_registros'>[] = [];
        
        // Calcular totais individuais para Equino e Canino
        const valorEquino = (remontaItemsGrouped['Equino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        const valorCanino = (remontaItemsGrouped['Canino'] || []).reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
        
        const totalGeralRemonta = valorEquino + valorCanino;
        
        // Calcular proporções para dividir ND 30/39
        const proporcaoEquino = totalGeralRemonta > 0 ? valorEquino / totalGeralRemonta : 0;
        const proporcaoCanino = totalGeralRemonta > 0 ? valorCanino / totalGeralRemonta : 0;
        
        const nd30Equino = allocation.nd_30_value * proporcaoEquino;
        const nd39Equino = allocation.nd_39_value * proporcaoEquino;
        
        const nd30Canino = allocation.nd_30_value * proporcaoCanino;
        const nd39Canino = allocation.nd_39_value * proporcaoCanino;
        
        // Processar Equino
        if (remontaItemsGrouped['Equino'] && remontaItemsGrouped['Equino'].length > 0) {
            const equinoItems = remontaItemsGrouped['Equino'];
            const nrAnimaisEquino = equinoItems[0].quantidade_animais;
            
            const detalhamentoEquino = generateRemontaMemoriaCalculo(
                'Equino', equinoItems, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Equino, nd39Equino
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Equino',
                quantidade_animais: nrAnimaisEquino,
                itens_remonta: equinoItems as any,
                valor_total: valorEquino,
                detalhamento: detalhamentoEquino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Equino,
                valor_nd_39: nd39Equino,
            });
        }
        
        // Processar Canino
        if (remontaItemsGrouped['Canino'] && remontaItemsGrouped['Canino'].length > 0) {
            const caninoItems = remontaItemsGrouped['Canino'];
            const nrAnimaisCanino = caninoItems[0].quantidade_animais;
            
            const detalhamentoCanino = generateRemontaMemoriaCalculo(
                'Canino', caninoItems, form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                nd30Canino, nd39Canino
            );
            
            registrosParaInserir.push({
                p_trab_id: ptrabId,
                organizacao: allocation.om_destino_recurso,
                ug: allocation.ug_destino_recurso,
                dias_operacao: form.dias_operacao,
                animal_tipo: 'Canino',
                quantidade_animais: nrAnimaisCanino,
                itens_remonta: caninoItems as any,
                valor_total: valorCanino,
                detalhamento: detalhamentoCanino,
                fase_atividade: faseFinalString,
                valor_nd_30: nd30Canino,
                valor_nd_39: nd39Canino,
            });
        }
        
        // Ajuste final de arredondamento (garantir que a soma seja exata)
        if (registrosParaInserir.length === 2) {
            const totalND30 = allocation.nd_30_value;
            const totalND39 = allocation.nd_39_value;
            
            const somaND30 = registrosParaInserir[0].valor_nd_30 + registrosParaInserir[1].valor_nd_30;
            const somaND39 = registrosParaInserir[0].valor_nd_39 + registrosParaInserir[1].valor_nd_39;
            
            // Adiciona a diferença de arredondamento ao primeiro registro
            if (!areNumbersEqual(somaND30, totalND30)) {
                registrosParaInserir[0].valor_nd_30 += (totalND30 - somaND30);
            }
            if (!areNumbersEqual(somaND39, totalND39)) {
                registrosParaInserir[0].valor_nd_39 += (totalND39 - somaND39);
            }
        }
            
        if (registrosParaInserir.length > 0) {
            await supabase.from("classe_viii_remonta_registros").insert(registrosParaInserir);
        }
      }
      
      toast.success("Registros de Classe VIII salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields(); // Resetar o formulário para permitir novo registro
      fetchRegistros(); // Recarregar a lista de registros salvos
    } catch (error) {
      console.error("Erro ao salvar registros de Classe VIII:", error);
      toast.error("Erro ao salvar registros de Classe VIII");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    const omToEdit = registro.organizacao;
    const ugToEdit = registro.ug;
    
    // 1. Buscar TODOS os registros de CLASSE VIII para esta OM/UG específica
    const [
        { data: saudeData },
        { data: remontaData }
    ] = await Promise.all([
        supabase
            .from("classe_viii_saude_registros")
            .select("*, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId)
            .eq("organizacao", omToEdit)
            .eq("ug", ugToEdit),
        supabase
            .from("classe_viii_remonta_registros")
            .select("*, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId)
            .eq("organizacao", omToEdit)
            .eq("ug", ugToEdit),
    ]);
    
    const recordsToEdit: ClasseVIIIRegistro[] = [
        ...(saudeData || []).map(r => ({ ...r, itens_saude: (r.itens_saude || []) as ItemSaude[] }) as ClasseVIIIRegistroSaude),
        ...(remontaData || []).map(r => ({ ...r, itens_remonta: (r.itens_remonta || []) as ItemRemonta[] }) as ClasseVIIIRegistroRemonta),
    ];
    
    if (recordsToEdit.length === 0) {
        toast.error("Erro ao carregar registros para edição.");
        setLoading(false);
        return;
    }
    
    const firstRecord = recordsToEdit[0];
    
    // 2. Consolidar Itens e Alocações
    let consolidatedSaude: ItemSaude[] = [];
    let consolidatedRemonta: ItemRemonta[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    
    recordsToEdit.forEach(r => {
        const category = r.categoria === 'Saúde - KPSI/KPT' ? 'Saúde' : 'Remonta/Veterinária';
        
        if (category === 'Saúde') {
            const saudeR = r as ClasseVIIIRegistroSaude;
            consolidatedSaude = saudeR.itens_saude;
            const totalValor = consolidatedSaude.reduce((sum, item) => sum + calculateSaudeItemTotal(item, saudeR.dias_operacao), 0);
            newAllocations['Saúde'] = {
                total_valor: totalValor,
                nd_39_input: formatNumberForInput(Number(saudeR.valor_nd_39), 2),
                nd_30_value: Number(saudeR.valor_nd_30),
                nd_39_value: Number(saudeR.valor_nd_39),
                om_destino_recurso: saudeR.organizacao,
                ug_destino_recurso: saudeR.ug,
                selectedOmDestinoId: undefined,
            };
        } else {
            const remontaR = r as ClasseVIIIRegistroRemonta;
            consolidatedRemonta = consolidatedRemonta.concat(remontaR.itens_remonta);
            
            // Acumular totais de ND para Remonta (pode haver Equino e Canino separados)
            newAllocations['Remonta/Veterinária'].total_valor += remontaR.valor_total;
            newAllocations['Remonta/Veterinária'].nd_30_value += Number(remontaR.valor_nd_30);
            newAllocations['Remonta/Veterinária'].nd_39_value += Number(remontaR.valor_nd_39);
            newAllocations['Remonta/Veterinária'].om_destino_recurso = remontaR.organizacao;
            newAllocations['Remonta/Veterinária'].ug_destino_recurso = remontaR.ug;
            newAllocations['Remonta/Veterinária'].selectedOmDestinoId = undefined;
        }
    });
    
    // Finalizar alocação de Remonta (ajustar input string)
    if (newAllocations['Remonta/Veterinária'].total_valor > 0) {
        newAllocations['Remonta/Veterinária'].nd_39_input = formatNumberForInput(newAllocations['Remonta/Veterinária'].nd_39_value, 2);
    }
    
    // 3. Fetch OM IDs
    const fetchOmId = async (nome: string, ug: string) => {
      if (!nome || !ug) return undefined;
      const { data } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', nome)
        .eq('codug_om', ug)
        .maybeSingle();
      return data?.id;
    };
    
    Promise.all([
      fetchOmId(omToEdit, ugToEdit),
      fetchOmId(newAllocations['Saúde'].om_destino_recurso, newAllocations['Saúde'].ug_destino_recurso),
      fetchOmId(newAllocations['Remonta/Veterinária'].om_destino_recurso, newAllocations['Remonta/Veterinária'].ug_destino_recurso),
    ]).then(([omDataId, saudeOmId, remontaOmId]) => {
      setForm({
        selectedOmId: omDataId,
        organizacao: omToEdit,
        ug: ugToEdit,
        dias_operacao: firstRecord.dias_operacao,
        itensSaude: consolidatedSaude,
        itensRemonta: consolidatedRemonta,
      });
      
      setCategoryAllocations(prev => ({
        ...prev,
        'Saúde': { ...newAllocations['Saúde'], selectedOmDestinoId: saudeOmId },
        'Remonta/Veterinária': { ...newAllocations['Remonta/Veterinária'], selectedOmDestinoId: remontaOmId },
      }));
      
      setEditingId(firstRecord.id);
      setSelectedTab(registro.categoria === 'Saúde - KPSI/KPT' ? 'Saúde' : 'Remonta/Veterinária');
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${registro.ug})`;
        if (!acc[key]) {
            acc[key] = {
                om: registro.organizacao,
                ug: registro.ug,
                total: 0,
                registros: [],
            };
        }
        acc[key].total += registro.valor_total;
        acc[key].registros.push(registro);
        return acc;
    }, {} as Record<string, { om: string, ug: string, total: number, registros: ClasseVIIIRegistro[] }>);
  }, [registros]);

  const handleIniciarEdicaoMemoria = (registro: ClasseVIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registroId: string, categoria: string) => {
    setLoading(true);
    try {
      if (categoria === 'Saúde - KPSI/KPT') {
        await supabase.from("classe_viii_saude_registros")
          .update({ detalhamento_customizado: memoriaEdit.trim() || null })
          .eq("id", registroId);
      } else {
        await supabase.from("classe_viii_remonta_registros")
          .update({ detalhamento_customizado: memoriaEdit.trim() || null })
          .eq("id", registroId);
      }

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

  const handleRestaurarMemoriaAutomatica = async (registroId: string, categoria: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      if (categoria === 'Saúde - KPSI/KPT') {
        await supabase.from("classe_viii_saude_registros")
          .update({ detalhamento_customizado: null })
          .eq("id", registroId);
      } else {
        await supabase.from("classe_viii_remonta_registros")
          .update({ detalhamento_customizado: null })
          .eq("id", registroId);
      }

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

  const currentAnimalQuantity = useMemo(() => {
    if (selectedTab === 'Remonta/Veterinária' && currentCategoryItems.length > 0) {
        return (currentCategoryItems[0] as ItemRemonta).quantidade_animais || 0;
    }
    return 0;
  }, [selectedTab, currentCategoryItems]);

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
              Classe VIII - Saúde e Remonta/Veterinária
            </CardTitle>
            <CardDescription>
              Solicitação de recursos para manutenção de material de Saúde e Remonta/Veterinária.
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
                  <Label>Dias de Atividade (Global) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                    value={form.dias_operacao || ""}
                    onChange={handleDiasOperacaoChange}
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
                
                {selectedTab === 'Remonta/Veterinária' && (
                    <div className="space-y-2">
                        <Label>Quantidade de Animais *</Label>
                        <Input
                            type="number"
                            min="1"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                            value={currentAnimalQuantity || ""}
                            onChange={(e) => handleQuantityAnimalsChange(0, parseInt(e.target.value) || 0)}
                            placeholder="Ex: 10"
                            disabled={!form.organizacao || form.dias_operacao <= 0}
                            onKeyDown={handleEnterToNextField}
                        />
                        <p className="text-xs text-muted-foreground">
                            A quantidade de animais se aplica a todos os itens de Remonta.
                        </p>
                    </div>
                )}
              </div>
            </div>

            {/* 2. Adicionar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-2">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>
                        {cat === 'Saúde' ? <HeartPulse className="h-4 w-4 mr-2" /> : <PawPrint className="h-4 w-4 mr-2" />}
                        {getCategoryLabel(cat)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => {
                    const isSaude = cat === 'Saúde';
                    const isRemonta = cat === 'Remonta/Veterinária';
                    
                    return (
                      <TabsContent key={cat} value={cat} className="mt-4">
                        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                          
                          <div className="max-h-[400px] overflow-y-auto rounded-md border">
                              <Table className="w-full">
                                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                      <TableRow>
                                          <TableHead className="w-[50%]">Item</TableHead>
                                          <TableHead className="w-[20%] text-right">Valor/Unidade</TableHead>
                                          <TableHead className="w-[15%] text-center">{isSaude ? 'Qtd Kits' : 'Qtd Itens'}</TableHead>
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
                                              const itemTotal = isSaude 
                                                ? calculateSaudeItemTotal(item as ItemSaude, form.dias_operacao)
                                                : calculateRemontaItemTotal(item as ItemRemonta);
                                              
                                              const isDisabled = isRemonta && currentAnimalQuantity === 0;
                                              
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
                                                              disabled={isDisabled}
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
                          
                          {/* BLOCO DE ALOCAÇÃO ND 30/39 */}
                          {currentCategoryTotalValue > 0 && (
                              <div className="space-y-4 p-4 border rounded-lg bg-background">
                                  <h4 className="font-semibold text-sm">Alocação de Recursos para {getCategoryLabel(cat)}</h4>
                                  
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
                                                  value={currentND39Input}
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
                                  disabled={!form.organizacao || form.dias_operacao <= 0 || !areNumbersEqual(currentCategoryTotalValue, (nd30ValueTemp + nd39ValueTemp)) || (currentCategoryTotalValue > 0 && !categoryAllocations[cat].om_destino_recurso)}
                              >
                                  Salvar Itens da Categoria
                              </Button>
                          </div>
                        </div>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {(form.itensSaude.length > 0 || form.itensRemonta.length > 0) && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itensSaude.length + form.itensRemonta.length} itens)</h3>
                
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
                    const totalCategoria = itens.reduce((sum, item) => 
                        item.categoria === 'Saúde' 
                            ? sum + calculateSaudeItemTotal(item as ItemSaude, form.dias_operacao)
                            : sum + calculateRemontaItemTotal(item as ItemRemonta)
                    , 0);
                    
                    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                    
                    const allocation = categoryAllocations[categoria as Categoria];
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{getCategoryLabel(categoria)} ({totalQuantidade} itens)</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const itemTotal = item.categoria === 'Saúde' 
                                ? calculateSaudeItemTotal(item as ItemSaude, form.dias_operacao)
                                : calculateRemontaItemTotal(item as ItemRemonta);
                            
                            return (
                              <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                                <span className="font-medium">{item.item}</span>
                                <span className="text-right">
                                  {item.quantidade} un. {item.categoria === 'Remonta/Veterinária' && `x ${(item as ItemRemonta).quantidade_animais} animais`} = {formatCurrency(itemTotal)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        
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
                    disabled={loading || !form.organizacao || valorTotalForm === 0 || !isTotalAlocadoCorrect}
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
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, group]) => {
                    const omName = group.om;
                    const ug = group.ug;
                    
                    return (
                        <Card key={omKey} className="p-4 bg-primary/5 border-primary/20">
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                                <h3 className="font-bold text-lg text-primary">
                                    {omName} (UG: {ug})
                                </h3>
                                <span className="font-extrabold text-xl text-primary">
                                    {formatCurrency(group.total)}
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {group.registros.map((registro) => {
                                    const isSaude = registro.categoria === 'Saúde - KPSI/KPT';
                                    const totalCategoria = registro.valor_total;
                                    const fases = formatFasesParaTexto(registro.fase_atividade);
                                    const badgeStyle = getCategoryBadgeStyle(isSaude ? 'Saúde' : 'Remonta/Veterinária');
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {isSaude ? 'Saúde - KPSI/KPT' : `Remonta - ${(registro as ClasseVIIIRegistroRemonta).animal_tipo}`}
                                                        </h4>
                                                    </div>
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
                                                                if (confirm(`Deseja realmente deletar o registro de Classe VIII para ${omName} (${registro.categoria})?`)) {
                                                                    const table = isSaude ? "classe_viii_saude_registros" : "classe_viii_remonta_registros";
                                                                    supabase.from(table)
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

            {/* 5. Memórias de Cálculos Detalhadas */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isSaude = registro.categoria === 'Saúde - KPSI/KPT';
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  
                  const memoriaAutomatica = isSaude 
                    ? generateSaudeMemoriaCalculo(
                        (registro as ClasseVIIIRegistroSaude).itens_saude, registro.dias_operacao, om, ug, registro.fase_atividade || '', om, ug, registro.valor_nd_30, registro.valor_nd_39
                      )
                    : generateRemontaMemoriaCalculo(
                        (registro as ClasseVIIIRegistroRemonta).animal_tipo, (registro as ClasseVIIIRegistroRemonta).itens_remonta, registro.dias_operacao, om, ug, registro.fase_atividade || '', om, ug, registro.valor_nd_30, registro.valor_nd_39
                      );
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  const badgeStyle = getCategoryBadgeStyle(isSaude ? 'Saúde' : 'Remonta/Veterinária');
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-foreground">
                                OM Destino: {om} ({ug})
                              </h4>
                              <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                  {isSaude ? 'Saúde' : `Remonta - ${(registro as ClasseVIIIRegistroRemonta).animal_tipo}`}
                              </Badge>
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
                                      onClick={() => handleRestaurarMemoriaAutomatica(registro.id, registro.categoria)}
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
                                    onClick={() => handleSalvarMemoriaCustomizada(registro.id, registro.categoria)}
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

export default ClasseVIIIForm;