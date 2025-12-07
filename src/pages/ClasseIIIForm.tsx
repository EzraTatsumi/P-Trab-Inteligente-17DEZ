import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor, Droplet, Check, ChevronsUpDown, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import { RefLPCFormSection } from "@/components/RefLPCFormSection";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryFormSection } from "@/components/CategoryFormSection"; // NOVO IMPORT
import { cn } from "@/lib/utils";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: TipoEquipamento, label: string, icon: React.FC<any> }[] = [
  { key: 'GERADOR', label: 'Geradores', icon: Zap },
  { key: 'EMBARCACAO', label: 'Embarcações', icon: Ship },
  { key: 'EQUIPAMENTO_ENGENHARIA', label: 'Engenharia', icon: Tractor },
  { key: 'MOTOMECANIZACAO', label: 'Motomecanização', icon: Truck },
];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  id?: string; // ID temporário para itens novos
  item: string;
  categoria: string;
  consumo_fixo: number;
  tipo_combustivel_fixo: 'GAS' | 'OD';
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia?: number;
  dias_utilizados: number;
  distancia_percorrida?: number;
  quantidade_deslocamentos?: number;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
  preco_lubrificante_input?: string;
  consumo_lubrificante_input?: string;
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemClasseIII[];
  fase_atividade?: string;
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  potencia_hp?: number;
  horas_dia?: number;
  dias_operacao: number;
  consumo_hora?: number;
  consumo_km_litro?: number;
  km_dia?: number;
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
}

interface LubricantAllocation {
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

// Função para comparar números de ponto flutuante com tolerância
const areNumbersEqual = (a: number, b: number, tolerance = 0.01): boolean => {
    return Math.abs(a - b) < tolerance;
};

// Função para formatar fases
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

const ClasseIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [selectedTab, setSelectedTab] = useState<TipoEquipamento>(CATEGORIAS[0].key);
  
  // Estado principal do formulário
  const [form, setForm] = useState<FormDataClasseIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [], // Array global com todos os itens de todas as categorias
    fase_atividade: "",
  });
  
  // Estado para a alocação de lubrificante (global)
  const [lubricantAllocation, setLubricantAllocation] = useState<LubricantAllocation>({
    om_destino_recurso: "",
    ug_destino_recurso: "",
    selectedOmDestinoId: undefined,
  });
  
  // Estado para as fases de atividade (global)
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Estado para as diretrizes de cada categoria
  const [allDiretrizItems, setAllDiretrizItems] = useState<Record<TipoEquipamento, TipoEquipamentoDetalhado[]>>({
    GERADOR: [], EMBARCACAO: [], EQUIPAMENTO_ENGENHARIA: [], MOTOMECANIZACAO: []
  });
  
  // Estado para os itens da categoria ATUAL (usado apenas no CategoryFormSection)
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseIII[]>([]);
  
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

  // Efeito para carregar diretrizes e reconstruir o estado quando a aba muda
  useEffect(() => {
    loadAllDiretrizItems();
  }, [selectedTab]);

  // Efeito para sincronizar os itens da categoria atual quando o formulário global muda
  useEffect(() => {
    const availableItems = allDiretrizItems[selectedTab] || [];
    const existingItemsMap = new Map<string, ItemClasseIII>();
    form.itens.filter(i => i.categoria === selectedTab).forEach(item => {
      existingItemsMap.set(item.item, item);
    });

    const mergedItems = availableItems.map(availableItem => {
      const existing = existingItemsMap.get(availableItem.nome);
      return existing || availableItem;
    });

    setCurrentCategoryItems(mergedItems);
  }, [selectedTab, allDiretrizItems, form.itens, form.dias_operacao]);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([
      loadAllDiretrizItems(), // Carrega diretrizes primeiro
      loadRefLPC(),
      fetchRegistros(true), // Passa true para reconstruir o estado após as diretrizes serem carregadas
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

  const fetchRegistros = async (initialLoad = false) => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante")
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
      // Se não for carga inicial, não reconstrua o estado. O CategoryFormSection cuidará disso.
      return;
    }
    
    // Se for carga inicial, reconstrói o estado do formulário a partir dos registros
    reconstructFormState(data as ClasseIIIRegistro[]);
  };

  const reconstructFormState = (records: ClasseIIIRegistro[]) => {
    const combustivelRecords = records.filter(r => r.tipo_equipamento === 'COMBUSTIVEL_CONSOLIDADO');
    const lubricantRecords = records.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO');
    
    if (combustivelRecords.length === 0 && lubricantRecords.length === 0) {
      resetFormFields();
      return;
    }
    
    const firstRecord = combustivelRecords[0] || lubricantRecords[0];
    
    // 1. Extrair dados globais (OM, Dias, Fases)
    const omName = firstRecord.organizacao;
    const ug = firstRecord.ug;
    const diasOperacao = firstRecord.dias_operacao;
    
    const fasesSalvas = (firstRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadrao = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];
    setFasesAtividade(fasesSalvas.filter(f => fasesPadrao.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !fasesPadrao.includes(f)) || "");
    
    // 2. Extrair dados da RM de fornecimento
    const rmMatch = firstRecord.detalhamento?.match(/Fornecido por: (.*?) \(CODUG: (.*?)\)/);
    if (rmMatch) {
      // setRmFornecimento(rmMatch[1]);
      // setCodugRmFornecimento(rmMatch[2]);
    }
    
    // 3. Extrair dados da alocação de lubrificante
    if (lubricantRecords.length > 0) {
      const lubRecord = lubricantRecords[0];
      setLubricantAllocation({
        om_destino_recurso: lubRecord.organizacao,
        ug_destino_recurso: lubRecord.ug,
        selectedOmDestinoId: undefined, // Será preenchido abaixo
      });
    } else {
      setLubricantAllocation({ om_destino_recurso: omName, ug_destino_recurso: ug, selectedOmDestinoId: undefined });
    }
    
    // 4. Consolidar todos os itens em um único array
    let consolidatedItems: ItemClasseIII[] = [];
    [...combustivelRecords, ...lubricantRecords].forEach(r => {
      if (r.itens_equipamentos && Array.isArray(r.itens_equipamentos)) {
        (r.itens_equipamentos as any[]).forEach(item => {
          const baseCategory = item.categoria as TipoEquipamento;
          const directiveItem = allDiretrizItems[baseCategory]?.find(d => d.nome === item.tipo_equipamento_especifico);
          
          if (directiveItem) {
            const newItem: ItemClasseIII = {
              id: item.id, // Preservar o ID se existir
              item: item.tipo_equipamento_especifico,
              categoria: baseCategory,
              consumo_fixo: directiveItem.consumo,
              tipo_combustivel_fixo: directiveItem.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL',
              unidade_fixa: directiveItem.unidade,
              quantidade: item.quantidade || 0,
              horas_dia: item.horas_dia || 0,
              dias_utilizados: item.dias_utilizados || 0,
              distancia_percorrida: item.distancia_percorrida || 0,
              quantidade_deslocamentos: item.quantidade_deslocamentos || 0,
              consumo_lubrificante_litro: item.consumo_lubrificante_litro || 0,
              preco_lubrificante: item.preco_lubrificante || 0,
              preco_lubrificante_input: item.preco_lubrificante > 0 ? String(Math.round(item.preco_lubrificante * 100)) : "",
              consumo_lubrificante_input: item.consumo_lubrificante_litro > 0 ? formatNumberForInput(item.consumo_lubrificante_litro, 2) : "",
            };
            consolidatedItems.push(newItem);
          }
        });
      }
    });
    
    // 5. Buscar IDs das OMs
    let selectedOmIdForEdit: string | undefined = undefined;
    
    if (omName) {
      try {
        const { data: omData } = await supabase
          .from('organizacoes_militares')
          .select('id')
          .eq('nome_om', omName)
          .eq('codug_om', ug)
          .maybeSingle();
        selectedOmIdForEdit = omData?.id;
      } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    }
    
    let selectedOmDestinoIdForEdit: string | undefined = undefined;
    
    if (lubricantRecords.length > 0) {
      const lubRecord = lubricantRecords[0];
      try {
        const { data: omData } = await supabase
          .from('organizacoes_militares')
          .select('id')
          .eq('nome_om', lubRecord.organizacao)
          .eq('codug_om', lubRecord.ug)
          .maybeSingle();
        selectedOmDestinoIdForEdit = omData?.id;
      } catch (e) { console.error(`Erro ao buscar OM Destino ID para Lubrificante:`, e); }
    }
    
    // 6. Preencher o estado principal
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: omName,
      ug: ug,
      dias_operacao: diasOperacao,
      itens: consolidatedItems,
      fase_atividade: fasesSalvas.join('; '),
    });
    
    // 7. Preencher o estado de alocação de lubrificante
    setLubricantAllocation(prev => ({
      ...prev,
      selectedOmDestinoId: selectedOmDestinoIdForEdit,
    }));
    
    // 8. Definir a aba ativa
    if (consolidatedItems.length > 0) {
      setSelectedTab(consolidatedItems[0].categoria as TipoEquipamento);
    } else {
      setSelectedTab(CATEGORIAS[0].key);
    }
  };

  const resetFormFields = () => {
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
      fase_atividade: "",
    });
    setLubricantAllocation({
      om_destino_recurso: "",
      ug_destino_recurso: "",
      selectedOmDestinoId: undefined,
    });
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
        ug: "",
      }));
      
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
    // setRmFornecimento(rmName);
    // setCodugRmFornecimento(rmCodug);
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // Handler para atualizar os itens de uma categoria específica
  const handleUpdateCategoryItems = (updatedItems: ItemClasseIII[], allocation: CategoryAllocation) => {
    // 1. Filtrar itens válidos (quantidade > 0)
    const itemsToKeep = updatedItems.filter(item => item.quantidade > 0);

    // 2. Atualizar o array global de itens
    // Primeiro, remove todos os itens da categoria atual do array global
    const itemsFromOtherCategories = form.itens.filter(item => item.categoria !== selectedTab);
    
    // Depois, adiciona os itens atualizados da categoria atual
    const newFormItems = [...itemsFromOtherCategories, ...itemsToKeep];
    
    setForm(prev => ({ ...prev, itens: newFormItems }));
    
    // 3. Atualiza a alocação da categoria
    onUpdateAllocation(allocation);
    
    // toast.success(`Itens e alocação de ND para ${selectedTab} atualizados!`);
  };

  // Handler para salvar todos os registros consolidados
  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error("Adicione pelo menos um equipamento"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    setLoading(true);
    
    // 1. Agrupar itens por categoria que possuem quantidade > 0
    const itemsByActiveCategory = form.itens.reduce((acc, item) => {
      if (item.quantidade > 0 && CATEGORIAS.map(c => c.key).includes(item.categoria as TipoEquipamento)) {
        if (!acc[item.categoria]) {
          acc[item.categoria] = [];
        }
        acc[item.categoria].push(item);
      }
      return acc;
    }, {} as Record<TipoEquipamento, ItemClasseIII[]>);
    
    const categoriesToSave = Object.keys(itemsByActiveCategory) as TipoEquipamento[];
    
    if (categoriesToSave.length === 0) {
      toast.error("Nenhum equipamento com quantidade maior que zero foi configurado.");
      setLoading(false);
      return;
    }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 2. Iterar sobre as categorias ativas para criar os registros
    for (const categoria of categoriesToSave) {
      const itens = itemsByActiveCategory[categoria];
      const allocation = lubricantAllocation; // Usa a alocação global de lubrificante
      
      if (!allocation.om_destino_recurso || !allocation.ug_destino_recurso) {
        toast.error(`Selecione a OM de destino do recurso para a categoria: ${categoria}.`);
        setLoading(false);
        return;
      }
      
      const valorTotalCategoria = itens.reduce((sum, item) => sum + (item.quantidade * item.consumo_fixo * form.dias_operacao), 0);
      
      // 3. Gerar o detalhamento para a categoria
      const detalhamento = generateCategoryDetalhamento(
        categoria,
        itens,
        form.dias_operacao,
        form.organizacao,
        form.ug,
        faseFinalString,
        allocation.om_destino_recurso,
        allocation.ug_destino_recurso,
        allocation.nd_30_value,
        allocation.nd_39_value
      );
      
      // 4. Criar o registro para a categoria
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'COMBUSTIVEL_CONSOLIDADO',
        organizacao: allocation.om_destino_recurso,
        ug: allocation.ug_destino_recurso,
        quantidade: itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: form.dias_operacao,
        tipo_combustivel: itens[0]?.tipo_combustivel_fixo || 'DIESEL', // Assume o primeiro
        preco_litro: 0, // Será preenchido pela lógica de combustível
        total_litros: itens.reduce((sum, item) => sum + (item.quantidade * item.consumo_fixo * form.dias_operacao), 0),
        valor_total: valorTotalCategoria,
        detalhamento: detalhamento,
        fase_atividade: faseFinalString,
        itens_equipamentos: itens.map(item => ({
          ...item,
          tipo_equipamento_especifico: item.item,
        })) as any,
      };
      registrosParaSalvar.push(registro);
    }

    // 5. Deletar todos os registros existentes e inserir os novos
    try {
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId);
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe III atualizados com sucesso!");
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

  // ... (restante do código permanece o mesmo)