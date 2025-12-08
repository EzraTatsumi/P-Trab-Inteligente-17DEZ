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
import { DiretrizClasseII, DiretrizClasseIIForm, RemontaItem } from "@/types/diretrizesClasseII";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { TablesInsert } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCategoryBadgeStyle, getCategoryLabel } from "@/lib/badgeUtils";
import { defaultClasseVIIISaudeConfig, defaultClasseVIIIRemontaMntDiaConfig, defaultRemontaComplexItems, RemontaItem as RemontaItemType } from "@/data/classeVIIIData";

type SubCategoria = 'Saúde' | 'Remonta';
type AnimalTipo = 'Equino' | 'Canino';

// --- TIPAGEM DE DADOS DE REGISTRO ---

interface ItemSaude {
  item: string; // KPSI / KPTI, KPSC / KPT Ni I, etc.
  valor_unitario: number;
  quantidade: number;
}

interface ItemRemonta {
  animal_tipo: AnimalTipo;
  quantidade_animais: number;
  dias_operacao: number;
  // Snapshot dos valores complexos usados no cálculo
  itens_complexos: RemontaItemType[];
  // Resultados do cálculo
  valor_total: number;
  valor_nd_30: number;
  valor_nd_39: number;
}

interface ClasseVIIIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  sub_categoria: SubCategoria;
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string;
  valor_nd_30: number;
  valor_nd_39: number;
  // Campos específicos
  itens_saude?: ItemSaude[];
  itens_remonta?: ItemRemonta;
}

// --- ESTADOS DO FORMULÁRIO ---

interface FormDataClasseVIII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  fase_atividade?: string;
  
  // Saúde
  itensSaude: ItemSaude[];
  
  // Remonta
  itensRemonta: ItemRemonta[];
}

const initialFormState: FormDataClasseVIII = {
  selectedOmId: undefined,
  organizacao: "",
  ug: "",
  dias_operacao: 0,
  fase_atividade: "",
  itensSaude: [],
  itensRemonta: [],
};

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

// --- FUNÇÕES DE CÁLCULO E MEMÓRIA ---

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

// Cálculo Saúde (KPSI/KPT)
const calculateSaudeTotal = (itens: ItemSaude[]) => {
  return itens.reduce((sum, item) => sum + (item.valor_unitario * item.quantidade), 0);
};

const generateSaudeMemoriaCalculo = (registro: ClasseVIIIRegistro): string => {
  const { organizacao, dias_operacao, itens_saude, valor_total, fase_atividade } = registro;
  const faseFormatada = formatFasesParaTexto(fase_atividade);
  
  const totalKits = itens_saude?.reduce((sum, item) => sum + item.quantidade, 0) || 0;
  
  let detalhes = "";
  let calculos = "";
  
  itens_saude?.forEach(item => {
    const valorItem = item.valor_unitario * item.quantidade;
    detalhes += `- ${item.item}: ${formatCurrency(item.valor_unitario)}\n`;
    calculos += `- ${item.quantidade} ${item.item} x ${formatCurrency(item.valor_unitario)} = ${formatCurrency(valorItem)}\n`;
  });

  return `30.90.30 - Aquisição de KPSI/KPSC e KPT para utilização por ${totalKits} kits, durante ${dias_operacao} dias de ${faseFormatada}, para ${organizacao}.

Cálculo:
${detalhes.trim()}

Fórmula: Nr KPSC/KPT x valor do item
${calculos.trim()}

Total: ${formatCurrency(valor_total)}.`;
};

// Cálculo Remonta (Equino/Canino)
const calculateRemontaItemTotals = (itemRemonta: ItemRemonta, diasOperacaoGlobal: number) => {
  const { animal_tipo, quantidade_animais, itens_complexos } = itemRemonta;
  const dias = itemRemonta.dias_operacao;
  
  if (quantidade_animais === 0 || dias === 0) {
    return { total: 0, nd30: 0, nd39: 0, calculos: {} };
  }
  
  const itensB = itens_complexos.filter(i => i.categoria === 'B' && i.animal_tipo === animal_tipo);
  const itensC = itens_complexos.filter(i => i.categoria === 'C' && i.animal_tipo === animal_tipo);
  const itensD = itens_complexos.filter(i => i.categoria === 'D' && i.animal_tipo === animal_tipo);
  const itensE = itens_complexos.filter(i => i.categoria === 'E' && i.animal_tipo === animal_tipo);
  
  // Item B: Anual (ND 30)
  const totalItemB = itensB.reduce((sum, item) => {
    // Se for Canino, o valor de 2500 é para 5 cães/ano. O valor unitário por cão/ano é 500.
    const valorAnualPorAnimal = item.animal_tipo === 'Canino' && item.item === 'Material de Condução' 
      ? item.valor / 5 
      : item.valor;
    return sum + valorAnualPorAnimal;
  }, 0) * quantidade_animais;
  
  // Item C: Mensal (ND 30)
  const totalItemC_Mensal = itensC.reduce((sum, item) => sum + item.valor, 0);
  const totalItemC_Diario = totalItemC_Mensal / 30;
  const totalItemC = quantidade_animais * totalItemC_Diario * dias;
  
  // Item D: Valor de Mercado (ND 39)
  const totalItemD = itensD.reduce((sum, item) => sum + item.valor, 0) * quantidade_animais;
  
  // Item E: Assistência Veterinária (ND 39)
  const totalItemE = itensE.reduce((sum, item) => sum + item.valor, 0) * quantidade_animais;
  
  const totalND30 = totalItemB + totalItemC;
  const totalND39 = totalItemD + totalItemE;
  const total = totalND30 + totalND39;
  
  return {
    total,
    nd30: totalND30,
    nd39: totalND39,
    calculos: {
      totalItemB,
      totalItemC_Mensal,
      totalItemC_Diario,
      totalItemC,
      totalItemD,
      totalItemE,
    }
  };
};

const generateRemontaMemoriaCalculo = (registro: ClasseVIIIRegistro): string => {
  const { organizacao, ug, dias_operacao, itens_remonta, valor_total, valor_nd_30, valor_nd_39, fase_atividade } = registro;
  const faseFormatada = formatFasesParaTexto(fase_atividade);
  
  if (!itens_remonta) return "Erro: Dados de remonta não encontrados.";
  
  const { animal_tipo, quantidade_animais, itens_complexos } = itens_remonta;
  const { calculos } = calculateRemontaItemTotals(itens_remonta, dias_operacao);
  
  const isEquino = animal_tipo === 'Equino';
  const itemBTotal = itens_complexos.filter(i => i.categoria === 'B' && i.animal_tipo === animal_tipo).reduce((sum, item) => sum + item.valor, 0);
  const itemDValor = itens_complexos.find(i => i.categoria === 'D' && i.animal_tipo === animal_tipo)?.valor || 0;
  const itemEValor = itens_complexos.find(i => i.categoria === 'E' && i.animal_tipo === animal_tipo)?.valor || 0;
  
  const itemBFormula = isEquino 
    ? `R$ ${formatNumber(itemBTotal, 2)} / ano` 
    : `R$ ${formatNumber(itemBTotal, 2)} / 5 cães / ano`;
    
  const itemCFormula = `R$ ${formatNumber(calculos.totalItemC_Mensal, 2)} / mês`;
  
  const titulo = isEquino ? "cavalos" : "cães de guerra";
  
  const memoria = `30.90.30/39 - Aquisição meios ou contratação de serviços para a manutenção de ${quantidade_animais} ${titulo} do ${organizacao} (UG: ${ug}), durante ${dias_operacao} dias na operação (${faseFormatada}).

Cálculo:
- Item B (Anual - ND 30): ${itemBFormula}.
- Item C (Mensal - ND 30): ${itemCFormula}.
- Item D (Valor Animal - 20% - ND 39): R$ ${formatNumber(itemDValor, 2)} / animal.
- Item E (Assistência Veterinária - 20% - ND 39): R$ ${formatNumber(itemEValor, 2)} / animal.

Formula: (Nr Animais x Item B) + [Nr Animais x (Item C / 30 dias) x Nr dias] + (Nr Animais x Item D) + (Nr Animais x Item E).

- Item B: (${quantidade_animais} x R$ ${formatNumber(itemBTotal, 2)}) = ${formatCurrency(calculos.totalItemB)}.
- Item C: [${quantidade_animais} x (R$ ${formatNumber(calculos.totalItemC_Mensal, 2)} / 30 dias) x ${dias_operacao} dias] = ${formatCurrency(calculos.totalItemC)}.
- Item D: (${quantidade_animais} x R$ ${formatNumber(itemDValor, 2)}) = ${formatCurrency(calculos.totalItemD)}.
- Item E: (${quantidade_animais} x R$ ${formatNumber(itemEValor, 2)}) = ${formatCurrency(calculos.totalItemE)}.

Total ND 30: ${formatCurrency(valor_nd_30)}.
Total ND 39: ${formatCurrency(valor_nd_39)}.
Total Geral: ${formatCurrency(valor_total)}.`;

  return memoria;
};


// --- COMPONENTE PRINCIPAL ---

const ClasseVIIIForm = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [registros, setRegistros] = useState<ClasseVIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [diretrizes, setDiretrizes] = useState<DiretrizClasseII[]>([]);
  const [remontaComplexItemsConfig, setRemontaComplexItemsConfig] = useState<RemontaItemType[]>(defaultRemontaComplexItems);
  
  const [selectedTab, setSelectedTab] = useState<SubCategoria>('Saúde');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [form, setForm] = useState<FormDataClasseVIII>(initialFormState);
  
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
        setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaMntDiaConfig]);
        setRemontaComplexItemsConfig(defaultRemontaComplexItems);
        return;
      }

      const { data: classeItemsData, error } = await supabase
        .from("diretrizes_classe_ii")
        .select("*")
        .eq("user_id", user.id)
        .eq("ano_referencia", anoReferencia)
        .eq("ativo", true)
        .in("categoria", ['Saúde - KPSI/KPT', 'Remonta - Mnt/Dia', 'Remonta - Item B', 'Remonta - Item C', 'Remonta - Item D', 'Remonta - Item E']);

      if (error) throw error;

      const loadedItems = classeItemsData || [];
      
      // 1. Diretrizes Simples (KPSI/KPT e Mnt/Dia)
      const simpleDiretrizes = loadedItems.filter(d => d.categoria === 'Saúde - KPSI/KPT' || d.categoria === 'Remonta - Mnt/Dia');
      if (simpleDiretrizes.length > 0) {
        setDiretrizes(simpleDiretrizes.map(d => ({
          categoria: d.categoria as DiretrizClasseIIForm['categoria'],
          item: d.item,
          valor_mnt_dia: Number(d.valor_mnt_dia),
        } as DiretrizClasseII)));
      } else {
        setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaMntDiaConfig]);
      }
      
      // 2. Itens Complexos de Remonta (B, C, D, E)
      const complexRemontaData = loadedItems.filter(d => d.categoria.startsWith('Remonta - Item'));
      if (complexRemontaData.length > 0) {
        const newRemontaComplexItems: RemontaItemType[] = [];
        complexRemontaData.forEach(d => {
          const baseItem = defaultRemontaComplexItems.find(def => def.item === d.item);
          if (baseItem) {
            newRemontaComplexItems.push({
              item: d.item,
              animal_tipo: baseItem.animal_tipo,
              categoria: baseItem.categoria,
              valor: Number(d.valor_mnt_dia),
              unidade: baseItem.unidade,
            });
          }
        });
        setRemontaComplexItemsConfig(newRemontaComplexItems.length > 0 ? newRemontaComplexItems : defaultRemontaComplexItems);
      } else {
        setRemontaComplexItemsConfig(defaultRemontaComplexItems);
      }
      
    } catch (error) {
      console.error("Erro ao carregar diretrizes:", error);
      setDiretrizes([...defaultClasseVIIISaudeConfig, ...defaultClasseVIIIRemontaMntDiaConfig]);
      setRemontaComplexItemsConfig(defaultRemontaComplexItems);
      toast.error("Erro ao carregar diretrizes. Usando valores padrão.");
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data: saudeData, error: saudeError } = await supabase
      .from("classe_viii_saude_registros")
      .select("*, detalhamento_customizado, itens_saude")
      .eq("p_trab_id", ptrabId);
      
    const { data: remontaData, error: remontaError } = await supabase
      .from("classe_viii_remonta_registros")
      .select("*, detalhamento_customizado, itens_remonta")
      .eq("p_trab_id", ptrabId);

    if (saudeError || remontaError) {
      toast.error("Erro ao carregar registros");
      console.error(saudeError || remontaError);
      return;
    }

    const saudeRegistros: ClasseVIIIRegistro[] = (saudeData || []).map(r => ({
      ...r,
      sub_categoria: 'Saúde',
      itens_saude: r.itens_saude as ItemSaude[],
    }));
    
    const remontaRegistros: ClasseVIIIRegistro[] = (remontaData || []).map(r => ({
      ...r,
      sub_categoria: 'Remonta',
      itens_remonta: {
        animal_tipo: r.animal_tipo as AnimalTipo,
        quantidade_animais: r.quantidade_animais,
        dias_operacao: r.dias_operacao,
        itens_complexos: r.itens_remonta as RemontaItemType[],
        valor_total: Number(r.valor_total),
        valor_nd_30: Number(r.valor_nd_30),
        valor_nd_39: Number(r.valor_nd_39),
      } as ItemRemonta,
    }));

    setRegistros([...saudeRegistros, ...remontaRegistros].sort((a, b) => a.organizacao.localeCompare(b.organizacao)));
  };

  const resetFormFields = () => {
    setEditingId(null);
    setForm(initialFormState);
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
    } else {
      setForm(prev => ({ 
        ...prev, 
        selectedOmId: undefined, 
        organizacao: "", 
        ug: "",
      }));
    }
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };
  
  // --- LÓGICA DE SAÚDE ---
  const saudeDiretrizes = useMemo(() => {
    return diretrizes.filter(d => d.categoria === 'Saúde - KPSI/KPT').map(d => ({
      item: d.item,
      valor_unitario: Number(d.valor_mnt_dia),
      quantidade: form.itensSaude.find(i => i.item === d.item)?.quantidade || 0,
    }));
  }, [diretrizes, form.itensSaude]);
  
  const handleSaudeQuantityChange = (item: ItemSaude, quantity: number) => {
    setForm(prev => {
      const existingIndex = prev.itensSaude.findIndex(i => i.item === item.item);
      const newItens = [...prev.itensSaude];
      
      if (existingIndex !== -1) {
        newItens[existingIndex] = { ...newItens[existingIndex], quantidade: Math.max(0, quantity) };
      } else {
        newItens.push({ ...item, quantidade: Math.max(0, quantity) });
      }
      return { ...prev, itensSaude: newItens };
    });
  };
  
  const saudeTotal = useMemo(() => calculateSaudeTotal(form.itensSaude), [form.itensSaude]);
  
  // --- LÓGICA DE REMONTA ---
  const remontaMntDiaDiretrizes = useMemo(() => {
    return diretrizes.filter(d => d.categoria === 'Remonta - Mnt/Dia');
  }, [diretrizes]);
  
  const [remontaEquinoQtd, setRemontaEquinoQtd] = useState(0);
  const [remontaCaninoQtd, setRemontaCaninoQtd] = useState(0);
  const [remontaEquinoDias, setRemontaEquinoDias] = useState(0);
  const [remontaCaninoDias, setRemontaCaninoDias] = useState(0);
  
  const remontaEquinoTotals = useMemo(() => {
    const itemRemonta: ItemRemonta = {
      animal_tipo: 'Equino',
      quantidade_animais: remontaEquinoQtd,
      dias_operacao: remontaEquinoDias,
      itens_complexos: remontaComplexItemsConfig,
      valor_total: 0, valor_nd_30: 0, valor_nd_39: 0,
    };
    return calculateRemontaItemTotals(itemRemonta, form.dias_operacao);
  }, [remontaEquinoQtd, remontaEquinoDias, remontaComplexItemsConfig, form.dias_operacao]);
  
  const remontaCaninoTotals = useMemo(() => {
    const itemRemonta: ItemRemonta = {
      animal_tipo: 'Canino',
      quantidade_animais: remontaCaninoQtd,
      dias_operacao: remontaCaninoDias,
      itens_complexos: remontaComplexItemsConfig,
      valor_total: 0, valor_nd_30: 0, valor_nd_39: 0,
    };
    return calculateRemontaItemTotals(itemRemonta, form.dias_operacao);
  }, [remontaCaninoQtd, remontaCaninoDias, remontaComplexItemsConfig, form.dias_operacao]);
  
  const remontaTotal = remontaEquinoTotals.total + remontaCaninoTotals.total;
  
  // --- HANDLERS DE SALVAMENTO ---
  
  const handleSalvarSaude = async () => {
    if (!ptrabId || !form.organizacao || form.dias_operacao <= 0) {
      toast.error("Preencha a OM e os Dias de Operação.");
      return;
    }
    
    const itensAtivos = form.itensSaude.filter(i => i.quantidade > 0);
    if (itensAtivos.length === 0) {
      toast.error("Adicione pelo menos um kit de Saúde.");
      return;
    }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    setLoading(true);
    
    const valorTotal = calculateSaudeTotal(itensAtivos);
    
    const registroData: TablesInsert<'classe_viii_saude_registros'> = {
      p_trab_id: ptrabId,
      organizacao: form.organizacao,
      ug: form.ug,
      dias_operacao: form.dias_operacao,
      itens_saude: itensAtivos as any,
      valor_total: valorTotal,
      fase_atividade: faseFinalString,
      valor_nd_30: valorTotal, // Saúde é ND 30
      valor_nd_39: 0,
    };
    
    try {
      // Deletar registros de Saúde existentes para esta OM
      await supabase
        .from("classe_viii_saude_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao)
        .eq("ug", form.ug);
        
      const { error: insertError } = await supabase.from("classe_viii_saude_registros").insert([registroData]);
      if (insertError) throw insertError;
      
      toast.success("Registro de Saúde salvo com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registro de Saúde:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleSalvarRemonta = async () => {
    if (!ptrabId || !form.organizacao || form.dias_operacao <= 0) {
      toast.error("Preencha a OM e os Dias de Operação.");
      return;
    }
    
    const equinoAtivo = remontaEquinoQtd > 0 && remontaEquinoDias > 0;
    const caninoAtivo = remontaCaninoQtd > 0 && remontaCaninoDias > 0;
    
    if (!equinoAtivo && !caninoAtivo) {
      toast.error("Adicione pelo menos um animal (Equino ou Canino) com quantidade e dias de operação.");
      return;
    }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    setLoading(true);
    
    const registrosParaSalvar: TablesInsert<'classe_viii_remonta_registros'>[] = [];
    
    // 1. Equinos
    if (equinoAtivo) {
      const totals = remontaEquinoTotals;
      const registroEquino: TablesInsert<'classe_viii_remonta_registros'> = {
        p_trab_id: ptrabId,
        organizacao: form.organizacao,
        ug: form.ug,
        dias_operacao: remontaEquinoDias,
        animal_tipo: 'Equino',
        quantidade_animais: remontaEquinoQtd,
        valor_total: totals.total,
        valor_nd_30: totals.nd30,
        valor_nd_39: totals.nd39,
        fase_atividade: faseFinalString,
        itens_remonta: remontaComplexItemsConfig as any,
      };
      registrosParaSalvar.push(registroEquino);
    }
    
    // 2. Caninos
    if (caninoAtivo) {
      const totals = remontaCaninoTotals;
      const registroCanino: TablesInsert<'classe_viii_remonta_registros'> = {
        p_trab_id: ptrabId,
        organizacao: form.organizacao,
        ug: form.ug,
        dias_operacao: remontaCaninoDias,
        animal_tipo: 'Canino',
        quantidade_animais: remontaCaninoQtd,
        valor_total: totals.total,
        valor_nd_30: totals.nd30,
        valor_nd_39: totals.nd39,
        fase_atividade: faseFinalString,
        itens_remonta: remontaComplexItemsConfig as any,
      };
      registrosParaSalvar.push(registroCanino);
    }
    
    try {
      // Deletar registros de Remonta existentes para esta OM
      await supabase
        .from("classe_viii_remonta_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", form.organizacao)
        .eq("ug", form.ug);
        
      const { error: insertError } = await supabase.from("classe_viii_remonta_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registro de Remonta salvo com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar registro de Remonta:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };
  
  const handleEditarRegistro = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    resetFormFields();
    
    // 1. Carregar OM Detentora
    let selectedOmIdForEdit: string | undefined = undefined;
    try {
        const { data: omData } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', registro.organizacao)
            .eq('codug_om', registro.ug)
            .maybeSingle();
        selectedOmIdForEdit = omData?.id;
    } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    
    // 2. Preencher dados globais
    setForm(prev => ({
      ...prev,
      selectedOmId: selectedOmIdForEdit,
      organizacao: registro.organizacao,
      ug: registro.ug,
      dias_operacao: registro.dias_operacao,
    }));
    
    const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
    setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    
    setEditingId(registro.id);
    setSelectedTab(registro.sub_categoria);
    
    // 3. Preencher dados específicos
    if (registro.sub_categoria === 'Saúde' && registro.itens_saude) {
      setForm(prev => ({ ...prev, itensSaude: registro.itens_saude! }));
    } else if (registro.sub_categoria === 'Remonta' && registro.itens_remonta) {
      // Para Remonta, precisamos carregar todos os registros da OM para preencher Equino e Canino
      const { data: allRemontaRecords } = await supabase
        .from("classe_viii_remonta_registros")
        .select("animal_tipo, quantidade_animais, dias_operacao")
        .eq("p_trab_id", ptrabId)
        .eq("organizacao", registro.organizacao)
        .eq("ug", registro.ug);
        
      const equinoRecord = allRemontaRecords?.find(r => r.animal_tipo === 'Equino');
      const caninoRecord = allRemontaRecords?.find(r => r.animal_tipo === 'Canino');
      
      setRemontaEquinoQtd(equinoRecord?.quantidade_animais || 0);
      setRemontaEquinoDias(equinoRecord?.dias_operacao || 0);
      setRemontaCaninoQtd(caninoRecord?.quantidade_animais || 0);
      setRemontaCaninoDias(caninoRecord?.dias_operacao || 0);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setLoading(false);
  };
  
  const handleRemoverRegistro = async (registro: ClasseVIIIRegistro) => {
    if (!confirm(`Tem certeza que deseja remover o registro de ${registro.sub_categoria} para ${registro.organizacao}?`)) return;
    
    setLoading(true);
    try {
      if (registro.sub_categoria === 'Saúde') {
        const { error } = await supabase
          .from("classe_viii_saude_registros")
          .delete()
          .eq("id", registro.id);
        if (error) throw error;
      } else if (registro.sub_categoria === 'Remonta') {
        // Para Remonta, deletamos todos os registros da OM (Equino e Canino)
        const { error } = await supabase
          .from("classe_viii_remonta_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("organizacao", registro.organizacao)
          .eq("ug", registro.ug);
        if (error) throw error;
      }
      
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
    
    let memoriaAutomatica = "";
    if (registro.sub_categoria === 'Saúde') {
      memoriaAutomatica = generateSaudeMemoriaCalculo(registro);
    } else if (registro.sub_categoria === 'Remonta') {
      memoriaAutomatica = generateRemontaMemoriaCalculo(registro);
    }
    
    setMemoriaEdit(registro.detalhamento_customizado || memoriaAutomatica);
  };

  const handleCancelarEdicaoMemoria = () => {
    setEditingMemoriaId(null);
    setMemoriaEdit("");
  };

  const handleSalvarMemoriaCustomizada = async (registro: ClasseVIIIRegistro) => {
    setLoading(true);
    try {
      const table = registro.sub_categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(table)
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
      const table = registro.sub_categoria === 'Saúde' ? 'classe_viii_saude_registros' : 'classe_viii_remonta_registros';
      
      const { error } = await supabase
        .from(table)
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
  
  // Agrupamento de registros para exibição
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
              Solicitação de recursos para Saúde (KPSI/KPT) e Remonta/Veterinária.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Dados da Organização e Dias */}
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>OM Detentora do Recurso *</Label>
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

            {/* 2. Configurar Itens por Sub-Categoria (Aba) */}
            {form.organizacao && form.dias_operacao > 0 && (
              <div className="space-y-4 border-b pb-4" ref={formRef}>
                <h3 className="text-lg font-semibold">2. Configurar Itens por Sub-Categoria</h3>
                
                <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as SubCategoria)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="Saúde" className="flex items-center gap-1">
                      <HeartPulse className="h-4 w-4" /> Saúde (KPSI/KPT)
                    </TabsTrigger>
                    <TabsTrigger value="Remonta" className="flex items-center gap-1">
                      <PawPrint className="h-4 w-4" /> Remonta/Veterinária
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* TAB SAÚDE */}
                  <TabsContent value="Saúde" className="mt-4">
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold text-base">KPSI/KPT (ND 33.90.30)</h4>
                      
                      <div className="max-h-[400px] overflow-y-auto rounded-md border">
                          <Table className="w-full">
                              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                                  <TableRow>
                                      <TableHead className="w-[50%]">Item</TableHead>
                                      <TableHead className="w-[25%] text-right">Valor Unitário</TableHead>
                                      <TableHead className="w-[15%] text-center">Quantidade</TableHead>
                                      <TableHead className="w-[10%] text-right">Total</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {saudeDiretrizes.length === 0 ? (
                                      <TableRow>
                                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                                              Nenhum item de diretriz de Saúde encontrado.
                                          </TableCell>
                                      </TableRow>
                                  ) : (
                                      saudeDiretrizes.map((item, index) => {
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
                                                          type="number"
                                                          min="0"
                                                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none h-8 text-center"
                                                          value={item.quantidade === 0 ? "" : item.quantidade.toString()}
                                                          onChange={(e) => handleSaudeQuantityChange(item, parseInt(e.target.value) || 0)}
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
                          <span className="font-bold text-sm">TOTAL SAÚDE (ND 30)</span>
                          <span className="font-extrabold text-lg text-primary">
                              {formatCurrency(saudeTotal)}
                          </span>
                      </div>
                      
                      <div className="flex justify-end">
                          <Button 
                              type="button" 
                              onClick={handleSalvarSaude} 
                              className="w-full md:w-auto" 
                              disabled={loading || saudeTotal === 0}
                          >
                              Salvar Registro de Saúde
                          </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* TAB REMONTA */}
                  <TabsContent value="Remonta" className="mt-4">
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-semibold text-base">Remonta/Veterinária (ND 30/39)</h4>
                      
                      {/* Equinos */}
                      <div className="space-y-3 p-3 border rounded-lg bg-background">
                        <h5 className="font-bold text-sm flex items-center gap-2">
                          <PawPrint className="h-4 w-4" /> Equinos
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Qtd. Cavalos *</Label>
                            <Input
                              type="number"
                              min="0"
                              value={remontaEquinoQtd || ""}
                              onChange={(e) => setRemontaEquinoQtd(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Dias de Operação *</Label>
                            <Input
                              type="number"
                              min="0"
                              value={remontaEquinoDias || ""}
                              onChange={(e) => setRemontaEquinoDias(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              disabled={remontaEquinoQtd === 0}
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                        </div>
                        <div className="pt-2 border-t mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total ND 30 (Material/Mensal/Anual):</span>
                            <span className="font-medium text-green-600">{formatCurrency(remontaEquinoTotals.nd30)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total ND 39 (Serviço/Anual):</span>
                            <span className="font-medium text-blue-600">{formatCurrency(remontaEquinoTotals.nd39)}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t">
                            <span>TOTAL EQUINOS:</span>
                            <span className="text-primary">{formatCurrency(remontaEquinoTotals.total)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Caninos */}
                      <div className="space-y-3 p-3 border rounded-lg bg-background">
                        <h5 className="font-bold text-sm flex items-center gap-2">
                          <PawPrint className="h-4 w-4" /> Cães de Guerra
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Qtd. Cães *</Label>
                            <Input
                              type="number"
                              min="0"
                              value={remontaCaninoQtd || ""}
                              onChange={(e) => setRemontaCaninoQtd(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Dias de Operação *</Label>
                            <Input
                              type="number"
                              min="0"
                              value={remontaCaninoDias || ""}
                              onChange={(e) => setRemontaCaninoDias(parseInt(e.target.value) || 0)}
                              placeholder="0"
                              disabled={remontaCaninoQtd === 0}
                              onKeyDown={handleEnterToNextField}
                            />
                          </div>
                        </div>
                        <div className="pt-2 border-t mt-2 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total ND 30 (Material/Mensal/Anual):</span>
                            <span className="font-medium text-green-600">{formatCurrency(remontaCaninoTotals.nd30)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total ND 39 (Serviço/Anual):</span>
                            <span className="font-medium text-blue-600">{formatCurrency(remontaCaninoTotals.nd39)}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t">
                            <span>TOTAL CÃES:</span>
                            <span className="text-primary">{formatCurrency(remontaCaninoTotals.total)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-background rounded-lg border">
                          <span className="font-bold text-sm">TOTAL REMONTA</span>
                          <span className="font-extrabold text-lg text-primary">
                              {formatCurrency(remontaTotal)}
                          </span>
                      </div>
                      
                      <div className="flex justify-end">
                          <Button 
                              type="button" 
                              onClick={handleSalvarRemonta} 
                              className="w-full md:w-auto" 
                              disabled={loading || remontaTotal === 0}
                          >
                              Salvar Registro de Remonta
                          </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* 3. Registros Salvos (OMs Cadastradas) - SUMMARY SECTION */}
            {registros.length > 0 && (
              <div className="space-y-4 mt-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Registros Cadastrados
                </h2>
                
                {Object.entries(registrosAgrupadosPorOM).map(([omKey, omRegistros]) => {
                    const totalOM = omRegistros.reduce((sum, r) => r.valor_total, 0);
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
                                    const isSaude = registro.sub_categoria === 'Saúde';
                                    
                                    return (
                                        <Card key={registro.id} className="p-3 bg-background border">
                                            <div className="flex items-center justify-between">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-base text-foreground">
                                                            {isSaude ? 'Saúde (KPSI/KPT)' : `Remonta (${registro.itens_remonta?.animal_tipo})`}
                                                        </h4>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Dias: {isSaude ? registro.dias_operacao : registro.itens_remonta?.dias_operacao} | Fases: {fases}
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
                                                            onClick={() => handleRemoverRegistro(registro)}
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
                                                    <span className="text-muted-foreground">ND 33.90.30 (Material/Custeio):</span>
                                                    <span className="font-medium text-green-600">{formatCurrency(registro.valor_nd_30)}</span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-muted-foreground">ND 33.90.39 (Serviço/Anual):</span>
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

            {/* 4. Memórias de Cálculos Detalhadas */}
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
                  
                  let memoriaAutomatica = "";
                  if (registro.sub_categoria === 'Saúde') {
                    memoriaAutomatica = generateSaudeMemoriaCalculo(registro);
                  } else if (registro.sub_categoria === 'Remonta') {
                    memoriaAutomatica = generateRemontaMemoriaCalculo(registro);
                  }
                  
                  const memoriaExibida = isEditing ? memoriaEdit : (registro.detalhamento_customizado || memoriaAutomatica);
                  
                  return (
                    <div key={`memoria-view-${registro.id}`} className="space-y-4 border p-4 rounded-lg bg-muted/30">
                      
                      {/* Container para H4 e Botões */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-foreground">
                                OM Destino: {om} ({ug}) - {registro.sub_categoria}
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