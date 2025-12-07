import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor, Droplet, Check, ChevronsUpDown, XCircle, AlertCircle } from "lucide-react";
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

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: TipoEquipamento, label: string, icon: React.FC<any> }[] = [
  { key: 'GERADOR', label: 'Gerador', icon: Zap },
  { key: 'EMBARCACAO', label: 'Embarcação', icon: Ship },
  { key: 'EQUIPAMENTO_ENGENHARIA', label: 'Engenharia', icon: Tractor },
  { key: 'MOTOMECANIZACAO', label: 'Motomecanização', icon: Truck },
];

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
  preco_lubrificante_input: string;
  consumo_lubrificante_input: string;
  
  // NEW: Lubricant Destination (if applicable)
  om_destino_lub: string;
  ug_destino_lub: string;
  selectedOmDestinoId_lub?: string;
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number; // Global days of activity (used only for detailing header)
  itens: ItemClasseIII[]; // All items across all categories (SAVED/COMMITTED)
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

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

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
    itemTotal,
    formulaLitros,
    precoLitro,
    litrosSemMargemItem,
    litrosLubrificante, // Retorna litros de lubrificante
  };
};


export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
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
  // REMOVIDO: const [lubricantAllocation, setLubricantAllocation] = useState<LubricantAllocation>({ ... });
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
    await Promise.all([
      loadRefLPC(),
      fetchRegistros(true), // Pass true to trigger reconstruction after directives are loaded
    ]);
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
      if (Object.values(allDiretrizItems).flat().length === 0) {
        await loadAllDiretrizItems();
      }
      reconstructFormState(data as ClasseIIIRegistro[]);
    } else if (!initialLoad) {
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
    
    // 3. Consolidate all ItemClasseIII data
    let consolidatedItems: ItemClasseIII[] = [];
    
    // Map to store lubricant destination IDs
    const lubDestinationMap = new Map<string, { om: string, ug: string, id?: string }>();
    
    // Process lubricant records first to map destinations
    lubricantRecords.forEach(r => {
        const key = `${r.organizacao}|${r.ug}`;
        lubDestinationMap.set(key, { om: r.organizacao, ug: r.ug });
    });
    
    [...combustivelRecords, ...lubricantRecords].forEach(r => {
      // Determine destination OM for lubricant items (it's stored in the consolidated record)
      const omDestinoLub = r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO' ? r.organizacao : '';
      const ugDestinoLub = r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO' ? r.ug : '';
      
      if (r.itens_equipamentos && Array.isArray(r.itens_equipamentos)) {
        (r.itens_equipamentos as any[]).forEach(item => {
          const baseCategory = item.categoria as TipoEquipamento;
          const directiveItem = allDiretrizItems[baseCategory]?.find(d => d.nome === item.tipo_equipamento_especifico);
          
          if (directiveItem) {
            const precoLubrificante = item.preco_lubrificante || 0;
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
              
              // NEW: Lubricant Destination fields
              om_destino_lub: omDestinoLub,
              ug_destino_lub: ugDestinoLub,
              selectedOmDestinoId_lub: undefined,
            };
            consolidatedItems.push(newItem);
          }
        });
      }
    });
    
    // 4. Fetch OM IDs
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
    ]).then(([omData]) => {
      
      // Fetch OM IDs for lubricant destinations
      const uniqueLubDestinations = Array.from(new Set(consolidatedItems.map(i => `${i.om_destino_lub}|${i.ug_destino_lub}`)))
        .filter(key => key !== '|');
        
      const destinationPromises = uniqueLubDestinations.map(key => {
        const [nome, ug] = key.split('|');
        return fetchOmId(nome, ug).then(data => ({ key, id: data?.id }));
      });
      
      Promise.all(destinationPromises).then(results => {
        const idMap = new Map(results.map(r => [r.key, r.id]));
        
        const updatedItemsWithIds = consolidatedItems.map(item => {
          const key = `${item.om_destino_lub}|${item.ug_destino_lub}`;
          const id = idMap.get(key);
          return { ...item, selectedOmDestinoId_lub: id };
        });
        
        setForm({
          selectedOmId: omData?.id,
          organizacao: omName,
          ug: ug,
          dias_operacao: diasOperacao,
          itens: updatedItemsWithIds,
        });
        setRmFornecimento(omData?.rm || rmFornecimento);
        setCodugRmFornecimento(omData?.codugRm || codugRmFornecimento);
      });
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
      
      // When OM Detentora changes, update lubricant destination for all items in the current local state
      setLocalCategoryItems(prevItems => prevItems.map(item => {
          if (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') {
              return {
                  ...item,
                  om_destino_lub: omData.nome_om,
                  ug_destino_lub: omData.codug_om,
                  selectedOmDestinoId_lub: omData.id,
              };
          }
          return item;
      }));
      
    } else {
      setForm(prev => ({
        ...prev,
        selectedOmId: undefined,
        organizacao: "",
        ug: ""
      }));
      setRmFornecimento("");
      setCodugRmFornecimento("");
      
      // Clear lubricant destination for all items in the current local state
      setLocalCategoryItems(prevItems => prevItems.map(item => {
          if (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') {
              return {
                  ...item,
                  om_destino_lub: "",
                  ug_destino_lub: "",
                  selectedOmDestinoId_lub: undefined,
              };
          }
          return item;
      }));
    }
  };

  const handleItemLubricantDestinationChange = (itemIndex: number, omData: OMData | undefined) => {
    const updatedItems = [...localCategoryItems];
    const item = updatedItems[itemIndex];
    
    if (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') {
        item.om_destino_lub = omData?.nome_om || "";
        item.ug_destino_lub = omData?.codug_om || "";
        item.selectedOmDestinoId_lub = omData?.id;
        setLocalCategoryItems(updatedItems);
    }
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
  
  const handleItemFieldChange = (itemIndex: number, field: keyof ItemClasseIII, value: any) => {
    const updatedItems = [...localCategoryItems];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value };
    setLocalCategoryItems(updatedItems);
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
        consumo_lubrificante_input: inputString,
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
  
  const handleConfirmLubricantConfig = (itemIndex: number, closePopover: () => void) => {
      const item = localCategoryItems[itemIndex];
      
      if (item.consumo_lubrificante_litro > 0 || item.preco_lubrificante > 0) {
          if (!item.om_destino_lub || !item.ug_destino_lub) {
              toast.error("Selecione a OM de destino do recurso de lubrificante.");
              return;
          }
      }
      
      // If consumption/price is zero, clear destination fields to avoid saving invalid data
      if (item.consumo_lubrificante_litro === 0 && item.preco_lubrificante === 0) {
          const updatedItems = [...localCategoryItems];
          updatedItems[itemIndex] = {
              ...item,
              om_destino_lub: "",
              ug_destino_lub: "",
              selectedOmDestinoId_lub: undefined,
          };
          setLocalCategoryItems(updatedItems);
      }
      
      toast.success("Configuração de lubrificante salva!");
      closePopover();
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
    
    // NEW CHECK: Ensure lubricant items have destination if active
    if (itemsToKeep.some(item => 
      (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') && 
      (item.consumo_lubrificante_litro > 0 || item.preco_lubrificante > 0) &&
      (!item.om_destino_lub || !item.ug_destino_lub)
    )) {
      toast.error("Configure a OM de destino para todos os lubrificantes ativos.");
      return;
    }
    
    // AQUI É O PONTO CHAVE: Remove os itens antigos da categoria atual e adiciona os novos (localCategoryItems filtrados)
    const itemsFromOtherCategories = form.itens.filter(item => item.categoria !== selectedTab);
    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];
    
    // Atualiza o estado principal (que alimenta a Seção 3)
    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens da categoria ${selectedTab} atualizados!`);
  };

  // --- Consolidation Logic (Memoized) ---
  const { consolidadosCombustivel, consolidadosLubrificante, itensAgrupadosPorCategoriaParaResumo } = useMemo(() => {
    const itens = form.itens.filter(item => item.quantidade > 0 && item.dias_utilizados > 0);
    
    const groupedFormItems = itens.reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<TipoEquipamento, ItemClasseIII[]>);
    
    if (itens.length === 0 || !refLPC || form.dias_operacao === 0) {
      return { consolidadosCombustivel: [], consolidadosLubrificante: [], itensAgrupadosPorCategoriaParaResumo: groupedFormItems };
    }
    
    // --- CÁLCULO DE COMBUSTÍVEL (ND 33.90.30) ---
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (item.categoria !== 'GERADOR' && item.categoria !== 'EMBARCACAO' && item.categoria !== 'EQUIPAMENTO_ENGENHARIA' && item.categoria !== 'MOTOMECANIZACAO') return grupos;
      
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
        const { litrosSemMargemItem, formulaLitros } = calculateItemTotals(item, refLPC, form.dias_operacao);
        
        totalLitrosSemMargem += litrosSemMargemItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${formulaLitros} = ${formatNumber(litrosSemMargemItem)} L ${unidade}.`);
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
      
      let detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} equipamentos, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}. Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento}) Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(precoLitro)}. Fórmula: (Nr Equipamentos x Nr Horas/Km x Consumo) x Nr dias de utilização. ${detalhes.join('\n')} Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}. Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(precoLitro)} = ${formatCurrency(valorTotal)}.`;
      
      novosConsolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
        organizacao: form.organizacao, // Combustível vai para a OM Detentora
        ug: form.ug,
      });
    });
    
    // --- CÁLCULO DE LUBRIFICANTE (ND 33.90.30) ---
    const itensComLubrificante = itens.filter(item => 
      (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') &&
      item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0
    );
    
    // Group lubricant items by destination OM
    const gruposLubrificantePorOM: Record<string, { om: string, ug: string, itens: ItemClasseIII[], totalLitros: number, totalValor: number }> = {};
    
    itensComLubrificante.forEach(item => {
      const key = `${item.om_destino_lub}|${item.ug_destino_lub}`;
      
      if (!gruposLubrificantePorOM[key]) {
        gruposLubrificantePorOM[key] = { 
          om: item.om_destino_lub, 
          ug: item.ug_destino_lub, 
          itens: [], 
          totalLitros: 0, 
          totalValor: 0, 
        };
      }
      
      const { valorLubrificante, litrosLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
      
      gruposLubrificantePorOM[key].itens.push(item);
      gruposLubrificantePorOM[key].totalLitros += litrosLubrificante;
      gruposLubrificantePorOM[key].totalValor += valorLubrificante;
    });
    
    const consolidadosLubrificanteArray: any[] = [];
    
    Object.values(gruposLubrificantePorOM).forEach(grupo => {
      const totalEquipamentos = grupo.itens.reduce((sum, item) => sum + item.quantidade, 0);
      
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      const detalhamentoLubrificante = `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} equipamentos, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}. Recurso destinado à OM proprietária: ${grupo.om} (UG: ${grupo.ug}) Cálculo: Fórmula: (Nr Equipamentos x Nr Horas utilizadas/dia x Nr dias de utilização) x Consumo Lubrificante/hora (ou /100h). ${grupo.itens.map(item => `- ${item.item}: Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/${item.categoria === 'GERADOR' ? '100h' : 'h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}.`).join('\n')} Total Litros: ${formatNumber(grupo.totalLitros, 2)} L. Valor Total: ${formatCurrency(grupo.totalValor)}.`;
      
      consolidadosLubrificanteArray.push({
        total_litros: grupo.totalLitros,
        valor_total: grupo.totalValor,
        itens: grupo.itens,
        detalhamento: detalhamentoLubrificante,
        organizacao: grupo.om, // Destination OM
        ug: grupo.ug, // Destination UG
      });
    });
    
    return { consolidadosCombustivel: novosConsolidados, consolidadosLubrificante: consolidadosLubrificanteArray, itensAgrupadosPorCategoriaParaResumo: groupedFormItems };
  }, [
    form.itens, refLPC, form.dias_operacao, form.organizacao, rmFornecimento, codugRmFornecimento,
    fasesAtividade, customFaseAtividade, allDiretrizItems
  ]);
  
  // --- CÁLCULOS DA CATEGORIA ATUAL (para a UI da aba) ---
  const {
    currentCategoryDieselLitros,
    currentCategoryDieselValor,
    currentCategoryGasolinaLitros,
    currentCategoryGasolinaValor,
    currentCategoryTotalCombustivel,
    currentCategoryTotalLubrificante,
  } = useMemo(() => {
    let dieselLitros = 0;
    let dieselValor = 0;
    let gasolinaLitros = 0;
    let gasolinaValor = 0;
    let lubrificanteValor = 0;

    localCategoryItems.forEach(item => {
      const { totalLitros, valorCombustivel, valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
      
      if (item.tipo_combustivel_fixo === 'DIESEL') {
        dieselLitros += totalLitros;
        dieselValor += valorCombustivel;
      } else if (item.tipo_combustivel_fixo === 'GASOLINA') {
        gasolinaLitros += totalLitros;
        gasolinaValor += valorCombustivel;
      }
      lubrificanteValor += valorLubrificante;
    });

    return {
      currentCategoryDieselLitros: dieselLitros,
      currentCategoryDieselValor: dieselValor,
      currentCategoryGasolinaLitros: gasolinaLitros,
      currentCategoryGasolinaValor: gasolinaValor,
      currentCategoryTotalCombustivel: dieselValor + gasolinaValor,
      currentCategoryTotalLubrificante: lubrificanteValor,
    };
  }, [localCategoryItems, refLPC, form.dias_operacao]);
  // --- FIM CÁLCULOS DA CATEGORIA ATUAL ---

  const totalCustoCombustivel = consolidadosCombustivel.reduce((sum, c) => sum + c.valor_total, 0);
  const totalCustoLubrificante = consolidadosLubrificante.reduce((sum, c) => sum + c.valor_total, 0);
  const custoTotalClasseIII = totalCustoCombustivel + totalCustoLubrificante;


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
    
    // Check if all active lubricant items have a destination OM
    const activeLubricantItems = form.itens.filter(item => 
        (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') && 
        (item.consumo_lubrificante_litro > 0 || item.preco_lubrificante > 0)
    );
    if (activeLubricantItems.some(item => !item.om_destino_lub || !item.ug_destino_lub)) {
        toast.error("Configure a OM de destino para todos os lubrificantes ativos.");
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
        dias_operacao: form.dias_operacao,
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
        valor_nd_30: consolidado.valor_total,
        valor_nd_39: 0,
      };
      registrosParaSalvar.push(registro);
    }
    
    // 2. Preparar registros de LUBRIFICANTE (ND 33.90.30) - ITERANDO SOBRE ARRAY DE CONSOLIDADOS POR OM
    for (const consolidadoLubrificante of consolidadosLubrificante) {
      const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'LUBRIFICANTE_CONSOLIDADO',
        organizacao: consolidadoLubrificante.organizacao, // Destination OM
        ug: consolidadoLubrificante.ug, // Destination UG
        quantidade: consolidadoLubrificante.itens.reduce((sum: number, item: ItemClasseIII) => sum + item.quantidade, 0),
        dias_operacao: form.dias_operacao,
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
        // Usar o primeiro item para preencher os campos de preço/consumo (apenas para referência no DB)
        consumo_lubrificante_litro: consolidadoLubrificante.itens[0]?.consumo_lubrificante_litro || 0,
        preco_lubrificante: consolidadoLubrificante.itens[0]?.preco_lubrificante || 0,
        valor_nd_30: consolidadoLubrificante.valor_total,
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
  
  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'COMBUSTIVEL_CONSOLIDADO': return 'Combustível';
      case 'LUBRIFICANTE_CONSOLIDADO': return 'Lubrificante';
      default: return tipo;
    }
  };
  
  const getSuprimentoLabel = (registro: ClasseIIIRegistro) => {
    if (registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') return 'Lubrificante';
    if (registro.tipo_combustivel === 'DIESEL' || registro.tipo_combustivel === 'OD') return 'Diesel';
    if (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS') return 'Gasolina';
    return 'Combustível';
  };
  
  const getSuprimentoBadgeClass = (registro: ClasseIIIRegistro) => {
    if (registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') return 'bg-purple-600 text-white hover:bg-purple-700';
    if (registro.tipo_combustivel === 'DIESEL' || registro.tipo_combustivel === 'OD') return 'bg-cyan-600 text-white hover:bg-cyan-700';
    if (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS') return 'bg-amber-500 text-white hover:bg-amber-600';
    return 'bg-primary text-primary-foreground';
  };
  
  const getCombustivelBadgeClass = (tipo: CombustivelTipo) => {
    return tipo === 'DIESEL' 
      ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
      : 'bg-amber-500 text-white hover:bg-amber-600';
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    const combustivelRecords = registros.filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO');
    const lubricantRecords = registros.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO');
    
    const groups: Record<string, { om: string, ug: string, combustivel: ClasseIIIRegistro[], lubrificante: ClasseIIIRegistro[], total: number }> = {};
    
    // Agrupar por OM de destino (organizacao/ug)
    const allRecords = [...combustivelRecords, ...lubricantRecords];
    
    allRecords.forEach(r => {
      const key = `${r.organizacao} (${r.ug})`;
      if (!groups[key]) {
        groups[key] = { om: r.organizacao, ug: r.ug, combustivel: [], lubrificante: [], total: 0 };
      }
      
      if (r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO') {
        groups[key].combustivel.push(r);
      } else if (r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO') {
        groups[key].lubrificante.push(r);
      }
      groups[key].total += r.valor_total;
    });
    
    return groups;
  }, [registros]);
  
  const getMemoriaRecords = useMemo(() => {
    return Object.values(registrosAgrupadosPorOM).flatMap(group => [
      ...group.combustivel,
      ...group.lubrificante
    ]).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
  }, [registrosAgrupadosPorOM]);
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        
        {/* LPC Section */}
        <div ref={lpcRef}>
          <RefLPCFormSection 
            ptrabId={ptrabId!} 
            refLPC={refLPC} 
            onUpdate={handleRefLPCUpdate} 
          />
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Classe III - Combustíveis e Lubrificantes</CardTitle>
            <CardDescription>
              Configure as necessidades de combustível e lubrificante por tipo de equipamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!refLPC && (
              <Alert className="mb-4">
                <Fuel className="h-4 w-4" />
                <AlertDescription>
                  Configure a referência LPC antes de adicionar equipamentos.
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
                                <TableHead className="w-[18%] text-center">{cat.key === 'MOTOMECANIZACAO' ? 'KM/Desloc' : 'Horas/Dia'}</TableHead>
                                {cat.key === 'MOTOMECANIZACAO' && (
                                  <TableHead className="w-[10%] text-center">Desloc/Dia</TableHead>
                                )}
                                <TableHead className="w-[10%] text-center">Lub/Comb</TableHead>
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
                                      {/* COLUMN 6: Lub/Comb */}
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
                                                {item.consumo_lubrificante_litro > 0 ? 'Configurado' : 'Lubrificante'}
                                              </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-96 p-4 space-y-4">
                                              {({ close }) => (
                                                <>
                                                  <h4 className="font-semibold text-sm border-b pb-2">Configurar Lubrificante para {item.item}</h4>
                                                  
                                                  {/* OM DESTINO RECURSO LUBRIFICANTE (ND 30) */}
                                                  <div className="space-y-2">
                                                    <Label>OM Destino Recurso (ND 30) *</Label>
                                                    <OmSelector 
                                                      selectedOmId={item.selectedOmDestinoId_lub} 
                                                      onChange={(omData) => handleItemLubricantDestinationChange(index, omData)} 
                                                      placeholder="Selecione a OM de destino..."
                                                      disabled={loading}
                                                    />
                                                    {item.ug_destino_lub && (
                                                      <p className="text-xs text-muted-foreground">UG: {item.ug_destino_lub}</p>
                                                    )}
                                                  </div>
                                                  
                                                  <div className="grid grid-cols-2 gap-3">
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
                                                  </div>
                                                  
                                                  <div className="flex justify-end gap-2 pt-2">
                                                    <Button 
                                                      type="button" 
                                                      variant="outline" 
                                                      size="sm"
                                                      onClick={() => close()}
                                                    >
                                                      Cancelar
                                                    </Button>
                                                    <Button 
                                                      type="button" 
                                                      size="sm"
                                                      onClick={() => handleConfirmLubricantConfig(index, close)}
                                                      disabled={loading || (item.consumo_lubrificante_litro > 0 && !item.om_destino_lub)}
                                                    >
                                                      <Check className="h-4 w-4 mr-2" />
                                                      Confirmar
                                                    </Button>
                                                  </div>
                                                </>
                                              )}
                                            </PopoverContent>
                                          </Popover>
                                        ) : (
                                          <Badge variant="secondary" className="text-xs w-full justify-center">
                                            {item.tipo_combustivel_fixo}
                                          </Badge>
                                        )}
                                      </TableCell>
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
                    const totalCombustivelCategoria = itens.reduce((sum, item) => {
                      const { valorCombustivel } = calculateItemTotals(item, refLPC, form.dias_operacao);
                      return sum + valorCombustivel;
                    }, 0);
                    
                    const totalLubrificanteCategoria = itens.reduce((sum, item) => {
                      const { valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
                      return sum + valorLubrificante;
                    }, 0);
                    
                    const totalCategoria = totalCombustivelCategoria + totalLubrificanteCategoria;
                    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                    
                    return (
                      <Card key={categoria} className="p-4 bg-secondary/10 border-secondary">
                        <div className="flex items-center justify-between mb-3 border-b pb-2">
                          <h4 className="font-bold text-base text-primary">{categoria} ({totalQuantidade} itens)</h4>
                          <span className="font-extrabold text-lg text-primary">{formatCurrency(totalCategoria)}</span>
                        </div>
                        
                        <div className="space-y-2">
                          {itens.map((item, index) => {
                            const { itemTotal, totalLitros, valorCombustivel, valorLubrificante, formulaLitros, precoLitro, litrosSemMargemItem } = calculateItemTotals(item, refLPC, form.dias_operacao);
                            const diasUtilizados = item.dias_utilizados || 0;
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
                                    {item.item} ({item.quantidade} un. x {diasUtilizados} dias)
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
                                        Lubrificante (Destino: {item.om_destino_lub}):
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
                      form.itens.filter(i => i.quantidade > 0 && i.dias_utilizados > 0).length === 0
                    }
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
                        {[...group.combustivel, ...group.lubrificante].map((registro) => {
                          const suprimento = getSuprimentoLabel(registro);
                          const badgeClass = getSuprimentoBadgeClass(registro);
                          
                          return (
                            <Card key={registro.id} className="p-3 bg-background border">
                              <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-base text-foreground">
                                      {getTipoLabel(registro.tipo_equipamento)}
                                    </h4>
                                    <Badge variant="default" className={cn("w-fit", badgeClass)}>
                                      {suprimento}
                                    </Badge>
                                  </div>
                                  {registro.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO' && (
                                    <p className="text-xs text-purple-600 font-medium">
                                      Destino Recurso: {registro.organizacao} ({registro.ug})
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Dias: {registro.dias_operacao} | Fases: {formatFasesParaTexto(registro.fase_atividade)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg text-primary/80">
                                    {formatCurrency(registro.valor_total)}
                                  </span>
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditarConsolidado(registro)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeletarConsolidado(registro.id)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Detalhes da Alocação (ND 30/39) */}
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
            {getMemoriaRecords.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                {getMemoriaRecords.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  const memoriaExibida = registro.detalhamento_customizado || registro.detalhamento || "";
                  const suprimento = getSuprimentoLabel(registro);
                  const badgeClass = getSuprimentoBadgeClass(registro);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <h4 className="text-base font-semibold text-foreground">
                          OM Destino: {om} ({ug})
                        </h4>
                        <Badge variant="default" className={cn("w-fit", badgeClass)}>
                          {suprimento}
                        </Badge>
                      </div>
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