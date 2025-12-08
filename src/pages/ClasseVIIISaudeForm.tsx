import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, XCircle, Check, ChevronsUpDown, Sparkles, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { defaultClasseVIIISaudeConfig, ItemSaude, defaultClasseVIIIRemontaConfig, ItemRemonta } from "@/data/classeVIIIData";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Importando Tabs

type Categoria = 'Saúde' | 'Remonta/Veterinária';

const CATEGORIAS: Categoria[] = ['Saúde', 'Remonta/Veterinária'];

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemRegistro extends ItemSaude, ItemRemonta {
  quantidade: number;
}

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string; // OM Detentora (Global)
  ug: string; // UG Detentora (Global)
  dias_operacao: number; // Global
  itens: ItemRegistro[]; // All items across all categories
  fase_atividade?: string; // Global
}

interface ClasseVIIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  dias_operacao: number;
  categoria: Categoria;
  itens_saude?: ItemRegistro[]; // Usado para Saúde
  itens_remonta?: ItemRegistro[]; // Usado para Remonta
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface SaudeAllocation {
  total_valor: number;
  nd_39_input: string; // User input string for ND 39
  nd_30_value: number; // Calculated ND 30 value
  nd_39_value: number; // Calculated ND 39 value
  om_destino_recurso: string;
  ug_destino_recurso: string;
  selectedOmDestinoId?: string;
}

const initialSaudeAllocation: SaudeAllocation = {
    total_valor: 0, 
    nd_39_input: "", 
    nd_30_value: 0, 
    nd_39_value: 0, 
    om_destino_recurso: "", 
    ug_destino_recurso: "", 
    selectedOmDestinoId: undefined 
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

// NOVO: Gera a memória de cálculo detalhada para a Classe VIII
const generateMemoriaCalculo = (categoria: Categoria, itens: ItemRegistro[], diasOperacao: number, organizacao: string, ug: string, faseAtividade: string, valorTotal: number, omDestino: string, ugDestino: string, valorND30: number, valorND39: number): string => {
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const totalItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
    const titulo = categoria === 'Saúde' ? "KPSI/KPSC e KPT" : "Material de Remonta e Veterinária";
    // const tabela = categoria === 'Saúde' ? "classe_viii_saude_registros" : "classe_viii_remonta_registros"; // Não usado no detalhamento

    let detalhamentoItens = "";
    let calculoDetalhado = "";
    
    itens.forEach(item => {
        const valorItem = item.quantidade * item.valor_unitario;
        detalhamentoItens += `- ${item.item}: ${formatCurrency(item.valor_unitario)}\n`;
        calculoDetalhado += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(valorItem)}\n`;
    });

    return `33.90.30 / 33.90.39 - Aquisição de ${titulo} para utilização por ${totalItens} itens do ${organizacao}, durante ${diasOperacao} dias de ${faseFormatada}.
Recurso destinado à OM proprietária: ${omDestino} (UG: ${ugDestino})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Cálculo:
Fórmula Base: Nr Itens x valor do item

Valores Unitários:
${detalhamentoItens.trim()}

Cálculo Detalhado:
${calculoDetalhado.trim()}

Total: ${formatCurrency(valorTotal)}.`;
};


const ClasseVIIISaudeForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Categoria>('Saúde');
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  // NOVO ESTADO: Alocação de recursos (substitui alocacaoND30/39)
  const [saudeAllocation, setSaudeAllocation] = useState<SaudeAllocation>(initialSaudeAllocation);
  
  const [form, setForm] = useState<FormDataClasseVIII>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  const { handleEnterToNextField } = useFormNavigation();
  
  // Mapeamento de diretrizes
  const diretrizesMap = useMemo(() => ({
      'Saúde': defaultClasseVIIISaudeConfig as ItemRegistro[],
      'Remonta/Veterinária': defaultClasseVIIIRemontaConfig as ItemRegistro[],
  }), []);
  
  // Estado para a lista de itens da categoria atual com quantidades editáveis
  const [currentCategoryItems, setCurrentCategoryItems] = useState<ItemRegistro[]>([]);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do P Trab não encontrado");
      navigate("/ptrab");
      return;
    }
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);
  
  // Efeito para carregar/resetar itens quando a categoria muda ou o formulário é resetado
  useEffect(() => {
    const availableItems = diretrizesMap[activeCategory] || [];
    
    const existingItemsMap = new Map<string, ItemRegistro>();
    // Se estiver editando, usamos os itens do form.itens (que foram carregados)
    if (editingId) {
        form.itens.forEach(item => {
            existingItemsMap.set(item.item, item);
        });
    }

    const mergedItems = availableItems.map(availableItem => {
        const existing = existingItemsMap.get(availableItem.item);
        return existing || { ...availableItem, quantidade: 0 };
    });

    setCurrentCategoryItems(mergedItems);
  }, [activeCategory, diretrizesMap, editingId, form.itens]);

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    setLoading(true);
    
    const [saudeRes, remontaRes] = await Promise.all([
        supabase
            .from("classe_viii_saude_registros")
            .select("*, itens_saude, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
        supabase
            .from("classe_viii_remonta_registros")
            .select("*, itens_remonta, detalhamento_customizado, valor_nd_30, valor_nd_39")
            .eq("p_trab_id", ptrabId),
    ]);

    if (saudeRes.error) { console.error("Erro ao carregar registros de Saúde:", saudeRes.error); }
    if (remontaRes.error) { console.error("Erro ao carregar registros de Remonta:", remontaRes.error); }

    const saudeRegistros = (saudeRes.data || []).map(r => ({
        ...r,
        categoria: 'Saúde' as Categoria,
        itens_saude: (r.itens_saude || []) as ItemRegistro[],
        valor_nd_30: Number(r.valor_nd_30),
        valor_nd_39: Number(r.valor_nd_39),
    }) as ClasseVIIIRegistro[]);
    
    const remontaRegistros = (remontaRes.data || []).map(r => ({
        ...r,
        categoria: 'Remonta/Veterinária' as Categoria,
        itens_remonta: (r.itens_remonta || []) as ItemRegistro[],
        valor_nd_30: Number(r.valor_nd_30),
        valor_nd_39: Number(r.valor_nd_39),
    }) as ClasseVIIIRegistro[]);

    setRegistros([...saudeRegistros, ...remontaRegistros].sort((a, b) => a.organizacao.localeCompare(b.organizacao)));
    setLoading(false);
  };

  const resetFormFields = (newCategory?: Categoria) => {
    const categoryToReset = newCategory || activeCategory;
    
    setEditingId(null);
    setForm({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    
    // Reseta os itens da categoria ativa
    setCurrentCategoryItems(diretrizesMap[categoryToReset].map(d => ({ ...d, quantidade: 0 })));
    
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
    
    setSaudeAllocation(initialSaudeAllocation);
  };
  
  const handleCategoryChange = (category: Categoria) => {
      if (activeCategory !== category) {
          setActiveCategory(category);
          resetFormFields(category);
      }
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ 
        ...form, 
        selectedOmId: omData.id, 
        organizacao: omData.nome_om, 
        ug: omData.codug_om,
      });
      
      // Inicializa a OM de destino do recurso com a OM detentora
      setSaudeAllocation(prev => ({
          ...prev,
          om_destino_recurso: omData.nome_om,
          ug_destino_recurso: omData.codug_om,
          selectedOmDestinoId: omData.id,
      }));
      
    } else {
      setForm({ 
        ...form, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      });
      
      // Limpa a OM de destino do recurso
      setSaudeAllocation(prev => ({
          ...prev,
          om_destino_recurso: "",
          ug_destino_recurso: "",
          selectedOmDestinoId: undefined,
      }));
    }
  };
  
  const handleOMDestinoChange = (omData: OMData | undefined) => {
    setSaudeAllocation(prev => ({
        ...prev,
        om_destino_recurso: omData?.nome_om || "",
        ug_destino_recurso: omData?.codug_om || "",
        selectedOmDestinoId: omData?.id,
    }));
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // Handler: Atualiza a quantidade de um item na lista expandida
  const handleQuantityChange = (itemIndex: number, quantity: number) => {
    const newItems = [...currentCategoryItems];
    // Garante que a quantidade seja um número inteiro não negativo
    newItems[itemIndex].quantidade = Math.max(0, Math.floor(quantity)); 
    setCurrentCategoryItems(newItems);
  };
  
  // ND Calculation and Input Handlers
  const valorTotalCategoriaEmEdicao = currentCategoryItems.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
  
  const nd39ValueTemp = Math.min(valorTotalCategoriaEmEdicao, Math.max(0, parseInputToNumber(saudeAllocation.nd_39_input)));
  const nd30ValueTemp = valorTotalCategoriaEmEdicao - nd39ValueTemp;

  const handleND39InputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      setSaudeAllocation(prev => ({
          ...prev,
          nd_39_input: formatInputWithThousands(rawValue)
      }));
  };

  const handleND39InputBlur = () => {
      const numericValue = parseInputToNumber(saudeAllocation.nd_39_input);
      const finalND39Value = Math.min(valorTotalCategoriaEmEdicao, Math.max(0, numericValue));
      
      setSaudeAllocation(prev => ({
          ...prev,
          nd_39_input: formatNumberForInput(finalND39Value, 2),
          nd_39_value: finalND39Value,
          nd_30_value: valorTotalCategoriaEmEdicao - finalND39Value,
          total_valor: valorTotalCategoriaEmEdicao,
      }));
  };


  // NOVO HANDLER: Salva os itens da lista expandida para o form.itens principal
  const handleUpdateCategoryItems = () => {
    if (!form.organizacao || form.dias_operacao <= 0) {
        toast.error("Preencha a OM e os Dias de Operação antes de salvar itens.");
        return;
    }
    
    // 1. Itens válidos da categoria atual (quantidade > 0)
    const itemsToKeep = currentCategoryItems.filter(item => item.quantidade > 0);
    
    // 2. Recalcular o valor total
    const total = itemsToKeep.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
    
    // 3. Aplicar a alocação ND 30/39 final (baseado no input atual)
    const numericInput = parseInputToNumber(saudeAllocation.nd_39_input);
    const finalND39Value = Math.min(total, Math.max(0, numericInput));
    const finalND30Value = total - finalND39Value;
    
    if (total > 0 && (!saudeAllocation.om_destino_recurso || !saudeAllocation.ug_destino_recurso)) {
        toast.error("Selecione a OM de destino do recurso antes de salvar a alocação.");
        return;
    }

    // 4. Atualizar o estado de alocação com os valores finais
    setSaudeAllocation(prev => ({
        ...prev,
        total_valor: total,
        nd_39_input: formatNumberForInput(finalND39Value, 2), // Armazena o valor final formatado
        nd_30_value: finalND30Value,
        nd_39_value: finalND39Value,
    }));

    // 5. Atualizar o formulário principal
    setForm({ ...form, itens: itemsToKeep });
    
    toast.success(`Itens de ${activeCategory} e alocação de ND atualizados!`);
  };
  
  // O valor total do formulário (que será salvo) é baseado nos itens confirmados (form.itens)
  const valorTotalForm = form.itens.reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
  
  const totalND30Final = saudeAllocation.nd_30_value;
  const totalND39Final = saudeAllocation.nd_39_value;
  
  const isTotalAlocadoCorrect = areNumbersEqual(valorTotalForm, totalND30Final + totalND39Final);

  const handleSalvarRegistros = async () => {
    if (!ptrabId) return;
    if (!form.organizacao || !form.ug) { toast.error("Selecione uma OM detentora"); return; }
    if (form.dias_operacao <= 0) { toast.error("Dias de operação deve ser maior que zero"); return; }
    if (form.itens.length === 0) { toast.error(`Adicione pelo menos um item. Clique em 'Salvar Itens de ${activeCategory}'.`); return; }
    
    if (!isTotalAlocadoCorrect) { toast.error("A soma da alocação ND 30 e ND 39 deve ser igual ao Valor Total. Clique em 'Salvar Itens de Saúde'."); return; }
    if (valorTotalForm > 0 && (!saudeAllocation.om_destino_recurso || !saudeAllocation.ug_destino_recurso)) {
        toast.error("Selecione a OM de destino do recurso.");
        return;
    }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    setLoading(true);
    
    const itens = form.itens;
    const tableName = activeCategory === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
    const itensKey = activeCategory === 'Saúde' ? 'itens_saude' : 'itens_remonta';
    
    const detalhamento = generateMemoriaCalculo(
        activeCategory,
        itens, 
        form.dias_operacao, 
        form.organizacao, // OM Detentora
        form.ug, // UG Detentora
        faseFinalString,
        valorTotalForm,
        saudeAllocation.om_destino_recurso, // OM Destino Recurso
        saudeAllocation.ug_destino_recurso, // UG Destino Recurso
        totalND30Final,
        totalND39Final
    );
    
    // Nota: O tipo TablesInsert<'classe_viii_saude_registros'> é usado como base, mas o objeto final é dinâmico
    const baseRegistro: TablesInsert<'classe_viii_saude_registros'> = {
        p_trab_id: ptrabId,
        organizacao: saudeAllocation.om_destino_recurso, // OM de destino do recurso
        ug: saudeAllocation.ug_destino_recurso, // UG de destino do recurso
        dias_operacao: form.dias_operacao,
        categoria: activeCategory,
        valor_total: valorTotalForm,
        detalhamento: detalhamento,
        fase_atividade: faseFinalString,
        detalhamento_customizado: null,
        valor_nd_30: totalND30Final,
        valor_nd_39: totalND39Final,
    };
    
    const registro = {
        ...baseRegistro,
        [itensKey]: itens as any,
    };

    try {
      // 1. Deletar registros existentes (apenas o registro da categoria ativa para esta OM/UG)
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao) // Usamos a OM Detentora para deletar
        .eq("ug", form.ug);
      if (deleteError) { console.error(`Erro ao deletar registros existentes em ${tableName}:`, deleteError); throw deleteError; }
      
      // 2. Inserir o novo registro
      const { error: insertError } = await supabase.from(tableName).insert([registro]);
      if (insertError) throw insertError;
      
      toast.success(editingId ? `Registro de ${activeCategory} atualizado com sucesso!` : `Registro de ${activeCategory} salvo com sucesso!`);
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error(`Erro ao salvar registros de ${activeCategory}:`, error);
      toast.error(`Erro ao salvar registros de ${activeCategory}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    resetFormFields(registro.categoria);
    setActiveCategory(registro.categoria);
    
    // 1. Preencher o formulário principal (OM Detentora)
    let selectedOmIdForEdit: string | undefined = undefined;
    try {
        const { data: omData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            // Assumimos que a OM Detentora é a mesma que a OM de Destino do Recurso (organizacao/ug)
            .eq('nome_om', registro.organizacao) 
            .eq('codug_om', registro.ug)
            .maybeSingle();
        selectedOmIdForEdit = omData?.id;
    } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    
    const itensRegistro = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
    
    setEditingId(registro.id); 
    setForm({
      selectedOmId: selectedOmIdForEdit,
      organizacao: registro.organizacao,
      ug: registro.ug,
      dias_operacao: registro.dias_operacao,
      itens: itensRegistro || [],
    });
    
    // 2. Preencher alocação ND e OM Destino
    const totalValor = (itensRegistro || []).reduce((sum, item) => sum + (item.quantidade * item.valor_unitario), 0);
    
    setSaudeAllocation({
        total_valor: totalValor,
        nd_39_input: formatNumberForInput(registro.valor_nd_39, 2),
        nd_30_value: registro.valor_nd_30,
        nd_39_value: registro.valor_nd_39,
        om_destino_recurso: registro.organizacao,
        ug_destino_recurso: registro.ug,
        selectedOmDestinoId: selectedOmIdForEdit, // Usamos o mesmo ID, pois é o mesmo OM/UG
    });
    
    // 3. Preencher fases
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    // 4. Recarregar a lista de itens editáveis com as quantidades salvas (feito no useEffect)
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const handleDeletarRegistro = async (registro: ClasseVIIIRegistro) => {
    if (!confirm(`Deseja realmente deletar o registro de ${registro.categoria} para ${registro.organizacao}?`)) {
        return;
    }
    
    setLoading(true);
    const tableName = registro.categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
    
    try {
        const { error } = await supabase.from(tableName)
            .delete()
            .eq("id", registro.id);
            
        if (error) throw error;
        
        toast.success("Registro excluído!");
        fetchRegistros();
    } catch (err) {
        toast.error(sanitizeError(err));
    } finally {
        setLoading(false);
    }
  };
  
  const registrosAgrupadosPorOM = useMemo(() => {
    return registros.reduce((acc, registro) => {
        const key = `${registro.organizacao} (${registro.ug})`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(registro);
        return acc;
    }, {} as Record<string, ClasseVIIIRegistro[]>);
  }, [registros]);

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
    const tableName = registro.categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
    
    try {
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
    const tableName = registro.categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
    
    try {
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
              Solicitação de recursos para Kits de Primeiros Socorros (Saúde) ou Material de Remonta/Veterinária.
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
                    type="text"
                    className="max-w-xs"
                    value={formatNumberForInput(form.dias_operacao, 0)} 
                    onChange={(e) => setForm({ ...form, dias_operacao: parseInputToNumber(e.target.value, 0) })}
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
                            placeholder="Ex: Concentração"
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* 2. Configurar Itens por Categoria */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                
                {/* Seletor de Categoria (Tabs) - MOVIDO PARA AQUI */}
                <Tabs value={activeCategory} onValueChange={(value) => handleCategoryChange(value as Categoria)}>
                    <TabsList className="grid w-full grid-cols-2">
                        {CATEGORIAS.map(cat => (
                            <TabsTrigger key={cat} value={cat} disabled={loading}>
                                {cat}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                
                <div className="max-h-[400px] overflow-y-auto rounded-md border">
                    <Table className="w-full">
                        <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                            <TableRow>
                                <TableHead className="w-[50%]">Item (MEM)</TableHead>
                                <TableHead className="w-[20%] text-right">Valor Unitário</TableHead>
                                <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                                <TableHead className="w-[15%] text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentCategoryItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                                        Nenhum item de diretriz encontrado para {activeCategory}.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentCategoryItems.map((item, index) => {
                                    const itemTotal = item.quantidade * item.valor_unitario;
                                    
                                    return (
                                        <TableRow key={item.item} className="h-12">
                                            <TableCell className="font-medium text-sm py-1">
                                                {item.item}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground py-1">
                                                {formatCurrency(item.valor_unitario)}
                                            </TableCell>
                                            <TableCell className="py-1">
                                                <Input
                                                    type="text"
                                                    className="h-8 text-center"
                                                    value={formatNumberForInput(item.quantidade, 0)}
                                                    onChange={(e) => handleQuantityChange(index, parseInputToNumber(e.target.value, 0))}
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
                    <span className="font-bold text-sm">VALOR TOTAL DA CATEGORIA</span>
                    <span className="font-extrabold text-lg text-red-600">
                        {formatCurrency(valorTotalCategoriaEmEdicao)}
                    </span>
                </div>
                
                {/* BLOCO DE ALOCAÇÃO ND 30/39 (Padrão Classe II) */}
                {valorTotalCategoriaEmEdicao > 0 && (
                    <div className="space-y-4 p-4 border rounded-lg bg-background">
                        <h4 className="font-semibold text-sm">Alocação de Recursos para {activeCategory}</h4>
                        
                        {/* CAMPO: OM de Destino do Recurso */}
                        <div className="space-y-2">
                            <Label>OM de Destino do Recurso *</Label>
                            <OmSelector
                                selectedOmId={saudeAllocation.selectedOmDestinoId}
                                onChange={handleOMDestinoChange}
                                placeholder="Selecione a OM que receberá o recurso..."
                                disabled={!form.organizacao} 
                            />
                            {saudeAllocation.ug_destino_recurso && (
                                <p className="text-xs text-muted-foreground">
                                    UG de Destino: {saudeAllocation.ug_destino_recurso}
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
                                        value={saudeAllocation.nd_39_input}
                                        onChange={handleND39InputChange}
                                        onBlur={handleND39InputBlur}
                                        placeholder="0,00"
                                        className="pl-12 text-lg"
                                        disabled={valorTotalCategoriaEmEdicao === 0}
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
                            <span className={cn(areNumbersEqual(valorTotalCategoriaEmEdicao, (nd30ValueTemp + nd39ValueTemp)) ? "text-primary" : "text-destructive")}>
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
                        disabled={!form.organizacao || form.dias_operacao <= 0 || (valorTotalCategoriaEmEdicao > 0 && !areNumbersEqual(valorTotalCategoriaEmEdicao, (nd30ValueTemp + nd39ValueTemp)))}
                    >
                        Salvar Itens de {activeCategory}
                    </Button>
                </div>
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
                            Atenção: O Custo Total dos Itens ({formatCurrency(valorTotalForm)}) não corresponde ao Total Alocado ({formatCurrency(totalND30Final + totalND39Final)}). 
                            Clique em "Salvar Itens de {activeCategory}" para atualizar a alocação.
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="space-y-4">
                  <Card className="p-4 bg-secondary/10 border-secondary">
                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                      <h4 className="font-bold text-base text-primary">{activeCategory} ({form.itens.reduce((sum, i) => sum + i.quantidade, 0)} itens)</h4>
                      <span className="font-extrabold text-lg text-red-600">{formatCurrency(valorTotalForm)}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {form.itens.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                          <span className="font-medium">{item.item}</span>
                          <span className="text-right">
                            {item.quantidade} un. x {formatCurrency(item.valor_unitario)} = {formatCurrency(item.quantidade * item.valor_unitario)}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-2 border-t mt-2">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">OM Destino Recurso:</span>
                            <span className="font-medium text-foreground">
                                {saudeAllocation.om_destino_recurso} ({saudeAllocation.ug_destino_recurso})
                            </span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ND 33.90.30 (Material):</span>
                            <span className="font-medium text-green-600">{formatCurrency(saudeAllocation.nd_30_value)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ND 33.90.39 (Serviço):</span>
                            <span className="font-medium text-blue-600">{formatCurrency(saudeAllocation.nd_39_value)}</span>
                        </div>
                        {!areNumbersEqual(saudeAllocation.total_valor, valorTotalForm) && (
                            <p className="text-xs text-destructive flex items-center gap-1 pt-1">
                                <AlertCircle className="h-3 w-3" />
                                Valores desatualizados. Salve os itens novamente.
                            </p>
                        )}
                    </div>
                  </Card>
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
                    onClick={() => resetFormFields()}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Limpar Formulário
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleSalvarRegistros} 
                    disabled={loading || !form.organizacao || form.itens.length === 0 || !isTotalAlocadoCorrect}
                  >
                    {loading ? "Aguarde..." : (editingId ? "Atualizar Registro" : "Salvar Registro")}
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
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {registro.categoria}
                                                        </h4>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {registro.dias_operacao} | Fases: {fases}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-lg text-red-600">
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
            {registros.length > 0 && (
              <div className="space-y-4 mt-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  📋 Memórias de Cálculos Detalhadas
                </h3>
                
                {registros.map(registro => {
                  const om = registro.organizacao;
                  const ug = registro.ug;
                  const isEditing = editingMemoriaId === registro.id;
                  const hasCustomMemoria = !!registro.detalhamento_customizado;
                  
                  const itensMemoria = registro.categoria === 'Saúde' ? registro.itens_saude : registro.itens_remonta;
                  
                  const memoriaAutomatica = generateMemoriaCalculo(
                      registro.categoria,
                      itensMemoria || [], 
                      registro.dias_operacao, 
                      registro.organizacao, 
                      registro.ug, 
                      registro.fase_atividade || '', 
                      registro.valor_total,
                      registro.organizacao, // OM Destino
                      registro.ug, // UG Destino
                      registro.valor_nd_30,
                      registro.valor_nd_39
                  );
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-foreground">
                                OM Destino: {om} ({ug}) - {registro.categoria}
                              </h4>
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

export default ClasseVIIISaudeForm;