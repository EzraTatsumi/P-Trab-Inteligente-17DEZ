"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands, formatCurrencyInput, numberToRawDigits, formatCodug } from "@/lib/formatUtils";
import { TablesInsert, Tables } from "@/integrations/supabase/types"; 
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
import { generateConsolidatedMemoriaCalculo, generateGranularMemoriaCalculo } from "@/lib/classeIIIUtils"; 

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: TipoEquipamento, label: string, icon: React.FC<any> }[] = [
  { key: 'GERADOR', label: 'Gerador', icon: Zap },
  { key: 'EMBARCACAO', label: 'Embarcação', icon: Ship },
  { key: 'EQUIPAMENTO_ENGENHARIA', label: 'Equipamento de Engenharia', icon: Tractor },
  { key: 'MOTOMECANIZACAO', label: 'Motomecanização', icon: Truck },
];

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  item: string; 
  categoria: TipoEquipamento;
  consumo_fixo: number; 
  tipo_combustivel_fixo: CombustivelTipo; 
  unidade_fixa: 'L/h' | 'km/L'; 
  quantidade: number; 
  horas_dia: number; 
  distancia_percorrida: number; 
  quantidade_deslocamentos: number; 
  dias_utilizados: number; 
  consumo_lubrificante_litro: number; 
  preco_lubrificante: number; 
  preco_lubrificante_input: string;
  consumo_lubrificante_input: string;
  memoria_customizada?: string | null; 
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string; 
  ug: string; 
  dias_operacao: number; 
  itens: ItemClasseIII[]; 
}

interface LubricantAllocation {
  om_destino_recurso: string; 
  ug_destino_recurso: string; 
  selectedOmDestinoId?: string;
}

type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

interface GranularDisplayItem {
  id: string; 
  om_destino: string; 
  ug_destino: string; 
  categoria: TipoEquipamento; 
  suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total: number;
  total_litros: number;
  preco_litro: number; 
  dias_operacao: number;
  fase_atividade: string;
  valor_nd_30: number;
  valor_nd_39: number;
  original_registro: ClasseIIIRegistro;
  detailed_items: ItemClasseIII[];
}

interface ConsolidatedSuprimentoGroup {
  om_detentora_equipamento: string; 
  ug_detentora_equipamento: string;
  suprimento_tipo: 'COMBUSTIVEL' | 'LUBRIFICANTE';
  total_valor: number;
  total_litros: number;
  categoria_totais: Record<TipoEquipamento, { litros: number, valor: number }>;
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

const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
  return Math.abs(a - b) < tolerance;
};

const getOmArticle = (omName: string): string => {
    if (omName.includes('ª')) {
        return 'da';
    }
    return 'do';
};

const getEquipmentPluralization = (categoria: TipoEquipamento, count: number): string => {
    const label = getClasseIIICategoryLabel(categoria);
    
    if (count === 1) {
        if (categoria === 'MOTOMECANIZACAO') return 'Viatura';
        return label;
    }
    
    switch (categoria) {
        case 'GERADOR': return 'Geradores';
        case 'EMBARCACAO': return 'Embarcações';
        case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamentos de Engenharia';
        case 'MOTOMECANIZACAO': return 'Viaturas';
        default: return `${label}s`;
    }
};

const pluralizeDay = (count: number): string => {
    return count === 1 ? 'dia' : 'dias';
};

const calculateItemTotals = (item: ItemClasseIII, refLPC: RefLPC | null, diasOperacao: number) => {
  const diasUtilizados = item.dias_utilizados || 0;
  let litrosSemMargemItem = 0;
  const isMotomecanizacao = item.categoria === 'MOTOMECANIZACAO';
  let formulaLitros = '';
  
  const diasPluralItem = pluralizeDay(diasUtilizados);
  
  if (diasUtilizados > 0) {
    if (isMotomecanizacao) {
      if (item.consumo_fixo > 0) {
        litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
        formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} ${diasPluralItem}) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
      }
    } else {
      litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
      formulaLitros = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} ${diasPluralItem}`;
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
    const totalHoras = item.quantidade * item.horas_dia * item.dias_utilizados;
    
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
    litrosLubrificante, 
    itemTotal,
    formulaLitros,
    precoLitro,
    litrosSemMargemItem, 
  };
};

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
            precoLitro = totals.precoLitro; 
        }
    });
    
    return { totalValor, totalLitros, precoLitro };
};

const ClasseIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [isLpcLoaded, setIsLpcLoaded] = useState(false); 
  
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null); 
  const [editingGranularId, setEditingGranularId] = useState<string | null>(null); 
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [selectedTab, setSelectedTab] = useState<TipoEquipamento>(CATEGORIAS[0].key);
  
  const [localCategoryItems, setLocalCategoryItems] = useState<ItemClasseIII[]>([]);
  
  const [form, setForm] = useState<FormDataClasseIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [], 
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

  const [omDetailsMap, setOmDetailsMap] = useState<Record<string, { rm_vinculacao: string, codug_rm_vinculacao: string }>>({});

  const [editingLubricantIndex, setEditingLubricantIndex] = useState<number | null>(null);
  const [tempConsumoInput, setTempConsumoInput] = useState<string>("");
  const [tempPrecoInput, setTempPrecoInput] = useState<string>("");

  const fetchRegistros = useCallback(async () => {
    if (!ptrabId) return;
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante, valor_nd_30, valor_nd_39, om_detentora, ug_detentora")
      .eq("p_trab_id", ptrabId)
      .order("organizacao", { ascending: true })
      .order("tipo_equipamento", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }
    setRegistros((data || []) as ClasseIIIRegistro[]);
    
    const uniqueOmUgs = new Set<string>();
    (data || []).forEach(r => {
        uniqueOmUgs.add(`${r.organizacao}-${r.ug}`);
    });

    const omDetailsPromises = Array.from(uniqueOmUgs).map(async (omUgKey) => {
        const [nome_om, codug_om] = omUgKey.split('-');
        const { data: omData } = await supabase
            .from('organizacoes_militares')
            .select('rm_vinculacao, codug_rm_vinculacao')
            .eq('nome_om', nome_om)
            .eq('codug_om', codug_om)
            .maybeSingle();
        return { key: omUgKey, rm_vinculacao: omData?.rm_vinculacao || '', codug_rm_vinculacao: omData?.codug_rm_vinculacao || '' };
    });

    const results = await Promise.all(omDetailsPromises);
    const newMap: Record<string, { rm_vinculacao: string, codug_rm_vinculacao: string }> = {};
    results.forEach(r => {
        newMap[r.key] = { rm_vinculacao: r.rm_vinculacao, codug_rm_vinculacao: r.codug_rm_vinculacao };
    });
    setOmDetailsMap(newMap);
  }, [ptrabId, toast]);


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
    await loadAllDiretrizItems(); 
    
    await loadRefLPC();
    setIsLpcLoaded(true); 
    
    await fetchRegistros(); 
    resetFormFields(); 
    
    setLoading(false);
  };

  const loadAllDiretrizItems = async () => {
    const results = await Promise.all(CATEGORIAS.map(c => getEquipamentosPorTipo(c.key)));
    const newDiretrizItems: Record<TipoEquipamento, TipoEquipamentoDetalhado[]> = {
      GERADOR: [],
      EMBARCACAO: [],
      EQUIPAMENTO_ENGENHARIA: [],
      MOTOMECANIZACAO: []
    };
    
    CATEGORIAS.forEach((cat, index) => {
        newDiretrizItems[cat.key] = results[index];
    });
    
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

  const reconstructFormState = (records: ClasseIIIRegistro[]) => {
    const combustivelRecords = records.filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO');
    const lubricantRecords = records.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO');
    
    if (combustivelRecords.length === 0 && lubricantRecords.length === 0) {
      resetFormFields();
      return;
    }
    
    const firstRecord = combustivelRecords[0] || lubricantRecords[0];
    
    const omName = firstRecord.organizacao;
    const ug = firstRecord.ug;
    const diasOperacao = firstRecord.dias_operacao;
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    let rmFromRecord = "";
    let codugRmFromRecord = "";
    const combustivelRecord = combustivelRecords[0];
    if (combustivelRecord) {
        rmFromRecord = combustivelRecord.om_detentora || "";
        codugRmFromRecord = combustivelRecord.ug_detentora || "";
        setRmFornecimento(rmFromRecord);
        setCodugRmFornecimento(codugRmFromRecord);
    } else {
        const omDetentoraKey = `${omName}-${ug}`;
        const omDetails = omDetailsMap[omDetentoraKey];
        setRmFornecimento(omDetails?.rm_vinculacao || "");
        setCodugRmFornecimento(omDetails?.codug_rm_vinculacao || "");
    }
    
    const lubRecord = lubricantRecords[0];
    const lubOmName = lubRecord?.om_detentora || omName;
    const lubUg = lubRecord?.ug_detentora || ug;
    
    setLubricantAllocation({
      om_destino_recurso: lubOmName,
      ug_destino_recurso: lubUg,
      selectedOmDestinoId: undefined, 
    });
    
    const consolidatedItemsMap = new Map<string, ItemClasseIII>();
    
    [...combustivelRecords, ...lubricantRecords].forEach(r => {
      if (r.itens_equipamentos && Array.isArray(r.itens_equipamentos)) {
        (r.itens_equipamentos as any[]).forEach((item: any) => {
          const baseCategory = item.categoria as TipoEquipamento;
          const directiveItem = allDiretrizItems[baseCategory]?.find(d => d.nome === item.tipo_equipamento_especifico);
          
          if (directiveItem) {
            const itemName = directiveItem.nome;
            
            const precoLubrificante = item.preco_lubrificante || 0;
            const consumoLubrificante = item.consumo_lubrificante_litro || 0;
            
            const precoLubrificanteInput = item.preco_lubrificante_input || (precoLubrificante > 0 
              ? numberToRawDigits(precoLubrificante)
              : "");
            
            const consumoLubrificanteInput = item.consumo_lubrificante_input || (consumoLubrificante > 0 
              ? formatNumberForInput(consumoLubrificante, 2)
              : "");
            
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
              memoria_customizada: item.memoria_customizada || null, 
            };
            
            let existingItem = consolidatedItemsMap.get(itemName);
            
            if (existingItem) {
                const mergedItem: ItemClasseIII = {
                    ...existingItem,
                    consumo_lubrificante_litro: existingItem.consumo_lubrificante_litro || newItem.consumo_lubrificante_litro,
                    preco_lubrificante: existingItem.preco_lubrificante || newItem.preco_lubrificante,
                    preco_lubrificante_input: existingItem.preco_lubrificante_input || newItem.preco_lubrificante_input,
                    consumo_lubrificante_input: existingItem.consumo_lubrificante_input || newItem.consumo_lubrificante_input,
                    memoria_customizada: existingItem.memoria_customizada || newItem.memoria_customizada, 
                };
                consolidatedItemsMap.set(itemName, mergedItem);
            } else {
                consolidatedItemsMap.set(itemName, newItem);
            }
          }
        });
      }
    });
    
    let consolidatedItems = Array.from(consolidatedItemsMap.values());
    
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
      fetchOmId(lubOmName, lubUg)
    ]).then(([omData, lubOmData]) => {
      setForm({
        selectedOmId: omData?.id,
        organizacao: omName,
        ug: ug,
        dias_operacao: diasOperacao,
        itens: consolidatedItems,
      });
      
      if (!rmFromRecord) {
        setRmFornecimento(omData?.rm || "");
        setCodugRmFornecimento(omData?.codugRm || "");
      }
      
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
    setLocalCategoryItems([]); 
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
  
  const handleFormNumericChange = (field: keyof FormDataClasseIII, inputString: string) => {
    const cleanedValue = inputString.replace(/[^\d]/g, ''); 
    const numericValue = parseInt(cleanedValue) || 0;
    
    setForm(prev => ({
        ...prev,
        [field]: numericValue
    }));
  };

  useEffect(() => {
    const availableItems = allDiretrizItems[selectedTab] || [];
    const existingItemsMap = new Map<string, ItemClasseIII>();
    
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
        memoria_customizada: null, 
      };
    });
    
    setLocalCategoryItems(mergedItems);
  }, [selectedTab, allDiretrizItems, form.itens]); 

  const handleItemFieldChange = (itemIndex: number, field: keyof ItemClasseIII, value: any) => {
    const updatedItems = [...localCategoryItems];
    updatedItems[itemIndex] = { ...updatedItems[itemIndex], [field]: value };
    setLocalCategoryItems(updatedItems);
  };

  const handleItemNumericChange = (itemIndex: number, field: keyof ItemClasseIII, inputString: string) => {
    const cleanedValue = inputString.replace(/[^\d,.]/g, '');
    
    if (editingLubricantIndex === itemIndex) {
        if (field === 'preco_lubrificante_input') {
            const digits = inputString.replace(/\D/g, '');
            setTempPrecoInput(digits);
            return;
        }
        
        if (field === 'consumo_lubrificante_input') {
            setTempConsumoInput(inputString);
            return;
        }
    }
    
    if (field === 'quantidade' || field === 'quantidade_deslocamentos' || field === 'dias_utilizados') {
      const numericValue = parseInt(cleanedValue.replace(/[,.]/g, '')) || 0;
      handleItemFieldChange(itemIndex, field, numericValue);
      return;
    }
    
    const numericValue = parseInputToNumber(cleanedValue);
    handleItemFieldChange(itemIndex, field, numericValue);
  };

  const handleOpenLubricantPopover = (item: ItemClasseIII, index: number) => {
    setEditingLubricantIndex(index);
    setTempConsumoInput(item.consumo_lubrificante_input);
    setTempPrecoInput(item.preco_lubrificante_input);
  };

  const handleConfirmLubricant = () => {
    if (editingLubricantIndex === null) return;

    const consumoNumeric = parseInputToNumber(tempConsumoInput);
    const { numericValue: precoNumeric, digits: precoDigits } = formatCurrencyInput(tempPrecoInput);

    const updatedItems = [...localCategoryItems];
    updatedItems[editingLubricantIndex] = {
        ...updatedItems[editingLubricantIndex],
        consumo_lubrificante_input: tempConsumoInput,
        consumo_lubrificante_litro: consumoNumeric,
        preco_lubrificante_input: precoDigits,
        preco_lubrificante: precoNumeric,
    };
    setLocalCategoryItems(updatedItems);
    setEditingLubricantIndex(null);
  };

  const handleCancelLubricant = () => {
    setEditingLubricantIndex(null);
  };

  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
      toast.error("Preencha a OM Detentora e os Dias de Atividade (Global) antes de salvar itens.");
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
      toast.error("Preencha Km/Desloc e Desloc/Dia para todas as viaturas ativas.");
      return;
    }
    
    const itemsFromOtherCategories = form.itens.filter(item => item.categoria !== selectedTab);
    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];
    
    const categoryTotalValue = itemsToKeep.reduce((sum, item) => {
        const { itemTotal } = calculateItemTotals(item, refLPC, form.dias_operacao);
        return sum + itemTotal;
    }, 0);
    
    const finalND39Value = 0;
    const finalND30Value = categoryTotalValue;
    
    if (categoryTotalValue > 0 && !areNumbersEqual(finalND30Value + finalND39Value, categoryTotalValue)) {
        toast.error("Erro de cálculo: A soma de ND 30 e ND 39 deve ser igual ao Total da Categoria.");
        return;
    }
    
    if (categoryTotalValue > 0) {
      const hasLubricantCost = itemsToKeep.some(item => item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0);
      if (hasLubricantCost && (!lubricantAllocation.om_destino_recurso || !lubricantAllocation.ug_destino_recurso)) {
        toast.error("Selecione a OM de destino do recurso Lubrificante antes de salvar a alocação.");
        return;
      }
    }
    
    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens da categoria ${selectedTab} atualizados!`);
  };

  const { consolidadosCombustivel, consolidadoLubrificante, itensAgrupadosPorCategoria } = useMemo(() => {
    const itens = form.itens.filter(item => item.quantidade > 0 && item.dias_utilizados > 0);
    
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
    
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (item.tipo_combustivel_fixo === 'GASOLINA' || item.tipo_combustivel_fixo === 'DIESEL') {
        if (!grupos[item.tipo_combustivel_fixo]) {
          grupos[item.tipo_combustivel_fixo] = [];
        }
        grupos[item.tipo_combustivel_fixo].push(item);
      }
      return grupos;
    }, {} as Record<CombustivelTipo, ItemClasseIII[]>);
    
    const novosConsolidados: { tipo_combustivel: CombustivelTipo, total_litros_sem_margem: number, total_litros: number, valor_total: number, itens: ItemClasseIII[], detalhamento: string }[] = [];
    
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
        const diasPluralItem = pluralizeDay(diasUtilizados);
        
        if (item.categoria === 'MOTOMECANIZACAO') {
          litrosSemMargemItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos * diasUtilizados) / item.consumo_fixo;
          formulaDetalhe = `(${item.quantidade} un. x ${formatNumber(item.distancia_percorrida)} km/desloc x ${item.quantidade_deslocamentos} desloc/dia x ${diasUtilizados} ${diasPluralItem}) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L`;
        } else {
          litrosSemMargemItem = item.quantidade * item.horas_dia * item.consumo_fixo * diasUtilizados;
          formulaDetalhe = `(${item.quantidade} un. x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${diasUtilizados} ${diasPluralItem}`;
        }
        
        totalLitrosSemMargem += litrosSemMargemItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${item.item}: ${formulaDetalhe} = ${formatNumber(litrosSemMargemItem)} L ${unidade}.`);
      });
      
      const totalLitros = totalLitrosSemMargem * 1.3;
      const valorTotal = totalLitros * precoLitro;
      
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
      
      const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      };
      
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsultaDisplay = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? ` (${refLPC.nome_local})` : ''; 
      
      const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      const diasPluralHeader = pluralizeDay(form.dias_operacao);
      const omArticle = getOmArticle(form.organizacao);
      
      const categoriasAtivas = Array.from(new Set(itensGrupo.map(item => item.categoria)));
      let categoriaLabel;
      if (categoriasAtivas.length === 1) {
          categoriaLabel = getEquipmentPluralization(categoriasAtivas[0], totalEquipamentos);
      } else {
          categoriaLabel = 'Equipamentos Diversos';
      }
      
      let formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
      const hasMotomecanizacao = categoriasAtivas.includes('MOTOMECANIZACAO');
      const hasOutrasCategorias = categoriasAtivas.some(cat => cat !== 'MOTOMECANIZACAO');
      
      if (hasMotomecanizacao && !hasOutrasCategorias) {
          formulaPrincipal = "Fórmula: (Nr Viaturas x Km/Desloc x Nr Desloc/dia x Nr Dias) ÷ Rendimento (Km/L).";
      } else if (hasMotomecanizacao && hasOutrasCategorias) {
          formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/Km x Consumo) x Nr dias de utilização.";
      } else {
          formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
      }
      
      let detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} ${categoriaLabel} ${omArticle} ${form.organizacao}, durante ${form.dias_operacao} ${diasPluralHeader} de ${faseFormatada}.

Cálculo:
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada}${localConsultaDisplay}: ${combustivelLabel} - ${formatCurrency(precoLitro)}.

${formulaPrincipal}

${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% (Margem) = ${formatNumber(totalLitros)} L ${unidadeLabel}.
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
    
    const itensLubrificante = itens.filter(item => 
      (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') && 
      item.consumo_lubrificante_litro > 0 && 
      item.preco_lubrificante > 0
    );
    
    let consolidadoLubrificante: { total_litros: number, valor_total: number, itens: ItemClasseIII[], detalhamento: string } | null = null;
    
    if (itensLubrificante.length > 0) {
      let totalLitrosLubrificante = 0;
      let totalValorLubrificante = 0;
      
      itensLubrificante.forEach(item => {
        const { litrosLubrificante, valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
        totalLitrosLubrificante += litrosLubrificante;
        totalValorLubrificante += valorLubrificante;
      });
      
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      
      const detalhamentoLubrificante = generateConsolidatedMemoriaCalculo(
          'LUBRIFICANTE_CONSOLIDADO',
          itensLubrificante,
          form.dias_operacao,
          form.organizacao,
          form.ug,
          faseFinalStringCalc,
          lubricantAllocation.om_destino_recurso,
          lubricantAllocation.ug_destino_recurso,
          refLPC,
          totalValorLubrificante,
          totalLitrosLubrificante
      );
      
      consolidadoLubrificante = {
        total_litros: totalLitrosLubrificante,
        valor_total: totalValorLubrificante,
        itens: itensLubrificante,
        detalhamento: detalhamentoLubrificante,
      };
    }
    
    return { 
      consolidadosCombustivel: novosConsolidados, 
      consolidadoLubrificante, 
      itensAgrupadosPorCategoria: groupedFormItems 
    };
  }, [form.itens, refLPC, form.dias_operacao, form.organizacao, form.ug, fasesAtividade, customFaseAtividade, rmFornecimento, codugRmFornecimento, lubricantAllocation]);

  const { currentCategoryDieselLitros, currentCategoryDieselValor, currentCategoryGasolinaLitros, currentCategoryGasolinaValor, currentCategoryTotalCombustivel, currentCategoryTotalLubrificante } = useMemo(() => {
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
  
  const totalCustoCombustivel = consolidadosCombustivel.reduce((sum, c) => sum + c.valor_total, 0);
  const totalCustoLubrificante = consolidadoLubrificante?.valor_total || 0;
  const custoTotalClasseIII = totalCustoCombustivel + totalCustoLubrificante;
  
  const itensAgrupadosPorCategoriaParaResumo = useMemo(() => {
    return form.itens.filter(i => i.quantidade > 0).reduce((acc, item) => {
      if (!acc[item.categoria]) {
        acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
    }, {} as Record<TipoEquipamento, ItemClasseIII[]>);
  }, [form.itens]);
  
  const registrosAgrupadosPorSuprimento = useMemo(() => {
    const grupos: Record<string, { om: string, ug: string, total: number, suprimentos: ConsolidatedSuprimentoGroup[] }> = {};
    
    registros.forEach(r => {
      const isCombustivel = r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
      const isLubricante = r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
      
      if (isCombustivel || isLubricante) {
        const omUgKey = `${r.organizacao}-${r.ug}`;
        
        if (!grupos[omUgKey]) {
          grupos[omUgKey] = {
            om: r.organizacao,
            ug: r.ug,
            total: 0,
            suprimentos: [],
          };
        }
        
        grupos[omUgKey].total += r.valor_total;
        
        const categoriaTotais: Record<TipoEquipamento, { litros: number, valor: number }> = {
            GERADOR: { litros: 0, valor: 0 },
            EMBARCACAO: { litros: 0, valor: 0 },
            EQUIPAMENTO_ENGENHARIA: { litros: 0, valor: 0 },
            MOTOMECANIZACAO: { litros: 0, valor: 0 },
        };
        
        (r.itens_equipamentos as any as ItemClasseIII[] || []).forEach((item: any) => {
            const categoria = item.categoria as TipoEquipamento;
            const totals = calculateItemTotals(item, refLPC, r.dias_operacao);
            
            if (isCombustivel) {
                categoriaTotais[categoria].litros += totals.totalLitros;
                categoriaTotais[categoria].valor += totals.valorCombustivel;
            } else if (isLubricante) {
                categoriaTotais[categoria].litros += totals.litrosLubrificante;
                categoriaTotais[categoria].valor += totals.valorLubrificante;
            }
        });
        
        grupos[omUgKey].suprimentos.push({
          om_detentora_equipamento: r.organizacao,
          ug_detentora_equipamento: r.ug,
          suprimento_tipo: isCombustivel ? 'COMBUSTIVEL' : 'LUBRIFICANTE',
          total_valor: r.valor_total,
          total_litros: r.total_litros,
          categoria_totais: categoriaTotais,
          original_registro: r,
        });
      }
    });
    
    Object.values(grupos).forEach(group => {
        group.suprimentos.sort((a, b) => {
            if (a.suprimento_tipo === 'COMBUSTIVEL' && b.suprimento_tipo === 'LUBRIFICANTE') return -1;
            if (a.suprimento_tipo === 'LUBRIFICANTE' && b.suprimento_tipo === 'COMBUSTIVEL') return 1;
            return 0;
        });
    });
    
    return grupos;
  }, [registros, refLPC]);
  
  const getMemoriaRecords = useMemo(() => {
    const granularItems: GranularDisplayItem[] = [];
    
    const consolidatedLubricantMap = new Map<string, { original_registro: ClasseIIIRegistro, detailed_items: ItemClasseIII[] }>();
    
    registros.forEach(r => {
      const isCombustivel = r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO';
      const isLubricante = r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
      
      if (isCombustivel) {
        (r.itens_equipamentos as any as ItemClasseIII[] || []).forEach((item: any, index) => {
          const { itemTotal } = calculateItemTotals(item, refLPC, r.dias_operacao);
          if (itemTotal > 0) {
            
            const suprimento_tipo: GranularDisplayItem['suprimento_tipo'] = item.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
            
            const { totalLitros, valorCombustivel, precoLitro } = calculateItemTotals(item, refLPC, r.dias_operacao);
            
            granularItems.push({
              id: `${r.id}-${item.item}-${suprimento_tipo}`, 
              om_destino: r.organizacao, 
              ug_destino: r.ug, 
              categoria: item.categoria,
              suprimento_tipo: suprimento_tipo,
              valor_total: valorCombustivel,
              total_litros: totalLitros, 
              preco_litro: precoLitro,
              dias_operacao: r.dias_operacao,
              fase_atividade: r.fase_atividade || '',
              valor_nd_30: r.valor_nd_30,
              valor_nd_39: r.valor_nd_39,
              original_registro: r, 
              detailed_items: [item], 
            });
          }
        });
      } else if (isLubricante) {
        (r.itens_equipamentos as any as ItemClasseIII[] || []).forEach((item: any) => {
            const { itemTotal } = calculateItemTotals(item, refLPC, r.dias_operacao);
            if (itemTotal > 0) {
                const key = `${r.organizacao}-${r.ug}-${item.categoria}`;
                
                if (!consolidatedLubricantMap.has(key)) {
                    consolidatedLubricantMap.set(key, {
                        original_registro: r,
                        detailed_items: [],
                    });
                }
                
                consolidatedLubricantMap.get(key)!.detailed_items.push(item);
            }
        });
      }
    });
    
    Array.from(consolidatedLubricantMap.entries()).forEach(([key, group]) => {
        const firstItem = group.detailed_items[0];
        const categoria = firstItem.categoria;
        const om_destino = group.original_registro.organizacao;
        const ug_destino = group.original_registro.ug;
        const dias_operacao = group.original_registro.dias_operacao;
        const fase_atividade = group.original_registro.fase_atividade || '';
        
        let totalValor = 0;
        let totalLitros = 0;
        let precoMedio = 0;
        
        group.detailed_items.forEach(item => {
            const { valorLubrificante, litrosLubrificante } = calculateItemTotals(item, refLPC, dias_operacao);
            totalValor += valorLubrificante;
            totalLitros += litrosLubrificante;
        });
        
        if (totalLitros > 0) {
            precoMedio = totalValor / totalLitros;
        }
        
        granularItems.push({
            id: `${group.original_registro.id}-${categoria}-LUBRIFICANTE`, 
            om_destino,
            ug_destino,
            categoria,
            suprimento_tipo: 'LUBRIFICANTE',
            valor_total: totalValor,
            total_litros: totalLitros,
            preco_litro: precoMedio, 
            dias_operacao,
            fase_atividade,
            valor_nd_30: group.original_registro.valor_nd_30, 
            valor_nd_39: group.original_registro.valor_nd_39, 
            original_registro: group.original_registro,
            detailed_items: group.detailed_items, 
        });
    });
    
    return granularItems.sort((a, b) => {
        if (a.om_destino !== b.om_destino) return a.om_destino.localeCompare(b.om_destino);
        if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
        return a.suprimento_tipo.localeCompare(b.suprimento_tipo);
    });
  }, [registros, refLPC]);
  
  const handleSalvarRegistros = async () => {
    if (!ptrabId || !refLPC) { toast.error("P Trab ou Referência LPC não configurados."); return; }
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de Fornecimento"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    
    const itens = form.itens.filter(i => i.quantidade > 0 && i.dias_utilizados > 0);
    if (itens.length === 0) { toast.error("Adicione pelo menos um item ativo"); return; }
    
    const totalCustoLubrificante = itens.reduce((sum, item) => {
        const { valorLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
        return sum + valorLubrificante;
    }, 0);
    
    if (totalCustoLubrificante > 0 && (!lubricantAllocation.om_destino_recurso || !lubricantAllocation.ug_destino_recurso)) {
        toast.error("Selecione a OM de destino do recurso Lubrificante.");
        return;
    }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; } 
    const faseFinalStringDB = fasesFinais.filter(f => f).join('; ');
    
    if (totalCustoLubrificante > 0) {
        const itensLubrificante = itens.filter(item => 
            item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0
        );
        
        if (itensLubrificante.length > 0) {
            const totalLitrosLubrificante = itensLubrificante.reduce((sum, item) => {
                const { litrosLubrificante } = calculateItemTotals(item, refLPC, form.dias_operacao);
                return sum + litrosLubrificante;
            }, 0);
            
            const totalEquipamentos = itensLubrificante.reduce((sum, item) => sum + item.quantidade, 0);
            
            const detalhamentoLubrificante = generateConsolidatedMemoriaCalculo(
                'LUBRIFICANTE_CONSOLIDADO',
                itensLubrificante,
                form.dias_operacao,
                form.organizacao,
                form.ug,
                faseFinalStringDB,
                lubricantAllocation.om_destino_recurso,
                lubricantAllocation.ug_destino_recurso,
                refLPC,
                totalCustoLubrificante,
                totalLitrosLubrificante
            );
            
            const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
                p_trab_id: ptrabId,
                organizacao: form.organizacao,
                ug: form.ug,
                tipo_equipamento: 'LUBRIFICANTE_CONSOLIDADO',
                quantidade: totalEquipamentos,
                dias_operacao: form.dias_operacao,
                tipo_combustivel: 'LUBRIFICANTE',
                preco_litro: 0,
                total_litros: totalLitrosLubrificante,
                total_litros_sem_margem: totalLitrosLubrificante,
                valor_total: totalCustoLubrificante,
                detalhamento: detalhamentoLubrificante,
                itens_equipamentos: itensLubrificante.map(item => ({
                    ...item,
                    tipo_equipamento_especifico: item.item,
                    consumo_lubrificante_litro: item.consumo_lubrificante_litro,
                    preco_lubrificante: item.preco_lubrificante,
                    memoria_customizada: item.memoria_customizada, 
                })) as any,
                fase_atividade: faseFinalStringDB,
                consumo_lubrificante_litro: 0, 
                preco_lubrificante: 0,
                valor_nd_30: totalCustoLubrificante,
                valor_nd_39: 0,
                om_detentora: lubricantAllocation.om_destino_recurso,
                ug_detentora: lubricantAllocation.ug_destino_recurso,
            };
            registrosParaSalvar.push(registroLubrificante);
        }
    }
    
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
        if (item.tipo_combustivel_fixo === 'GASOLINA' || item.tipo_combustivel_fixo === 'DIESEL') {
            if (!grupos[item.tipo_combustivel_fixo]) {
                grupos[item.tipo_combustivel_fixo] = [];
            }
            grupos[item.tipo_combustivel_fixo].push(item);
        }
        return grupos;
    }, {} as Record<CombustivelTipo, ItemClasseIII[]>);
    
    Object.entries(gruposPorCombustivel).forEach(([combustivel, itensGrupo]) => {
        const tipoCombustivel = combustivel as CombustivelTipo;
        const precoLitro = tipoCombustivel === 'GASOLINA' 
            ? refLPC.preco_gasolina 
            : refLPC.preco_diesel;
        
        let totalLitrosSemMargem = 0;
        let totalLitros = 0;
        let valorTotal = 0;
        let totalEquipamentos = 0;
        
        itensGrupo.forEach(item => {
            const { totalLitros: totalL, valorCombustivel, litrosSemMargemItem } = calculateItemTotals(item, refLPC, form.dias_operacao);
            totalLitrosSemMargem += litrosSemMargemItem;
            totalLitros += totalL;
            valorTotal += valorCombustivel;
            totalEquipamentos += item.quantidade;
        });
        
        const detalhamentoCombustivel = generateConsolidatedMemoriaCalculo(
            'COMBUSTIVEL_CONSOLIDADO',
            itensGrupo,
            form.dias_operacao,
            form.organizacao,
            form.ug,
            faseFinalStringDB,
            rmFornecimento, 
            codugRmFornecimento, 
            refLPC,
            valorTotal,
            totalLitros
        );
        
        const registroCombustivel: TablesInsert<'classe_iii_registros'> = {
            p_trab_id: ptrabId,
            organizacao: form.organizacao,
            ug: form.ug,
            tipo_equipamento: 'COMBUSTIVEL_CONSOLIDADO',
            quantidade: totalEquipamentos,
            dias_operacao: form.dias_operacao,
            tipo_combustivel: tipoCombustivel,
            preco_litro: precoLitro,
            total_litros: totalLitros,
            total_litros_sem_margem: totalLitrosSemMargem,
            valor_total: valorTotal,
            detalhamento: detalhamentoCombustivel,
            itens_equipamentos: itensGrupo.map(item => ({
                ...item,
                tipo_equipamento_especifico: item.item,
                memoria_customizada: item.memoria_customizada, 
            })) as any,
            fase_atividade: faseFinalStringDB,
            consumo_lubrificante_litro: 0, 
            preco_lubrificante: 0,
            valor_nd_30: valorTotal, 
            valor_nd_39: 0,
            om_detentora: rmFornecimento, 
            ug_detentora: codugRmFornecimento, 
        };
        registrosParaSalvar.push(registroCombustivel);
    });
    
    try {
      setLoading(true);
      
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao)
        .eq("ug", form.ug);
        
      if (deleteError) {
        throw deleteError;
      }
      
      const { error: insertError = null } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe III atualizados com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields(); 
      await fetchRegistros(); 
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de Classe III:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeletarConsolidado = async (id: string) => {
    if (!confirm("Deseja realmente deletar este registro consolidado?")) return;
    setLoading(true);
    try {
        const { error } = await supabase
          .from("classe_iii_registros")
          .delete()
          .eq("id", id);
        if (error) {
          throw error;
        }
        toast.success("Registro deletado!");
        resetFormFields(); 
        await fetchRegistros();
    } catch (error) {
        console.error("Erro ao deletar registro:", error);
        toast.error(sanitizeError(error));
    } finally {
        setLoading(false);
    }
  };

  const handleEditarConsolidado = (registro: ClasseIIIRegistro) => {
    const omToEdit = registro.organizacao;
    const ugToEdit = registro.ug;
    
    const recordsToReconstruct = registros.filter(r => 
      r.organizacao === omToEdit && r.ug === ugToEdit
    );
    
    if (recordsToReconstruct.length === 0) {
        toast.error("Não foi possível encontrar registros para edição.");
        return;
    }

    reconstructFormState(recordsToReconstruct);
    
    const firstItem = (recordsToReconstruct[0].itens_equipamentos as any[])?.[0];
    if (firstItem) {
        setSelectedTab(firstItem.categoria as TipoEquipamento);
    } else {
        setSelectedTab(CATEGORIAS[0].key);
    }
    
    toast.info(`Editando registros para ${omToEdit} (${ugToEdit}).`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIniciarEdicaoMemoria = (granularItem: GranularDisplayItem) => {
    // CORREÇÃO: Atribuindo o ID vindo do objeto de parâmetro para evitar referência circular
    const granularId = granularItem.id;
    setEditingGranularId(granularId);
    
    // 1. Encontrar o item detalhado (ItemClasseIII) que contém a memória customizada
    // O item detalhado é sempre o primeiro do array detailed_items, pois o agrupamento é granular
    const itemComMemoria = granularItem.detailed_items.find(i => !!i.memoria_customizada) || granularItem.detailed_items[0];
    
    // 2. Priorizar a memória customizada do item, senão gerar a automática
    const memoriaAutomatica = generateGranularMemoriaCalculo(granularItem, refLPC, rmFornecimento, codugRmFornecimento);
    
    setMemoriaEdit(itemComMemoria.memoria_customizada || memoriaAutomatica || "");
    setEditingMemoriaId(granularItem.original_registro.id); // Mantém o ID do registro consolidado para o salvamento no DB
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setEditingGranularId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async () => {
    if (!editingMemoriaId || !editingGranularId) return;
    
    setLoading(true);
    
    try {
      const registroOriginal = registros.find(r => r.id === editingMemoriaId);
      if (!registroOriginal) throw new Error("Registro consolidado não encontrado.");
      
      const isSavingLubricant = editingGranularId.endsWith('-LUBRIFICANTE');
      const parts = editingGranularId.split('-');
      const targetCategory = isSavingLubricant ? parts[parts.length - 2] : null; 
      
      const itensEquipamentos = (registroOriginal.itens_equipamentos as any as ItemClasseIII[] || []).map((item: any) => {
          let currentGranularId = '';
          
          const isLubricantItem = item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0;
          
          if (isSavingLubricant) {
              if (isLubricantItem && item.categoria === targetCategory) {
                  currentGranularId = `${registroOriginal.id}-${item.categoria}-LUBRIFICANTE`;
              }
          } else {
              const suprimento_tipo = item.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
              currentGranularId = `${registroOriginal.id}-${item.item}-${suprimento_tipo}`;
          }
          
          if (currentGranularId === editingGranularId) {
              return {
                  ...item,
                  memoria_customizada: memoriaEdit.trim() || null,
              };
          }
          return item; 
      });
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          itens_equipamentos: itensEquipamentos as any,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", editingMemoriaId);

      if (error) throw error;

      toast.success("Memória de cálculo atualizada com sucesso!");
      handleCancelarEdicaoMemoria();
      await fetchRegistros(); 
    } catch (error) {
      console.error("Erro ao salvar memória:", error);
      toast.error("Erro ao salvar memória de cálculo");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarMemoriaAutomatica = async (granularItem: GranularDisplayItem) => {
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    setLoading(true);
    const consolidatedId = granularItem.original_registro.id;
    const granularId = granularItem.id;
    
    try {
      const registroOriginal = registros.find(r => r.id === consolidatedId);
      if (!registroOriginal) throw new Error("Registro consolidado não encontrado.");
      
      const isRestoringLubricant = granularId.endsWith('-LUBRIFICANTE');
      const parts = granularId.split('-');
      const targetCategory = isRestoringLubricant ? parts[parts.length - 2] : null; 
      
      const itensEquipamentos = (registroOriginal.itens_equipamentos as any as ItemClasseIII[] || []).map((item: any) => {
          let currentGranularId = '';
          
          const isLubricantItem = item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0;
          
          if (isRestoringLubricant) {
              if (isLubricantItem && item.categoria === targetCategory) {
                  currentGranularId = `${registroOriginal.id}-${item.categoria}-LUBRIFICANTE`;
              }
          } else {
              const suprimento_tipo = item.tipo_combustivel_fixo === 'GASOLINA' ? 'COMBUSTIVEL_GASOLINA' : 'COMBUSTIVEL_DIESEL';
              currentGranularId = `${registroOriginal.id}-${item.item}-${suprimento_tipo}`;
          }
          
          if (currentGranularId === granularId) {
              return {
                  ...item,
                  memoria_customizada: null,
              };
          }
          return item; 
      });
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          itens_equipamentos: itensEquipamentos as any,
          updated_at: new Date().toISOString(),
        } as TablesInsert<'classe_iii_registros'>)
        .eq("id", consolidatedId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada!");
      await fetchRegistros();
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
  
  const getCombustivelBadgeClass = (tipo: CombustivelTipo | string) => {
    return tipo === 'DIESEL' 
      ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
      : 'bg-amber-500 text-white hover:bg-amber-600';
  };
  
  const calculatedLubricantTotal = useMemo(() => {
    if (editingLubricantIndex === null || form.dias_operacao === 0) return 0;
    
    const item = localCategoryItems[editingLubricantIndex];
    if (!item || item.quantidade === 0 || item.dias_utilizados === 0) return 0;
    
    const consumoNumeric = parseInputToNumber(tempConsumoInput);
    const { numericValue: precoNumeric } = formatCurrencyInput(tempPrecoInput);
    
    if (consumoNumeric <= 0 || precoNumeric <= 0) return 0;
    
    const totalHoras = item.quantidade * item.horas_dia * item.dias_utilizados;
    let litrosLubrificante = 0;
    
    if (item.categoria === 'GERADOR') {
      litrosLubrificante = (totalHoras / 100) * consumoNumeric;
    } else if (item.categoria === 'EMBARCACAO') {
      litrosLubrificante = totalHoras * consumoNumeric;
    }
    
    return litrosLubrificante * precoNumeric;
  }, [editingLubricantIndex, localCategoryItems, tempConsumoInput, tempPrecoInput, form.dias_operacao]);
  
  const omDetentoraKey = `${form.organizacao}-${form.ug}`;
  const omDetentoraDetails = omDetailsMap[omDetentoraKey] || { rm_vinculacao: '', codug_rm_vinculacao: '' };
  const omDetentoraRmVinculacao = omDetentoraDetails.rm_vinculacao;

  const isCombustivelDifferentOm = omDetentoraRmVinculacao.toUpperCase() !== rmFornecimento.toUpperCase();
  const combustivelDestinoTextClass = isCombustivelDifferentOm ? 'text-red-600 font-bold' : 'text-foreground';
  
  const isLubricanteDifferentOm = form.organizacao !== lubricantAllocation.om_destino_recurso;
  const lubrificanteDestinoTextClass = isLubricanteDifferentOm ? 'text-red-600 font-bold' : 'text-foreground';
  
  const categoryLabelMap: Record<TipoEquipamento, string> = {
    GERADOR: 'Gerador',
    EMBARCACAO: 'Embarcação',
    EQUIPAMENTO_ENGENHARIA: 'Equipamento de Engenharia',
    MOTOMECANIZACAO: 'Motomecanização',
  };


  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        
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
            
            {isLpcLoaded && !refLPC && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  Atenção: A Referência LPC não está configurada. Por favor, preencha a seção acima para habilitar o cálculo de custos.
                </AlertDescription>
              </Alert>
            )}
            
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
                    value={formatCodug(form.ug)} 
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
                    value={form.dias_operacao === 0 ? "" : formatInputWithThousands(form.dias_operacao)}
                    onChange={(e) => handleFormNumericChange('dias_operacao', e.target.value)} 
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
                    value={formatCodug(codugRmFornecimento)} 
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
            
            {isFormValid && refLPC && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as TipoEquipamento)}>
                  <TabsList className="grid w-full grid-cols-4">
                    {CATEGORIAS.map(cat => (
                      <TabsTrigger key={cat.key} value={cat.key} className="flex items-center gap-1">
                        {cat.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CATEGORIAS.map(cat => {
                    const shouldShowLubricantColumn = cat.key === 'GERADOR' || cat.key === 'EMBARCACAO';
                    const isMotomecanizacao = cat.key === 'MOTOMECANIZACAO';
                    
                    let formulaPrincipal = "Fórmula: (Nr Equipamentos x Nr Horas/dia x Consumo) x Nr dias de utilização.";
                    if (cat.key === 'MOTOMECANIZACAO') {
                        formulaPrincipal = "Fórmula: (Nr Viaturas x Km/Desloc x Nr Desloc/dia x Nr Dias) ÷ Rendimento (Km/L).";
                    }
                    
                    return (
                      <TabsContent key={cat.key} value={cat.key} className="mt-4">
                        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                          
                          <Alert variant="default" className="p-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              <AlertDescription className="text-sm font-medium m-0">
                                {formulaPrincipal}
                              </AlertDescription>
                            </div>
                          </Alert>
                          
                          <div className="max-h-[400px] overflow-y-auto rounded-md border">
                            <Table className="w-full">
                              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                <TableRow>
                                  <TableHead className="w-[30%]">Equipamento</TableHead>
                                  <TableHead className="w-[10%] text-center">Qtd</TableHead>
                                  <TableHead className="w-[10%] text-center">Qtd Dias</TableHead>
                                  <TableHead className="w-[15%] text-center">{isMotomecanizacao ? 'Km/Desloc' : 'Horas/Dia'}</TableHead>
                                  {isMotomecanizacao && (
                                    <TableHead className="w-[10%] text-center">Desloc/Dia</TableHead>
                                  )}
                                  {shouldShowLubricantColumn && (
                                    <TableHead className="w-[10%] text-center">Lubrificante</TableHead>
                                  )}
                                  <TableHead className="w-[8%] text-right">Litros</TableHead>
                                  <TableHead className="w-[7%] text-right">Custo Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {localCategoryItems.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={isMotomecanizacao ? 8 : (shouldShowLubricantColumn ? 7 : 6)} className="text-center text-muted-foreground">
                                      Nenhum item de diretriz encontrado para esta categoria.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  localCategoryItems.map((item, index) => {
                                    const isLubricantType = item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO';
                                    
                                    const { totalLitros, itemTotal } = calculateItemTotals(item, refLPC, form.dias_operacao);
                                    const diasUtilizados = item.dias_utilizados || 0;
                                    
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
                                        <TableCell className="py-1 w-[10%]">
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
                                        <TableCell className="py-1 w-[10%]">
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
                                        <TableCell className="py-1 w-[15%]">
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
                                        {shouldShowLubricantColumn && (
                                          <TableCell className="py-1 w-[10%]">
                                            {isLubricantType ? (
                                              <Popover 
                                                open={editingLubricantIndex === index} 
                                                onOpenChange={(open) => {
                                                  if (open) {
                                                    handleOpenLubricantPopover(item, index);
                                                  } else if (editingLubricantIndex === index) {
                                                    handleCancelLubricant();
                                                  }
                                                }}
                                              >
                                                <PopoverTrigger asChild>
                                                  <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className={cn("h-8 w-full text-xs", item.consumo_lubrificante_litro > 0 && "border-purple-500 text-purple-600")}
                                                    disabled={item.quantidade === 0 || diasUtilizados === 0}
                                                    onClick={() => handleOpenLubricantPopover(item, index)} 
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
                                                      value={tempConsumoInput}
                                                      onChange={(e) => handleItemNumericChange(index, 'consumo_lubrificante_input', e.target.value)}
                                                      placeholder="0,00"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label>Preço (R$/L)</Label>
                                                    <Input 
                                                      type="text"
                                                      inputMode="numeric"
                                                      value={formatCurrencyInput(tempPrecoInput).formatted}
                                                      onChange={(e) => handleItemNumericChange(index, 'preco_lubrificante_input', e.target.value)}
                                                      placeholder="0,00"
                                                      onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                                                    />
                                                  </div>
                                                  
                                                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                                                      <span>VALOR TOTAL:</span>
                                                      <span className="text-purple-600">
                                                          {formatCurrency(calculatedLubricantTotal)}
                                                      </span>
                                                  </div>
                                                  
                                                  <div className="flex justify-end gap-2 pt-2">
                                                      <Button 
                                                          size="sm" 
                                                          onClick={handleConfirmLubricant}
                                                          disabled={calculatedLubricantTotal === 0}
                                                      >
                                                          Confirmar
                                                      </Button>
                                                      <Button 
                                                          variant="outline" 
                                                          size="sm" 
                                                          onClick={handleCancelLubricant}
                                                      >
                                                          Cancelar
                                                      </Button>
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
                                        <TableCell className="text-right text-sm py-1 w-[8%]">
                                          {totalLitros > 0 ? `${formatNumber(totalLitros)} L` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold text-sm py-1 w-[7%]">
                                          {formatCurrency(itemTotal)}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </div>
                          
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
                    );
                  })}
                </Tabs>
              </div>
            )}
            
            {form.itens.filter(i => i.quantidade > 0).length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.filter(i => i.quantidade > 0).length})</h3>
                
                {!areNumbersEqual(custoTotalClasseIII, totalCustoCombustivel + totalCustoLubrificante) && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium">
                            Atenção: O Custo Total dos Itens ({formatCurrency(custoTotalClasseIII)}) não corresponde ao Total Alocado ({formatCurrency(totalCustoCombustivel + totalCustoLubrificante)}). 
                            Clique em "Salvar Itens da Categoria" em todas as abas ativas.
                        </AlertDescription>
                    </Alert>
                )}

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
                        
                        {totalCombustivelCategoria > 0 && (
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">OM Destino Recurso Combustível:</span>
                                <span className={cn("font-medium", combustivelDestinoTextClass)}>
                                    {rmFornecimento} ({formatCodug(codugRmFornecimento)})
                                </span>
                            </div>
                        )}
                        
                        {totalLubrificanteCategoria > 0 && (
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-muted-foreground">OM Destino Recurso Lubrificante:</span>
                                <span className={cn("font-medium", lubrificanteDestinoTextClass)}>
                                    {lubricantAllocation.om_destino_recurso} ({formatCodug(lubricantAllocation.ug_destino_recurso)})
                                </span>
                            </div>
                        )}
                        
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
                                  <div className="flex justify-between">
                                    <span className="w-2/3">
                                      Combustível ({item.tipo_combustivel_fixo}): {formulaLitros} = {formatNumber(litrosSemMargemItem)} L + 30% = {formatNumber(totalLitros)} L
                                    </span>
                                    <span className="w-1/3 text-right font-medium text-foreground">
                                      {formatNumber(totalLitros)} L x {formatCurrency(precoLitro)} = {formatCurrency(valorCombustivel)}
                                    </span>
                                  </div>
                                  
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
                        {omName} (UG: {formatCodug(ug)})
                        </h3>
                        <span className="font-extrabold text-xl text-primary">
                          {formatCurrency(group.total)}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {group.suprimentos.map((suprimentoGroup) => {
                          const isCombustivel = suprimentoGroup.suprimento_tipo === 'COMBUSTIVEL';
                          
                          let badgeText = '';
                          let badgeClass = '';
                          
                          if (isCombustivel) {
                            badgeText = capitalizeFirstLetter(suprimentoGroup.original_registro.tipo_combustivel);
                            badgeClass = getCombustivelBadgeClass(suprimentoGroup.original_registro.tipo_combustivel as CombustivelTipo);
                          } else {
                            badgeText = 'Lubrificante'; 
                            badgeClass = 'bg-purple-600 text-white hover:bg-purple-700'; 
                          }
                          
                          const originalRegistro = suprimentoGroup.original_registro;
                          
                          let destinoOmNome: string;
                          let destinoOmUg: string;
                          let isDifferentOm: boolean;

                          if (isCombustivel) {
                            destinoOmNome = originalRegistro.om_detentora || ''; 
                            destinoOmUg = originalRegistro.ug_detentora || '';
                            
                            const omDetentoraKey = `${group.om}-${group.ug}`;
                            const omDetentoraDetails = omDetailsMap[omDetentoraKey];
                            const omDetentoraRmVinculacao = omDetentoraDetails?.rm_vinculacao; 
                            
                            if (omDetentoraRmVinculacao && destinoOmNome) {
                                isDifferentOm = omDetentoraRmVinculacao.toUpperCase() !== destinoOmNome.toUpperCase();
                            } else {
                                isDifferentOm = false; 
                            }
                            
                          } else {
                            destinoOmNome = originalRegistro.om_detentora || originalRegistro.organizacao;
                            destinoOmUg = originalRegistro.ug_detentora || originalRegistro.ug;
                            isDifferentOm = group.om !== destinoOmNome;
                          }
                          const omDestinoTextClass = isDifferentOm ? 'text-red-600 font-bold' : 'text-foreground';

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
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => handleEditarConsolidado(originalRegistro)}
                                      disabled={loading}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeletarConsolidado(originalRegistro.id)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      disabled={loading}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-xs mt-2 pt-2 border-t">
                                <span className="text-muted-foreground">OM Destino Recurso:</span>
                                <span className={cn("font-medium", omDestinoTextClass)}>
                                  {destinoOmNome} ({formatCodug(destinoOmUg)})
                                </span>
                              </div>
                              
                              <div className="mt-1 space-y-1">
                                {CATEGORIAS.map(cat => {
                                  const totais = suprimentoGroup.categoria_totais[cat.key];
                                  if (totais.valor > 0) {
                                    const categoryBadgeStyle = getClasseIIICategoryBadgeStyle(cat.key);
                                    const displayLabel = categoryLabelMap[cat.key] || getClasseIIICategoryLabel(cat.key);
                                    
                                    return (
                                      <div key={cat.key} className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          {displayLabel}: {formatNumber(totais.litros, 2)} L
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
                            </Card>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            
            {getMemoriaRecords.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                {getMemoriaRecords.map(item => {
                  const om = item.om_destino;
                  const ug = item.ug_destino;
                  
                  const granularId = item.id;
                  const isEditing = editingGranularId === granularId;
                  
                  const itemComMemoria = item.detailed_items.find(i => !!i.memoria_customizada) || item.detailed_items[0];
                  const hasCustomMemoria = !!itemComMemoria.memoria_customizada;
                  
                  const memoriaAutomatica = generateGranularMemoriaCalculo(item, refLPC, rmFornecimento, codugRmFornecimento);
                  
                  const memoriaExibida = isEditing 
                    ? memoriaEdit 
                    : (itemComMemoria.memoria_customizada || memoriaAutomatica);
                  
                  const suprimento = getSuprimentoLabel(item);
                  const badgeClass = getSuprimentoBadgeClass(item);
                  
                  const categoryBadgeStyle = getClasseIIICategoryBadgeStyle(item.categoria);
                  const displayCategoryLabel = categoryLabelMap[item.categoria] || getClasseIIICategoryLabel(item.categoria);
                  
                  let isResourceDifferent = false;
                  let omDestinoRecurso = '';
                  let ugDestinoRecurso = '';
                  
                  const omDetentoraKey = `${om}-${ug}`;
                  const omDetentoraDetails = omDetailsMap[omDetentoraKey];
                  const omDetentoraRmVinculacao = omDetentoraDetails?.rm_vinculacao;
                  
                  if (item.suprimento_tipo === 'LUBRIFICANTE') {
                      omDestinoRecurso = item.original_registro.om_detentora || om;
                      ugDestinoRecurso = item.original_registro.ug_detentora || ug;
                      isResourceDifferent = om !== omDestinoRecurso;
                  } else {
                      const rmFornecimento = item.original_registro.om_detentora || '';
                      const codugRmFornecimento = item.original_registro.ug_detentora || '';
                      
                      omDestinoRecurso = rmFornecimento;
                      ugDestinoRecurso = codugRmFornecimento;
                      
                      if (omDetentoraRmVinculacao && rmFornecimento) {
                          isResourceDifferent = omDetentoraRmVinculacao.toUpperCase() !== rmFornecimento.toUpperCase();
                      }
                  }
                  
                  const resourceDestinationText = `Recurso destinado à OM: ${omDestinoRecurso} (${formatCodug(ugDestinoRecurso)})`;
                  
                  return (
                    <div key={`memoria-view-${granularId}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-semibold text-foreground">
                            {om} ({formatCodug(ug)})
                            </h4>
                            <Badge variant="default" className={cn("w-fit shrink-0", categoryBadgeStyle.className)}>
                              {displayCategoryLabel}
                            </Badge>
                            <Badge variant="default" className={cn("w-fit shrink-0", badgeClass)}>
                              {suprimento}
                            </Badge>
                            {hasCustomMemoria && !isEditing && (
                                <Badge variant="outline" className="text-xs">
                                    Editada manualmente
                                </Badge>
                            )}
                          </div>
                          
                          {isResourceDifferent && (
                              <div className="flex items-center gap-1 mt-1">
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
                                onClick={() => handleIniciarEdicaoMemoria(item)}
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
                                  onClick={() => handleRestaurarMemoriaAutomatica(item)}
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
                                onClick={handleSalvarMemoriaCustomizada}
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