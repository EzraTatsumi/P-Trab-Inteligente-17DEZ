import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, XCircle, ChevronDown, Check, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, formatNumber, parseInputToNumber, formatNumberForInput } from "@/lib/formatUtils";
import { TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC } from "@/types/refLPC";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { sanitizeError } from "@/lib/errorUtils";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type CombustivelTipo = 'GASOLINA' | 'DIESEL';

interface ItemEmbarcacao {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: CombustivelTipo;
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
}

interface FormDataEmbarcacao {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemEmbarcacao[];
}

interface ConsolidadoCombustivel {
  tipo_combustivel: CombustivelTipo;
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemEmbarcacao[];
  detalhamento: string;
}

interface ConsolidadoLubrificante {
  total_litros: number;
  valor_total: number;
  itens: ItemEmbarcacao[];
  detalhamento: string;
}

interface ClasseIIIEmbarcacaoFormProps {
  ptrabId: string;
  refLPC: RefLPC;
  equipamentosDisponiveis: TipoEquipamentoDetalhado[];
  onSaveSuccess: () => void;
  editingRegistroId: string | null;
  setEditingRegistroId: (id: string | null) => void;
  initialData?: {
    form: FormDataEmbarcacao;
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

export const ClasseIIIEmbarcacaoForm = ({
  ptrabId,
  refLPC,
  equipamentosDisponiveis,
  onSaveSuccess,
  editingRegistroId,
  setEditingRegistroId,
  initialData,
}: ClasseIIIEmbarcacaoFormProps) => {
  const [loading, setLoading] = useState(false);
  const [formEmbarcacao, setFormEmbarcacao] = useState<FormDataEmbarcacao>(initialData?.form || {
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });
  const [rmFornecimentoEmbarcacao, setRmFornecimentoEmbarcacao] = useState(initialData?.rmFornecimento || "");
  const [codugRmFornecimentoEmbarcacao, setCodugRmFornecimentoEmbarcacao] = useState(initialData?.codugRmFornecimento || "");
  const [omLubrificante, setOmLubrificante] = useState(initialData?.omLubrificante || "");
  const [ugLubrificante, setUgLubrificante] = useState(initialData?.ugLubrificante || "");
  const [selectedOmLubrificanteId, setSelectedOmLubrificanteId] = useState(initialData?.selectedOmLubrificanteId);

  const [itemEmbarcacaoTemp, setItemEmbarcacaoTemp] = useState<ItemEmbarcacao>({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
    consumo_lubrificante_litro: 0,
    preco_lubrificante: 0,
  });
  
  const [inputConsumoLubrificanteEmbarcacao, setInputConsumoLubrificanteEmbarcacao] = useState<string>("");
  const [inputPrecoLubrificanteEmbarcacao, setInputPrecoLubrificanteEmbarcacao] = useState<string>("");
  const [editingEmbarcacaoItemIndex, setEditingEmbarcacaoItemIndex] = useState<number | null>(null);
  const [isPopoverOpenEmbarcacao, setIsPopoverOpenEmbarcacao] = useState(false);
  const [fasesAtividadeEmbarcacao, setFasesAtividadeEmbarcacao] = useState<string[]>(initialData?.fasesAtividade || ["Execução"]);
  const [customFaseAtividadeEmbarcacao, setCustomFaseAtividadeEmbarcacao] = useState<string>(initialData?.customFaseAtividade || "");

  const addEmbarcacaoRef = useRef<HTMLDivElement>(null);
  const { handleEnterToNextField } = useFormNavigation();

  // --- Input Handlers para Lubrificante ---
  const updateNumericItemEmbarcacao = (field: keyof ItemEmbarcacao, inputString: string) => {
    const numericValue = parseInputToNumber(inputString);
    setItemEmbarcacaoTemp(prev => ({ ...prev, [field]: numericValue }));
  };

  const handleInputEmbarcacaoChange = (
      e: React.ChangeEvent<HTMLInputElement>, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      field: keyof ItemEmbarcacao
  ) => {
      const rawValue = e.target.value;
      let cleaned = rawValue.replace(/[^\d,.]/g, '');
      const parts = cleaned.split(',');
      if (parts.length > 2) { cleaned = parts[0] + ',' + parts.slice(1).join(''); }
      cleaned = cleaned.replace(/\./g, '');
      setInput(cleaned);
      updateNumericItemEmbarcacao(field, cleaned);
  };

  const handleInputEmbarcacaoBlur = (
      input: string, 
      setInput: React.Dispatch<React.SetStateAction<string>>, 
      minDecimals: number,
      field: keyof ItemEmbarcacao
  ) => {
      const numericValue = parseInputToNumber(input);
      const formattedDisplay = formatNumberForInput(numericValue, minDecimals);
      setInput(formattedDisplay);
      updateNumericItemEmbarcacao(field, numericValue); // Usar numericValue para o estado interno
  };
  // Fim Input Handlers

  useEffect(() => {
    if (initialData) {
        setFormEmbarcacao(initialData.form);
        setRmFornecimentoEmbarcacao(initialData.rmFornecimento);
        setCodugRmFornecimentoEmbarcacao(initialData.codugRmFornecimento);
        setOmLubrificante(initialData.omLubrificante);
        setUgLubrificante(initialData.ugLubrificante);
        setSelectedOmLubrificanteId(initialData.selectedOmLubrificanteId);
        setFasesAtividadeEmbarcacao(initialData.fasesAtividade);
        setCustomFaseAtividadeEmbarcacao(initialData.customFaseAtividade);
    }
  }, [initialData]);

  const handleOMEmbarcacaoChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormEmbarcacao({ ...formEmbarcacao, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimentoEmbarcacao(omData.rm_vinculacao);
      setCodugRmFornecimentoEmbarcacao(omData.codug_rm_vinculacao);
      
      setSelectedOmLubrificanteId(omData.id);
      setOmLubrificante(omData.nome_om);
      setUgLubrificante(omData.codug_om);
    } else {
      setFormEmbarcacao({ ...formEmbarcacao, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimentoEmbarcacao("");
      setCodugRmFornecimentoEmbarcacao("");
      setSelectedOmLubrificanteId(undefined);
      setOmLubrificante("");
      setUgLubrificante("");
    }
  };
  
  const handleOMLubrificanteEmbarcacaoChange = (omData: OMData | undefined) => {
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
  
  const handleRMFornecimentoEmbarcacaoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimentoEmbarcacao(rmName);
    setCodugRmFornecimentoEmbarcacao(rmCodug);
  };
  
  const handleTipoEmbarcacaoChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const combustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemEmbarcacaoTemp({ 
        ...itemEmbarcacaoTemp, 
        tipo_equipamento_especifico: tipoNome, 
        consumo_fixo: equipamento.consumo, 
        tipo_combustivel: combustivel as CombustivelTipo,
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
      });
      setInputConsumoLubrificanteEmbarcacao("");
      setInputPrecoLubrificanteEmbarcacao("");
    }
  };

  const adicionarOuAtualizarItemEmbarcacao = () => {
    if (!itemEmbarcacaoTemp.tipo_equipamento_especifico || itemEmbarcacaoTemp.quantidade <= 0 || itemEmbarcacaoTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos obrigatórios do item (Tipo, Quantidade, Horas/dia)");
      return;
    }
    if (itemEmbarcacaoTemp.consumo_lubrificante_litro < 0 || itemEmbarcacaoTemp.preco_lubrificante < 0) {
      toast.error("Consumo e preço do lubrificante não podem ser negativos.");
      return;
    }
    
    const novoItem: ItemEmbarcacao = { ...itemEmbarcacaoTemp };
    let novosItens = [...formEmbarcacao.itens];
    if (editingEmbarcacaoItemIndex !== null) {
      novosItens[editingEmbarcacaoItemIndex] = novoItem;
      toast.success("Item atualizado!");
      setEditingEmbarcacaoItemIndex(null);
    } else {
      novosItens.push(novoItem);
      toast.success("Item adicionado!");
    }
    setFormEmbarcacao({ ...formEmbarcacao, itens: novosItens });
    setItemEmbarcacaoTemp({ 
      tipo_equipamento_especifico: "", 
      quantidade: 0, 
      horas_dia: 0, 
      consumo_fixo: 0, 
      tipo_combustivel: "DIESEL",
      consumo_lubrificante_litro: 0,
      preco_lubrificante: 0,
    });
    setInputConsumoLubrificanteEmbarcacao("");
    setInputPrecoLubrificanteEmbarcacao("");
    setTimeout(() => { addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const removerItemEmbarcacao = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formEmbarcacao.itens.filter((_, i) => i !== index);
    setFormEmbarcacao({ ...formEmbarcacao, itens: novosItens });
    if (editingEmbarcacaoItemIndex === index) { handleCancelEditEmbarcacaoItem(); }
    toast.success("Item removido!");
  };

  const handleEditEmbarcacaoItem = (item: ItemEmbarcacao, index: number) => {
    setItemEmbarcacaoTemp({ ...item });
    setInputConsumoLubrificanteEmbarcacao(formatNumberForInput(item.consumo_lubrificante_litro, 2));
    setInputPrecoLubrificanteEmbarcacao(formatNumberForInput(item.preco_lubrificante, 2));
    setEditingEmbarcacaoItemIndex(index);
    setTimeout(() => { addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleCancelEditEmbarcacaoItem = () => {
    setItemEmbarcacaoTemp({ 
      tipo_equipamento_especifico: "", 
      quantidade: 0, 
      horas_dia: 0, 
      consumo_fixo: 0, 
      tipo_combustivel: "DIESEL",
      consumo_lubrificante_litro: 0,
      preco_lubrificante: 0,
    });
    setInputConsumoLubrificanteEmbarcacao("");
    setInputPrecoLubrificanteEmbarcacao("");
    setEditingEmbarcacaoItemIndex(null);
  };

  const handleFaseChange = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeEmbarcacao(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFasesAtividadeEmbarcacao(prev => prev.filter(f => f !== fase));
    }
  };

  const { consolidadosCombustivel, consolidadoLubrificante } = useMemo(() => {
    const itens = formEmbarcacao.itens;
    if (itens.length === 0 || !refLPC) { 
      return { consolidadosCombustivel: [], consolidadoLubrificante: null }; 
    }
    
    // --- CÁLCULO DE COMBUSTÍVEL (ND 33.90.39) ---
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (!grupos[item.tipo_combustivel]) { grupos[item.tipo_combustivel] = []; }
      grupos[item.tipo_combustivel].push(item);
      return grupos;
    }, {} as Record<CombustivelTipo, ItemEmbarcacao[]>);
    
    const novosConsolidados: ConsolidadoCombustivel[] = [];
    Object.entries(gruposPorCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as CombustivelTipo;
      const precoLitro = tipoCombustivel === 'GASOLINA' ? refLPC.preco_gasolina : refLPC.preco_diesel;
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Diesel'; // DEFINIÇÃO AQUI
      let totalLitrosSemMargem = 0;
      let detalhes: string[] = [];
      let fasesFinaisCalc = [...fasesAtividadeEmbarcacao];
      if (customFaseAtividadeEmbarcacao.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEmbarcacao.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      itensGrupo.forEach(item => {
        const litrosSemMargemItem = item.quantidade * item.consumo_fixo * item.horas_dia * formEmbarcacao.dias_operacao;
        totalLitrosSemMargem += litrosSemMargemItem;
        detalhes.push(`- (${item.quantidade} ${item.tipo_equipamento_especifico} x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formEmbarcacao.dias_operacao} dias = ${formatNumber(litrosSemMargemItem)} L.`);
      });
      
      const totalLitros = totalLitrosSemMargem * 1.3;
      const valorTotal = totalLitros * precoLitro;
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? `(${refLPC.nome_local})` : '';
      const totalEmbarcacoes = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      
      let detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalEmbarcacoes} embarcações, durante ${formEmbarcacao.dias_operacao} dias de ${faseFormatada}, para ${formEmbarcacao.organizacao}.
Fornecido por: ${rmFornecimentoEmbarcacao} (CODUG: ${codugRmFornecimentoEmbarcacao})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(precoLitro)}.

Fórmula: (Nr Embarcações x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD'} + 30% = ${formatNumber(totalLitros)} L ${tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD'}.
Valor: ${formatNumber(totalLitros)} L x ${formatCurrency(precoLitro)} = ${formatCurrency(valorTotal)}.`;
      
      novosConsolidados.push({
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
      const totalHoras = item.quantidade * item.horas_dia * formEmbarcacao.dias_operacao;
      const litrosItem = totalHoras * item.consumo_lubrificante_litro;
      const valorItem = litrosItem * item.preco_lubrificante;
      
      totalLitrosLubrificante += litrosItem;
      totalValorLubrificante += valorItem;
      
      detalhesLubrificante.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: (${formatNumber(totalHoras)} horas) x ${formatNumber(item.consumo_lubrificante_litro, 2)} L/h = ${formatNumber(litrosItem, 2)} L. Valor: ${formatCurrency(valorItem)}.`);
    });
    
    let consolidadoLubrificante: ConsolidadoLubrificante | null = null;
    
    if (totalLitrosLubrificante > 0) {
      const totalEmbarcacoes = itensComLubrificante.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividadeEmbarcacao];
      if (customFaseAtividadeEmbarcacao.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEmbarcacao.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      
      const detalhamentoLubrificante = `33.90.30 - Aquisição de Lubrificante para ${totalEmbarcacoes} embarcações, durante ${formEmbarcacao.dias_operacao} dias de ${faseFormatada}, para ${formEmbarcacao.organizacao}.
Recurso destinado à OM proprietária: ${omLubrificante} (UG: ${ugLubrificante})

Cálculo:
Fórmula: (Nr Embarcações x Nr Horas utilizadas/dia x Nr dias de operação) x Consumo Lubrificante/hora.

${itensComLubrificante.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/h. Preço Unitário: ${formatCurrency(item.preco_lubrificante)}.`).join('\n')}

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
    
    return { consolidadosCombustivel: novosConsolidados, consolidadoLubrificante };
  }, [formEmbarcacao, refLPC, rmFornecimentoEmbarcacao, codugRmFornecimentoEmbarcacao, omLubrificante, ugLubrificante, fasesAtividadeEmbarcacao, customFaseAtividadeEmbarcacao]);

  const salvarRegistrosConsolidadosEmbarcacao = async () => {
    if (!ptrabId) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); return; }
    if (!formEmbarcacao.organizacao || !formEmbarcacao.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimentoEmbarcacao || !codugRmFornecimentoEmbarcacao) { toast.error("Selecione a RM de fornecimento de combustível"); return; }
    if (formEmbarcacao.itens.length === 0) { toast.error("Adicione pelo menos uma embarcação"); return; }
    if (consolidadoLubrificante && (!omLubrificante || !ugLubrificante)) { toast.error("Selecione a OM de destino do Lubrificante (ND 30)"); return; }
    
    let fasesFinais = [...fasesAtividadeEmbarcacao];
    if (customFaseAtividadeEmbarcacao.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeEmbarcacao.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Preparar registros de COMBUSTÍVEL (ND 33.90.39)
    for (const consolidado of consolidadosCombustivel) {
      const precoLitro = consolidado.tipo_combustivel === 'GASOLINA' ? refLPC.preco_gasolina : refLPC.preco_diesel;
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'EMBARCACAO',
        organizacao: formEmbarcacao.organizacao,
        ug: formEmbarcacao.ug,
        quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formEmbarcacao.dias_operacao,
        tipo_combustivel: consolidado.tipo_combustivel,
        preco_litro: precoLitro,
        total_litros: consolidado.total_litros,
        total_litros_sem_margem: consolidado.total_litros_sem_margem,
        valor_total: consolidado.valor_total,
        detalhamento: consolidado.detalhamento,
        itens_equipamentos: consolidado.itens as any,
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
        tipo_equipamento: 'LUBRIFICANTE_EMBARCACAO',
        tipo_equipamento_detalhe: null,
        organizacao: omLubrificante,
        ug: ugLubrificante,
        quantidade: consolidadoLubrificante.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formEmbarcacao.dias_operacao,
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
    
    setLoading(true);
    try {
      // 3. Deletar registros existentes (Combustível e Lubrificante) para esta OM/Tipo
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .in("tipo_equipamento", ["EMBARCACAO", "LUBRIFICANTE_EMBARCACAO"])
        .eq("organizacao", formEmbarcacao.organizacao)
        .eq("ug", formEmbarcacao.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes de embarcação/lubrificante para edição:", deleteError); throw deleteError; }
      
      // 4. Inserir novos registros
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success(editingRegistroId ? "Registros de embarcações e lubrificantes atualizados com sucesso!" : "Registros de embarcações e lubrificantes salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      setEditingRegistroId(null);
      onSaveSuccess();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formEmbarcacao.organizacao && formEmbarcacao.ug && rmFornecimentoEmbarcacao && codugRmFornecimentoEmbarcacao && formEmbarcacao.dias_operacao > 0;
  const isItemValid = itemEmbarcacaoTemp.tipo_equipamento_especifico && itemEmbarcacaoTemp.quantidade > 0 && itemEmbarcacaoTemp.horas_dia > 0;
  const fuelBadgeClass = itemEmbarcacaoTemp.tipo_combustivel === 'DIESEL' 
    ? 'bg-cyan-600 text-white hover:bg-cyan-700' 
    : 'bg-amber-500 text-white hover:bg-amber-600';

  const displayFases = [...fasesAtividadeEmbarcacao, customFaseAtividadeEmbarcacao.trim()].filter(f => f).join(', ');

  return (
    <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosEmbarcacao(); }}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>OM Detentora do Equipamento *</Label>
            <OmSelector
              selectedOmId={formEmbarcacao.selectedOmId}
              onChange={handleOMEmbarcacaoChange}
              placeholder="Selecione a OM detentora..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>UG Detentora</Label>
            <Input value={formEmbarcacao.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rmFornecimentoEmbarcacao">RM de Fornecimento de Combustível *</Label>
            <RmSelector
              value={rmFornecimentoEmbarcacao}
              onChange={handleRMFornecimentoEmbarcacaoChange}
              placeholder="Selecione a RM de fornecimento..."
              disabled={!formEmbarcacao.organizacao || loading}
            />
          </div>

          <div className="space-y-2">
            <Label>CODUG da RM de Fornecimento</Label>
            <Input value={codugRmFornecimentoEmbarcacao} readOnly disabled onKeyDown={handleEnterToNextField} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Dias de Atividade *</Label>
            <Input
              type="number"
              min="1"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
              value={formEmbarcacao.dias_operacao || ""}
              onChange={(e) => setFormEmbarcacao({ ...formEmbarcacao, dias_operacao: parseInt(e.target.value) || 0 })}
              placeholder="Ex: 7"
              onKeyDown={handleEnterToNextField}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Fase da Atividade *</Label>
            <Popover open={isPopoverOpenEmbarcacao} onOpenChange={setIsPopoverOpenEmbarcacao}>
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
                        onSelect={() => handleFaseChange(fase, !fasesAtividadeEmbarcacao.includes(fase))}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>{fase}</span>
                        <Checkbox
                          checked={fasesAtividadeEmbarcacao.includes(fase)}
                          onCheckedChange={(checked) => handleFaseChange(fase, !!checked)}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <div className="p-2 border-t">
                    <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                    <Input
                      value={customFaseAtividadeEmbarcacao}
                      onChange={(e) => setCustomFaseAtividadeEmbarcacao(e.target.value)}
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

      {isFormValid && formEmbarcacao.dias_operacao > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6" ref={addEmbarcacaoRef}>
          <h3 className="text-lg font-semibold">2. Adicionar Embarcações</h3>
          
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label>Tipo de Embarcação *</Label>
              <Select 
                value={itemEmbarcacaoTemp.tipo_equipamento_especifico}
                onValueChange={handleTipoEmbarcacaoChange}
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
                value={itemEmbarcacaoTemp.quantidade === 0 ? "" : itemEmbarcacaoTemp.quantidade.toString()}
                onChange={(e) => setItemEmbarcacaoTemp({ ...itemEmbarcacaoTemp, quantidade: parseInt(e.target.value) || 0 })}
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
                value={itemEmbarcacaoTemp.horas_dia === 0 ? "" : itemEmbarcacaoTemp.horas_dia.toString()}
                onChange={(e) => setItemEmbarcacaoTemp({ ...itemEmbarcacaoTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                placeholder="Ex: 6"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border-t border-border">
            <div className="space-y-2">
              <Label>Consumo Lubrificante (L/h)</Label>
              <Input
                type="text"
                inputMode="decimal"
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={inputConsumoLubrificanteEmbarcacao}
                onChange={(e) => handleInputEmbarcacaoChange(e, setInputConsumoLubrificanteEmbarcacao, 'consumo_lubrificante_litro')}
                onBlur={(e) => handleInputEmbarcacaoBlur(e.target.value, setInputConsumoLubrificanteEmbarcacao, 2, 'consumo_lubrificante_litro')}
                placeholder="Ex: 0,05"
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
                value={inputPrecoLubrificanteEmbarcacao}
                onChange={(e) => handleInputEmbarcacaoChange(e, setInputPrecoLubrificanteEmbarcacao, 'preco_lubrificante')}
                onBlur={(e) => handleInputEmbarcacaoBlur(e.target.value, setInputPrecoLubrificanteEmbarcacao, 2, 'preco_lubrificante')}
                placeholder="Ex: 35,00"
                disabled={loading}
                onKeyDown={handleEnterToNextField}
              />
            </div>
            
            <div className="space-y-2">
              <Label>OM Destino Recurso (ND 30) *</Label>
              <OmSelector
                selectedOmId={selectedOmLubrificanteId}
                onChange={handleOMLubrificanteEmbarcacaoChange}
                placeholder="Selecione a OM de destino..."
                disabled={!formEmbarcacao.organizacao || loading}
              />
              <p className="text-xs text-muted-foreground">OM que receberá o recurso de lubrificante.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              type="button" 
              onClick={adicionarOuAtualizarItemEmbarcacao} 
              className="w-full md:w-auto" 
              disabled={loading || !isItemValid}
            >
              {editingEmbarcacaoItemIndex !== null ? "Atualizar Item" : "Adicionar"}
            </Button>
          </div>

          {itemEmbarcacaoTemp.consumo_fixo > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="default" className={fuelBadgeClass}>
                Combustível: {itemEmbarcacaoTemp.tipo_combustivel} ({formatNumber(itemEmbarcacaoTemp.consumo_fixo, 1)} L/h)
              </Badge>
              {itemEmbarcacaoTemp.consumo_lubrificante_litro > 0 && (
                <Badge variant="default" className="bg-purple-600 text-white hover:bg-purple-700">
                  Lubrificante: {formatNumber(itemEmbarcacaoTemp.consumo_lubrificante_litro, 2)} L/h @ {formatCurrency(itemEmbarcacaoTemp.preco_lubrificante)}
                </Badge>
              )}
            </div>
          )}
          {editingEmbarcacaoItemIndex !== null && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEditEmbarcacaoItem}
              className="mt-2"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Edição do Item
            </Button>
          )}
        </div>
      )}

      {formEmbarcacao.itens.length > 0 && (
        <div className="space-y-4 mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold">3. Embarcações Configuradas</h3>
          
          <div className="space-y-2">
            {formEmbarcacao.itens.map((item, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantidade} unidade(s) • {formatNumber(item.horas_dia, 1)}h/dia • {formatNumber(item.consumo_fixo, 1)} L/h • {item.tipo_combustivel}
                      {item.consumo_lubrificante_litro > 0 && ` • Lub: ${formatNumber(item.consumo_lubrificante_litro, 2)} L/h`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditEmbarcacaoItem(item, index)}
                      disabled={loading}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerItemEmbarcacao(index)}
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
                  <h4 className="font-medium text-lg text-primary flex items-center gap-2">
                    <Droplet className="h-5 w-5 text-purple-600" />
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
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Edição
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading || !isFormValid || formEmbarcacao.itens.length === 0 || (consolidadoLubrificante && (!omLubrificante || !ugLubrificante))}
            >
              {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosCombustivel.length + (consolidadoLubrificante ? 1 : 0)} registros)
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};