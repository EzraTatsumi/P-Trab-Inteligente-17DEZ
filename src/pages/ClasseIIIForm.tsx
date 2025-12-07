import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor, Droplet, Check, ChevronsUpDown, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import RefLPCFormSection from "@/components/RefLPCFormSection";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands, formatCurrencyInput } from "@/lib/formatUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { getClasseIIICategoryBadgeStyle, getClasseIIICategoryLabel } from "@/lib/classeIIIBadgeUtils";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: TipoEquipamento, label: string, icon: React.FC<any> }[] = [
  { key: 'GERADOR', label: 'Gerador', icon: Zap },
  { key: 'EMBARCACAO', label: 'Embarcação', icon: Ship },
  { key: 'EQUIPAMENTO_ENGENHARIA', label: 'Equipamento de Engenharia', icon: Tractor },
  { key: 'MOTOMECANIZACAO', label: 'Motomecanização', icon: Truck },
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  item: string; // nome_equipamento
  categoria: TipoEquipamento;
  consumo_fixo: number; // L/h or km/L
  tipo_combustivel_fixo: CombustivelTipo; // GASOLINA or DIESEL
  unidade_fixa: 'L/h' | 'km/L'; // User input fields
  quantidade: number; // Usage fields (mutually exclusive based on category)
  horas_dia: number; // Used by GERADOR, EMBARCACAO, EQUIPAMENTO_ENGENHARIA
  distancia_percorrida: number; // Used by MOTOMECANIZACAO
  quantidade_deslocamentos: number; // Used by MOTOMECANIZACAO
  dias_utilizados: number; // Days used for this specific equipment
  // Lubricant fields (only for GERADOR, EMBARCACAO)
  consumo_lubrificante_litro: number; // L/100h or L/h
  preco_lubrificante: number; // R$/L
  // NEW: Internal state for masked input (string of digits)
  preco_lubrificante_input: string;
  // NEW: Internal state for raw decimal input (string)
  consumo_lubrificante_input: string;
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number; // Global days of activity (used only for detailing header)
  itens: ItemClasseIII[]; // All items across all categories (SAVED/COMMITTED)
}

interface LubricantAllocation {
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string; // COMBUSTIVEL_CONSOLIDADO, LUBRIFICANTE_CONSOLIDADO
  organizacao: string;
  ug: string;
  quantidade: number;
  dias_operacao: number; // Global days of activity (saved for context)
  tipo_combustivel: string;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  itens_equipamentos?: any;
  fase_atividade?: string;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
  valor_nd_30: number;
  valor_nd_39: number;
}

// NEW INTERFACE FOR GRANULAR DISPLAY
interface GranularDisplayItem {
  id: string; // Unique ID for the display item (e.g., based on original record ID + index)
  om_destino: string;
  ug_destino: string;
  categoria: TipoEquipamento; // GERADOR, EMBARCACAO, etc.
  suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total: number;
  total_litros: number;
  preco_litro: number; // Only for fuel
  dias_operacao: number;
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
  original_registro: ClasseIIIRegistro;
  detailed_items: ItemClasseIII[];
}

// NEW INTERFACE FOR CONSOLIDATED DISPLAY (Seção 4)
interface ConsolidatedSuprimentoGroup {
  om_destino: string;
  ug_destino: string;
  suprimento_tipo: 'COMBUSTIVEL' | 'LUBRIFICANTE';
  total_valor: number;
  total_litros: number;
  // Totais detalhados por categoria (para exibição)
  categoria_totais: Record<TipoEquipamento, { litros: number, valor: number }>;
  // Referência ao registro consolidado original (para ações de edição/deleção)
  original_registro: ClasseIIIRegistro;
}

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

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
  return Math.abs(a - b) < tolerance;
};

// Função auxiliar para calcular litros e valor de um item (AGORA RETORNA DETALHES DA FÓRMULA)
const calculateItemTotals = (item: ItemClasseIII, refLPC: RefLPC | null, diasOperacao: number) => {
  const diasUtilizados = item.dias_utilizados || 0;
  let litrosSemMargemItem = 0;
  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
  let formulaLitros = '';
  
  if (diasUtilizados > 0) {
    if (isMotomecanizacao) {
      if (item.consumo_fixo > 0) {
        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
        formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} dias) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
      }
    } else {
      litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
      formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} dias`;
    }
  }
  
  const totalLitros = litrosSemMargemItem * 1.3;
  const precoLitro = item.tipo_combustivel_fixo === 'GASOLINA' 
    ? (refLPC?.preco_gasolina ?? 0) 
    : (refLPC?.preco_diesel ?? 0);
  const valorCombustivel = totalLitros * precoLitro;
  
  let valorLubrificante = 0;
  let litrosLubrificante = 0;
  const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
  if (isLubricantType && item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0 && diasUtilizados > 0) {
    const totalHoras = item.quantidade * item.horas_dia * diasUtilizados;
    
    if (item.categoria === 'GERADOR') {
      litrosLubrificante = (totalHoras / 100) * item.consumo_lubrificante_litro;
    } else if (item.categoria === 'EMBARCACAO') {
      litrosLubrificante = totalHoras * item.consumo_lubrificante_litro;
    }
    
    valorLubrificante = litrosLubrificante * item.preco_lubrificante;
  }
  
  const itemTotal = valorCombustivel + valorLubrificante;
  
  return { 
    totalLitros, 
    valorCombustivel, 
    valorLubrificante, 
    litrosLubrificante, // Adicionado litros de lubrificante
    itemTotal,
    formulaLitros,
    precoLitro,
    litrosSemMargemItem, // Adicionado para detalhamento na UI
  };
};

// Função auxiliar para calcular totais de um grupo granular
const calculateGranularTotals = (
  items: ItemClasseIII[], 
  refLPC: RefLPC | null, 
  diasOperacao: number, 
  suprimento_tipo: GranularDisplayItem['suprimento_tipo']
) => {
    let totalValor = 0;
    let totalLitros = 0;
    let precoLitro = 0;
    
    items.forEach(item => {
        const totals = calculateItemTotals(item, refLPC, diasOperacao);
        
        if (suprimento_tipo === 'LUBRIFICANTE') {
            totalValor += totals.valorLubrificante;
            totalLitros += totals.litrosLubrificante;
        } else {
            totalValor += totals.valorCombustivel;
            totalLitros += totals.totalLitros;
            precoLitro = totals.precoLitro; // Assuming price is consistent within the group
        }
    });
    
    return { totalValor, totalLitros, precoLitro };
};

// Função auxiliar para gerar a memória de cálculo detalhada para um item granular
const generateGranularMemoriaCalculo = (item: GranularDisplayItem, refLPC: RefLPC | null, rmFornecimento: string, codugRmFornecimento: string): string => {
    const { om_destino, ug_destino, categoria, suprimento_tipo, valor_total, total_litros, preco_litro, dias_operacao, fase_atividade, detailed_items } = item;
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    const totalEquipamentos = detailed_items.reduce((sum, item) => sum + item.quantidade, 0);
    
    const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };
    
    const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
    const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
    const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';

    if (suprimento_tipo === 'LUBRIFICANTE') {
        // MEMÓRIA LUBRIFICANTE (GRANULAR)
        return `33.90.30 - Aquisição de Lubrificante para ${getClasseIIICategoryLabel(categoria)} (${totalEquipamentos} equipamentos), durante ${dias_operacao} dias de ${faseFormatada}.
OM Destino Recurso: ${om_destino} (UG: ${ug_destino})

Cálculo:
Fórmula Base: (Nr Equipamentos x Nr Horas utilizadas/dia x Nr dias de utilização) x Consumo Lubrificante/hora (ou /100h).

Detalhes dos Itens:
${detailed_items.map(item => {
    const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, dias_operacao);
    
    return `- ${item.quantidade} ${item.item} (${item.categoria}): Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/${item.categoria === 'GERADOR' ? '100h' : 'h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}. Litros: ${formatNumber(litrosLubrificante, 2)} L. Valor: ${formatCurrency(valorLubrificante)}.`;
}).join('\n')}

Total Litros: ${formatNumber(total_litros, 2)} L.
Valor Total: ${formatCurrency(valor_total)}.`;
    } else {
        // MEMÓRIA COMBUSTÍVEL (GRANULAR)
        const tipoCombustivel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'Gasolina' : 'Diesel';
        const unidadeLabel = suprimento_tipo === 'COMBUSTIVEL_GASOLINA' ? 'Gas' : 'OD';
        
        let totalLitrosSemMargem = 0;
        let detalhes: string[] = [];
        
        detailed_items.forEach(item => {
            const { litrosSemMargemItem, formulaLitros } = calculateItemTotals(item, refLPC, dias_operacao);
            totalLitrosSemMargem += litrosSemMargemItem;
            detalhes.push(`- ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidadeLabel}.`);
        });
        
        return `33.90.30 - Aquisição de Combustível (${tipoCombustivel}) para ${getClasseIIICategoryLabel(categoria)} (${totalEquipamentos} equipamentos), durante ${dias_operacao} dias de ${faseFormatada}, para ${om_destino}.

Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${tipoCombustivel} - ${formatCurrency(preco_litro)}.

Fórmula: (Nr Equipamentos x Nr Horas/Km x Consumo) x Nr dias de utilização.

${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(total_litros)} L ${unidadeLabel}.
Valor: ${formatNumber(total_litros)} L ${unidadeLabel} x ${formatCurrency(preco_litro)} = ${formatCurrency(valor_total)}.`;
    }
};


const ClasseIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [isLpcLoaded, setIsLpcLoaded] = useState(false); // NOVO ESTADO
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<TipoEquipamento>(CATEGORIAS[0].key);
  
  // NOVO ESTADO: Itens em edição na aba atual (não salvos no form.itens)
  const [localCategoryItems, setLocalCategoryItems] = useState<ItemClasseIII[]>([]);
  
  const [form, setForm] = useState<FormDataClasseIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [], // All items across all categories (SAVED/COMMITTED)
  });
  const [rmFornecimento, setRmFornecimento] = useState("");
  const [codugRmFornecimento, setCodugRmFornecimento] = useState("");
  const [lubricantAllocation, setLubricantAllocation] = useState<LubricantAllocation>({
    om_destino_recurso: "",
    ug_destino_recurso: "",
    selectedOmDestinoId: undefined,
  });
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [allDiretrizItems, setAllDiretrizItems] = useState<Record<TipoEquipamento, TipoEquipamentoDetalhado[]>>({
    GERADOR: [],
    EMBARCACAO: [],
    EQUIPAMENTO_ENGENHARIA: [],
    MOTOMECANIZACAO: []
  });
  const { handleEnterToNextField } = useFormNavigation();
  const lpcRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadInitialData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);

  const loadInitialData = async () => {
    setLoading(true);
    await loadAllDiretrizItems(); // Load directives first
    
    // Carrega LPC primeiro
    await loadRefLPC();
    setIsLpcLoaded(true); // Marca que o LPC foi carregado (mesmo que seja null)
    
    // Depois carrega os registros
    await fetchRegistros(true); 
    
    setLoading(false);
  };

  const loadAllDiretrizItems = async () => {
    const results = await Promise.all(CATEGORIAS.map(c => getEquipamentosPorTipo(c.key)));
    const newDiretrizItems: Record<TipoEquipamento, TipoEquipamentoDetalhado[]> = {
      GERADOR: results[0],
      EMBARCACAO: results[1],
      EQUIPAMENTO_ENGENHARIA: results[2],
      MOTOMECANIZACAO: results[3],
    };
    setAllDiretrizItems(newDiretrizItems);
  };

  const loadRefLPC = async () => {
    try {
      const { data, error } = await supabase
        .from("p_trab_ref_lpc")
        .select("*")
        .eq("p_trab_id", ptrabId!)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRefLPC(data as RefLPC);
      } else {
        setRefLPC(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar referência LPC:", error);
      setRefLPC(null);
    }
  };

  const handleRefLPCUpdate = (newRefLPC: RefLPC) => {
    setRefLPC(newRefLPC);
    toast.success("Referência LPC atualizada!");
  };

  const fetchRegistros = async (initialLoad = false) => {
    if (!ptrabId) return;
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true })
      .order("tipo_equipamento", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }
    setRegistros((data || []) as ClasseIIIRegistro[]);
    if (initialLoad && data && data.length > 0) {
      // Ensure directives are loaded before reconstruction
      if (Object.values(allDiretrizItems).flat().length === 0) {
        await loadAllDiretrizItems();
      }
      reconstructFormState(data as ClasseIIIRegistro[]);
    } else if (!initialLoad) {
      // If not initial load (e.g., after save/delete), just reset form fields
      resetFormFields();
    }
  };

  const reconstructFormState = (records: ClasseIIIRegistro[]) => {
    const combustivelRecords = records.filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO');
    const lubricantRecords = records.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO');
    
    if (combustivelRecords.length === 0 && lubricantRecords.length === 0) {
      resetFormFields();
      return;
    }
    
    const firstRecord = combustivelRecords[0] || lubricantRecords[0];
    
    // 1. Extract global data (OM, Days, Fases)
    const omName = firstRecord.organizacao;
    const ug = firstRecord.ug;
    const diasOperacao = firstRecord.dias_operacao;
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    // 2. Extract RM Fornecimento (from detailing)
    const rmMatch = firstRecord.detalhamento?.match(/Fornecido por: (.*?) \(CODUG: (.*?)\)/);
    if (rmMatch) {
      setRmFornecimento(rmMatch[1]);
      setCodugRmFornecimento(rmMatch[2]);
    }
    
    // 3. Extract Lubricant Allocation
    if (lubricantRecords.length > 0) {
      const lubRecord = lubricantRecords[0];
      setLubricantAllocation({
        om_destino_recurso: lubRecord.organizacao,
        ug_destino_recurso: lubRecord.ug,
        selectedOmDestinoId: undefined, // Will be fetched below
      });
    } else {
      setLubricantAllocation({
        om_destino_recurso: omName,
        ug_destino_recurso: ug,
        selectedOmDestinoId: undefined
      });
    }
    
    // 4. Consolidate all ItemClasseIII data
    let consolidatedItems: ItemClasseIII[] = [];
    [...combustivelRecords, ...lubricantRecords].forEach(r => {
      if (r.itens_equipamentos && Array.isArray(r.itens_equipamentos)) {
        (r.itens_equipamentos as any[]).forEach(item => {
          const baseCategory = item.categoria as TipoEquipamento;
          const directiveItem = allDiretrizItems[baseCategory]?.find(d => d.nome === item.tipo_equipamento_especifico);
          
          if (directiveItem) {
            const precoLubrificante = item.preco_lubrificante || 0;
            // Converte o preço para a string de dígitos (centavos) para o input mascarado
            const precoLubrificanteInput = precoLubrificante > 0 
              ? String(Math.round(precoLubrificante * 100))
              : "";
            
            const consumoLubrificante = item.consumo_lubrificante_litro || 0;
            const consumoLubrificanteInput = consumoLubrificante > 0 
              ? formatNumberForInput(consumoLubrificante, 2)
              : "";
            
            const newItem: ItemClasseIII = {
              item: directiveItem.nome,
              categoria: baseCategory,
              consumo_fixo: directiveItem.consumo,
              tipo_combustivel_fixo: directiveItem.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL',
              unidade_fixa: directiveItem.unidade,
              quantidade: item.quantidade || 0,
              horas_dia: item.horas_dia || 0,
              distancia_percorrida: item.distancia_percorrida || 0,
              quantidade_deslocamentos: item.quantidade_deslocamentos || 0,
              dias_utilizados: item.dias_utilizados || 0,
              consumo_lubrificante_litro: consumoLubrificante,
              preco_lubrificante: precoLubrificante,
              preco_lubrificante_input: precoLubrificanteInput,
              consumo_lubrificante_input: consumoLubrificanteInput,
            };
            consolidatedItems.push(newItem);
          }
        });
      }
    });
    
    // 5. Fetch OM IDs
    const fetchOmId = async (nome: string, ug: string) => {
      if (!nome || !ug) return undefined;
      const { data } = await supabase
        .from('organizacoes_militares')
        .select('id, rm_vinculacao, codug_rm_vinculacao')
        .eq('nome_om', nome)
        .eq('codug_om', ug)
        .maybeSingle();
      return { id: data?.id, rm: data?.rm_vinculacao, codugRm: data?.codug_rm_vinculacao };
    };
    
    Promise.all([
      fetchOmId(omName, ug),
      fetchOmId(lubricantRecords[0]?.organizacao || '', lubricantRecords[0]?.ug || '')
    ]).then(([omData, lubOmData]) => {
      setForm({
        selectedOmId: omData?.id,
        organizacao: omName,
        ug: ug,
        dias_operacao: diasOperacao,
        itens: consolidatedItems,
      });
      setRmFornecimento(omData?.rm || rmFornecimento);
      setCodugRmFornecimento(omData?.codugRm || codugRmFornecimento);
      setLubricantAllocation(prev => ({
        ...prev,
        selectedOmDestinoId: lubOmData?.id
      }));
    });
  };

  const resetFormFields = () => {
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setRmFornecimento("");
    setCodugRmFornecimento("");
    setLubricantAllocation({
      om_destino_recurso: "",
      ug_destino_recurso: "",
      selectedOmDestinoId: undefined,
    });
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    setLocalCategoryItems([]); // Limpa também o estado local
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm(prev => ({
        ...prev,
        selectedOmId: omData.id,
        organizacao: omData.nome_om,
        ug: omData.codug_om
      }));
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
      // Default lubricant destination to OM Detentora
      setLubricantAllocation({
        om_destino_recurso: omData.nome_om,
        ug_destino_recurso: omData.codug_om,
        selectedOmDestinoId: omData.id,
      });
    } else {
      setForm(prev => ({
        ...prev,
        selectedOmId: undefined,
        organizacao: "",
        ug: ""
      }));
      setRmFornecimento("");
      setCodugRmFornecimento("");
      setLubricantAllocation({
        om_destino_recurso: "",
        ug_destino_recurso: "",
        selectedOmDestinoId: undefined,
      });
    }
  };

  const handleOMLubrificanteChange = (omData: OMData | undefined) => {
    setLubricantAllocation({
      om_destino_recurso: omData?.nome_om || "",
      ug_destino_recurso: omData?.codug_om || "",
      selectedOmDestinoId: omData?.id,
    });
  };

  const handleRMFornecimentoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimento(rmName);
    setCodugRmFornecimento(rmCodug);
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // --- Item Management Logic (Uses localCategoryItems) ---
  
  // Efeito para carregar os itens da categoria atual no estado local
  useEffect(() => {
    const availableItems = allDiretrizItems[selectedTab] || [];
    const existingItemsMap = new Map<string, ItemClasseIII>();
    
    // Pega os itens salvos (form.itens) da categoria atual
    form.itens.filter(i => i.categoria === selectedTab).forEach(item => {
      existingItemsMap.set(item.item, item);
    });
    
    const mergedItems: ItemClasseIII[] = availableItems.map(directive => {
      const existing = existingItemsMap.get(directive.nome);
      if (existing) {
        return existing;
      }
      return {
        item: directive.nome,
        categoria: selectedTab,
        consumo_fixo: directive.consumo,
        tipo_combustivel_fixo: directive.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL',
        unidade_fixa: directive.unidade,
        quantidade: 0,
        horas_dia: 0,
        distancia_percorrida: 0,
        quantidade_deslocamentos: 0,
        dias_utilizados: 0,
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
        preco_lubrificante_input: "",
        consumo_lubrificante_input: "",
      };
    });
    
    setLocalCategoryItems(mergedItems);
  }, [selectedTab, allDiretrizItems, form.itens]); // Depende de form.itens para recarregar após salvar/reconstruir

  const handleItemFieldChange = (itemIndex: number, field: keyof ItemClasseIII, value: any) => {
    const updatedItems = [...localCategoryItems];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value };
    setLocalCategoryItems(updatedItems);
    // NOTA: form.itens NÃO é atualizado aqui.
  };

  const handleItemNumericChange = (itemIndex: number, field: keyof ItemClasseIII, inputString: string) => {
    const cleanedValue = inputString.replace(/[^\d,.]/g, '');
    
    if (field === 'quantidade' || field === 'quantidade_deslocamentos' || field === 'dias_utilizados') {
      const numericValue = parseInt(cleanedValue.replace(/[,.]/g, '')) || 0;
      handleItemFieldChange(itemIndex, field, numericValue);
      return;
    }
    
    if (field === 'preco_lubrificante_input') {
      const digits = inputString.replace(/\D/g, '');
      const { numericValue } = formatCurrencyInput(digits);
      
      const updatedItems = [...localCategoryItems];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        preco_lubrificante_input: digits,
        preco_lubrificante: numericValue,
      };
      setLocalCategoryItems(updatedItems);
      return;
    }
    
    if (field === 'consumo_lubrificante_input') {
      const numericValue = parseInputToNumber(inputString);
      const updatedItems = [...localCategoryItems];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        consumo_lubrificante_litro: numericValue,
      };
      setLocalCategoryItems(updatedItems);
      return;
    }
    
    const numericValue = parseInputToNumber(cleanedValue);
    handleItemFieldChange(itemIndex, field, numericValue);
  };

  const handleItemNumericBlur = (itemIndex: number, field: keyof ItemClasseIII, inputString: string) => {
    if (field === 'consumo_lubrificante_input') {
      const numericValue = parseInputToNumber(inputString);
      const formattedString = numericValue === 0 
        ? "" 
        : formatNumberForInput(numericValue, 2);
      handleItemFieldChange(itemIndex, 'consumo_lubrificante_input', formattedString);
      return;
    }
  };

  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
      toast.error("Preencha a OM e os Dias de Atividade (Global) antes de salvar itens.");
      return;
    }
    
    const itemsToKeep = localCategoryItems.filter(item => 
      item.quantidade > 0 && item.dias_utilizados > 0
    );
    
    if (itemsToKeep.length > 0 && itemsToKeep.some(item => 
      item.categoria !== 'MOTOMECANIZACAO' && item.horas_dia <= 0
    )) {
      toast.error("Preencha as Horas/Dia para todos os equipamentos ativos.");
      return;
    }
    
    if (itemsToKeep.length > 0 && itemsToKeep.some(item => 
      item.categoria === 'MOTOMECANIZACAO' && (
        item.distancia_percorrida <= 0 || item.quantidade_deslocamentos <= 0
      )
    )) {
      toast.error("Preencha KM/Desloc e Desloc/Dia para todas as viaturas ativas.");
      return;
    }
    
    // AQUI É O PONTO CHAVE: Remove os itens antigos da categoria atual e adiciona os novos (localCategoryItems filtrados)
    const itemsFromOtherCategories = form.itens.filter(item => item.categoria !== selectedTab);
    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];
    
    // Atualiza o estado principal (que alimenta a Seção 3)
    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens da categoria ${selectedTab} atualizados!`);
  };

  // --- Calculation Logic (Memoized) ---
  const { consolidadosCombustivel, consolidadoLubrificante, itensAgrupadosPorCategoria } = useMemo(() => {
    // Usa form.itens (itens salvos) para o cálculo de consolidação e resumo da Seção 3
    const itens = form.itens.filter(item => item.quantidade > 0 && item.dias_utilizados > 0);
    
    // Agrupamento de itens do formulário por categoria (para Seção 3)
    const groupedFormItems = itens.reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<TipoEquipamento, ItemClasseIII[]>);
    
    if (itens.length === 0 || !refLPC || form.dias_operacao === 0) {
      return { consolidadosCombustivel: [], consolidadoLubrificante: null, itensAgrupadosPorCategoria: groupedFormItems };
    }
    
    // --- CÁLCULO DE COMBUSTÍVEL (ND 33.90.30) ---
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (!grupos[item.tipo_combustivel_fixo]) {
        grupos[item.tipo_combustivel_fixo] = [];
      }
      grupos[item.tipo_combustivel_fixo].push(item);
      return grupos;
    }, {} as Record<CombustivelTipo, ItemClasseIII[]>);
    
    const novosConsolidados: any[] = [];
    
    Object.entries(gruposPorCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      const precoLitro = tipoCombustivel === 'GASOLINA' 
        ? refLPC.preco_gasolina 
        : refLPC.preco_diesel;
      
      let totalLitrosSemMargem = 0;
      let detalhes: string[] = [];
      
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      itensGrupo.forEach(item => {
        let litrosSemMargemItem = 0;
        let formulaDetalhe = '';
        const diasUtilizados = item.dias_utilizados || 0;
        
        if (item.categoria === 'MOTOMECANIZACAO') {
          litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
          formulaDetalhe = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} dias) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
        } else {
          litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
          formulaDetalhe = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} dias`;
        }
        
        totalLitrosSemMargem += litrosSemMargemItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${formulaDetalhe} = ${formatNumber(litrosSemMargemItem)} L ${unidade}.`);
      });
      
      const totalLitros = totalLitrosSemMargem * 1.3;
      const valorTotal = totalLitros * precoLitro;
      
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      
      const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      };
      
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? `(${refLPC.nome_local})` : '';
      
      const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      // REESTRUTURAÇÃO DA MEMÓRIA DE CÁLCULO DE COMBUSTÍVEL (NOVO PADRÃO)
      let detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} equipamentos, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}.

Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(precoLitro)}.

Fórmula: (Nr Equipamentos x Nr Horas/Km x Consumo) x Nr dias de utilização.

${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(precoLitro)} = ${formatCurrency(valorTotal)}.`;
      
      novosConsolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });
    
    // 2. Preparar registro de LUBRIFICANTE (ND 33.90.30)
    let totalLitrosLubrificante = 0;
    let totalValorLubrificante = 0;
    const itensComLubrificante = itens.filter(item => 
      item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0
    );
    const detalhesLubrificante: string[] = [];
    
    itensComLubrificante.forEach(item => {
      const diasUtilizados = item.dias_utilizados || 0;
      const totalHoras = item.quantidade * item.horas_dia * diasUtilizados;
      let litrosItem = 0;
      let formulaDetalhe = '';
      
      if (item.categoria === 'GERADOR') {
        litrosItem = (totalHoras / 100) * item.consumo_lubrificante_litro;
        formulaDetalhe = `(${formatNumber(totalHoras)} horas) / 100h x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/100h`;
      } else if (item.categoria === 'EMBARCACAO') {
        litrosItem = totalHoras * item.consumo_lubrificante_litro;
        formulaDetalhe = `(${formatNumber(totalHoras)} horas) x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/h`;
      }
      
      const valorItem = litrosItem * item.preco_lubrificante;
      totalLitrosLubrificante += litrosItem;
      totalValorLubrificante += valorItem;
      
      detalhesLubrificante.push(`- ${item.quantidade} ${item.item} (${item.categoria}): Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/${item.categoria === 'GERADOR' ? '100h' : 'h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}. Litros: ${formatNumber(litrosItem, 2)} L. Valor: ${formatCurrency(valorItem)}.`);
    });
    
    let consolidadoLubrificante: any | null = null;
    if (totalLitrosLubrificante > 0) {
      const totalEquipamentos = itensComLubrificante.reduce((sum, item) => sum + item.quantidade, 0);
      
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      // REESTRUTURAÇÃO DA MEMÓRIA DE CÁLCULO DE LUBRIFICANTE (NOVO PADRÃO)
      const detalhamentoLubrificante = `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} equipamentos, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}.

OM Destino Recurso: ${lubricantAllocation.om_destino_recurso} (UG: ${lubricantAllocation.ug_destino_recurso})

Cálculo:
Fórmula Base: (Nr Equipamentos x Nr Horas utilizadas/dia x Nr dias de utilização) x Consumo Lubrificante/hora (ou /100h).

Detalhes dos Itens:
${itensComLubrificante.map(item => {
    const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
    
    return `- ${item.quantidade} ${item.item} (${item.categoria}): Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/${item.categoria === 'GERADOR' ? '100h' : 'h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}. Litros: ${formatNumber(litrosLubrificante, 2)} L. Valor: ${formatCurrency(valorLubrificante)}.`;
}).join('\n')}

Total Litros: ${formatNumber(totalLitrosLubrificante, 2)} L.
Valor Total: ${formatCurrency(totalValorLubrificante)}.`;
      
      consolidadoLubrificante = {
        total_litros: totalLitrosLubrificante,
        valor_total: totalValorLubrificante,
        itens: itensComLubrificante,
        detalhamento: detalhamentoLubrificante,
      };
    }
    
    return { consolidadosCombustivel: novosConsolidados, consolidadoLubrificante, itensAgrupadosPorCategoria: groupedFormItems };
  }, [
    form.itens, refLPC, form.dias_operacao, form.organizacao, rmFornecimento, codugRmFornecimento,
    lubricantAllocation, fasesAtividade, customFaseAtividade, allDiretrizItems
  ]);
  
  const itensAgrupadosPorCategoriaParaResumo = itensAgrupadosPorCategoria;

  // NEW MEMO: Map category keys to their correct title-cased labels
  const categoryLabelMap = useMemo(() => {
    return CATEGORIAS.reduce((acc, cat) => {
        acc[cat.key] = cat.label;
        return acc;
    }, {} as Record<TipoEquipamento, string>);
  }, []);

  // --- Calculation Logic for Current Tab (Uses localCategoryItems) ---
  const { 
    currentCategoryTotalCombustivel, 
    currentCategoryTotalLubrificante, 
    currentCategoryTotalValue,
    currentCategoryDieselLitros,
    currentCategoryGasolinaLitros,
    currentCategoryGasolinaValor,
    currentCategoryDieselValor,
  } = useMemo(() => {
    let totalCombustivel = 0;
    let totalLubrificante = 0;
    let dieselLitros = 0;
    let gasolinaLitros = 0;
    let dieselValor = 0;
    let gasolinaValor = 0;

    localCategoryItems.forEach(item => {
      if (form.dias_operacao === 0) return;
      
      const { totalLitros, valorCombustivel, valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
      
      totalCombustivel += valorCombustivel;
      totalLubrificante += valorLubrificante;
      
      if (item.tipo_combustivel_fixo === 'DIESEL') {
        dieselLitros += totalLitros;
        dieselValor += valorCombustivel;
      } else {
        gasolinaLitros += totalLitros;
        gasolinaValor += valorCombustivel;
      }
    });

    return { 
      currentCategoryTotalCombustivel: totalCombustivel, 
      currentCategoryTotalLubrificante: totalLubrificante, 
      currentCategoryTotalValue: totalCombustivel + totalLubrificante,
      currentCategoryDieselLitros: dieselLitros,
      currentCategoryGasolinaLitros: gasolinaLitros,
      currentCategoryGasolinaValor: gasolinaValor,
      currentCategoryDieselValor: dieselValor,
    };
  }, [localCategoryItems, refLPC, form.dias_operacao]);
  
  // --- NOVO MEMO: GERA REGISTROS GRANULARES PARA EXIBIÇÃO (USADO APENAS PARA MEMÓRIA) ---
  const granularRegistros = useMemo(() => {
    if (!refLPC) return [];
    
    const granular: GranularDisplayItem[] = [];
    let idCounter = 0;

    registros.forEach(registro => {
        const itens = (registro.itens_equipamentos || []) as ItemClasseIII[];
        const isLubricantConsolidated = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
        
        // Group items by Category and Fuel Type (if applicable)
        const groups: Record<string, ItemClasseIII[]> = {};
        
        itens.forEach(item => {
            const category = item.categoria;
            let key: string;
            
            if (isLubricantConsolidated) {
                // Lubrificante is only relevant for GERADOR and EMBARCACAO and if used
                if (item.consumo_lubrificante_litro > 0 && (category === 'GERADOR' || category === 'EMBARCACAO')) {
                    key = `${category}_LUBRIFICANTE`;
                } else {
                    return;
                }
            } else {
                // Combustível
                key = `${category}_COMBUSTIVEL_${item.tipo_combustivel_fixo}`;
            }
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });
        
        Object.entries(groups).forEach(([key, detailed_items]) => {
            const [categoryStr, typeStr, fuelTypeStr] = key.split('_');
            const category = categoryStr as TipoEquipamento;
            
            let suprimento_tipo: GranularDisplayItem['suprimento_tipo'];
            
            if (typeStr === 'LUBRIFICANTE') {
                suprimento_tipo = 'LUBRIFICANTE';
            } else {
                suprimento_tipo = fuelTypeStr === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
            }
            
            const { totalValor, totalLitros, precoLitro } = calculateGranularTotals(
                detailed_items, 
                refLPC, 
                registro.dias_operacao, 
                suprimento_tipo
            );
            
            // Only include if total value > 0
            if (totalValor > 0) {
                granular.push({
                    id: `${registro.id}-${idCounter++}`,
                    om_destino: registro.organizacao,
                    ug_destino: registro.ug,
                    categoria: category,
                    suprimento_tipo: suprimento_tipo,
                    valor_total: totalValor,
                    total_litros: totalLitros,
                    preco_litro: precoLitro,
                    dias_operacao: registro.dias_operacao,
                    fase_atividade: registro.fase_atividade || '',
                    valor_nd_30: totalValor, // All Classe III is ND 30
                    valor_nd_39: 0,
                    original_registro: registro,
                    detailed_items: detailed_items,
                });
            }
        });
    });
    
    return granular.sort((a, b) => a.om_destino.localeCompare(b.om_destino) || a.categoria.localeCompare(b.categoria));
}, [registros, refLPC]);

// --- NOVO MEMO: AGRUPAMENTO POR OM E TIPO DE SUPRIMENTO (PARA SEÇÃO 4) ---
const registrosAgrupadosPorSuprimento = useMemo(() => {
    const groupedByOm: Record<string, { om: string, ug: string, total: number, suprimentos: ConsolidatedSuprimentoGroup[] }> = {};

    // 1. Agrupar os registros consolidados originais por OM
    registros.forEach(registro => {
        const omKey = `${registro.organizacao} (${registro.ug})`;
        const isLubricant = registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
        const suprimentoType: 'COMBUSTIVEL' | 'LUBRIFICANTE' = isLubricant ? 'LUBRIFICANTE' : 'COMBUSTIVEL';
        
        if (!groupedByOm[omKey]) {
            groupedByOm[omKey] = { om: registro.organizacao, ug: registro.ug, total: 0, suprimentos: [] };
        }
        
        // Find existing suprimento group or create a new one
        let suprimentoGroup = groupedByOm[omKey].suprimentos.find(s => s.suprimento_tipo === suprimentoType && s.original_registro.tipo_combustivel === registro.tipo_combustivel);

        if (!suprimentoGroup) {
            suprimentoGroup = {
                om_destino: registro.organizacao,
                ug_destino: registro.ug,
                suprimento_tipo: suprimentoType,
                total_valor: 0,
                total_litros: 0,
                categoria_totais: {
                    GERADOR: { litros: 0, valor: 0 },
                    EMBARCACAO: { litros: 0, valor: 0 },
                    EQUIPAMENTO_ENGENHARIA: { litros: 0, valor: 0 },
                    MOTOMECANIZACAO: { litros: 0, valor: 0 },
                },
                original_registro: registro, // Keep reference to the original record for actions
            };
            groupedByOm[omKey].suprimentos.push(suprimentoGroup);
        }
        
        groupedByOm[omKey].total += registro.valor_total;
        suprimentoGroup.total_valor += registro.valor_total;

        // 2. Calcular totais por categoria dentro deste registro consolidado
        const itens = (registro.itens_equipamentos || []) as ItemClasseIII[];
        let totalLitrosRegistro = 0;
        
        itens.forEach(item => {
            const totals = calculateItemTotals(item, refLPC, registro.dias_operacao);
            const categoria = item.categoria;

            if (isLubricant) {
                suprimentoGroup!.categoria_totais[categoria].litros += totals.litrosLubrificante;
                suprimentoGroup!.categoria_totais[categoria].valor += totals.valorLubrificante;
                totalLitrosRegistro += totals.litrosLubrificante;
            } else {
                // Combustível
                suprimentoGroup!.categoria_totais[categoria].litros += totals.totalLitros;
                suprimentoGroup!.categoria_totais[categoria].valor += totals.valorCombustivel;
                totalLitrosRegistro += totals.totalLitros;
            }
        });
        
        suprimentoGroup.total_litros += totalLitrosRegistro;
    });

    return groupedByOm;
}, [registros, refLPC]);

// --- NOVO MEMO: REGISTROS PARA MEMÓRIA (SEÇÃO 5) ---
const getMemoriaRecords = granularRegistros;

  // --- Save Logic ---
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!refLPC) {
      toast.error("Configure a referência LPC antes de salvar");
      return;
    }
    if (!form.organizacao || !form.ug) {
      toast.error("Selecione uma OM");
      return;
    }
    if (!rmFornecimento || !codugRmFornecimento) {
      toast.error("Selecione a RM de Fornecimento de Combustível");
      return;
    }
    if (form.itens.filter(i => i.quantidade > 0 && i.dias_utilizados > 0).length === 0) {
      toast.error("Adicione pelo menos um equipamento com quantidade e dias de utilização maior que zero (e salve a categoria).");
      return;
    }
    if (consolidadoLubrificante && (!lubricantAllocation.om_destino_recurso || !lubricantAllocation.ug_destino_recurso)) {
      toast.error("Selecione a OM de destino do Lubrificante (ND 30)");
      return;
    }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividade.trim()];
    }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Preparar registros de COMBUSTÍVEL (ND 33.90.30)
    for (const consolidado of consolidadosCombustivel) {
      const precoLitro = consolidado.tipo_combustivel === 'GASOLINA' 
        ? refLPC.preco_gasolina 
        : refLPC.preco_diesel;
      
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'COMBUSTIVEL_CONSOLIDADO',
        organizacao: form.organizacao,
        ug: form.ug,
        quantidade: consolidado.itens.reduce((sum: number, item: ItemClasseIII) => sum + item.quantidade, 0),
        dias_operacao: form.dias_operacao, // Salva o dia global para contexto
        tipo_combustivel: consolidado.tipo_combustivel,
        preco_litro: precoLitro,
        total_litros: consolidado.total_litros,
        total_litros_sem_margem: consolidado.total_litros_sem_margem,
        valor_total: consolidado.valor_total,
        detalhamento: consolidado.detalhamento,
        itens_equipamentos: consolidado.itens.map((item: ItemClasseIII) => ({
          ...item,
          tipo_equipamento_especifico: item.item,
        })) as any,
        fase_atividade: faseFinalString,
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
        valor_nd_30: consolidado.valor_total, // Classe III Combustível é ND 30
        valor_nd_39: 0,
      };
      registrosParaSalvar.push(registro);
    }
    
    // 2. Preparar registro de LUBRIFICANTE (ND 33.90.30)
    if (consolidadoLubrificante) {
      const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'LUBRIFICANTE_CONSOLIDADO',
        organizacao: lubricantAllocation.om_destino_recurso,
        ug: lubricantAllocation.ug_destino_recurso,
        quantidade: consolidadoLubrificante.itens.reduce((sum: number, item: ItemClasseIII) => sum + item.quantidade, 0),
        dias_operacao: form.dias_operacao, // Salva o dia global para contexto
        tipo_combustivel: 'LUBRIFICANTE',
        preco_litro: 0,
        total_litros: consolidadoLubrificante.total_litros,
        total_litros_sem_margem: consolidadoLubrificante.total_litros,
        valor_total: consolidadoLubrificante.valor_total,
        detalhamento: consolidadoLubrificante.detalhamento,
        itens_equipamentos: consolidadoLubrificante.itens.map((item: ItemClasseIII) => ({
          ...item,
          tipo_equipamento_especifico: item.item,
        })) as any,
        fase_atividade: faseFinalString,
        consumo_lubrificante_litro: consolidadoLubrificante.itens[0]?.consumo_lubrificante_litro || 0,
        preco_lubrificante: consolidadoLubrificante.itens[0]?.preco_lubrificante || 0,
        valor_nd_30: consolidadoLubrificante.valor_total, // Classe III Lubrificante é ND 30
        valor_nd_39: 0,
      };
      registrosParaSalvar.push(registroLubrificante);
    }
    
    try {
      setLoading(true);
      // 3. Deletar TODOS os registros de Classe III existentes para este PTrab
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId);
      if (deleteError) {
        throw deleteError;
      }
      
      // 4. Inserir novos registros
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe III atualizados com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      fetchRegistros(); // Reload data
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de Classe III:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // --- UI Helpers ---
  const handleDeletarConsolidado = async (id: string) => {
    if (!confirm("Deseja realmente deletar este registro consolidado?")) return;
    const { error } = await supabase
      .from("classe_iii_registros")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao deletar registro");
      console.error(error);
      return;
    }
    toast.success("Registro deletado!");
    fetchRegistros();
  };

  const handleEditarConsolidado = (registro: ClasseIIIRegistro) => {
    // Ao editar, reconstruímos o estado principal (form.itens) e o useEffect recarrega o localCategoryItems
    fetchRegistros(true).then(() => {
      if (registro.itens_equipamentos && registro.itens_equipamentos.length > 0) {
        const firstItemCategory = (registro.itens_equipamentos as any[])[0].categoria as TipoEquipamento;
        setSelectedTab(firstItemCategory);
      } else {
        setSelectedTab(CATEGORIAS[0].key);
      }
    });
  };

  const handleIniciarEdicaoMemoria = (registro: ClasseIIIRegistro) => {
    setEditingMemoriaId(registro.id);
    setMemoriaEdit(registro.detalhamento_customizado || registro.detalhamento || "");
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
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", registroId);
      if (error) throw error;
      toast.success("Memória de cálculo atualizada com sucesso!");
      setEditingMemoriaId(null);
      setMemoriaEdit("");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (registroId: string) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", registroId);
      if (error) throw error;
      toast.success("Memória de cálculo restaurada!");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = form.organizacao && form.ug && rmFornecimento && codugRmFornecimento && form.dias_operacao > 0;
  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join('; ');
  
  const totalCustoCombustivel = consolidadosCombustivel.reduce((sum, c) => sum + c.valor_total, 0);
  const totalCustoLubrificante = consolidadoLubrificante?.valor_total || 0;
  const custoTotalClasseIII = totalCustoCombustivel + totalCustoLubrificante;
  
  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'COMBUSTIVEL_CONSOLIDADO': return 'Combustível';
      case 'LUBRIFICANTE_CONSOLIDADO': return 'Lubrificante';
      default: return tipo;
    }
  };
  
  const getSuprimentoLabel = (item: GranularDisplayItem) => {
    switch (item.suprimento_tipo) {
        case 'COMBUSTIVEL_DIESEL': return 'Diesel';
        case 'COMBUSTIVEL_GASOLINA': return 'Gasolina';
        case 'LUBRIFICANTE': return 'Lubrificante';
        default: return 'Suprimento';
    }
  };
  
  const getSuprimentoBadgeClass = (item: GranularDisplayItem) => {
    switch (item.suprimento_tipo) {
        case 'COMBUSTIVEL_DIESEL': return 'bg-cyan-600 text-white hover:bg-cyan-700';
        case 'COMBUSTIVEL_GASOLINA': return 'bg-amber-500 text-white hover:bg-amber-600';
        case 'LUBRIFICANTE': return 'bg-purple-600 text-white hover:bg-purple-700';
        default: return 'bg-primary text-primary-foreground';
    }
  };
  
  const getCombustivelBadgeClass = (tipo: CombustivelTipo) => {
    return tipo === 'DIESEL' 
      ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
      : 'bg-amber-500 text-white hover:bg-amber-600';
  };
  
  // --- MEMÓRIAS E AGRUPAMENTOS ATUALIZADOS ---
  // OMs Cadastradas (Seção 4) usa registrosAgrupadosPorSuprimento
  // Memórias de Cálculo (Seção 5) usa getMemoriaRecords
  
  // Determina se a aba atual deve exibir a coluna de Lubrificante
  const shouldShowLubricantColumn = selectedTab === 'GERADOR' || selectedTab === 'EMBARCACAO';
  
  // Determina o título da coluna
  const lubricantColumnTitle = shouldShowLubricantColumn ? 'Lubrificante' : 'Lub/Comb'; // Mantendo 'Lub/Comb' como fallback, embora não deva ser exibido

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        
        {/* LPC Section - Renderiza somente após o carregamento inicial */}
        {isLpcLoaded ? (
          <div ref={lpcRef}>
            <RefLPCFormSection 
              ptrabId={ptrabId!} 
              refLPC={refLPC} 
              onUpdate={handleRefLPCUpdate} 
            />
          </div>
        ) : (
          <Card className="mb-6 border-2 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                Referência de Preços - Consulta LPC
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center py-4">
              <Alert className="w-full">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Carregando referência de preços...
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Classe III - Combustíveis e Lubrificantes</CardTitle>
            <CardDescription>
              Configure as necessidades de combustível e lubrificante por tipo de equipamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Alerta se LPC não estiver configurado */}
            {isLpcLoaded && !refLPC && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  Atenção: A Referência LPC não está configurada. Por favor, preencha a seção acima para habilitar o cálculo de custos.
                </AlertDescription>
              </Alert>
            )}
            
            {/* 1. Dados da Organização */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Equipamento *</Label>
                  <OmSelector 
                    selectedOmId={form.selectedOmId} 
                    onChange={handleOMChange} 
                    placeholder="Selecione a OM detentora..."
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>UG Detentora</Label>
                  <Input 
                    value={form.ug} 
                    readOnly 
                    disabled
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dias de Atividade (Global) *</Label>
                  <Input 
                    type="text"
                    inputMode="numeric"
                    className="max-w-xs"
                    value={form.dias_operacao === 0 ? "" : form.dias_operacao.toString()}
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInt(e.target.value.replace(/\D/g, '')) || 0 })}
                    placeholder="Ex: 7"
                    onKeyDown={handleEnterToNextField}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">Usado apenas no cabeçalho da memória de cálculo.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rmFornecimento">RM de Fornecimento de Combustível *</Label>
                  <RmSelector 
                    value={rmFornecimento} 
                    onChange={handleRMFornecimentoChange} 
                    placeholder="Selecione a RM de fornecimento..."
                    disabled={!form.organizacao || loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CODUG da RM de Fornecimento</Label>
                  <Input 
                    value={codugRmFornecimento} 
                    readOnly 
                    disabled
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
                        disabled={loading}
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
                  <Label>OM Destino Recurso Lubrificante (ND 30) *</Label>
                  <OmSelector 
                    selectedOmId={lubricantAllocation.selectedOmDestinoId} 
                    onChange={handleOMLubrificanteChange} 
                    placeholder="Selecione a OM de destino..."
                    disabled={!form.organizacao || loading}
                  />
                  <p className="text-xs text-muted-foreground">OM que receberá o recurso de lubrificante.</p>
                </div>
              </div>
            </div>
            
            {/* 2. Configurar Itens por Categoria (Tabs) */}
            {isFormValid && refLPC && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as TipoEquipamento)}>
                  <TabsList className="grid w-full grid-cols-4">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat.key} value={cat.key} className="flex items-center gap-1">
                        <cat.icon className="h-4 w-4" />
                        {cat.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {CATEGORIAS.map(cat => (
                    <TabsContent key={cat.key} value={cat.key} className="mt-4">
                      <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="max-h-[400px] overflow-y-auto rounded-md border">
                          <Table className="w-full">
                            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                              <TableRow>
                                <TableHead className="w-[30%]">Equipamento</TableHead>
                                <TableHead className="w-[8%] text-center">Qtd</TableHead>
                                <TableHead className="w-[8%] text-center">Qtd Dias</TableHead>
                                <TableHead className="w-[18%] text-center">{cat.key === 'MOTOMECANIZACAO' ? 'Km/Desloc' : 'Horas/Dia'}</TableHead>
                                {cat.key === 'MOTOMECANIZACAO' && (
                                  <TableHead className="w-[10%] text-center">Desloc/Dia</TableHead>
                                )}
                                {shouldShowLubricantColumn && (
                                  <TableHead className="w-[10%] text-center">Lubrificante</TableHead>
                                )}
                                <TableHead className="w-[10%] text-right">Litros</TableHead>
                                <TableHead className="w-[8%] text-right">Custo Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {localCategoryItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={cat.key === 'MOTOMECANIZACAO' ? 8 : 7} className="text-center text-muted-foreground">
                                    Nenhum item de diretriz encontrado para esta categoria.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                localCategoryItems.map((item, index) => {
                                  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
                                  const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
                                  
                                  const { totalLitros, itemTotal } = calculateItemTotals(item, refLPC, form.dias_operacao);
                                  const diasUtilizados = item.dias_utilizados || 0;
                                  
                                  const formattedPriceInput = formatCurrencyInput(item.preco_lubrificante_input).formatted;
                                  
                                  return (
                                    <TableRow key={item.item} className="h-12">
                                      <TableCell className="font-medium text-sm py-1 w-[30%]">
                                        <div className="flex flex-col gap-1">
                                          <span className="font-medium text-sm">{item.item}</span>
                                          <Badge 
                                            variant="default" 
                                            className={cn("w-fit text-xs font-normal", getCombustivelBadgeClass(item.tipo_combustivel_fixo))}
                                          >
                                            {item.tipo_combustivel_fixo} ({formatNumber(item.consumo_fixo, 1)} {item.unidade_fixa})
                                          </Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell className="py-1 w-[8%]">
                                        <Input 
                                          type="text"
                                          inputMode="numeric"
                                          className="h-8 text-center"
                                          value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                          onChange={(e) => handleItemNumericChange(index, 'quantidade', e.target.value)}
                                          placeholder="0"
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* NEW COLUMN: Qtd Dias */}
                                      <TableCell className="py-1 w-[8%]">
                                        <Input 
                                          type="text"
                                          inputMode="numeric"
                                          className="h-8 text-center"
                                          value={item.dias_utilizados === 0 ? "" : item.dias_utilizados.toString()}
                                          onChange={(e) => handleItemNumericChange(index, 'dias_utilizados', e.target.value)}
                                          placeholder="0"
                                          disabled={item.quantidade === 0}
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* COLUMN 4: Horas/Dia or KM/Desloc */}
                                      <TableCell className="py-1 w-[18%]">
                                        <Input 
                                          type="text"
                                          inputMode="decimal"
                                          className="h-8 text-center"
                                          value={isMotomecanizacao 
                                            ? (item.distancia_percorrida === 0 ? "" : item.distancia_percorrida.toString())
                                            : (item.horas_dia === 0 ? "" : item.horas_dia.toString())
                                          }
                                          onChange={(e) => handleItemNumericChange(index, isMotomecanizacao ? 'distancia_percorrida' : 'horas_dia', e.target.value)}
                                          placeholder="0"
                                          disabled={item.quantidade === 0 || diasUtilizados === 0}
                                          onKeyDown={handleEnterToNextField}
                                        />
                                      </TableCell>
                                      {/* COLUMN 5: Desloc/Dia (Only for Motomecanizacao) */}
                                      {isMotomecanizacao && (
                                        <TableCell className="py-1 w-[10%]">
                                          <Input 
                                            type="text"
                                            inputMode="numeric"
                                            className="h-8 text-center"
                                            value={item.quantidade_deslocamentos === 0 ? "" : item.quantidade_deslocamentos.toString()}
                                            onChange={(e) => handleItemNumericChange(index, 'quantidade_deslocamentos', e.target.value)}
                                            placeholder="0"
                                            disabled={item.quantidade === 0 || diasUtilizados === 0}
                                            onKeyDown={handleEnterToNextField}
                                          />
                                        </TableCell>
                                      )}
                                      {/* COLUMN 6: Lubrificante (Conditional) */}
                                      {shouldShowLubricantColumn && (
                                        <TableCell className="py-1 w-[10%]">
                                          {isLubricantType ? (
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button 
                                                  variant="outline" 
                                                  size="sm" 
                                                  className={cn("h-8 w-full text-xs", item.consumo_lubrificante_litro > 0 && "border-purple-500 text-purple-600")}
                                                  disabled={item.quantidade === 0 || diasUtilizados === 0}
                                                >
                                                  <Droplet className="h-3 w-3 mr-1" />
                                                  {item.consumo_lubrificante_litro > 0 ? 'Configurado' : 'Configurar'}
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-80 p-4 space-y-3">
                                                <h4 className="font-semibold text-sm">Configurar Lubrificante</h4>
                                                <div className="space-y-2">
                                                  <Label>Consumo ({item.categoria === 'GERADOR' ? 'L/100h' : 'L/h'})</Label>
                                                  <Input 
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={item.consumo_lubrificante_input}
                                                    onChange={(e) => handleItemNumericChange(index, 'consumo_lubrificante_input', e.target.value)}
                                                    onBlur={(e) => handleItemNumericBlur(index, 'consumo_lubrificante_input', e.target.value)}
                                                    placeholder="0,00"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label>Preço (R$/L)</Label>
                                                  <Input 
                                                    type="text"
                                                    inputMode="numeric"
                                                    value={formattedPriceInput}
                                                    onChange={(e) => handleItemNumericChange(index, 'preco_lubrificante_input', e.target.value)}
                                                    placeholder="0,00"
                                                    onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                                                  />
                                                </div>
                                              </PopoverContent>
                                            </Popover>
                                          ) : (
                                            <Badge variant="secondary" className="text-xs w-full justify-center">
                                              {item.tipo_combustivel_fixo}
                                            </Badge>
                                          )}
                                        </TableCell>
                                      )}
                                      {/* NOVA COLUNA: Litros */}
                                      <TableCell className="text-right text-sm py-1 w-[10%]">
                                        {totalLitros > 0 ? `${formatNumber(totalLitros)} L` : '-'}
                                      </TableCell>
                                      {/* COLUMN 7: Custo Total */}
                                      <TableCell className="text-right font-semibold text-sm py-1 w-[8%]">
                                        {formatCurrency(itemTotal)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* NOVO DETALHAMENTO DE TOTAIS */}
                        <div className="space-y-2 p-3 bg-background rounded-lg border">
                          <h4 className="font-bold text-sm mb-2">Resumo de Combustível (30% Margem)</h4>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Óleo Diesel:</span>
                            <span className="font-medium text-cyan-600">
                              {formatNumber(currentCategoryDieselLitros)} L ({formatCurrency(currentCategoryDieselValor)})
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Gasolina:</span>
                            <span className="font-medium text-amber-600">
                              {formatNumber(currentCategoryGasolinaLitros)} L ({formatCurrency(currentCategoryGasolinaValor)})
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-bold text-sm">TOTAL COMBUSTÍVEL</span>
                            <span className="font-extrabold text-lg text-primary">
                              {formatCurrency(currentCategoryTotalCombustivel)}
                            </span>
                          </div>
                        </div>
                        
                        {currentCategoryTotalLubrificante > 0 && (
                          <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                            <span className="font-bold text-sm flex items-center gap-2">
                              TOTAL LUBRIFICANTE
                            </span>
                            <span className="font-extrabold text-lg text-purple-600">
                              {formatCurrency(currentCategoryTotalLubrificante)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-end">
                          <Button 
                            type="button" 
                            onClick={handleUpdateCategoryItems} 
                            className="w-full md:w-auto"
                            disabled={!form.organizacao || form.dias_operacao <= 0}
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
            
            {/* 3. Itens Adicionados (numero de itens) */}
            {form.itens.filter(i => i.quantidade > 0).length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.filter(i => i.quantidade > 0).length})</h3>
                
                <div className="space-y-4">
                  {Object.entries(itensAgrupadosPorCategoriaParaResumo).map(([categoria, itens]) => {
                    const categoriaLabel = CATEGORIAS.find(c => c.key === categoria)?.label || categoria;
                    
                    const totalCombustivelCategoria = itens.reduce((sum, item) => {
                      const { valorCombustivel } = calculateItemTotals(item, refLPC, form.dias_operacao);
                      return sum + valorCombustivel;
                    }, 0);
                    
                    const totalLubrificanteCategoria = itens.reduce((sum, item) => {
                      const { valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
                      return sum + valorLubrificante;
                    }, 0);
                    
                    const totalCategoria = totalCombustivelCategoria + totalLubrificanteCategoria;
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{categoriaLabel}</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const { itemTotal, totalLitros, valorCombustivel, valorLubrificante, formulaLitros, precoLitro, litrosSemMargemItem } = calculateItemTotals(item, refLPC, form.dias_operacao);
                            const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
                            
                            return (
                              <div 
                                key={index} 
                                className={cn(
                                  "p-2 border-b border-dashed border-border/50",
                                  index === itens.length - 1 && "border-b-0 pb-0"
                                )}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-sm text-foreground">
                                    {item.item}
                                  </span>
                                  <span className="font-bold text-base text-primary">
                                    {formatCurrency(itemTotal)}
                                  </span>
                                </div>
                                
                                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                  {/* Detalhe Combustível - Volume e Custo */}
                                  <div className="flex justify-between">
                                    <span className="w-2/3">
                                      Combustível ({item.tipo_combustivel_fixo}): {formulaLitros} = {formatNumber(litrosSemMargemItem)} L + 30% = {formatNumber(totalLitros)} L
                                    </span>
                                    <span className="w-1/3 text-right font-medium text-foreground">
                                      {formatNumber(totalLitros)} L x {formatCurrency(precoLitro)} = {formatCurrency(valorCombustivel)}
                                    </span>
                                  </div>
                                  
                                  {/* Detalhe Lubrificante */}
                                  {isLubricantType && valorLubrificante > 0 && (
                                    <div className="flex justify-between text-purple-600">
                                      <span className="w-1/2">
                                        Lubrificante:
                                      </span>
                                      <span className="w-1/2 text-right font-medium">
                                        {formatCurrency(valorLubrificante)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* REMOVIDO: Detalhes de Custo Combustível e Lubrificante */}
                      </Card>
                    );
                  })}
                </div>
                
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                  <span className="font-bold text-base text-primary">VALOR TOTAL DA OM</span>
                  <span className="font-extrabold text-xl text-primary">
                    {formatCurrency(custoTotalClasseIII)}
                  </span>
                </div>
                
                <div className="flex gap-3 pt-4 justify-end">
                  <Button variant="outline" type="button" onClick={resetFormFields}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros}
                    disabled={
                      loading || 
                      !isFormValid || 
                      form.itens.filter(i => i.quantidade > 0 && i.dias_utilizados > 0).length === 0 ||
                      (consolidadoLubrificante && (!lubricantAllocation.om_destino_recurso || !lubricantAllocation.ug_destino_recurso))
                    }
                  >
                    {loading ? "Aguarde..." : "Salvar Registros"}
                  </Button>
                </div>
              </div>
            )}
            
            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION (NOVO LAYOUT) */}
            {Object.keys(registrosAgrupadosPorSuprimento).length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {Object.entries(registrosAgrupadosPorSuprimento).map(([omKey, group]) => {
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
                        {group.suprimentos.map((suprimentoGroup) => {
                          const isCombustivel = suprimentoGroup.suprimento_tipo === 'COMBUSTIVEL';
                          
                          // Determine badge class and text based on consolidated type
                          let badgeText = '';
                          let badgeClass = '';
                          
                          if (isCombustivel) {
                            badgeText = suprimentoGroup.original_registro.tipo_combustivel;
                            // Use getCombustivelBadgeClass based on the specific fuel type
                            badgeClass = getCombustivelBadgeClass(suprimentoGroup.original_registro.tipo_combustivel as CombustivelTipo);
                          } else {
                            badgeText = 'LUBRIFICANTE';
                            badgeClass = 'bg-purple-600 text-white hover:bg-purple-700'; // Cor padronizada para Lubrificante
                          }
                          
                          const originalRegistro = suprimentoGroup.original_registro;
                          
                          return (
                            <Card key={originalRegistro.id} className="p-3 bg-background border">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-base text-foreground">
                                      {isCombustivel ? 'Combustível' : 'Lubrificante'}
                                    </h4>
                                    <Badge variant="default" className={cn("w-fit", badgeClass)}>
                                      {badgeText}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Total Litros: {formatNumber(suprimentoGroup.total_litros, 2)} L | Dias: {originalRegistro.dias_operacao}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg text-primary/80">
                                    {formatCurrency(suprimentoGroup.total_valor)}
                                  </span>
                                  <div className="flex gap-1">
                                    {/* Ações de Edição e Deleção devem ser feitas no registro CONSOLIDADO original */}
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditarConsolidado(originalRegistro)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeletarConsolidado(originalRegistro.id)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Detalhes por Categoria (Gerador, Embarcação, etc.) */}
                              <div className="pt-2 border-t mt-2 space-y-1">
                                {CATEGORIAS.map(cat => {
                                  const totais = suprimentoGroup.categoria_totais[cat.key];
                                  if (totais.valor > 0) {
                                    const categoryBadgeStyle = getClasseIIICategoryBadgeStyle(cat.key);
                                    return (
                                      <div key={cat.key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          <cat.icon className="h-3 w-3" />
                                          {categoryBadgeStyle.label}: {formatNumber(totais.litros, 2)} L
                                        </span>
                                        <span className="font-medium text-foreground text-right">
                                          {formatCurrency(totais.valor)}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                              
                              {/* Detalhes da Alocação (ND 30/39) - REMOVIDO */}
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
            {getMemoriaRecords.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                {getMemoriaRecords.map(item => {
                  const om = item.om_destino;
                  const ug = item.ug_destino;
                  
                  // Use the original consolidated record ID for memory editing
                  const originalId = item.original_registro.id;
                  const isEditing = editingMemoriaId === originalId;
                  
                  // Check if the original consolidated record has custom memory
                  const hasCustomMemoria = !!item.original_registro.detalhamento_customizado;
                  
                  // Generate automatic memory based on granular item data
                  const memoriaAutomatica = generateGranularMemoriaCalculo(item, refLPC, rmFornecimento, codugRmFornecimento);
                  
                  // Determine which memory to display/edit
                  const memoriaExibida = isEditing 
                    ? memoriaEdit 
                    : (item.original_registro.detalhamento_customizado || memoriaAutomatica);
                  
                  const suprimento = getSuprimentoLabel(item);
                  const badgeClass = getSuprimentoBadgeClass(item);
                  
                  // Encontrar o label e estilo da categoria do material usando o novo utilitário
                  const categoryBadgeStyle = getClasseIIICategoryBadgeStyle(item.categoria);
                  const displayCategoryLabel = categoryLabelMap[item.categoria] || categoryBadgeStyle.label; // Use map for correct capitalization
                  
                  return (
                    <div key={`memoria-view-${item.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <h4 className="text-base font-semibold text-foreground">
                            OM Destino: {om} ({ug})
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
                        
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          {!isEditing ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                // Pass the original consolidated ID for memory editing
                                onClick={() => handleIniciarEdicaoMemoria(item.original_registro)}
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
                                  onClick={() => handleRestaurarMemoriaAutomatica(item.original_registro.id)}
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
                                onClick={() => handleSalvarMemoriaCustomizada(originalId)}
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
                          <pre className="text-sm font-mono whitespace-pre-wrap text-foreground" style={{ whiteSpace: 'pre-wrap' }}>
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