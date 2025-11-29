import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Package, Pencil, Trash2, XCircle, Check, ChevronDown, ClipboardList, Sparkles, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
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
  memoria_customizada?: string | null; // NOVO CAMPO
}

interface FormDataClasseII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora
  ug: string; // UG Detentora
  dias_operacao: number;
  itens: ItemClasseII[];
  fase_atividade?: string;
  // CAMPOS PARA OM DE DESTINO DO RECURSO (ND 30)
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
  
  // NOVOS CAMPOS DE ALOCAÇÃO
  valor_nd_39_input: string; // Input string para ND 33.90.39
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

export default function ClasseIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState<FormDataClasseII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
    om_destino_recurso: "",
    ug_destino_recurso: "",
    selectedOmDestinoId: undefined,
    valor_nd_39_input: "",
  });
  
  // NOVO ESTADO: Lista de itens da categoria atual com quantidades editáveis
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemClasseII[]>([]);
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // NOVOS ESTADOS para edição de memória de cálculo por item
  const [editingItemMemoriaId, setEditingItemMemoriaId] = useState<{ registroId: string, itemIndex: number } | null>(null);
  const [memoriaItemEdit, setMemoriaItemEdit] = useState<string>("");

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
  
  // NOVO MEMO: Agrupa os itens do formulário por categoria para exibição consolidada
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
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    const uniqueRecordsMap = new Map<string, ClasseIIRegistro>();
    (data || []).forEach(r => {
        const key = `${r.organizacao}-${r.ug}`;
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
  
  const generateItemMemoriaCalculo = (item: ItemClasseII, diasOperacao: number, organizacao: string, ug: string, faseAtividade: string | null | undefined): string => {
    if (item.memoria_customizada) {
      return item.memoria_customizada;
    }
    
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorItem = item.quantidade * item.valor_mnt_dia * diasOperacao;

    return `33.90.30 - Aquisição de Material de Intendência (${item.categoria}) - Item: ${item.item}
OM de Destino: ${organizacao} (UG: ${ug})
Período: ${diasOperacao} dias de ${faseFormatada}

Cálculo:
Fórmula: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_mnt_dia)}/dia x ${diasOperacao} dias = ${formatCurrency(valorItem)}.

Valor Total do Item: ${formatCurrency(valorItem)}.`;
  };

  const resetFormFields = () => {
    setEditingId(null);
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
      om_destino_recurso: "",
      ug_destino_recurso: "",
      selectedOmDestinoId: undefined,
      valor_nd_39_input: "",
    });
    // Resetar estados de edição de item
    setEditingItemMemoriaId(null);
    setMemoriaItemEdit("");
    // Resetar currentCategoryItems (será re-populado pelo useEffect)
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
        // Por padrão, a OM de destino do recurso é a OM detentora
        om_destino_recurso: omData.nome_om,
        ug_destino_recurso: omData.codug_om,
        selectedOmDestinoId: omData.id,
      });
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
        om_destino_recurso: "",
        ug_destino_recurso: "",
        selectedOmDestinoId: undefined,
      });
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ 
        ...form, 
        om_destino_recurso: omData.nome_om, 
        ug_destino_recurso: omData.codug_om,
        selectedOmDestinoId: omData.id,
      });
    } else {
      setForm({ 
        ...form, 
        om_destino_recurso: "", 
        ug_destino_recurso: "",
        selectedOmDestinoId: undefined,
      });
    }
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

  // NOVO HANDLER: Salva os itens da lista expandida para o form.itens principal
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Operação antes de salvar itens.");
        return;
    }

    // 1. Itens válidos da categoria atual (quantidade > 0)
    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);

    // 2. Itens de outras categorias no formulário principal
    const otherCategoryItems = form.itens.filter(item => item.categoria !== selectedTab);

    // 3. Mesclar as listas
    const newFormItems = [...otherCategoryItems, ...itemsToKeep];

    setForm({ ...form, itens: newFormItems });
    toast.success(`Itens da categoria ${selectedTab} atualizados!`);
  };
  
  // Lógica de cálculo de alocação
  const valorTotalForm = form.itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
  
  const nd39Value = useMemo(() => {
    const parsed = parseInputToNumber(form.valor_nd_39_input);
    return Math.min(valorTotalForm, Math.max(0, parsed));
  }, [form.valor_nd_39_input, valorTotalForm]);
  
  const nd30Value = valorTotalForm - nd39Value;

  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    // Permite a formatação de milhar e decimal
    const formattedValue = formatNumberForInput(parseInputToNumber(rawValue), 2);
    setForm(prev => ({ ...prev, valor_nd_39_input: formattedValue }));
  };
  
  const handleND39InputBlur = () => {
    // Ao perder o foco, garante que o valor seja formatado corretamente
    const numericValue = parseInputToNumber(form.valor_nd_39_input);
    setForm(prev => ({ ...prev, valor_nd_39_input: formatNumberForInput(numericValue, 2) }));
  };


  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error("Adicione pelo menos um item"); return; }
    if (!form.om_destino_recurso || !form.ug_destino_recurso) { toast.error("Selecione a OM de destino do recurso"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }

    setLoading(true);
    
    const valorTotal = valorTotalForm; // Já calculado
    const valorND30Final = nd30Value;
    const valorND39Final = nd39Value;
    
    const detalhamento = generateDetalhamento(
      form.itens, 
      form.dias_operacao, 
      form.organizacao, 
      form.ug, 
      faseFinalString,
      form.om_destino_recurso,
      form.ug_destino_recurso,
      valorND30Final,
      valorND39Final
    );
    
    // Mapear itens para garantir que 'memoria_customizada' seja explicitamente null se estiver faltando
    const finalItensToSave = form.itens.map(item => ({
        ...item,
        memoria_customizada: item.memoria_customizada || null,
    }));
    
    const registroParaSalvar: TablesInsert<'classe_ii_registros'> = {
      p_trab_id: ptrabId,
      organizacao: form.om_destino_recurso, // OM de destino do recurso (ND 30)
      ug: form.ug_destino_recurso, // UG de destino do recurso
      dias_operacao: form.dias_operacao,
      categoria: 'CONSOLIDADO',
      itens_equipamentos: finalItensToSave as any, // Salvar o array atualizado
      valor_total: valorTotal,
      detalhamento: detalhamento,
      fase_atividade: faseFinalString,
      detalhamento_customizado: null, // Ignorar o campo de detalhamento consolidado
      valor_nd_30: valorND30Final, // NOVO
      valor_nd_39: valorND39Final, // NOVO
    };
    
    try {
      // 1. Deletar registros existentes para esta OM/UG de destino
      const { error: deleteError } = await supabase
        .from("classe_ii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.om_destino_recurso)
        .eq("ug", form.ug_destino_recurso);
      if (deleteError) { console.error("Erro ao deletar registros existentes:", deleteError); throw deleteError; }
      
      // 2. Inserir o novo registro consolidado
      const { error: insertError } = await supabase.from("classe_ii_registros").insert([registroParaSalvar]);
      if (insertError) throw insertError;
      
      toast.success(editingId ? "Registro de Classe II atualizado com sucesso!" : "Registro de Classe II salvo com sucesso!");
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
    
    const consolidatedItems = registro.itens_equipamentos || [];
    let selectedOmIdForEdit: string | undefined = undefined;
    let selectedOmDestinoIdForEdit: string | undefined = undefined;
    
    try {
      // Buscar OM Detentora (usando o nome da OM do primeiro item, se houver)
      // Nota: O item não armazena OM/UG, mas o registro consolidado sim.
      // Para fins de edição, assumimos que a OM Detentora é a mesma que a OM de Destino do Recurso,
      // a menos que tenhamos uma forma de rastrear a OM Detentora original.
      // Por enquanto, vamos assumir que a OM Detentora é a mesma que a OM de Destino do Recurso.
      
      const omDetentoraNome = registro.organizacao;
      const omDetentoraUg = registro.ug;
      
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id, nome_om, codug_om')
        .eq('nome_om', omDetentoraNome)
        .eq('codug_om', omDetentoraUg)
        .maybeSingle();
        
      if (omData && !omError) {
        selectedOmIdForEdit = omData.id;
        selectedOmDestinoIdForEdit = omData.id;
      }
      
    } catch (error) {
      console.error("Erro ao buscar OMs para edição:", error);
    }
    
    setEditingId(registro.id); 
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: registro.organizacao, // OM Detentora (Assumindo ser a mesma que a de destino)
      ug: registro.ug, // UG Detentora
      dias_operacao: registro.dias_operacao,
      itens: consolidatedItems, // Load all items here
      om_destino_recurso: registro.organizacao, // OM de Destino do Recurso
      ug_destino_recurso: registro.ug, // UG de Destino do Recurso
      selectedOmDestinoId: selectedOmDestinoIdForEdit,
      valor_nd_39_input: formatNumberForInput(registro.valor_nd_39, 2), // NOVO: Carregar valor ND 39
    });
    
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // Set the initial tab to the category of the first item, if available
    if (consolidatedItems.length > 0) {
        const firstCategory = consolidatedItems[0].categoria;
        setSelectedTab(firstCategory);
    } else {
        setSelectedTab(CATEGORIAS[0]);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  // --- Handlers para Edição de Memória por Item ---
  const handleIniciarEdicaoMemoriaItem = (registroId: string, itemIndex: number) => {
    const registro = registros.find(r => r.id === registroId);
    if (!registro) return;
    
    const item = registro.itens_equipamentos[itemIndex];
    if (!item) return;
    
    // Gerar memória automática (passando item sem customização para forçar a geração)
    const autoMemoria = generateItemMemoriaCalculo(
      { ...item, memoria_customizada: null }, 
      registro.dias_operacao,
      registro.organizacao,
      registro.ug,
      registro.fase_atividade
    );
    
    setEditingItemMemoriaId({ registroId, itemIndex });
    setMemoriaItemEdit(item.memoria_customizada || autoMemoria);
  };

  const handleCancelarEdicaoMemoriaItem = () => {
    setEditingItemMemoriaId(null);
    setMemoriaItemEdit("");
  };

  const handleSalvarMemoriaCustomizadaItem = async () => {
    if (!editingItemMemoriaId) return;
    
    const { registroId, itemIndex } = editingItemMemoriaId;
    const registroToUpdate = registros.find(r => r.id === registroId);
    if (!registroToUpdate) return;
    
    setLoading(true);
    
    try {
      // 1. Atualizar o item na lista de itens_equipamentos
      const novosItens = [...registroToUpdate.itens_equipamentos];
      novosItens[itemIndex] = {
        ...novosItens[itemIndex],
        memoria_customizada: memoriaItemEdit.trim() || null,
      };
      
      // 2. Salvar o registro completo de volta no DB
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          itens_equipamentos: novosItens as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo do item atualizada!");
      handleCancelarEdicaoMemoriaItem();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar memória customizada do item:", error);
      toast.error("Erro ao salvar memória customizada do item.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleRestaurarMemoriaAutomaticaItem = async () => {
    if (!editingItemMemoriaId) return;
    
    if (!confirm("Deseja restaurar a memória de cálculo automática? O texto customizado será perdido.")) {
      return;
    }
    
    const { registroId, itemIndex } = editingItemMemoriaId;
    const registroToUpdate = registros.find(r => r.id === registroId);
    if (!registroToUpdate) return;
    
    setLoading(true);
    
    try {
      // 1. Atualizar o item na lista de itens_equipamentos, removendo a customização
      const novosItens = [...registroToUpdate.itens_equipamentos];
      novosItens[itemIndex] = {
        ...novosItens[itemIndex],
        memoria_customizada: null,
      };
      
      // 2. Salvar o registro completo de volta no DB
      const { error } = await supabase
        .from("classe_ii_registros")
        .update({
          itens_equipamentos: novosItens as any,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo do item restaurada!");
      handleCancelarEdicaoMemoriaItem();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória customizada do item:", error);
      toast.error("Erro ao restaurar memória customizada do item.");
    } finally {
      setLoading(false);
    }
  };
  // --- Fim Handlers para Edição de Memória por Item ---

  const registrosAgrupados = useMemo(() => {
    return registros;
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
                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                {formatCurrency(currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0))}
                            </span>
                        </div>
                        
                        {/* NOVO CAMPO: OM de Destino do Recurso (ND 30) */}
                        <div className="space-y-2 pt-2">
                          <Label>OM de Destino do Recurso (ND 30/39) *</Label>
                          <OmSelector
                            selectedOmId={form.selectedOmDestinoId}
                            onChange={handleOMDestinoChange}
                            placeholder="Selecione a OM que receberá o recurso..."
                            // Desabilitar se a OM detentora não estiver selecionada
                            disabled={!form.organizacao} 
                          />
                          {form.ug_destino_recurso && (
                            <p className="text-xs text-muted-foreground">
                              UG de Destino: {form.ug_destino_recurso}
                            </p>
                          )}
                        </div>

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

            {/* 3. Itens Adicionados e Consolidação */}
            {form.itens.length > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">3. Itens Adicionados ({form.itens.length})</h3>
                
                <div className="space-y-4">
                  {Object.entries(itensAgrupadosPorCategoria).map(([categoria, itens]) => {
                    const totalCategoria = itens.reduce((sum, item) => sum + (item.quantidade * item.valor_mnt_dia * form.dias_operacao), 0);
                    const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                    
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
                
                {/* NOVO BLOCO DE ALOCAÇÃO ND 30/39 */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold text-sm">Alocação de Recursos (ND 33.90.30 / 33.90.39)</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nd39-input">ND 33.90.39 (Serviço)</Label>
                            <div className="relative">
                                <Input
                                    id="nd39-input"
                                    type="text"
                                    inputMode="decimal"
                                    value={form.valor_nd_39_input}
                                    onChange={handleND39InputChange}
                                    onBlur={handleND39InputBlur}
                                    placeholder="0,00"
                                    className="pl-8 text-lg"
                                    disabled={valorTotalForm === 0}
                                    onKeyDown={handleEnterToNextField}
                                />
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Valor alocado para contratação de serviço.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>ND 33.90.30 (Material)</Label>
                            <div className="relative">
                                <Input
                                    value={formatNumberForInput(nd30Value, 2)}
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
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-2">
                        <span>TOTAL ALOCADO:</span>
                        <span className={cn(valorTotalForm === (nd30Value + nd39Value) ? "text-primary" : "text-destructive")}>
                            {formatCurrency(nd30Value + nd39Value)}
                        </span>
                    </div>
                </div>
                {/* FIM NOVO BLOCO DE ALOCAÇÃO */}
                
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
                    disabled={loading || !form.organizacao || form.itens.length === 0 || !form.om_destino_recurso || valorTotalForm !== (nd30Value + nd39Value)}
                  >
                    {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registrosAgrupados.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  OMs Cadastradas
                </h2>
                
                {registrosAgrupados.map((registro) => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const totalOM = registro.valor_total;
                  const fases = formatFasesParaTexto(registro.fase_atividade);
                  
                  return (
                    <Card key={registro.id} className="p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3 border-b pb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-lg font-semibold text-foreground">{om} (UG: {ug})</h4>
                          <Badge variant="secondary" className="ml-2 text-xs">Consolidado</Badge>
                        </div>
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
                              if (confirm(`Deseja realmente deletar o registro de Classe II para ${om}?`)) {
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
                      
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Dias: {registro.dias_operacao} | Fases: {fases}</p>
                        
                        <div className="space-y-1 pt-2">
                          {Object.entries(registro.itens_equipamentos.reduce((acc, item) => {
                            acc[item.categoria] = (acc[item.categoria] || 0) + item.quantidade;
                            return acc;
                          }, {} as Record<Categoria, number>)).map(([categoria, quantidade]) => (
                            <div key={categoria} className="flex justify-between text-sm border-b border-dashed pb-1">
                              <span className="font-medium text-primary">{categoria} ({quantidade} itens)</span>
                              <span className="font-semibold">{formatCurrency(registro.itens_equipamentos.filter(i => i.categoria === categoria).reduce((sum, i) => sum + (i.quantidade * i.valor_mnt_dia * registro.dias_operacao), 0))}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Exibição da Alocação */}
                        <div className="pt-2 border-t">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                                <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                                <span className="font-medium text-blue-600">{formatCurrency(registro.valor_nd_39)}</span>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-2">
                          <span className="font-bold text-base">TOTAL OM</span>
                          <span className="font-extrabold text-xl text-primary">{formatCurrency(totalOM)}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 5. Memórias de Cálculos Detalhadas - AGORA COM EDIÇÃO POR ITEM */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Memórias de Cálculos Detalhadas
                </h2>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      <h4 className="text-lg font-semibold text-foreground">
                        OM: {om} ({ug})
                      </h4>
                      
                      <div className="space-y-3">
                        {registro.itens_equipamentos.map((item, itemIndex) => {
                          const isEditing = editingItemMemoriaId?.registroId === registro.id && editingItemMemoriaId?.itemIndex === itemIndex;
                          const hasCustomMemoria = !!item.memoria_customizada;
                          
                          const itemMemoria = isEditing 
                            ? memoriaItemEdit 
                            : generateItemMemoriaCalculo(
                                item, 
                                registro.dias_operacao, 
                                registro.organizacao, 
                                registro.ug, 
                                registro.fase_atividade
                              );
                          
                          return (
                            <Card key={itemIndex} className="p-4 bg-background">
                              <div className="flex items-center justify-between mb-2">
                                <h6 className="font-bold text-sm">
                                  {item.item} ({item.quantidade} un.) - {item.categoria}
                                </h6>
                                
                                <div className="flex items-center gap-2">
                                  {hasCustomMemoria && !isEditing && (
                                    <Badge variant="outline" className="text-xs">
                                      Editada manualmente
                                    </Badge>
                                  )}
                                  
                                  {!isEditing ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleIniciarEdicaoMemoriaItem(registro.id, itemIndex)}
                                        disabled={loading}
                                        className="gap-2"
                                      >
                                        <Pencil className="h-4 w-4" />
                                        Editar
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        onClick={handleSalvarMemoriaCustomizadaItem}
                                        disabled={loading}
                                        className="gap-2"
                                      >
                                        <Check className="h-4 w-4" />
                                        Salvar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCancelarEdicaoMemoriaItem}
                                        disabled={loading}
                                        className="gap-2"
                                      >
                                        <XCircle className="h-4 w-4" />
                                        Cancelar
                                      </Button>
                                      {hasCustomMemoria && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={handleRestaurarMemoriaAutomaticaItem}
                                          disabled={loading}
                                          className="gap-2 text-muted-foreground"
                                        >
                                          <XCircle className="h-4 w-4" />
                                          Restaurar
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <Card className="p-3 bg-muted/50">
                                <Textarea
                                  value={itemMemoria}
                                  onChange={(e) => isEditing && setMemoriaItemEdit(e.target.value)}
                                  readOnly={!isEditing}
                                  rows={10}
                                  className={cn(
                                    "font-mono text-xs whitespace-pre-wrap text-foreground",
                                    isEditing && "border-primary focus:ring-2 focus:ring-primary"
                                  )}
                                />
                              </Card>
                            </Card>
                          );
                        })}
                      </div>
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