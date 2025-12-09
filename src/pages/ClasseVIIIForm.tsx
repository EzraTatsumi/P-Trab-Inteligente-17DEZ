import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronsUpDown, Sparkles, AlertCircle, HeartPulse, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
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
  quantidade: number; // Nr Kits
  valor_mnt_dia: number; // Valor do Kit
  categoria: 'Saúde';
}

interface ItemRemonta {
  item: string; // Ex: Equino, Canino
  quantidade_animais: number;
  dias_operacao_item: number; // Dias específicos de uso do animal
  valor_mnt_dia: number; // Valor base (Anual/Mensal/Diário) - Usado apenas para cálculo interno
  categoria: 'Remonta/Veterinária';
}

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global days of activity (Used for header only)
  itensSaude: ItemSaude[];
  itensRemonta: ItemRemonta[];
  fase_atividade?: string; // Global
}

interface ClasseVIIIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  categoria: string;
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
  itens_saude?: ItemSaude[];
  animal_tipo?: 'Equino' | 'Canino';
  quantidade_animais?: number;
  itens_remonta?: ItemRemonta[];
}

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

// --- Lógica de Cálculo Remonta/Veterinária ---

const calculateRemontaItemTotal = (item: ItemRemonta): number => {
    const baseValue = item.valor_mnt_dia;
    const nrAnimais = item.quantidade_animais;
    const diasOperacao = item.dias_operacao_item;
    
    if (diasOperacao <= 0 || nrAnimais <= 0) return 0;

    let total = 0;
    
    if (item.item.includes('(Anual)')) {
        // Item B, D, E (Annual): Nr Animais x Item Valor x ceil(diasOperacao / 365)
        const multiplier = Math.ceil(diasOperacao / 365);
        total = baseValue * multiplier * nrAnimais;
        
    } else if (item.item.includes('(Mensal)')) {
        // Item C (Monthly): [Nr Animais x (Item C / 30 dias) x Nr dias]
        // Formula: Nr Animais x Item C x (diasOperacao / 30)
        total = nrAnimais * (baseValue / 30) * diasOperacao;
        
    } else {
        // Item G (Daily): Nr Animais x Item Valor x diasOperacao
        total = baseValue * diasOperacao * nrAnimais;
    }
    
    return total;
};

const calculateSaudeItemTotal = (item: ItemSaude): number => {
    return item.valor_mnt_dia * item.quantidade;
};

// --- Geração de Memória de Cálculo ---

const generateRemontaMemoriaCalculo = (
    animalTipo: 'Equino' | 'Canino',
    itens: ItemRemonta[],
    diasOperacaoGlobal: number, // Dias globais do PTrab (para o cabeçalho)
    organizacao: string,
    ug: string,
    faseAtividade: string,
    omDestino: string,
    ugDestino: string,
    valorND30: number,
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotal = valorND30 + valorND39;
    
    // Agrupar itens por tipo de animal (Equino ou Canino)
    const itensPorAnimal = itens.filter(i => i.item.includes(animalTipo));
    
    if (itensPorAnimal.length === 0) return "";
    
    // Usamos o primeiro item para pegar a quantidade de animais e dias de operação específicos
    const nrAnimais = itensPorAnimal[0].quantidade_animais;
    const diasOperacaoItem = itensPorAnimal[0].dias_operacao_item;
    
    // Group items by Item Type (B, C, D, E, G)
    const groupedItems: Record<string, ItemRemonta[]> = itensPorAnimal.reduce((acc, item) => {
        const itemTypeMatch = item.item.match(/-\s([A-G]):/);
        if (itemTypeMatch) {
            const type = itemTypeMatch[1];
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
        }
        return acc;
    }, {} as Record<string, ItemRemonta[]>);
    
    // Calculate totals and build formula components
    let formulaComponents: string[] = [];
    let calculationComponents: string[] = [];
    let totalBrutoCalculado = 0;
    
    // Detailed Item Breakdown for the memory (Cálculo:)
    let detailedItems = "Cálculo:\n";
    
    // Iterate over item types B, C, D, E, G in order
    ['B', 'C', 'D', 'E', 'G'].forEach(type => {
        const itemsOfType = groupedItems[type] || [];
        
        itemsOfType.forEach(item => {
            const baseValue = item.valor_mnt_dia;
            const itemTotal = calculateRemontaItemTotal(item);
            totalBrutoCalculado += itemTotal;
            
            const itemDescription = item.item.split(/-\s[A-G]:\s/)[1].trim();
            const itemUnit = item.item.includes('(Anual)') ? 'ano' : item.item.includes('(Mensal)') ? 'mês' : 'dia';
            
            detailedItems += `- Item ${type} (${itemDescription}): ${formatCurrency(baseValue)} / ${animalTipo.toLowerCase()} / ${itemUnit}.\n`;
            
            if (item.item.includes('(Mensal)')) {
                // Item C: [Nr Animais x (Item C / 30 dias) x Nr dias]
                formulaComponents.push(`[Nr ${animalTipo}s x (Item C / 30 dias) x Nr dias]`);
                calculationComponents.push(`(${nrAnimais} x (${formatCurrency(baseValue)} / 30 dias) x ${diasOperacaoItem} dias)`);
            } else if (item.item.includes('(Diário)')) {
                // Item G: (Nr Animais x Item G x Nr dias)
                formulaComponents.push(`(Nr ${animalTipo}s x Item G x Nr dias)`);
                calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)} x ${diasOperacaoItem} dias)`);
            } else {
                // Item B, D, E (Annual): (Nr Animais x Item X)
                // Nota: O cálculo anual usa Math.ceil(diasOperacaoItem / 365) como multiplicador, mas a fórmula simplificada na memória é (Nr Animais x Item X)
                formulaComponents.push(`(Nr ${animalTipo}s x Item ${type})`);
                
                const multiplier = Math.ceil(diasOperacaoItem / 365);
                if (multiplier > 1) {
                    calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)} x ${multiplier} anos)`);
                } else {
                    calculationComponents.push(`(${nrAnimais} x ${formatCurrency(baseValue)})`);
                }
            }
        });
    });
    
    const formulaString = formulaComponents.join(' + ');
    const calculationString = calculationComponents.join(' + ');
    
    let memoria = `33.90.30 / 33.90.39 - Aquisição meios ou contratação de serviços para a manutenção de ${nrAnimais} ${animalTipo.toLowerCase()}(s) do ${organizacao}, durante ${diasOperacaoItem} dias de ${faseFormatada}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

${detailedItems.trim()}

Fórmula: ${formulaString} = ${formatCurrency(valorTotal)}.
Cálculo Detalhado: ${calculationString} = ${formatCurrency(totalBrutoCalculado)}.

Total: ${formatCurrency(valorTotal)}.`;

    return memoria;
};

const generateSaudeMemoriaCalculo = (
    itens: ItemSaude[],
    diasOperacao: number,
    organizacao: string,
    ug: string,
    faseAtividade: string,
    omDestino: string,
    ugDestino: string,
    valorND30: number,
    valorND39: number
): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalKits = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const valorTotal = valorND30 + valorND39;
    
    let detalhamentoCalculo = "";
    
    itens.forEach(item => {
        const itemTotal = calculateSaudeItemTotal(item);
        detalhamentoCalculo += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)} = ${formatCurrency(itemTotal)}.\n`;
    });
    
    return `33.90.30 / 33.90.39 - Aquisição de KPSI/KPSC e KPT para utilização por ${totalKits} kits do ${organizacao}, durante ${diasOperacao} dias de ${faseFormatada}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula: Nr KPSC/KPT x valor do item

Detalhes:
${detalhamentoCalculo.trim()}

Total: ${formatCurrency(valorTotal)}.`;
};


const ClasseVIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registrosSaude, setRegistrosSaude] = useState<ClasseVIIIRegistro[]>([]);
  const [registrosRemonta, setRegistrosRemonta] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [diretrizesSaude, setDiretrizesSaude] = useState<DiretrizClasseII[]>([]);
  const [diretrizesRemonta, setDiretrizesRemonta] = useState<DiretrizClasseII[]>([]);
  
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
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

  // Efeito para gerenciar a lista de itens da categoria atual
  useEffect(() => {
    const isSaude = selectedTab === 'Saúde';
    const directives = isSaude ? diretrizesSaude : diretrizesRemonta;
    const formItems = isSaude ? form.itensSaude : form.itensRemonta;
    
    if (directives.length === 0) {
        setCurrentCategoryItems([]);
        return;
    }

    if (isSaude) {
        const existingItemsMap = new Map<string, ItemSaude>();
        (formItems as ItemSaude[]).forEach(item => {
            existingItemsMap.set(item.item, item);
        });

        const mergedItems = directives.map(directive => {
            const existing = existingItemsMap.get(directive.item);
            const defaultItem: ItemSaude = {
                item: directive.item,
                quantidade: 0,
                valor_mnt_dia: Number(directive.valor_mnt_dia),
                categoria: 'Saúde',
            };
            return existing || defaultItem;
        });
        setCurrentCategoryItems(mergedItems);
        
    } else {
        // Lógica específica para Remonta/Veterinária: Apenas 2 itens (Equino e Canino)
        const animalTypes = ['Equino', 'Canino'];
        const baseItems: ItemRemonta[] = [];
        
        animalTypes.forEach(animalType => {
            // Agrupar todas as diretrizes relacionadas a este tipo de animal para calcular o valor base total
            const relatedDirectives = directives.filter(d => d.item.includes(animalType));
            
            if (relatedDirectives.length > 0) {
                // O valor_mnt_dia aqui será o valor total de todas as diretrizes relacionadas ao animal
                // Isso é necessário para que o cálculo de total do item (calculateRemontaItemTotal) funcione corretamente
                
                // Encontrar o item existente no formulário para manter o estado (quantidade e dias)
                const existingItem = (formItems as ItemRemonta[]).find(item => item.item === animalType);
                
                // Criar um item base que representa o tipo de animal, mas que carrega todas as diretrizes
                const baseItem: ItemRemonta = {
                    item: animalType,
                    quantidade_animais: existingItem?.quantidade_animais || 0,
                    dias_operacao_item: existingItem?.dias_operacao_item || 0,
                    valor_mnt_dia: 0, // Será preenchido abaixo com o valor total das diretrizes
                    categoria: 'Remonta/Veterinária',
                };
                
                // Para o cálculo, precisamos de um array de ItemRemonta que contenha todas as diretrizes
                // O valor_mnt_dia de cada diretriz é o que importa para o cálculo.
                const directivesAsItems: ItemRemonta[] = relatedDirectives.map(d => ({
                    item: d.item,
                    quantidade_animais: baseItem.quantidade_animais,
                    dias_operacao_item: baseItem.dias_operacao_item,
                    valor_mnt_dia: Number(d.valor_mnt_dia),
                    categoria: 'Remonta/Veterinária',
                }));
                
                // Calcular o valor total (soma de todas as diretrizes) para este tipo de animal
                const totalValueForAnimal = directivesAsItems.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
                
                // Atualizar o valor_mnt_dia do item base para armazenar o valor total calculado (para exibição na coluna Total)
                // Nota: Isso é um hack para usar a estrutura ItemRemonta para representar o total do animal.
                baseItem.valor_mnt_dia = totalValueForAnimal; 
                
                baseItems.push(baseItem);
            }
        });
        
        setCurrentCategoryItems(baseItems);
    }
  }, [selectedTab, diretrizesSaude, diretrizesRemonta, form.itensSaude, form.itensRemonta]);


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
      
      const allCategories = [...CATEGORIAS];
      
      if (!anoReferencia) {
        setDiretrizesSaude(defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
        setDiretrizesRemonta(defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
        setLoading(false);
        return;
      }

      const { data: classeItemsData } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", allCategories);

      const loadedItems = classeItemsData || [];
      
      const loadedSaude = loadedItems.filter(d => d.categoria === 'Saúde');
      setDiretrizesSaude(loadedSaude.length > 0 ? loadedSaude as DiretrizClasseII[] : defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
      
      const loadedRemonta = loadedItems.filter(d => d.categoria === 'Remonta/Veterinária');
      setDiretrizesRemonta(loadedRemonta.length > 0 ? loadedRemonta as DiretrizClasseII[] : defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizesSaude(defaultClasseVIIISaudeConfig as DiretrizClasseII[]);
      setDiretrizesRemonta(defaultClasseVIIIRemontaConfig as DiretrizClasseII[]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const [
        { data: saudeData, error: saudeError },
        { data: remontaData, error: remontaError },
    ] = await Promise.all([
        supabase
            .from("classe_viii_saude_registros")
            .select("*, itens_saude, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
        supabase
            .from("classe_viii_remonta_registros")
            .select("*, itens_remonta, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
    ]);

    if (saudeError) { console.error("Erro ao carregar Saúde:", saudeError); toast.error("Erro ao carregar registros de Saúde"); }
    if (remontaError) { console.error("Erro ao carregar Remonta:", remontaError); toast.error("Erro ao carregar registros de Remonta"); }

    setRegistrosSaude((saudeData || []) as ClasseVIIIRegistro[]);
    setRegistrosRemonta((remontaData || []) as ClasseVIIIRegistro[]);
    
    // Reconstruir o estado do formulário se houver registros
    if ((saudeData && saudeData.length > 0) || (remontaData && remontaData.length > 0)) {
        reconstructFormState(saudeData as ClasseVIIIRegistro[], remontaData as ClasseVIIIRegistro[]);
    }
  };
  
  const reconstructFormState = async (saudeRecords: ClasseVIIIRegistro[], remontaRecords: ClasseVIIIRegistro[]) => {
    const allRecords = [...saudeRecords, ...remontaRecords];
    if (allRecords.length === 0) return;

    const firstRecord = allRecords[0];
    
    // 1. Extract global data
    const omName = firstRecord.organizacao;
    const ug = firstRecord.ug;
    const diasOperacao = firstRecord.dias_operacao;
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    // 2. Consolidate items and allocations
    let consolidatedSaude: ItemSaude[] = [];
    let consolidatedRemonta: ItemRemonta[] = [];
    let newAllocations = { ...initialCategoryAllocations };
    let selectedOmIdForEdit: string | undefined = undefined;
    
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
    
    // Process Saúde
    saudeRecords.forEach(r => {
        // Sanitize items before consolidation
        const sanitizedItems = (r.itens_saude || []).map(item => ({
            ...item,
            quantidade: Number((item as ItemSaude).quantidade || 0), // Ensure quantity is a number
        })) as ItemSaude[];
        
        consolidatedSaude = consolidatedSaude.concat(sanitizedItems);
        
        const totalValor = sanitizedItems.reduce((sum, item) => calculateSaudeItemTotal(item) + sum, 0);
        newAllocations['Saúde'] = {
            total_valor: totalValor,
            nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
            nd_30_value: Number(r.valor_nd_30),
            nd_39_value: Number(r.valor_nd_39),
            om_destino_recurso: r.organizacao,
            ug_destino_recurso: r.ug,
            selectedOmDestinoId: undefined,
        };
    });
    
    // Process Remonta
    remontaRecords.forEach(r => {
        // Sanitize items before consolidation
        const sanitizedItems = (r.itens_remonta || []).map(item => ({
            ...item,
            quantidade_animais: Number((item as ItemRemonta).quantidade_animais || 0), // Ensure quantity is a number
            dias_operacao_item: Number((item as ItemRemonta).dias_operacao_item || 0), // Ensure days is a number
        })) as ItemRemonta[];
        
        consolidatedRemonta = consolidatedRemonta.concat(sanitizedItems);
        
        // Recalcular o valor total usando os dias de operação específicos do item
        const totalValor = sanitizedItems.reduce((sum, item) => calculateRemontaItemTotal(item) + sum, 0);
        
        newAllocations['Remonta/Veterinária'] = {
            total_valor: totalValor,
            nd_39_input: formatNumberForInput(Number(r.valor_nd_39), 2),
            nd_30_value: Number(r.valor_nd_30),
            nd_39_value: Number(r.valor_nd_39),
            om_destino_recurso: r.organizacao,
            ug_destino_recurso: r.ug,
            selectedOmDestinoId: undefined,
        };
    });
    
    // Fetch OM IDs
    selectedOmIdForEdit = await fetchOmId(omName, ug);
    
    for (const cat of CATEGORIAS) {
        const alloc = newAllocations[cat];
        if (alloc.om_destino_recurso) {
            alloc.selectedOmDestinoId = await fetchOmId(alloc.om_destino_recurso, alloc.ug_destino_recurso);
        }
    }
    
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: omName,
      ug: ug,
      dias_operacao: diasOperacao,
      itensSaude: consolidatedSaude,
      itensRemonta: consolidatedRemonta,
    });
    setCategoryAllocations(newAllocations);
    
    // Set initial tab based on which records exist
    if (saudeRecords.length > 0) {
        setSelectedTab('Saúde');
    } else if (remontaRecords.length > 0) {
        setSelectedTab('Remonta/Veterinária');
    }
  };

  const resetFormFields = () => {
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
    const omName = omData?.nome_om || "";
    const ug = omData?.codug_om || "";
    const omId = omData?.id;
    
    setForm(prev => ({
      ...prev,
      selectedOmId: omId,
      organizacao: omName,
      ug: ug,
    }));
    
    const newAllocations = CATEGORIAS.reduce((acc, cat) => {
        acc[cat] = {
            ...categoryAllocations[cat],
            om_destino_recurso: omName,
            ug_destino_recurso: ug,
            selectedOmDestinoId: omId,
        };
        return acc;
    }, {} as Record<Categoria, CategoryAllocation>);
    setCategoryAllocations(newAllocations);
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

  // --- Item Quantity Handlers ---
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    
    if (selectedTab === 'Saúde') {
        (newItems as ItemSaude[])[itemIndex].quantidade = Math.max(0, quantity);
    } else {
        // Lógica de Remonta/Veterinária
        const item = (newItems as ItemRemonta[])[itemIndex];
        let finalQuantity = Math.max(0, quantity);
        
        // Regra Caninos: múltiplos de 5
        if (item.item === 'Canino') {
            // Arredonda para o múltiplo de 5 mais próximo
            finalQuantity = Math.round(finalQuantity / 5) * 5;
        }
        
        item.quantidade_animais = finalQuantity;
    }
    setCurrentCategoryItems(newItems);
  };
  
  const handleDiasOperacaoChange = (itemIndex: number, days: number) => {
    if (selectedTab !== 'Remonta/Veterinária') return;
    
    const newItems = [...currentCategoryItems];
    const item = (newItems as ItemRemonta[])[itemIndex];
    item.dias_operacao_item = Math.max(0, days);
    
    setCurrentCategoryItems(newItems);
  };

  // --- ND Allocation Handlers ---
  const currentCategoryTotalValue = useMemo(() => {
    if (selectedTab === 'Saúde') {
        return (currentCategoryItems as ItemSaude[]).reduce((sum, item) => sum + calculateSaudeItemTotal(item), 0);
    } else {
        // Para Remonta, o valor_mnt_dia do item já armazena o total calculado no useEffect
        // Se a quantidade de animais ou dias for alterada, precisamos recalcular o total
        
        const remontaItems = currentCategoryItems as ItemRemonta[];
        
        // 1. Obter as diretrizes de Remonta
        const directives = diretrizesRemonta;
        
        let totalRemonta = 0;
        
        remontaItems.forEach(animalItem => {
            const animalType = animalItem.item; // 'Equino' ou 'Canino'
            const nrAnimais = animalItem.quantidade_animais;
            const diasOperacao = animalItem.dias_operacao_item;
            
            if (nrAnimais > 0 && diasOperacao > 0) {
                // 2. Filtrar as diretrizes relacionadas a este tipo de animal
                const relatedDirectives = directives.filter(d => d.item.includes(animalType));
                
                // 3. Criar itens temporários para cálculo
                const directivesAsItems: ItemRemonta[] = relatedDirectives.map(d => ({
                    item: d.item,
                    quantidade_animais: nrAnimais,
                    dias_operacao_item: diasOperacao,
                    valor_mnt_dia: Number(d.valor_mnt_dia),
                    categoria: 'Remonta/Veterinária',
                }));
                
                // 4. Somar os totais calculados
                const totalForAnimal = directivesAsItems.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
                totalRemonta += totalForAnimal;
            }
        });
        
        return totalRemonta;
    }
  }, [currentCategoryItems, selectedTab, diretrizesRemonta]);
  
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

  // --- Save Category Items to Form State ---
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Atividade (Global) antes de salvar itens.");
        return;
    }
    
    const categoryTotalValue = currentCategoryTotalValue;

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

    let itemsToKeep: (ItemSaude | ItemRemonta)[] = [];
    
    if (selectedTab === 'Saúde') {
        // 1. Itens válidos da categoria atual (quantidade > 0)
        itemsToKeep = (currentCategoryItems as ItemSaude[]).filter(item => item.quantidade > 0);
        setForm({ ...form, itensSaude: itemsToKeep as ItemSaude[] });
    } else {
        // Lógica de Remonta: Consolidar as diretrizes para cada animal ativo
        const remontaItems = currentCategoryItems as ItemRemonta[];
        const directives = diretrizesRemonta;
        
        const activeRemontaItems: ItemRemonta[] = [];
        
        remontaItems.forEach(animalItem => {
            const animalType = animalItem.item; // 'Equino' ou 'Canino'
            const nrAnimais = animalItem.quantidade_animais;
            const diasOperacao = animalItem.dias_operacao_item;
            
            if (nrAnimais > 0 && diasOperacao > 0) {
                // 1. Filtrar as diretrizes relacionadas a este tipo de animal
                const relatedDirectives = directives.filter(d => d.item.includes(animalType));
                
                // 2. Criar um ItemRemonta para CADA diretriz, mas usando a Qtd Animais e Dias do item principal
                relatedDirectives.forEach(d => {
                    activeRemontaItems.push({
                        item: d.item, // Ex: Item B (Encilhagem...)
                        quantidade_animais: nrAnimais,
                        dias_operacao_item: diasOperacao,
                        valor_mnt_dia: Number(d.valor_mnt_dia),
                        categoria: 'Remonta/Veterinária',
                    });
                });
            }
        });
        
        itemsToKeep = activeRemontaItems;
        setForm({ ...form, itensRemonta: itemsToKeep as ItemRemonta[] });
    }

    // 2. Update allocation state for the current category
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
    
    toast.success(`Itens e alocação de ND para ${getCategoryLabel(selectedTab)} atualizados!`);
  };
  
  // --- Global Totals and Validation ---
  const valorTotalSaude = form.itensSaude.reduce((sum, item) => sum + calculateSaudeItemTotal(item), 0);
  const valorTotalRemonta = form.itensRemonta.reduce((sum, item) => sum + calculateRemontaItemTotal(item), 0);
  const valorTotalForm = valorTotalSaude + valorTotalRemonta;

  const totalND30Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_30_value, 0);
  const totalND39Final = Object.values(categoryAllocations).reduce((sum, alloc) => sum + alloc.nd_39_value, 0);
  const totalAlocado = totalND30Final + totalND39Final;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalAlocado);
  
  const itensAgrupadosPorCategoria = useMemo(() => {
    const groups: Record<Categoria, (ItemSaude | ItemRemonta)[]> = {};
    if (form.itensSaude.length > 0) groups['Saúde'] = form.itensSaude;
    if (form.itensRemonta.length > 0) groups['Remonta/Veterinária'] = form.itensRemonta;
    return groups;
  }, [form.itensSaude, form.itensRemonta]);


  // --- Save Records to Database ---
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação (Global) deve ser maior que zero"); return; }
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
      // 1. Deletar registros antigos
      await supabase.from("classe_viii_saude_registros").delete().eq("p_trab_id", ptrabId);
      await supabase.from("classe_viii_remonta_registros").delete().eq("p_trab_id", ptrabId);
      
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
        const valorTotal = valorTotalRemonta;
        
        // Determinar o tipo de animal predominante para o cabeçalho da memória
        const animalTipo = form.itensRemonta.some(i => i.item.includes('Equino')) ? 'Equino' : 'Canino';
        
        // Para a memória, precisamos agrupar os itens por animal para calcular o total de animais e dias
        const remontaItemsGrouped = form.itensRemonta.reduce((acc, item) => {
            const type = item.item.includes('Equino') ? 'Equino' : 'Canino';
            if (!acc[type]) acc[type] = [];
            acc[type].push(item);
            return acc;
        }, {} as Record<string, ItemRemonta[]>);
        
        let detalhamento = "";
        
        // Gerar memória para Equino, se houver
        if (remontaItemsGrouped['Equino'] && remontaItemsGrouped['Equino'].length > 0) {
            detalhamento += generateRemontaMemoriaCalculo(
                'Equino', remontaItemsGrouped['Equino'], form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                // NDs são alocados globalmente para a categoria, mas a memória precisa do total
                // Aqui, para simplificar, usaremos o total da categoria, mas o ideal seria dividir o ND por animal.
                // Como o ND é global, vamos usar o total alocado para a categoria.
                allocation.nd_30_value, allocation.nd_39_value
            );
        }
        
        // Gerar memória para Canino, se houver
        if (remontaItemsGrouped['Canino'] && remontaItemsGrouped['Canino'].length > 0) {
            if (detalhamento) detalhamento += "\n\n---\n\n";
            detalhamento += generateRemontaMemoriaCalculo(
                'Canino', remontaItemsGrouped['Canino'], form.dias_operacao, form.organizacao, form.ug, faseFinalString,
                allocation.om_destino_recurso, allocation.ug_destino_recurso, 
                allocation.nd_30_value, allocation.nd_39_value
            );
        }
        
        // O registro de Remonta armazena todos os itens consolidados
        const registroRemonta: TablesInsert<'classe_viii_remonta_registros'> = {
            p_trab_id: ptrabId,
            organizacao: allocation.om_destino_recurso,
            ug: allocation.ug_destino_recurso,
            dias_operacao: form.dias_operacao, // Dias globais (para compatibilidade com a tabela)
            animal_tipo: animalTipo, // Tipo predominante
            quantidade_animais: form.itensRemonta.reduce((sum, item) => sum + item.quantidade_animais, 0),
            itens_remonta: form.itensRemonta as any,
            valor_total: valorTotal,
            detalhamento: detalhamento,
            fase_atividade: faseFinalString,
            valor_nd_30: allocation.nd_30_value,
            valor_nd_39: allocation.nd_39_value,
        };
        await supabase.from("classe_viii_remonta_registros").insert([registroRemonta]);
      }
      
      toast.success("Registros de Classe VIII salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registros de Classe VIII:", error);
      toast.error("Erro ao salvar registros de Classe VIII");
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    // A edição é feita reconstruindo o formulário com TODOS os registros da Classe VIII
    setLoading(true);
    resetFormFields();
    
    await fetchRegistros(); // Garante que os dados mais recentes estão no estado
    
    // Reconstruir o estado do formulário com os dados carregados
    reconstructFormState(registrosSaude, registrosRemonta);
    
    // Define a aba correta para visualização
    setSelectedTab(registro.categoria === 'Saúde - KPSI/KPT' ? 'Saúde' : 'Remonta/Veterinária');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const handleDeletarRegistro = async (registro: ClasseVIIIRegistro) => {
    if (!confirm(`Deseja realmente deletar o registro de ${registro.categoria} para ${registro.organizacao}?`)) return;
    
    setLoading(true);
    try {
        const tableName = registro.categoria === 'Saúde - KPSI/KPT' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
        const { error } = await supabase.from(tableName).delete().eq("id", registro.id);
        
        if (error) throw error;
        
        toast.success("Registro excluído!");
        fetchRegistros();
    } catch (error) {
        console.error("Erro ao deletar registro:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  const handleIniciarEdicaoMemoria = (registro: ClasseVIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    try {
      const tableName = registro.categoria === 'Saúde - KPSI/KPT' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          detalhamento_customizado: memoriaEdit.trim() || null,
        })
        .eq("id", registro.id);

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

  const handleRestaurarMemoriaAutomatica = async (registro: ClasseVIIIRegistro) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    try {
      const tableName = registro.categoria === 'Saúde - KPSI/KPT' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(tableName)
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registro.id);

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
  
  const allRegistros = [...registrosSaude, ...registrosRemonta];
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return allRegistros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${registro.ug})`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseVIIIRegistro[]>);
  }, [allRegistros]);


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
              </div>
            </div>

            {/* 2. Configurar Itens por Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                  <TabsList className="grid w-full grid-cols-2">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat} value={cat} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        
                        {/* Tabela de Itens */}
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                            <Table className="w-full">
                                <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                    <TableRow>
                                        <TableHead className="w-[40%]">Item</TableHead>
                                        {cat === 'Saúde' && (
                                            <TableHead className="w-[25%] text-right">Valor Kit</TableHead>
                                        )}
                                        <TableHead className="w-[15%] text-center">{cat === 'Saúde' ? 'Qtd Kits' : 'Qtd Animais'}</TableHead>
                                        {cat === 'Remonta/Veterinária' && (
                                            <TableHead className="w-[15%] text-center">Qtd Dias</TableHead>
                                        )}
                                        <TableHead className="w-[20%] text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentCategoryItems.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={cat === 'Saúde' ? 4 : 4} className="text-center text-muted-foreground">
                                                Nenhum item de diretriz encontrado para esta categoria.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        currentCategoryItems.map((item, index) => {
                                            const isSaude = cat === 'Saúde';
                                            const itemSaude = item as ItemSaude;
                                            const itemRemonta = item as ItemRemonta;
                                            
                                            const quantity = isSaude ? itemSaude.quantidade : itemRemonta.quantidade_animais;
                                            const valorMntDia = isSaude ? itemSaude.valor_mnt_dia : itemRemonta.valor_mnt_dia;
                                            
                                            // Para Remonta, o itemTotal é o valor_mnt_dia do item (calculado no useEffect)
                                            // Se for Saúde, calcula o total do item
                                            const itemTotal = isSaude 
                                                ? calculateSaudeItemTotal(itemSaude)
                                                : currentCategoryTotalValue; // O total é calculado globalmente para Remonta
                                            
                                            const itemLabel = isSaude ? itemSaude.item : itemRemonta.item;
                                            
                                            // Determine unit label for Remonta (Not used in table, but kept for context)
                                            const unitLabel = !isSaude && itemLabel.includes('(Anual)') ? 'ano' : !isSaude && itemLabel.includes('(Mensal)') ? 'mês' : 'dia';
                                            
                                            return (
                                                <TableRow key={itemLabel} className="h-12">
                                                    <TableCell className="font-medium text-sm py-1">
                                                        {itemLabel}
                                                    </TableCell>
                                                    
                                                    {/* Coluna Valor Base (Apenas para Saúde) */}
                                                    {isSaude && (
                                                        <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                            {formatCurrency(valorMntDia)}
                                                            {!isSaude && <span className="ml-1">/ {unitLabel}</span>}
                                                        </TableCell>
                                                    )}
                                                    
                                                    {/* Coluna Qtd Kits / Qtd Animais */}
                                                    <TableCell className="py-1">
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                            value={typeof quantity === 'number' && quantity !== 0 ? quantity.toString() : ""}
                                                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                                                            placeholder="0"
                                                            onKeyDown={handleEnterToNextField}
                                                        />
                                                    </TableCell>
                                                    
                                                    {/* Coluna Qtd Dias (Apenas para Remonta) */}
                                                    {!isSaude && (
                                                        <TableCell className="py-1">
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                                value={itemRemonta.dias_operacao_item || ""}
                                                                onChange={(e) => handleDiasOperacaoChange(index, parseInt(e.target.value) || 0)}
                                                                placeholder={form.dias_operacao.toString()}
                                                                onKeyDown={handleEnterToNextField}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    
                                                    {/* Coluna Total */}
                                                    <TableCell className="text-right font-semibold text-sm py-1">
                                                        {formatCurrency(isSaude ? itemTotal : calculateRemontaItemTotal(itemRemonta))}
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
                  ))}
                </Tabs>
              </div>
            )}

            {/* 3. Itens Adicionados e Consolidação */}
            {valorTotalForm > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itensSaude.length + form.itensRemonta.length})</h3>
                
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
                    const isSaude = categoria === 'Saúde';
                    const totalCategoria = isSaude ? valorTotalSaude : valorTotalRemonta;
                    const allocation = categoryAllocations[categoria as Categoria];
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{categoria}</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const itemSaude = item as ItemSaude;
                            const itemRemonta = item as ItemRemonta;
                            
                            const itemTotal = isSaude 
                                ? calculateSaudeItemTotal(itemSaude)
                                : calculateRemontaItemTotal(itemRemonta);
                            
                            const quantity = isSaude ? itemSaude.quantidade : itemRemonta.quantidade_animais;
                            const unitValue = isSaude ? itemSaude.valor_mnt_dia : itemRemonta.valor_mnt_dia;
                            
                            const unitLabel = isSaude ? 'kit' : (itemRemonta.item.includes('(Anual)') ? 'ano' : itemRemonta.item.includes('(Mensal)') ? 'mês' : 'dia');
                            
                            return (
                              <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                                <span className="font-medium">{isSaude ? itemSaude.item : itemRemonta.item}</span>
                                <span className="text-right">
                                  {quantity} un. x {formatCurrency(unitValue)} / {unitLabel} = {formatCurrency(itemTotal)}
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
                    {loading ? "Aguarde..." : "Salvar Registros"}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {allRegistros.length > 0 && (
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
                                    const isSaude = registro.categoria === 'Saúde - KPSI/KPT';
                                    const badgeStyle = isSaude ? { label: 'Saúde', className: 'bg-red-500 text-white' } : { label: 'Remonta/Vet', className: 'bg-yellow-700 text-white' };
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {isSaude ? 'Saúde' : 'Remonta/Veterinária'}
                                                        </h4>
                                                        <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                                            {badgeStyle.label}
                                                        </Badge>
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
                                                            onClick={() => handleDeletarRegistro(registro)}
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
            {allRegistros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {allRegistros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  const isSaude = registro.categoria === 'Saúde - KPSI/KPT';
                  
                  // Para Remonta, precisamos dos itens originais para gerar a memória
                  const itensParaMemoria = isSaude ? registro.itens_saude as ItemSaude[] : registro.itens_remonta as ItemRemonta[];
                  
                  const memoriaAutomatica = isSaude 
                    ? generateSaudeMemoriaCalculo(
                        itensParaMemoria as ItemSaude[], registro.dias_operacao, om, ug, registro.fase_atividade || '', om, ug, registro.valor_nd_30, registro.valor_nd_39
                      )
                    : generateRemontaMemoriaCalculo(
                        registro.animal_tipo || 'Equino', itensParaMemoria as ItemRemonta[], registro.dias_operacao, om, ug, registro.fase_atividade || '', om, ug, registro.valor_nd_30, registro.valor_nd_39
                      );
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  const badgeStyle = isSaude ? { label: 'Saúde', className: 'bg-red-500 text-white' } : { label: 'Remonta/Vet', className: 'bg-yellow-700 text-white' };
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-foreground">
                                OM Destino: {om} ({ug})
                              </h4>
                              <Badge variant="default" className={cn("w-fit shrink-0", badgeStyle.className)}>
                                  {badgeStyle.label}
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
                                      onClick={() => handleRestaurarMemoriaAutomatica(registro)}
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
                                    onClick={() => handleSalvarMemoriaCustomizada(registro)}
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