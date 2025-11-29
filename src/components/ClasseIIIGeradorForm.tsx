import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, XCircle, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput, formatInputWithThousands } from "@/lib/formatUtils";
import { TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Checkbox } from "@/components/ui/checkbox";

type CombustivelTipo = 'GASOLINA' | 'DIESEL';

interface ItemGerador {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
}

interface FormDataGerador {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemGerador[];
}

interface ConsolidadoCombustivel {
  tipo_combustivel: CombustivelTipo;
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemGerador[];
  detalhamento: string;
}

interface ConsolidadoLubrificante {
  total_litros: number;
  valor_total: number;
  itens: ItemGerador[];
  detalhamento: string;
}

interface ClasseIIIGeradorFormProps {
  ptrabId: string;
  refLPC: RefLPC;
  equipamentosDisponiveis: TipoEquipamentoDetalhado[];
  onSaveSuccess: () => void;
  editingRegistroId: string | null;
  setEditingRegistroId: (id: string | null) => void;
  initialData?: {
    form: FormDataGerador;
    rmFornecimento: string;
    codugRmFornecimento: string;
    omLubrificante: string;
    ugLubrificante: string;
    selectedOmLubrificanteId?: string;
    fasesAtividade: string[];
    customFaseAtividade: string;
  };
}

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

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

export const ClasseIIIGeradorForm = ({
  ptrabId,
  refLPC,
  equipamentosDisponiveis,
  onSaveSuccess,
  editingRegistroId,
  setEditingRegistroId,
  initialData,
}: ClasseIIIGeradorFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formGerador, setFormGerador] = useState<FormDataGerador>(initialData?.form || {
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  const [rmFornecimento, setRmFornecimento] = useState(initialData?.rmFornecimento || "");
  const [codugRmFornecimento, setCodugRmFornecimento] = useState(initialData?.codugRmFornecimento || "");
  const [omLubrificante, setOmLubrificante] = useState(initialData?.omLubrificante || "");
  const [ugLubrificante, setUgLubrificante] = useState(initialData?.ugLubrificante || "");
  const [selectedOmLubrificanteId, setSelectedOmLubrificanteId] = useState(initialData?.selectedOmLubrificanteId);

  const [itemGeradorTemp, setItemGeradorTemp] = useState<ItemGerador>({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
    consumo_lubrificante_litro: 0,
    preco_lubrificante: 0,
  });
  
  const [inputConsumoLubrificante, setInputConsumoLubrificante] = useState<string>("");
  const [inputPrecoLubrificante, setInputPrecoLubrificante] = useState<string>("");
  const [editingGeradorItemIndex, setEditingGeradorItemIndex] = useState<number | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [fasesAtividade, setFasesAtividade] = useState<string[]>(initialData?.fasesAtividade || ["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>(initialData?.customFaseAtividade || "");

  const addGeradorRef = useRef<HTMLDivElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  // --- Input Handlers para Lubrificante ---
  const updateNumericItemGerador = (field: keyof ItemGerador, inputString: string) => {
    const numericValue = parseInputToNumber(inputString);
    setItemGeradorTemp(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleInputGeradorChange = (
      e: React.ChangeEvent<HTMLInputElement>, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      field: keyof ItemGerador
  ) => {
      const rawValue = e.target.value;
      let cleaned = rawValue.replace(/[^\d,.]/g, '');
      const parts = cleaned.split(',');
      if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
      cleaned = cleaned.replace(/\./g, '');
      setInput(cleaned);
      updateNumericItemGerador(field, cleaned);
  };

  const handleInputGeradorBlur = (
      input: string, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      minDecimals: number,
      field: keyof ItemGerador
  ) => {
      const numericValue = parseInputToNumber(input);
      const formattedDisplay = formatNumberForInput(numericValue, minDecimals);
      setInput(formattedDisplay);
      updateNumericItemGerador(field, formattedDisplay);
  };
  // Fim Input Handlers

  // Efeito para carregar dados iniciais na montagem/edição
  useEffect(() => {
    if (initialData) {
        setFormGerador(initialData.form);
        setRmFornecimento(initialData.rmFornecimento);
        setCodugRmFornecimento(initialData.codugRmFornecimento);
        setOmLubrificante(initialData.omLubrificante);
        setUgLubrificante(initialData.ugLubrificante);
        setSelectedOmLubrificanteId(initialData.selectedOmLubrificanteId);
        setFasesAtividade(initialData.fasesAtividade);
        setCustomFaseAtividade(initialData.customFaseAtividade);
    }
  }, [initialData]);

  const handleOMGeradorChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormGerador({ ...formGerador, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
      setSelectedOmLubrificanteId(omData.id);
      setOmLubrificante(omData.nome_om);
      setUgLubrificante(omData.codug_om);
    } else {
      setFormGerador({ ...formGerador, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimento("");
      setCodugRmFornecimento("");
      setSelectedOmLubrificanteId(undefined);
      setOmLubrificante("");
      setUgLubrificante("");
    }
  };
  
  const handleOMLubrificanteChange = (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmLubrificanteId(omData.id);
      setOmLubrificante(omData.nome_om);
      setUgLubrificante(omData.codug_om);
    } else {
      setSelectedOmLubrificanteId(undefined);
      setOmLubrificante("");
      setUgLubrificante("");
    }
  };
  
  const handleRMFornecimentoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimento(rmName);
    setCodugRmFornecimento(rmCodug);
  };

  const handleTipoGeradorChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemGeradorTemp({ 
        ...itemGeradorTemp, 
        tipo_equipamento_especifico: tipoNome, 
        tipo_combustivel: novoCombustivel, 
        consumo_fixo: equipamento.consumo,
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
      });
      setInputConsumoLubrificante("");
      setInputPrecoLubrificante("");
    }
  };

  const adicionarOuAtualizarItemGerador = () => {
    if (!itemGeradorTemp.tipo_equipamento_especifico || itemGeradorTemp.quantidade <= 0 || itemGeradorTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos obrigatórios do item (Tipo, Quantidade, Horas/dia)");
      return;
    }
    if (itemGeradorTemp.consumo_lubrificante_litro < 0 || itemGeradorTemp.preco_lubrificante < 0) {
      toast.error("Consumo e preço do lubrificante não podem ser negativos.");
      return;
    }

    const novoItem: ItemGerador = { ...itemGeradorTemp };
    let novosItens = [...formGerador.itens];
    if (editingGeradorItemIndex !== null) {
      novosItens[editingGeradorItemIndex] = novoItem;
      toast.success("Item de gerador atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de gerador adicionado!");
    }
    setFormGerador({ ...formGerador, itens: novosItens });
    setItemGeradorTemp({ 
      tipo_equipamento_especifico: "", 
      quantidade: 0, 
      horas_dia: 0, 
      consumo_fixo: 0, 
      tipo_combustivel: "DIESEL",
      consumo_lubrificante_litro: 0,
      preco_lubrificante: 0,
    });
    setInputConsumoLubrificante("");
    setInputPrecoLubrificante("");
    setEditingGeradorItemIndex(null);
  };
  
  const handleEditGeradorItem = (item: ItemGerador, index: number) => {
    setItemGeradorTemp(item);
    setInputConsumoLubrificante(formatNumberForInput(item.consumo_lubrificante_litro, 2));
    setInputPrecoLubrificante(formatNumberForInput(item.preco_lubrificante, 2));
    setEditingGeradorItemIndex(index);
    if (addGeradorRef.current) { addGeradorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  
  const handleCancelEditGeradorItem = () => {
    setItemGeradorTemp({ 
      tipo_equipamento_especifico: "", 
      quantidade: 0, 
      horas_dia: 0, 
      consumo_fixo: 0, 
      tipo_combustivel: "DIESEL",
      consumo_lubrificante_litro: 0,
      preco_lubrificante: 0,
    });
    setInputConsumoLubrificante("");
    setInputPrecoLubrificante("");
    setEditingGeradorItemIndex(null);
  };
  
  const removerItemGerador = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formGerador.itens.filter((_, i) => i !== index);
    setFormGerador({ ...formGerador, itens: novosItens });
    if (editingGeradorItemIndex === index) { handleCancelEditGeradorItem(); }
    toast.success("Item de gerador removido!");
  };
  
  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  // --- CÁLCULO CONSOLIDADO ---
  const { consolidadosCombustivel, consolidadoLubrificante } = useMemo(() => {
    const itens = formGerador.itens;
    if (itens.length === 0 || !refLPC) { 
      return { consolidadosCombustivel: [], consolidadoLubrificante: null }; 
    }
    
    // --- CÁLCULO DE COMBUSTÍVEL (ND 33.90.39) ---
    const gruposCombustivel = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<CombustivelTipo, ItemGerador[]>);
    
    const consolidadosCombustivel: ConsolidadoCombustivel[] = [];
    Object.entries(gruposCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];
      itensGrupo.forEach(item => {
        const litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * formGerador.dias_operacao;
        totalLitrosSemMargem += litrosItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- (${item.quantidade} ${item.tipo_equipamento_especifico} x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formGerador.dias_operacao} dias = ${formatNumber(litrosItem)} L ${unidade}.`);
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
      const totalGeradores = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      const detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalGeradores} geradores, durante ${formGerador.dias_operacao} dias de ${faseFormatada}, para ${formGerador.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Nr Geradores x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.
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
    let totalLitrosLubrificante = 0;
    let totalValorLubrificante = 0;
    const itensComLubrificante = itens.filter(item => item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0);
    const detalhesLubrificante: string[] = [];
    
    itensComLubrificante.forEach(item => {
      const totalHoras = item.quantidade * item.horas_dia * formGerador.dias_operacao;
      const litrosItem = (totalHoras / 100) * item.consumo_lubrificante_litro;
      const valorItem = litrosItem * item.preco_lubrificante;
      
      totalLitrosLubrificante += litrosItem;
      totalValorLubrificante += valorItem;
      
      detalhesLubrificante.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: (${formatNumber(totalHoras)} horas / 100h) x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/100h = ${formatNumber(litrosItem, 2)} L. Valor: ${formatCurrency(valorItem)}.`);
    });
    
    let consolidadoLubrificante: ConsolidadoLubrificante | null = null;
    
    if (totalLitrosLubrificante > 0) {
      const totalGeradores = itensComLubrificante.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividade];
      if (customFaseAtividade.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividade.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      const detalhamentoLubrificante = `33.90.30 - Aquisição de Lubrificante para ${totalGeradores} geradores, durante ${formGerador.dias_operacao} dias de ${faseFormatada}, para ${formGerador.organizacao}.
Recurso destinado à OM proprietária: ${omLubrificante} (UG: ${ugLubrificante})

Cálculo:
Fórmula: (Nr Geradores x Nr Horas utilizadas/dia x Nr dias de operação) / 100h x Consumo Lubrificante/100h.

${itensComLubrificante.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/100h. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}.`).join('\n')}

${detalhesLubrificante.join('\n')}

Total Litros: ${formatNumber(totalLitrosLubrificante, 2)} L.
Valor Total: ${formatCurrency(totalValorLubrificante)}.`;

      consolidadoLubrificante = {
        total_litros: totalLitrosLubrificante,
        valor_total: totalValorLubrificante,
        itens: itensComLubrificante,
        detalhamento: detalhamentoLubrificante,
      };
    }
    
    return { consolidadosCombustivel, consolidadoLubrificante };
  }, [formGerador, refLPC, rmFornecimento, codugRmFornecimento, omLubrificante, ugLubrificante, fasesAtividade, customFaseAtividade]);
  
  const totalGeradores = formGerador.itens.reduce((sum, item) => sum + item.quantidade, 0);
  const isFormValid = formGerador.organizacao && formGerador.ug && rmFornecimento && codugRmFornecimento && formGerador.dias_operacao > 0 && formGerador.itens.length > 0;
  const isItemValid = itemGeradorTemp.tipo_equipamento_especifico && itemGeradorTemp.quantidade > 0 && itemGeradorTemp.horas_dia > 0;
  const fuelBadgeClass = itemGeradorTemp.tipo_combustivel === 'DIESEL' 
    ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
    : 'bg-amber-500 text-white hover:bg-amber-600';

  const salvarRegistrosConsolidadosGerador = async () => {
    if (!ptrabId) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); return; }
    if (!formGerador.organizacao || !formGerador.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formGerador.itens.length === 0) { toast.error("Adicione pelo menos um gerador"); return; }
    if (consolidadoLubrificante && (!omLubrificante || !ugLubrificante)) { toast.error("Selecione a OM de destino do Lubrificante (ND 30)"); return; }
    
    let fasesFinais = [...fasesAtividade];
    if (customFaseAtividade.trim()) { fasesFinais = [...fasesFinais, customFaseAtividade.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Preparar registros de COMBUSTÍVEL (ND 33.90.39)
    for (const consolidado of consolidadosCombustivel) {
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'GERADOR',
        tipo_equipamento_detalhe: null,
        organizacao: formGerador.organizacao,
        ug: formGerador.ug,
        quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formGerador.dias_operacao,
        tipo_combustivel: consolidado.tipo_combustivel,
        preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC.preco_gasolina ?? 0) : (refLPC.preco_diesel ?? 0),
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
    
    // 2. Preparar registro de LUBRIFICANTE (ND 33.90.30)
    if (consolidadoLubrificante) {
      const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'LUBRIFICANTE_GERADOR',
        tipo_equipamento_detalhe: null,
        organizacao: omLubrificante,
        ug: ugLubrificante,
        quantidade: consolidadoLubrificante.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formGerador.dias_operacao,
        tipo_combustivel: 'LUBRIFICANTE',
        preco_litro: 0,
        total_litros: consolidadoLubrificante.total_litros,
        total_litros_sem_margem: consolidadoLubrificante.total_litros,
        valor_total: consolidadoLubrificante.valor_total,
        detalhamento: consolidadoLubrificante.detalhamento,
        itens_equipamentos: JSON.parse(JSON.stringify(consolidadoLubrificante.itens)),
        fase_atividade: faseFinalString,
        consumo_lubrificante_litro: consolidadoLubrificante.itens[0]?.consumo_lubrificante_litro || 0,
        preco_lubrificante: consolidadoLubrificante.itens[0]?.preco_lubrificante || 0,
      };
      registrosParaSalvar.push(registroLubrificante);
    }

    try {
      setLoading(true);
      
      // Deletar registros existentes (Combustível e Lubrificante) para esta OM/Tipo
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .in("tipo_equipamento", ["GERADOR", "LUBRIFICANTE_GERADOR"])
        .eq("organizacao", formGerador.organizacao)
        .eq("ug", formGerador.ug);
      if (deleteError) { throw deleteError; }
      
      // Inserir novos registros
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success(editingRegistroId ? "Registros de geradores e lubrificantes atualizados com sucesso!" : "Registros de geradores e lubrificantes salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      setEditingRegistroId(null);
      onSaveSuccess();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de gerador/lubrificante:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const displayFases = [...fasesAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosGerador(); }}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>OM Detentora do Equipamento *</Label>
            <OmSelector
              selectedOmId={formGerador.selectedOmId}
              onChange={handleOMGeradorChange}
              placeholder="Selecione a OM detentora..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>UG Detentora</Label>
            <Input value={formGerador.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rmFornecimentoGerador">RM de Fornecimento de Combustível *</Label>
            <RmSelector
              value={rmFornecimento}
              onChange={handleRMFornecimentoChange}
              placeholder="Selecione a RM de fornecimento..."
              disabled={!formGerador.organizacao || loading}
            />
          </div>

          <div className="space-y-2">
            <Label>CODUG da RM de Fornecimento</Label>
            <Input value={codugRmFornecimento} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dias de Atividade *</Label>
            <Input
              type="number"
              min="1"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
              value={formGerador.dias_operacao || ""}
              onChange={(e) => setFormGerador({ ...formGerador, dias_operacao: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
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
      <div className="mb-6" /> 

      {formGerador.organizacao && (
        <div className="space-y-4 mt-6 border-t pt-6" ref={addGeradorRef}>
          <h3 className="text-lg font-semibold">2. Adicionar Geradores</h3>
          
          {/* LINHA 1: DADOS DO GERADOR (3 COLUNAS) - COMBUSTÍVEL */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Tipo de Gerador *</Label>
              <Select 
                value={itemGeradorTemp.tipo_equipamento_especifico}
                onValueChange={handleTipoGeradorChange}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {equipamentosDisponiveis.map(eq => (
                    <SelectItem key={eq.nome} value={eq.nome}>
                      {eq.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min="1"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={itemGeradorTemp.quantidade === 0 ? "" : itemGeradorTemp.quantidade.toString()}
                onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, quantidade: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 2"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>

            <div className="space-y-2">
              <Label>Horas/dia *</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={itemGeradorTemp.horas_dia === 0 ? "" : itemGeradorTemp.horas_dia.toString()}
                onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: 8"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>
          </div>
          
          {/* LINHA 2: DADOS DO LUBRIFICANTE (3 COLUNAS) */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border-t border-border">
            <div className="space-y-2">
              <Label>Consumo Lubrificante (L/100h)</Label>
              <Input
                type="text"
                inputMode="decimal"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={inputConsumoLubrificante}
                onChange={(e) => handleInputGeradorChange(e, setInputConsumoLubrificante, 'consumo_lubrificante_litro')}
                onBlur={(e) => handleInputGeradorBlur(e.target.value, setInputConsumoLubrificante, 2, 'consumo_lubrificante_litro')}
                placeholder="Ex: 0,50"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Preço Lubrificante (R$/L)</Label>
              <Input
                type="text"
                inputMode="decimal"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={inputPrecoLubrificante}
                onChange={(e) => handleInputGeradorChange(e, setInputPrecoLubrificante, 'preco_lubrificante')}
                onBlur={(e) => handleInputGeradorBlur(e.target.value, setInputPrecoLubrificante, 2, 'preco_lubrificante')}
                placeholder="Ex: 35,00"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>
            
            <div className="space-y-2">
              <Label>OM Destino Recurso (ND 30) *</Label>
              <OmSelector
                selectedOmId={selectedOmLubrificanteId}
                onChange={handleOMLubrificanteChange}
                placeholder="Selecione a OM de destino..."
                disabled={!formGerador.organizacao || loading}
              />
              <p className="text-xs text-muted-foreground">OM que receberá o recurso de lubrificante.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              type="button" 
              onClick={adicionarOuAtualizarItemGerador} 
              className="w-full md:w-auto" 
              disabled={loading || !isItemValid}
            >
              {editingGeradorItemIndex !== null ? "Atualizar Item" : "Adicionar"}
            </Button>
          </div>

          {itemGeradorTemp.consumo_fixo > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className={fuelBadgeClass}>
                Combustível: {itemGeradorTemp.tipo_combustivel} ({formatNumber(itemGeradorTemp.consumo_fixo, 1)} L/h)
              </Badge>
              {itemGeradorTemp.consumo_lubrificante_litro > 0 && (
                <Badge variant="default" className="bg-purple-600 text-white hover:bg-purple-700">
                  Lubrificante: {formatNumber(itemGeradorTemp.consumo_lubrificante_litro, 2)} L/100h @ {formatCurrency(itemGeradorTemp.preco_lubrificante)}
                </Badge>
              )}
            </div>
          )}
          {editingGeradorItemIndex !== null && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEditGeradorItem}
              className="mt-2"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Edição do Item
            </Button>
          )}
        </div>
      )}

      {formGerador.itens.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">3. Geradores Configurados ({totalGeradores} unidades)</h3>
          
          <div className="space-y-2">
            {formGerador.itens.map((item, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} unidade(s) • {formatNumber(item.horas_dia, 1)}h/dia • {formatNumber(item.consumo_fixo, 1)} L/h {item.tipo_combustivel}
                      {item.consumo_lubrificante_litro > 0 && ` • Lub: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/100h @ ${formatCurrency(item.preco_lubrificante)}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditGeradorItem(item, index)}
                      disabled={loading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItemGerador(index)}
                      disabled={loading}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {(consolidadosCombustivel.length > 0 || consolidadoLubrificante) && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">4. Consolidação de Custos</h3>
          
          {/* CONSOLIDAÇÃO DE COMBUSTÍVEL */}
          {consolidadosCombustivel.map((consolidado, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg text-primary">
                    {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel'}
                  </h4>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total com 30%</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(consolidado.valor_total)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Memória de Cálculo</Label>
                  <Textarea
                    value={consolidado.detalhamento}
                    readOnly
                    rows={6}
                    className="font-mono text-xs"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
            </Card>
          ))}
          
          {/* CONSOLIDAÇÃO DE LUBRIFICANTE */}
          {consolidadoLubrificante && (
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-lg text-primary">
                    Lubrificante
                  </h4>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(consolidadoLubrificante.valor_total)}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Memória de Cálculo</Label>
                  <Textarea
                    value={consolidadoLubrificante.detalhamento}
                    readOnly
                    rows={8}
                    className="font-mono text-xs"
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              </div>
            </Card>
          )}

          <div className="flex gap-3 pt-4 justify-end">
            {editingRegistroId && (
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditingRegistroId(null)}
                disabled={loading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Edição
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading || !isFormValid || (consolidadoLubrificante && (!omLubrificante || !ugLubrificante))}
            >
              {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosCombustivel.length + (consolidadoLubrificante ? 1 : 0)} registros)
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};