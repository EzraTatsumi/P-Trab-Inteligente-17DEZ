import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, Sparkles, Tractor, XCircle, ChevronDown, Check, Droplet, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import RefLPCFormSection from "@/components/RefLPCFormSection";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { TablesInsert } from "@/integrations/supabase/types";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ClasseIIIItemConfigurator } from "@/components/ClasseIIIItemConfigurator"; // NOVO COMPONENTE

type Categoria = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

const CATEGORIAS: { key: Categoria, label: string }[] = [
  { key: "GERADOR", label: "Geradores" },
  { key: "EMBARCACAO", label: "Embarcações" },
  { key: "MOTOMECANIZACAO", label: "Motomecanização" },
  { key: "EQUIPAMENTO_ENGENHARIA", label: "Engenharia" },
];

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ItemClasseIII {
  id: string; // ID temporário para o formulário
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  km_dia: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
  categoria: Categoria;
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: Categoria | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO';
  organizacao: string;
  ug: string;
  quantidade: number;
  dias_operacao: number;
  tipo_combustivel: string;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  itens_equipamentos?: ItemClasseIII[];
  fase_atividade?: string;
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
}

interface FormDataClasseIII {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemClasseIII[]; // Lista consolidada de todos os itens
}

interface ConsolidadoCombustivel {
  tipo_combustivel: CombustivelTipo;
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemClasseIII[];
  detalhamento: string;
}

interface ConsolidadoLubrificante {
  categoria: Categoria;
  omLubrificante: string;
  ugLubrificante: string;
  total_litros: number;
  valor_total: number;
  itens: ItemClasseIII[];
  detalhamento: string;
}

// Estado de alocação de OM de Lubrificante por Categoria
interface LubrificanteAllocation {
    om: string;
    ug: string;
    selectedOmId?: string;
}

const initialLubrificanteAllocation: Record<Categoria, LubrificanteAllocation> = {
    'GERADOR': { om: "", ug: "", selectedOmId: undefined },
    'EMBARCACAO': { om: "", ug: "", selectedOmId: undefined },
    'EQUIPAMENTO_ENGENHARIA': { om: "", ug: "", selectedOmId: undefined },
    'MOTOMECANIZACAO': { om: "", ug: "", selectedOmId: undefined },
};

const initialFormState: FormDataClasseIII = {
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
};

// Função para formatar as fases de forma natural no texto
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

export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [selectedTab, setSelectedTab] = useState<Categoria>(CATEGORIAS[0].key);
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<TipoEquipamentoDetalhado[]>([]);
  
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const lpcRef = useRef<HTMLDivElement>(null);
  
  const [form, setForm] = useState<FormDataClasseIII>(initialFormState);
  
  const [rmFornecimento, setRmFornecimento] = useState("");
  const [codugRmFornecimento, setCodugRmFornecimento] = useState("");
  const [lubrificanteAlloc, setLubrificanteAlloc] = useState<Record<Categoria, LubrificanteAllocation>>(initialLubrificanteAllocation);
  
  const [editingItem, setEditingItem] = useState<ItemClasseIII | null>(null);
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
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
    loadRefLPC();
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);

  useEffect(() => {
    carregarEquipamentos(selectedTab);
  }, [selectedTab]);

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

  const carregarEquipamentos = async (tipo: Categoria) => {
    setLoading(true);
    const equipamentos = await getEquipamentosPorTipo(tipo);
    setEquipamentosDisponiveis(equipamentos);
    setLoading(false);
  };
  
  const resetFormFields = () => {
    // Redefine o estado do formulário para o estado inicial
    setForm(initialFormState);
    setRmFornecimento("");
    setCodugRmFornecimento("");
    setLubrificanteAlloc(initialLubrificanteAllocation);
    setEditingItem(null);
    setFasesAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado, consumo_lubrificante_litro, preco_lubrificante")
      .eq("p_trab_id", ptrabId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    const loadedRegistros = (data || []) as ClasseIIIRegistro[];
    setRegistros(loadedRegistros);
    
    // --- REMOVIDA A LÓGICA DE PRÉ-PREENCHIMENTO DO FORMULÁRIO AQUI ---
    
    setEditingItem(null);
    setEditingMemoriaId(null);
    setLoading(false);
  };
  
  // NOVO: Função para carregar os dados de um registro para o formulário (usada no botão Recarregar)
  const loadRegistroToForm = async (loadedRegistros: ClasseIIIRegistro[]) => {
    if (loadedRegistros.length === 0) {
        resetFormFields();
        return;
    }
    
    const firstRecord = loadedRegistros[0];
    
    // 1. Dados globais (OM Detentora, Dias, Fases)
    const omDetentoraRecord = loadedRegistros.find(r => !r.tipo_equipamento.startsWith('LUBRIFICANTE')) || firstRecord;
    
    if (omDetentoraRecord) {
        setForm(prev => ({
            ...prev,
            organizacao: omDetentoraRecord.organizacao,
            ug: omDetentoraRecord.ug,
            dias_operacao: omDetentoraRecord.dias_operacao,
        }));
        
        const fasesSalvas = (omDetentoraRecord.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
        setFasesAtividade(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
        setCustomFaseAtividade(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    }
    
    // 2. Itens consolidados
    let consolidatedItems: ItemClasseIII[] = [];
    let newLubAlloc = { ...initialLubrificanteAllocation };
    
    loadedRegistros.forEach(r => {
        if (r.itens_equipamentos) {
            consolidatedItems = consolidatedItems.concat(r.itens_equipamentos.map(item => ({
                ...item,
                id: crypto.randomUUID(), // Novo ID temporário para o formulário
                categoria: item.categoria as Categoria,
            })));
        }
        
        // 3. Alocação de Lubrificante (se for um registro de lubrificante)
        if (r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO') {
            const cat: Categoria = r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' ? 'GERADOR' : 'EMBARCACAO';
            newLubAlloc[cat] = { om: r.organizacao, ug: r.ug };
        }
    });
    
    setForm(prev => ({ ...prev, itens: consolidatedItems }));
    setLubrificanteAlloc(newLubAlloc);
    
    // 4. Buscar OM Detentora ID e RM Fornecimento
    if (omDetentoraRecord?.organizacao) {
        try {
            const { data: omData } = await supabase
                .from('organizacoes_militares')
                .select('id, rm_vinculacao, codug_rm_vinculacao')
                .eq('nome_om', omDetentoraRecord.organizacao)
                .eq('codug_om', omDetentoraRecord.ug)
                .maybeSingle();
            
            if (omData) {
                setForm(prev => ({ ...prev, selectedOmId: omData.id }));
                setRmFornecimento(omData.rm_vinculacao);
                setCodugRmFornecimento(omData.codug_rm_vinculacao);
                
                // Atualizar IDs de OM de Lubrificante
                const updatedAlloc = { ...newLubAlloc };
                for (const cat of ['GERADOR', 'EMBARCACAO'] as Categoria[]) {
                    if (updatedAlloc[cat].om) {
                        const { data: lubOmData } = await supabase
                            .from('organizacoes_militares')
                            .select('id')
                            .eq('nome_om', updatedAlloc[cat].om)
                            .eq('codug_om', updatedAlloc[cat].ug)
                            .maybeSingle();
                        updatedAlloc[cat].selectedOmId = lubOmData?.id;
                    }
                }
                setLubrificanteAlloc(updatedAlloc);
            }
        } catch (e) { console.error("Erro ao buscar OM Detentora ID:", e); }
    }
    
    setEditingItem(null);
    setEditingMemoriaId(null);
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setForm({ ...form, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
      
      // Define a OM detentora como padrão para o lubrificante
      setLubrificanteAlloc(prev => {
          const newAlloc = { ...prev };
          for (const cat of ['GERADOR', 'EMBARCACAO'] as Categoria[]) {
              newAlloc[cat] = { om: omData.nome_om, ug: omData.codug_om, selectedOmId: omData.id };
          }
          return newAlloc;
      });
    } else {
      setForm({ ...form, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimento("");
      setCodugRmFornecimento("");
      setLubrificanteAlloc(initialLubrificanteAllocation);
    }
  };
  
  const handleRMFornecimentoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimento(rmName);
    setCodugRmFornecimento(rmCodug);
  };
  
  const handleOMLubrificanteChange = (omData: OMData | undefined) => {
    setLubrificanteAlloc(prev => ({
        ...prev,
        [selectedTab]: {
            om: omData?.nome_om || "",
            ug: omData?.codug_om || "",
            selectedOmId: omData?.id,
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
  
  const handleAddItem = (item: ItemClasseIII) => {
    if (form.itens.some(i => i.id === item.id)) {
        toast.error("Erro: Item com ID duplicado.");
        return;
    }
    setForm(prev => ({ ...prev, itens: [...prev.itens, item] }));
  };
  
  const handleUpdateItem = (updatedItem: ItemClasseIII) => {
    setForm(prev => ({
        ...prev,
        itens: prev.itens.map(item => item.id === updatedItem.id ? updatedItem : item)
    }));
    setEditingItem(null);
  };
  
  const handleEditItem = (item: ItemClasseIII) => {
    setEditingItem(item);
    setSelectedTab(item.categoria);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleCancelEdit = () => {
    setEditingItem(null);
  };
  
  const handleDeletar = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Registro removido com sucesso!");
      fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = (id: string) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    setForm(prev => ({
        ...prev,
        itens: prev.itens.filter(item => item.id !== id)
    }));
    if (editingItem?.id === id) {
        setEditingItem(null);
    }
    toast.success("Item removido!");
  };

  // --- CÁLCULO CONSOLIDADO ---
  const { consolidadosCombustivel, consolidadosLubrificante } = useMemo(() => {
    const itens = form.itens;
    if (itens.length === 0 || !refLPC || form.dias_operacao === 0) { 
      return { consolidadosCombustivel: [], consolidadosLubrificante: [] }; 
    }
    
    const fasesFinaisCalc = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinaisCalc.push(customFaseAtividade.trim()); }
    const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
    const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
    
    const gruposCombustivel = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<CombustivelTipo, ItemClasseIII[]>);
    
    const consolidadosCombustivel: ConsolidadoCombustivel[] = [];
    Object.entries(gruposCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];
      
      itensGrupo.forEach(item => {
        let litrosItem = 0;
        let formulaDetalhe = "";
        
        if (item.categoria === 'MOTOMECANIZACAO') {
            // Fórmula: (Km/dia * Qtd) / Consumo (km/L) * Dias
            litrosItem = (item.km_dia * item.quantidade) / item.consumo_fixo * form.dias_operacao;
            formulaDetalhe = `(${formatNumber(item.km_dia)} km/dia x ${item.quantidade} un) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L x ${form.dias_operacao} dias`;
        } else {
            // Fórmula: (Qtd * Horas/dia * Consumo (L/h)) * Dias
            litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * form.dias_operacao;
            formulaDetalhe = `(${item.quantidade} un x ${formatNumber(item.horas_dia, 1)} h/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${form.dias_operacao} dias`;
        }
        
        totalLitrosSemMargem += litrosItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${item.tipo_equipamento_especifico}: ${formulaDetalhe} = ${formatNumber(litrosItem)} L ${unidade}.`);
      });
      
      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC.preco_gasolina ?? 0) : (refLPC.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? `(${refLPC.nome_local})` : '';
      const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      const detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} equipamentos, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Detalhes:
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(preco)} = ${formatCurrency(valorTotal)}.`;

      consolidadosCombustivel.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });
    
    // --- CÁLCULO DE LUBRIFICANTE (ND 33.90.30) ---
    const consolidadosLubrificante: ConsolidadoLubrificante[] = [];
    
    const itensComLubrificante = itens.filter(item => item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0);
    
    // Agrupar itens com lubrificante por categoria (Gerador/Embarcação)
    const gruposLubrificante = itensComLubrificante.reduce((acc, item) => {
        if (item.categoria === 'GERADOR' || item.categoria === 'EMBARCACAO') {
            if (!acc[item.categoria]) { acc[item.categoria] = []; }
            acc[item.categoria].push(item);
        }
        return acc;
    }, {} as Record<Categoria, ItemClasseIII[]>);
    
    Object.entries(gruposLubrificante).forEach(([categoria, itensGrupo]) => {
        const cat = categoria as Categoria;
        const alloc = lubrificanteAlloc[cat];
        
        let totalLitrosLubrificante = 0;
        let totalValorLubrificante = 0;
        const detalhesLubrificante: string[] = [];
        
        itensGrupo.forEach(item => {
            const totalHoras = item.quantidade * item.horas_dia * form.dias_operacao;
            let litrosItem = 0;
            let formulaDetalhe = "";
            
            if (cat === 'GERADOR') {
                // Fórmula Gerador: (Total Horas / 100h) * Consumo Lubrificante/100h
                litrosItem = (totalHoras / 100) * item.consumo_lubrificante_litro;
                formulaDetalhe = `(${formatNumber(totalHoras)} horas) / 100h x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/100h`;
            } else if (cat === 'EMBARCACAO') {
                // Fórmula Embarcação: Total Horas * Consumo Lubrificante/hora
                litrosItem = totalHoras * item.consumo_lubrificante_litro;
                formulaDetalhe = `(${formatNumber(totalHoras)} horas) x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/h`;
            }
            
            const valorItem = litrosItem * item.preco_lubrificante;
            
            totalLitrosLubrificante += litrosItem;
            totalValorLubrificante += valorItem;
            
            detalhesLubrificante.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: ${formulaDetalhe} = ${formatNumber(litrosItem, 2)} L. Valor: ${formatCurrency(valorItem)}.`);
        });
        
        const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
        
        const detalhamentoLubrificante = `33.90.30 - Aquisição de Lubrificante para ${totalEquipamentos} ${cat === 'GERADOR' ? 'geradores' : 'embarcações'}, durante ${form.dias_operacao} dias de ${faseFormatada}, para ${form.organizacao}.
Recurso destinado à OM proprietária: ${alloc.om} (UG: ${alloc.ug})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: Consumo: ${formatNumber(item.consumo_lubrificante_litro, 2)} ${cat === 'GERADOR' ? 'L/100h' : 'L/h'}. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}.`).join('\n')}

${detalhesLubrificante.join('\n')}

Total Litros: ${formatNumber(totalLitrosLubrificante, 2)} L.
Valor Total: ${formatCurrency(totalValorLubrificante)}.`;

        consolidadosLubrificante.push({
            categoria: cat,
            omLubrificante: alloc.om,
            ugLubrificante: alloc.ug,
            total_litros: totalLitrosLubrificante,
            valor_total: totalValorLubrificante,
            itens: itensGrupo,
            detalhamento: detalhamentoLubrificante,
        });
    });
    
    return { consolidadosCombustivel, consolidadosLubrificante };
  }, [form, refLPC, rmFornecimento, codugRmFornecimento, lubrificanteAlloc, fasesAtividade, customFaseAtividade]);
  
  const custoTotalClasseIII = consolidadosCombustivel.reduce((sum, c) => sum + c.valor_total, 0) + 
                              consolidadosLubrificante.reduce((sum, c) => sum + c.valor_total, 0);

  const isFormValid = form.organizacao && form.ug && rmFornecimento && codugRmFornecimento && form.dias_operacao > 0 && form.itens.length > 0;
  
  const salvarRegistrosConsolidados = async () => {
    if (!ptrabId) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); return; }
    if (!isFormValid) { toast.error("Preencha todos os dados da OM e adicione pelo menos um item."); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    // Validação de OM de Lubrificante
    for (const consolidado of consolidadosLubrificante) {
        if (!consolidado.omLubrificante || !consolidado.ugLubrificante) {
            toast.error(`Selecione a OM de destino do Lubrificante para a categoria ${consolidado.categoria}.`);
            return;
        }
    }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Preparar registros de COMBUSTÍVEL (ND 33.90.30)
    for (const consolidado of consolidadosCombustivel) {
      const precoLitro = consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC.preco_gasolina ?? 0) : (refLPC.preco_diesel ?? 0);
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: consolidado.itens[0].categoria, // Usa a categoria do item como tipo
        tipo_equipamento_detalhe: null,
        organizacao: form.organizacao, // OM Detentora
        ug: form.ug, // UG Detentora
        quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: form.dias_operacao,
        tipo_combustivel: consolidado.tipo_combustivel,
        preco_litro: precoLitro,
        total_litros: consolidado.total_litros,
        total_litros_sem_margem: consolidado.total_litros_sem_margem,
        valor_total: consolidado.valor_total,
        detalhamento: consolidado.detalhamento,
        itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
        fase_atividade: faseFinalString,
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
      };
      registrosParaSalvar.push(registro);
    }
    
    // 2. Preparar registros de LUBRIFICANTE (ND 33.90.30)
    for (const consolidado of consolidadosLubrificante) {
        const primeiroItem = consolidado.itens[0];
        const tipoLubrificante = consolidado.categoria === 'GERADOR' ? 'LUBRIFICANTE_GERADOR' : 'LUBRIFICANTE_EMBARCACAO';
        
        const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
            p_trab_id: ptrabId,
            tipo_equipamento: tipoLubrificante,
            tipo_equipamento_detalhe: null,
            organizacao: consolidado.omLubrificante, // OM de Destino do Recurso
            ug: consolidado.ugLubrificante, // UG de Destino do Recurso
            quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
            dias_operacao: form.dias_operacao,
            tipo_combustivel: 'LUBRIFICANTE',
            preco_litro: 0,
            total_litros: consolidado.total_litros,
            total_litros_sem_margem: consolidado.total_litros,
            valor_total: consolidado.valor_total,
            detalhamento: consolidado.detalhamento,
            itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
            fase_atividade: faseFinalString,
            consumo_lubrificante_litro: primeiroItem.consumo_lubrificante_litro,
            preco_lubrificante: primeiroItem.preco_lubrificante,
        };
        registrosParaSalvar.push(registroLubrificante);
    }

    try {
      setLoading(true);
      
      // 3. Deletar TODOS os registros existentes de Classe III para este PTrab
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId);
      
      if (deleteError) { 
          console.error("Erro ao deletar registros existentes:", deleteError);
          toast.error(`Falha ao deletar registros antigos: ${sanitizeError(deleteError)}`);
          // Se a deleção falhar, ABORTA a inserção
          setLoading(false);
          return;
      }
      
      // 4. Inserir novos registros
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success("Registros de Classe III atualizados com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      
      // Limpar o formulário principal após o salvamento
      resetFormFields();
      
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de Classe III:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const getTipoLabel = (tipo: Categoria | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO') => {
    switch (tipo) {
      case 'GERADOR': return 'Gerador';
      case 'EMBARCACAO': return 'Embarcação';
      case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamento de Engenharia';
      case 'MOTOMECANIZACAO': return 'Motomecanização';
      case 'LUBRIFICANTE_GERADOR': return 'Lubrificante (Gerador)';
      case 'LUBRIFICANTE_EMBARCACAO': return 'Lubrificante (Embarcação)';
      default: return tipo;
    }
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

  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');
  
  // Agrupamento de itens por categoria para exibição na lista
  const itensPorCategoria = form.itens.reduce((acc, item) => {
      if (!acc[item.categoria]) {
          acc[item.categoria] = [];
      }
      acc[item.categoria].push(item);
      return acc;
  }, {} as Record<Categoria, ItemClasseIII[]>);

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

        {/* NOVO COMPONENTE LPC */}
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
              Configure os equipamentos e calcule as necessidades de suprimento.
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
                    disabled={loading}
                  />
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
                        {displayFases || "Selecione as fases..."}
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
            
            {/* 2. Configuração de Itens por Categoria */}
            {form.organizacao && form.dias_operacao > 0 && refLPC && (
                <div className="space-y-4 border-b pb-4">
                    <h3 className="text-lg font-semibold">2. Configurar Itens por Categoria</h3>
                    
                    <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as Categoria)}>
                        <TabsList className="grid w-full grid-cols-4">
                            {CATEGORIAS.map(cat => (
                                <TabsTrigger key={cat.key} value={cat.key} disabled={loading}>
                                    {cat.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        
                        {CATEGORIAS.map(cat => (
                            <TabsContent key={cat.key} value={cat.key} className="mt-4">
                                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                                    
                                    {/* Formulário de Configuração de Item */}
                                    <ClasseIIIItemConfigurator
                                        categoria={cat.key}
                                        equipamentosDisponiveis={equipamentosDisponiveis}
                                        onAddItem={handleAddItem}
                                        onUpdateItem={handleUpdateItem}
                                        editingItem={editingItem && editingItem.categoria === cat.key ? editingItem : null}
                                        onCancelEdit={handleCancelEdit}
                                        loading={loading}
                                        // NOVOS PROPS
                                        lubrificanteAlloc={lubrificanteAlloc[cat.key]}
                                        onOMLubrificanteChange={handleOMLubrificanteChange}
                                    />
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
                        {CATEGORIAS.map(cat => {
                            const itens = itensPorCategoria[cat.key];
                            if (!itens || itens.length === 0) return null;
                            
                            const totalQuantidade = itens.reduce((sum, item) => sum + item.quantidade, 0);
                            const totalValorCombustivel = itens.reduce((sum, item) => {
                                let litrosItem = 0;
                                if (item.categoria === 'MOTOMECANIZACAO') {
                                    litrosItem = (item.km_dia * item.quantidade) / item.consumo_fixo * form.dias_operacao;
                                } else {
                                    litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * form.dias_operacao;
                                }
                                const totalLitros = litrosItem * 1.3;
                                const preco = item.tipo_combustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0);
                                return sum + (totalLitros * preco);
                            }, 0);
                            
                            const totalValorLubrificante = itens.reduce((sum, item) => {
                                if (item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0) {
                                    const totalHoras = item.quantidade * item.horas_dia * form.dias_operacao;
                                    let litrosItem = 0;
                                    if (item.categoria === 'GERADOR') {
                                        litrosItem = (totalHoras / 100) * item.consumo_lubrificante_litro;
                                    } else if (item.categoria === 'EMBARCACAO') {
                                        litrosItem = totalHoras * item.consumo_lubrificante_litro;
                                    }
                                    return sum + (litrosItem * item.preco_lubrificante);
                                }
                                return sum;
                            }, 0);
                            
                            return (
                                <Card key={cat.key} className="p-4 bg-secondary/10 border-secondary">
                                    <div className="flex items-center justify-between mb-3 border-b pb-2">
                                        <h4 className="font-bold text-base text-primary">{cat.label} ({totalQuantidade} un.)</h4>
                                        <span className="font-extrabold text-lg text-primary">{formatCurrency(totalValorCombustivel + totalValorLubrificante)}</span>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        {itens.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center text-sm text-muted-foreground border-b border-dashed pb-1 last:border-b-0 last:pb-0">
                                                <div className="flex-1">
                                                    <span className="font-medium text-foreground">{item.tipo_equipamento_especifico}</span>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.quantidade} un. • {item.categoria === 'MOTOMECANIZACAO' ? `${formatNumber(item.km_dia)} km/dia` : `${formatNumber(item.horas_dia, 1)} h/dia`}
                                                        {item.consumo_lubrificante_litro > 0 && ` • Lub: ${formatNumber(item.consumo_lubrificante_litro, 2)} ${item.categoria === 'GERADOR' ? 'L/100h' : 'L/h'}`}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditItem(item)}
                                                        disabled={loading}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        disabled={loading}
                                                        className="text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {(cat.key === 'GERADOR' || cat.key === 'EMBARCACAO') && (
                                        <div className="pt-2 border-t mt-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">OM Destino Lubrificante:</span>
                                                <span className="font-medium text-foreground">
                                                    {lubrificanteAlloc[cat.key].om} ({lubrificanteAlloc[cat.key].ug})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg border border-primary/20 mt-4">
                        <span className="font-bold text-base text-primary">CUSTO TOTAL CLASSE III</span>
                        <span className="font-extrabold text-xl text-primary">
                            {formatCurrency(custoTotalClasseIII)}
                        </span>
                    </div>
                    
                    <div className="flex gap-3 pt-4 justify-end">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={resetFormFields} // Chamando a função de reset completa
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar Formulário
                        </Button>
                        <Button 
                            type="button" 
                            onClick={salvarRegistrosConsolidados} 
                            disabled={loading || !isFormValid || consolidadosLubrificante.some(c => !c.omLubrificante)}
                        >
                            {loading 
                                ? "Aguarde..." 
                                : (registros.length > 0 ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosCombustivel.length + consolidadosLubrificante.length} registros)
                        </Button>
                    </div>
                </div>
            )}
            
            {/* 4. RENDERIZAÇÃO DE REGISTROS SALVOS */}
            {registros.length > 0 && (
              <>
                <div className="space-y-4 mt-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      OMs Cadastradas
                    </h3>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => fetchRegistros()} 
                        disabled={loading}
                        className="gap-1"
                    >
                        <RefreshCw className="h-3 w-3" />
                        Recarregar
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3 font-semibold text-sm w-[20%]">OM Destino</th>
                            <th className="text-left p-3 font-semibold text-sm w-[15%]">Tipo</th>
                            <th className="text-left p-3 font-semibold text-sm w-[12%]">Suprimento</th>
                            <th className="text-right p-3 font-semibold text-sm w-[13%]">Total Litros</th>
                            <th className="text-right p-3 font-semibold text-sm w-[13%]">Valor Total</th>
                            <th className="text-center p-3 font-semibold text-sm w-[15%]">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registros.map((registro) => {
                            const isLubrificante = registro.tipo_equipamento.startsWith('LUBRIFICANTE');
                            const tipoLabel = getTipoLabel(registro.tipo_equipamento as Categoria | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO');
                            
                            let suprimentoBadgeClass = '';
                            let suprimentoText = '';

                            if (isLubrificante) {
                              suprimentoBadgeClass = 'bg-purple-600 text-white hover:bg-purple-700';
                              suprimentoText = 'Lubrificante';
                            } else if (registro.tipo_combustivel === 'DIESEL' || registro.tipo_combustivel === 'OD') {
                              suprimentoBadgeClass = 'bg-cyan-600 text-white hover:bg-cyan-700';
                              suprimentoText = 'Diesel';
                            } else if (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS') {
                              suprimentoBadgeClass = 'bg-amber-500 text-white hover:bg-amber-600';
                              suprimentoText = 'Gasolina';
                            } else {
                              suprimentoBadgeClass = 'bg-primary text-primary-foreground';
                              suprimentoText = 'Combustível';
                            }
                            
                            return (
                              <tr key={registro.id} className="border-t hover:bg-muted/50 transition-colors">
                                <td className="p-3 text-sm">{registro.organizacao} ({registro.ug})</td>
                                <td className="p-3 text-sm">{tipoLabel}</td>
                                <td className="p-3 text-sm">
                                  <Badge variant="default" className={suprimentoBadgeClass}>
                                    {suprimentoText}
                                  </Badge>
                                </td>
                                <td className="p-3 text-sm text-right font-medium">{formatNumber(registro.total_litros, isLubrificante ? 2 : 0)} L</td>
                                <td className="p-3 text-sm text-right font-medium">{formatCurrency(registro.valor_total)}</td>
                                <td className="p-3 text-sm">
                                  <div className="flex gap-1 justify-center">
                                    {/* A edição de registro agora recarrega o formulário principal */}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => loadRegistroToForm(registros)} // Carrega os dados para edição
                                      disabled={loading}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeletar(registro.id)}
                                      disabled={loading}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-muted/50 border-t-2">
                          <tr className="bg-primary/10 border-t-2">
                            <td colSpan={4} className="p-3 text-sm font-bold text-primary text-right">
                              CUSTO TOTAL CLASSE III
                            </td>
                            <td className="p-3 text-sm text-right font-extrabold text-primary text-base">
                              {formatCurrency(registros.reduce((sum, r) => sum + r.valor_total, 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mt-8">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    📋 Memórias de Cálculo Detalhadas
                  </h3>
                  
                  {registros.map((registro) => {
                    const isEditing = editingMemoriaId === registro.id;
                    const hasCustomMemoria = !!registro.detalhamento_customizado;
                    const memoriaExibida = registro.detalhamento_customizado || registro.detalhamento || "";
                    const isLubrificante = registro.tipo_equipamento.startsWith('LUBRIFICANTE');
                    
                    let suprimentoTipo = isLubrificante ? 'Lubrificante' : (registro.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel');
                    let equipamentoTipo = getTipoLabel(registro.tipo_equipamento as Categoria | 'LUBRIFICANTE_GERADOR' | 'LUBRIFICANTE_EMBARCACAO');
                    
                    const tituloOM = `${registro.organizacao} (UG: ${registro.ug})`;
                    const tituloEquipamento = equipamentoTipo;

                    return (
                      <Card key={`memoria-${registro.id}`} className="p-6 bg-muted/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                              {tituloOM}
                            </h4>
                            <span className="text-lg font-semibold text-muted-foreground/80">
                              | {tituloEquipamento}
                            </span>
                            {hasCustomMemoria && !isEditing && (
                              <Badge variant="outline" className="text-xs">
                                Editada manualmente
                              </Badge>
                            )}
                          </div>
                          <Badge 
                            variant="default" 
                            className={isLubrificante 
                              ? 'bg-purple-600 text-primary-foreground' 
                              : (registro.tipo_combustivel === 'GASOLINA' || registro.tipo_combustivel === 'GAS'
                                  ? 'bg-amber-500 text-primary-foreground' 
                                  : 'bg-cyan-600 text-primary-foreground')}
                          >
                            {suprimentoTipo}
                          </Badge>
                        </div>
                        
                        <div className="h-px bg-border my-4" />
                        
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
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}