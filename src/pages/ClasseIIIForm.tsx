import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, AlertCircle, XCircle, ChevronDown, ChevronUp, Sparkles, ClipboardList, Check } from "lucide-react"; // Adicionado Sparkles, ClipboardList e Check
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC, RefLPCForm } from "@/types/refLPC";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils"; // Importar a nova função
import { formatCurrency, formatNumber } from "@/lib/formatUtils"; // Importar formatCurrency e formatNumber
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Adicionado importação do Dialog

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: TipoEquipamento;
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
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string;
  itens_equipamentos?: any;
  total_litros_sem_margem?: number;
  fase_atividade?: string;
}

interface FormData {
  selectedOmId?: string; // Novo campo para o ID da OM selecionada
  organizacao: string;
  ug: string;
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia?: number;
  km_dia?: number;
  dias_operacao: number;
  tipo_combustivel: string;
  consumo_fixo: number;
  preco_litro: number;
}

interface ItemGerador {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
}

interface FormDataGerador {
  selectedOmId?: string; // Novo campo para o ID da OM selecionada
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemGerador[];
  fase_atividade?: string;
}

interface ConsolidadoGerador {
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemGerador[];
  detalhamento: string;
}

interface ItemViatura {
  tipo_equipamento_especifico: string;
  quantidade: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  consumo_fixo: number;
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
}

interface FormDataViatura {
  selectedOmId?: string; // Novo campo para o ID da OM selecionada
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemViatura[];
  fase_atividade?: string;
}

interface ConsolidadoViatura {
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemViatura[];
  detalhamento: string;
}

interface ItemEmbarcacao {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
}

interface FormDataEmbarcacao {
  selectedOmId?: string; // Novo campo para o ID da OM selecionada
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemEmbarcacao[];
  fase_atividade?: string;
}

interface ConsolidadoEmbarcacao {
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemEmbarcacao[];
  detalhamento: string;
}

export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoEquipamento | null>(null);
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<TipoEquipamentoDetalhado[]>([]);
  
  // Estados para edição de memória de cálculo
  const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
  const [memoriaEdit, setMemoriaEdit] = useState<string>("");
  
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [formLPC, setFormLPC] = useState<RefLPCForm>({
    data_inicio_consulta: "",
    data_fim_consulta: "",
    ambito: "Nacional",
    nome_local: "",
    preco_diesel: 0,
    preco_gasolina: 0,
  });
  const [isLPCFormExpanded, setIsLPCFormExpanded] = useState(false);

  const lpcRef = useRef<HTMLDivElement>(null);
  const addGeradorRef = useRef<HTMLDivElement>(null);
  const addViaturaRef = useRef<HTMLDivElement>(null);
  const { handleEnterToNextField } = useFormNavigation();
  
  // Estados para Fase da Atividade - Gerador
  const [fasesAtividadeGerador, setFasesAtividadeGerador] = useState<string[]>(["Execução"]);
  const [customFaseAtividadeGerador, setCustomFaseAtividadeGerador] = useState<string>("");
  const [isPopoverOpenGerador, setIsPopoverOpenGerador] = useState(false);

  // Estados para Fase da Atividade - Viatura
  const [fasesAtividadeViatura, setFasesAtividadeViatura] = useState<string[]>(["Execução"]);
  const [customFaseAtividadeViatura, setCustomFaseAtividadeViatura] = useState<string>("");
  const [isPopoverOpenViatura, setIsPopoverOpenViatura] = useState(false);

  // Estados para Fase da Atividade - Embarcação
  const [fasesAtividadeEmbarcacao, setFasesAtividadeEmbarcacao] = useState<string[]>(["Execução"]);
  const [customFaseAtividadeEmbarcacao, setCustomFaseAtividadeEmbarcacao] = useState<string>("");
  const [isPopoverOpenEmbarcacao, setIsPopoverOpenEmbarcacao] = useState(false);

  // Handlers para mudança de fase - Gerador
  const handleFaseChangeGerador = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeGerador([...fasesAtividadeGerador, fase]);
    } else {
      setFasesAtividadeGerador(fasesAtividadeGerador.filter(f => f !== fase));
    }
  };

  // Handlers para mudança de fase - Viatura
  const handleFaseChangeViatura = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeViatura([...fasesAtividadeViatura, fase]);
    } else {
      setFasesAtividadeViatura(fasesAtividadeViatura.filter(f => f !== fase));
    }
  };

  // Handlers para mudança de fase - Embarcação
  const handleFaseChangeEmbarcacao = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeEmbarcacao([...fasesAtividadeEmbarcacao, fase]);
    } else {
      setFasesAtividadeEmbarcacao(fasesAtividadeEmbarcacao.filter(f => f !== fase));
    }
  };
  
  const [formData, setFormData] = useState<FormData>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    tipo_equipamento_especifico: "",
    quantidade: 1,
    dias_operacao: 1,
    tipo_combustivel: "DIESEL",
    consumo_fixo: 0,
    preco_litro: 0,
  });

  const [rmFornecimento, setRmFornecimento] = useState<string>(""); // Novo estado para o nome da RM fornecedora
  const [codugRmFornecimento, setCodugRmFornecimento] = useState<string>(""); // Novo estado para o CODUG da RM fornecedora

  const [calculoPreview, setCalculoPreview] = useState({
    consumo_hora: 0,
    total_litros: 0,
    valor_total: 0,
    detalhamento: "",
  });

  const [formGerador, setFormGerador] = useState<FormDataGerador>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });

  const [itemGeradorTemp, setItemGeradorTemp] = useState({
    tipo_equipamento_especifico: "",
    quantidade: 0, // Alterado para 0
    horas_dia: 0, // Alterado para 0
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL" as 'GASOLINA' | 'DIESEL',
  });
  const [editingGeradorItemIndex, setEditingGeradorItemIndex] = useState<number | null>(null);

  const [consolidadosGerador, setConsolidadosGerador] = useState<ConsolidadoGerador[]>([]);

  const [formViatura, setFormViatura] = useState<FormDataViatura>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });

  const [itemViaturaTemp, setItemViaturaTemp] = useState({
    tipo_equipamento_especifico: "",
    quantidade: 0, // Alterado para 0
    distancia_percorrida: 0,
    quantidade_deslocamentos: 0, // Alterado para 0
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL" as 'GASOLINA' | 'DIESEL',
  });
  const [editingViaturaItemIndex, setEditingViaturaItemIndex] = useState<number | null>(null);

  const [consolidadosViatura, setConsolidadosViatura] = useState<ConsolidadoViatura[]>([]);

  const [formEmbarcacao, setFormEmbarcacao] = useState<FormDataEmbarcacao>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });

  const [itemEmbarcacaoTemp, setItemEmbarcacaoTemp] = useState({
    tipo_equipamento_especifico: "",
    quantidade: 0, // Alterado para 0
    horas_dia: 0, // Alterado para 0
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL" as 'GASOLINA' | 'DIESEL',
  });

  const [editingEmbarcacaoItemIndex, setEditingEmbarcacaoItemIndex] = useState<number | null>(null);
  const [consolidadosEmbarcacao, setConsolidadosEmbarcacao] = useState<ConsolidadoEmbarcacao[]>([]);
  const addEmbarcacaoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ptrabId) {
      toast.error("ID do PTrab não encontrado");
      navigate("/ptrab");
      return;
    }
    loadRefLPC();
    fetchRegistros();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ptrabId]);

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
        setFormLPC({
          data_inicio_consulta: data.data_inicio_consulta,
          data_fim_consulta: data.data_fim_consulta,
          ambito: data.ambito as 'Nacional' | 'Estadual' | 'Municipal',
          nome_local: data.nome_local || "",
          preco_diesel: data.preco_diesel,
          preco_gasolina: data.preco_gasolina,
        });
        setIsLPCFormExpanded(false);
      } else {
        setRefLPC(null);
        setIsLPCFormExpanded(true);
      }
    } catch (error: any) {
      console.error("Erro ao carregar referência LPC:", error);
      setRefLPC(null);
      setIsLPCFormExpanded(true);
    }
  };

  const handleSalvarRefLPC = async () => {
    try {
      if (!formLPC.data_inicio_consulta || !formLPC.data_fim_consulta) {
        toast.error("Preencha as datas de início e fim da consulta");
        return;
      }

      if (formLPC.ambito !== 'Nacional' && !formLPC.nome_local) {
        toast.error(`Preencha o nome do ${formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'}`);
        return;
      }

      if (formLPC.preco_diesel <= 0 || formLPC.preco_gasolina <= 0) {
        toast.error("Os preços devem ser maiores que zero");
        return;
      }

      const dataToSave = {
        p_trab_id: ptrabId!,
        ...formLPC,
      };

      if (refLPC) {
        const { error } = await supabase
          .from("p_trab_ref_lpc")
          .update(dataToSave)
          .eq("id", refLPC.id);

        if (error) throw error;
        toast.success("Referência LPC atualizada!");
      } else {
        const { data, error } = await supabase
          .from("p_trab_ref_lpc")
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;
        setRefLPC(data as RefLPC);
        toast.success("Referência LPC salva!");
      }

      loadRefLPC();
      setIsLPCFormExpanded(false);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    }
  };

  useEffect(() => {
    calcularTotais();
  }, [formData, tipoSelecionado]);

  useEffect(() => {
    if (tipoSelecionado) {
      carregarEquipamentos();
    }
  }, [tipoSelecionado]);

  useEffect(() => {
    if (tipoSelecionado === 'GERADOR' && formGerador.itens.length > 0) {
      calcularConsolidadosGerador(formGerador.itens);
    }
  }, [formGerador.dias_operacao, refLPC, formGerador.itens, rmFornecimento, codugRmFornecimento]);

  useEffect(() => {
    if (tipoSelecionado === 'MOTOMECANIZACAO' && formViatura.itens.length > 0) {
      calcularConsolidadosViatura(formViatura.itens);
    }
  }, [formViatura.dias_operacao, refLPC, formViatura.itens, rmFornecimento, codugRmFornecimento]);

  useEffect(() => {
    if (tipoSelecionado === 'EMBARCACAO' && formEmbarcacao.itens.length > 0) {
      calcularConsolidadosEmbarcacao(formEmbarcacao.itens);
    }
  }, [formEmbarcacao.dias_operacao, refLPC, formEmbarcacao.itens, rmFornecimento, codugRmFornecimento]);

  const carregarEquipamentos = async () => {
    if (!tipoSelecionado) return;
    const equipamentos = await getEquipamentosPorTipo(tipoSelecionado);
    setEquipamentosDisponiveis(equipamentos);
  };
  
  const handleTipoEspecificoChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      const novoPreco = novoCombustivel === 'DIESEL' 
        ? (refLPC?.preco_diesel ?? 0)
        : (refLPC?.preco_gasolina ?? 0);

      setFormData({
        ...formData,
        tipo_equipamento_especifico: tipoNome,
        tipo_combustivel: novoCombustivel,
        consumo_fixo: equipamento.consumo,
        preco_litro: novoPreco,
      });
    }
  };

  const fetchRegistros = async () => {
    if (!ptrabId) return;
    
    const { data, error } = await supabase
      .from("classe_iii_registros")
      .select("*, detalhamento_customizado")
      .eq("p_trab_id", ptrabId)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar registros");
      console.error(error);
      return;
    }

    setRegistros((data || []) as ClasseIIIRegistro[]);
  };

  // Funções de gerenciamento de memória customizada
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
        })
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
    setLoading(true);
    try {
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Memória de cálculo restaurada para o padrão automático!");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  // Função para formatar as fases de forma natural no texto
  const formatFasesParaTexto = (faseCSV: string | undefined): string => {
    if (!faseCSV) return 'operação';
    
    const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
    
    if (fases.length === 0) return 'operação';
    
    // Ordenar as fases de acordo com a ordem padrão FASES_PADRAO
    const fasesOrdenadas = fases.sort((a, b) => {
      const indexA = FASES_PADRAO.indexOf(a);
      const indexB = FASES_PADRAO.indexOf(b);
      
      // Se a fase não está em FASES_PADRAO (fase customizada), coloca no final
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      
      return indexA - indexB;
    });
    
    if (fasesOrdenadas.length === 1) return fasesOrdenadas[0];
    if (fasesOrdenadas.length === 2) return `${fasesOrdenadas[0]} e ${fasesOrdenadas[1]}`;
    
    // 3 ou mais fases: "Fase1, Fase2 e Fase3"
    const ultimaFase = fasesOrdenadas[fasesOrdenadas.length - 1];
    const demaisFases = fasesOrdenadas.slice(0, -1).join(', ');
    return `${demaisFases} e ${ultimaFase}`;
  };

  const gerarMemoriaCalculo = (): string => {
    if (!refLPC || !formData.tipo_equipamento_especifico || !rmFornecimento) return "";

    const combustivelLabel = formData.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel';
    const tipoEquipLabel = getTipoLabel(tipoSelecionado!);
    
    const formatarData = (data: string) => {
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    };

    const dataInicioFormatada = formatarData(refLPC.data_inicio_consulta);
    const dataFimFormatada = formatarData(refLPC.data_fim_consulta);
    
    const localConsulta = refLPC.ambito === 'Nacional' 
      ? '' 
      : refLPC.nome_local ? `(${refLPC.nome_local})` : '';

    let litrosSem30 = 0;
    let formulaDetalhada = "";
    let calculoPasso = "";

    if (tipoSelecionado === 'MOTOMECANIZACAO') {
      if (formData.km_dia) {
        const litros_dia = formData.km_dia / formData.consumo_fixo;
        litrosSem30 = formData.quantidade * litros_dia * formData.dias_operacao;
        formulaDetalhada = `(Nr Viaturas x Nr Km percorridos/dia ÷ Consumo km/L) x Nr dias de operação.`;
        calculoPasso = `- (${formData.quantidade} ${formData.tipo_equipamento_especifico} x ${formatNumber(formData.km_dia)} km/dia ÷ ${formatNumber(formData.consumo_fixo, 1)} km/L) x ${formData.dias_operacao} dias = ${formatNumber(litrosSem30)} L ${combustivelLabel}.`;
      }
    } else {
      if (formData.horas_dia) {
        litrosSem30 = formData.quantidade * formData.consumo_fixo * formData.horas_dia * formData.dias_operacao;
        const unidadeEquip = tipoSelecionado === 'GERADOR' ? 'Geradores' : 
                            tipoSelecionado === 'EMBARCACAO' ? 'Embarcações' : 
                            'Equipamentos';
        formulaDetalhada = `(Nr ${unidadeEquip} x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.`;
        calculoPasso = `- (${formData.quantidade} ${formData.tipo_equipamento_especifico} x ${formatNumber(formData.horas_dia, 1)} horas/dia x ${formatNumber(formData.consumo_fixo, 1)} L/h) x ${formData.dias_operacao} dias = ${formatNumber(litrosSem30)} L ${combustivelLabel}.`;
      }
    }

    const litrosCom30 = litrosSem30 * 1.3;
    const valorTotal = litrosCom30 * formData.preco_litro;
    const precoFormatado = formatCurrency(formData.preco_litro);
    const valorFormatado = formatCurrency(valorTotal);

    const unidadeMedida = tipoSelecionado === 'MOTOMECANIZACAO' ? 'km/L' : 'L/h';
    const contextoOperacao = "operação";

    return `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${formData.quantidade} ${formData.tipo_equipamento_especifico}, durante ${formData.dias_operacao} dias de ${contextoOperacao}, para ${formData.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Cálculo:
- ${formData.tipo_equipamento_especifico}: ${formatNumber(formData.consumo_fixo, 1)} ${unidadeMedida}.
- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${precoFormatado}.

Fórmula: ${formulaDetalhada}
${calculoPasso}

Total: ${formatNumber(litrosSem30)} L ${combustivelLabel} + 30% = ${formatNumber(litrosCom30)} L ${combustivelLabel}.
Valor: ${formatNumber(litrosCom30)} L ${combustivelLabel} x ${precoFormatado} = ${valorFormatado}.`;
  };

  const calcularTotais = () => {
    if (!tipoSelecionado || !formData.consumo_fixo) return;

    let litrosSem30 = 0;
    let detalhamento = "";

    if (tipoSelecionado === 'MOTOMECANIZACAO') {
      if (formData.km_dia) {
        litrosSem30 = formData.quantidade * (formData.km_dia / formData.consumo_fixo) * formData.dias_operacao;
      }
    } else {
      if (formData.horas_dia) {
        litrosSem30 = formData.quantidade * formData.consumo_fixo * formData.horas_dia * formData.dias_operacao;
      }
    }

    const total_litros = litrosSem30 * 1.3;
    const valor_total = total_litros * formData.preco_litro;

    const combustivelLabel = formData.tipo_combustivel === 'GASOLINA' ? 'Gas' : 'OD';
    detalhamento = `Total base: ${formatNumber(litrosSem30)} L\nTotal com 30%: ${formatNumber(total_litros)} L ${combustivelLabel}\nValor: ${formatCurrency(valor_total)}`;

    setCalculoPreview({
      consumo_hora: tipoSelecionado !== 'MOTOMECANIZACAO' ? formData.consumo_fixo : 0,
      total_litros,
      valor_total,
      detalhamento,
    });
  };

  const handleOMChange = async (omData: OMData | undefined) => {
    if (omData) {
      setFormData({
        ...formData,
        selectedOmId: omData.id,
        organizacao: omData.nome_om,
        ug: omData.codug_om,
      });
      // Define a RM de vinculação da OM como padrão para a RM fornecedora
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormData({
        ...formData,
        selectedOmId: undefined,
        organizacao: "",
        ug: "",
      });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };

  const handleRMFornecimentoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimento(rmName);
    setCodugRmFornecimento(rmCodug);
  };

  const resetFormFields = () => {
    setEditingId(null);
    setFormData({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      tipo_equipamento_especifico: "",
      quantidade: 1,
      dias_operacao: 1,
      tipo_combustivel: "DIESEL",
      consumo_fixo: 0,
      preco_litro: refLPC?.preco_diesel ?? 0,
    });
    setRmFornecimento("");
    setCodugRmFornecimento("");
    setCalculoPreview({
      consumo_hora: 0,
      total_litros: 0,
      valor_total: 0,
      detalhamento: "",
    });
    setFormGerador({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setItemGeradorTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingGeradorItemIndex(null);
    setConsolidadosGerador([]);
    setFormViatura({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setItemViaturaTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      distancia_percorrida: 0,
      quantidade_deslocamentos: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingViaturaItemIndex(null);
    setConsolidadosViatura([]);
    setFormEmbarcacao({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setItemEmbarcacaoTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setConsolidadosEmbarcacao([]);
    setEditingEmbarcacaoItemIndex(null);
    
    // Reset fases
    setFasesAtividadeGerador(["Execução"]);
    setCustomFaseAtividadeGerador("");
    setFasesAtividadeViatura(["Execução"]);
    setCustomFaseAtividadeViatura("");
    setFasesAtividadeEmbarcacao(["Execução"]);
    setCustomFaseAtividadeEmbarcacao("");
  };

  const handleCancelEdit = () => {
    resetFormFields();
    setTipoSelecionado(null);
  };

  const handleSalvar = async () => {
    if (!ptrabId || !tipoSelecionado) return;

    if (!formData.organizacao || !formData.ug || !formData.tipo_equipamento_especifico) {
      toast.error("Preencha OM, UG e Tipo de Equipamento");
      return;
    }

    if (tipoSelecionado === 'MOTOMECANIZACAO') {
      if (!formData.km_dia) {
        toast.error("Preencha km/dia");
        return;
      }
    } else {
      if (!formData.horas_dia) {
        toast.error("Preencha horas/dia");
        return;
      }
    }

    if (!refLPC) {
      toast.error("Configure a referência LPC antes de salvar");
      if (lpcRef.current) {
        lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (!rmFornecimento || !codugRmFornecimento) {
      toast.error("Selecione a RM de Fornecimento de Combustível");
      return;
    }

    try {
      setLoading(true);
      const memoriaCalculo = gerarMemoriaCalculo();
      
      const registro = {
        p_trab_id: ptrabId,
        tipo_equipamento: tipoSelecionado,
        tipo_equipamento_detalhe: formData.tipo_equipamento_especifico,
        organizacao: formData.organizacao,
        ug: formData.ug,
        quantidade: formData.quantidade,
        potencia_hp: null,
        horas_dia: formData.horas_dia ?? null,
        km_dia: formData.km_dia ?? null,
        consumo_km_litro: tipoSelecionado === 'MOTOMECANIZACAO' ? formData.consumo_fixo : null,
        dias_operacao: formData.dias_operacao,
        tipo_combustivel: formData.tipo_combustivel,
        preco_litro: formData.preco_litro,
        consumo_hora: tipoSelecionado !== 'MOTOMECANIZACAO' ? formData.consumo_fixo : null,
        total_litros: calculoPreview.total_litros,
        valor_total: calculoPreview.valor_total,
        detalhamento: memoriaCalculo,
      };

      if (editingId) {
        const { error } = await supabase
          .from("classe_iii_registros")
          .update(registro)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Registro atualizado!");
      } else {
        const { error } = await supabase
          .from("classe_iii_registros")
          .insert([registro]);

        if (error) throw error;
        toast.success("Registro salvo!");
      }

      // Atualiza o status do PTrab para 'em_andamento' se estiver 'aberto'
      await updatePTrabStatusIfAberto(ptrabId);

      resetFormFields();
      setTipoSelecionado(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar registro");
    } finally {
      setLoading(false);
    }
  };

  const handleEditar = async (registro: ClasseIIIRegistro) => {
    resetFormFields();
    setEditingId(registro.id);
    setTipoSelecionado(registro.tipo_equipamento);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let defaultRmName = "";
    let defaultRmCodug = "";
    let selectedOmIdForEdit: string | undefined = undefined;

    if (registro.organizacao) {
      try {
        const { data: omData, error: omError } = await supabase
          .from('organizacoes_militares')
          .select('id, rm_vinculacao, codug_rm_vinculacao')
          .eq('nome_om', registro.organizacao)
          .eq('codug_om', registro.ug) // Adicionado para buscar a OM específica
          .single();
        if (omData && !omError) {
          selectedOmIdForEdit = omData.id;
          defaultRmName = omData.rm_vinculacao;
          defaultRmCodug = omData.codug_rm_vinculacao;
        }
      } catch (error) {
        console.error("Erro ao buscar OM para edição:", error);
      }
    }

    const rmMatch = registro.detalhamento?.match(/Fornecido por: (.*?) \(CODUG: (.*?)\)/);
    if (rmMatch) {
      setRmFornecimento(rmMatch[1]);
      setCodugRmFornecimento(rmMatch[2]);
    } else {
      setRmFornecimento(defaultRmName);
      setCodugRmFornecimento(defaultRmCodug);
    }

    if (registro.tipo_equipamento === 'GERADOR') {
      setFormGerador({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemGerador[]) || [],
      });
    } else if (registro.tipo_equipamento === 'MOTOMECANIZACAO') {
      setFormViatura({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemViatura[]) || [],
      });
    } else if (registro.tipo_equipamento === 'EMBARCACAO') {
      setFormEmbarcacao({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemEmbarcacao[]) || [],
      });
    } else {
      const equipamentoDetalhado = equipamentosDisponiveis.find(eq => eq.nome === registro.tipo_equipamento_detalhe);
      const consumo_fixo = equipamentoDetalhado ? equipamentoDetalhado.consumo : 0;

      setFormData({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        tipo_equipamento_especifico: registro.tipo_equipamento_detalhe || "",
        quantidade: registro.quantidade,
        horas_dia: registro.horas_dia ?? undefined,
        km_dia: registro.km_dia ?? undefined,
        dias_operacao: registro.dias_operacao,
        tipo_combustivel: registro.tipo_combustivel,
        consumo_fixo: consumo_fixo,
        preco_litro: registro.preco_litro,
      });
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Deseja realmente deletar este registro?")) return;

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

  const getTipoLabel = (tipo: TipoEquipamento) => {
    switch (tipo) {
      case 'GERADOR': return 'Gerador';
      case 'EMBARCACAO': return 'Embarcação';
      case 'EQUIPAMENTO_ENGENHARIA': return 'Equipamento de Engenharia';
      case 'MOTOMECANIZACAO': return 'Motomecanização';
    }
  };

  // Handler para mudança de OM (Embarcação)
  const handleOMEmbarcacaoChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormEmbarcacao({
        ...formEmbarcacao,
        selectedOmId: omData.id,
        organizacao: omData.nome_om,
        ug: omData.codug_om,
      });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormEmbarcacao({
        ...formEmbarcacao,
        selectedOmId: undefined,
        organizacao: "",
        ug: "",
      });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };

  // Handler para mudança de tipo de embarcação
  const handleTipoEmbarcacaoChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const combustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemEmbarcacaoTemp({
        ...itemEmbarcacaoTemp,
        tipo_equipamento_especifico: tipoNome,
        consumo_fixo: equipamento.consumo,
        tipo_combustivel: combustivel as 'GASOLINA' | 'DIESEL',
      });
    }
  };

  // Adicionar ou atualizar item de embarcação
  const adicionarOuAtualizarItemEmbarcacao = () => {
    if (!itemEmbarcacaoTemp.tipo_equipamento_especifico || itemEmbarcacaoTemp.quantidade <= 0 || itemEmbarcacaoTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos obrigatórios do item");
      return;
    }

    const novoItem: ItemEmbarcacao = { ...itemEmbarcacaoTemp };

    if (editingEmbarcacaoItemIndex !== null) {
      const novosItens = [...formEmbarcacao.itens];
      novosItens[editingEmbarcacaoItemIndex] = novoItem;
      setFormEmbarcacao({ ...formEmbarcacao, itens: novosItens });
      toast.success("Item atualizado!");
      setEditingEmbarcacaoItemIndex(null);
    } else {
      setFormEmbarcacao({ ...formEmbarcacao, itens: [...formEmbarcacao.itens, novoItem] });
      toast.success("Item adicionado!");
    }

    setItemEmbarcacaoTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });

    setTimeout(() => {
      addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Remover item de embarcação
  const removerItemEmbarcacao = (index: number) => {
    const novosItens = formEmbarcacao.itens.filter((_, i) => i !== index);
    setFormEmbarcacao({ ...formEmbarcacao, itens: novosItens });
    toast.success("Item removido!");
  };

  // Editar item de embarcação
  const handleEditEmbarcacaoItem = (item: ItemEmbarcacao, index: number) => {
    setItemEmbarcacaoTemp({ ...item });
    setEditingEmbarcacaoItemIndex(index);
    setTimeout(() => {
      addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Cancelar edição de item de embarcação
  const handleCancelEditEmbarcacaoItem = () => {
    setItemEmbarcacaoTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingEmbarcacaoItemIndex(null);
  };

  // Calcular consolidados de embarcação
  const calcularConsolidadosEmbarcacao = (itens: ItemEmbarcacao[]) => {
    if (!refLPC || !formEmbarcacao.organizacao || !rmFornecimento) {
      setConsolidadosEmbarcacao([]);
      return;
    }

    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (!grupos[item.tipo_combustivel]) {
        grupos[item.tipo_combustivel] = [];
      }
      grupos[item.tipo_combustivel].push(item);
      return grupos;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemEmbarcacao[]>);

    const novosConsolidados: ConsolidadoEmbarcacao[] = [];

    Object.entries(gruposPorCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as 'GASOLINA' | 'DIESEL';
      const precoLitro = tipoCombustivel === 'GASOLINA' ? refLPC.preco_gasolina : refLPC.preco_diesel;
      
      let totalLitrosSemMargem = 0;
      // Construir string de fases da mesma forma que no salvamento
      let fasesFinaisCalc = [...fasesAtividadeEmbarcacao];
      if (customFaseAtividadeEmbarcacao.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEmbarcacao.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      let detalhamento = `33.90.30 - Aquisição de Combustível (${tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}) para Embarcações, durante ${formEmbarcacao.dias_operacao} dias de ${faseFormatada}, para ${formEmbarcacao.organizacao}.\nFornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})\n\nCálculo:\n`;

      itensGrupo.forEach(item => {
        const litrosSemMargemItem = item.quantidade * item.consumo_fixo * item.horas_dia * formEmbarcacao.dias_operacao;
        totalLitrosSemMargem += litrosSemMargemItem;
        detalhamento += `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.\n`;
        detalhamento += `  (${item.quantidade} embarcações x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formEmbarcacao.dias_operacao} dias = ${formatNumber(litrosSemMargemItem)} L.\n`;
      });

      const totalLitros = totalLitrosSemMargem * 1.3;
      const valorTotal = totalLitros * precoLitro;
      
      const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      };
      const dataInicioFormatada = formatarData(refLPC.data_inicio_consulta);
      const dataFimFormatada = formatarData(refLPC.data_fim_consulta);
      const localConsulta = refLPC.ambito === 'Nacional' ? '' : refLPC.nome_local ? `(${refLPC.nome_local})` : '';
      
      detalhamento += `\n- Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'} - ${formatCurrency(precoLitro)}.\n\n`;
      detalhamento += `Total: ${formatNumber(totalLitrosSemMargem)} L + 30% = ${formatNumber(totalLitros)} L ${tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}.\n`;
      detalhamento += `Valor: ${formatNumber(totalLitros)} L x ${formatCurrency(precoLitro)} = ${formatCurrency(valorTotal)}.`;

      novosConsolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });

    setConsolidadosEmbarcacao(novosConsolidados);
  };

  // Salvar registros consolidados de embarcação
  const salvarRegistrosConsolidadosEmbarcacao = async () => {
    if (!ptrabId || !formEmbarcacao.organizacao || !formEmbarcacao.ug || consolidadosEmbarcacao.length === 0) {
      toast.error("Preencha todos os dados obrigatórios e adicione embarcações");
      return;
    }

    if (!rmFornecimento || !codugRmFornecimento) {
      toast.error("Selecione a RM de fornecimento de combustível");
      return;
    }

    // Construir string de fases
    let fasesFinais = [...fasesAtividadeEmbarcacao];
    if (customFaseAtividadeEmbarcacao.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividadeEmbarcacao.trim()];
    }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }

    setLoading(true);

    try {
      for (const consolidado of consolidadosEmbarcacao) {
        const precoLitro = consolidado.tipo_combustivel === 'GASOLINA' 
          ? refLPC!.preco_gasolina 
          : refLPC!.preco_diesel;

        const registro = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'EMBARCACAO' as TipoEquipamento,
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
        };

        const { error } = await supabase
          .from("classe_iii_registros")
          .insert([registro]);

        if (error) throw error;
      }

      toast.success(`${consolidadosEmbarcacao.length} ${consolidadosEmbarcacao.length === 1 ? 'registro salvo' : 'registros salvos'} com sucesso!`);
      
      await updatePTrabStatusIfAberto(ptrabId);
      
      setFormEmbarcacao({
        selectedOmId: undefined,
        organizacao: "",
        ug: "",
        dias_operacao: 1,
        itens: [],
      });
      setItemEmbarcacaoTemp({
        tipo_equipamento_especifico: "",
        quantidade: 0, // Alterado para 0
        horas_dia: 0, // Alterado para 0
        consumo_fixo: 0,
        tipo_combustivel: "DIESEL",
      });
      setConsolidadosEmbarcacao([]);
      setRmFornecimento("");
      setCodugRmFornecimento("");
      setTipoSelecionado(null);
      
      await fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEquipmentType = (type: TipoEquipamento) => {
    if (!refLPC) {
      toast.error("Configure a referência LPC antes de adicionar equipamentos.");
      if (lpcRef.current) {
        lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    resetFormFields();
    setTipoSelecionado(type);
  };

  const handleOMGeradorChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormGerador({
        ...formGerador,
        selectedOmId: omData.id,
        organizacao: omData.nome_om,
        ug: omData.codug_om,
      });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormGerador({
        ...formGerador,
        selectedOmId: undefined,
        organizacao: "",
        ug: "",
      });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
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
      });
    }
  };

  const adicionarOuAtualizarItemGerador = () => {
    if (!itemGeradorTemp.tipo_equipamento_especifico || itemGeradorTemp.quantidade <= 0 || itemGeradorTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }

    const novoItem: ItemGerador = {
      tipo_equipamento_especifico: itemGeradorTemp.tipo_equipamento_especifico,
      quantidade: itemGeradorTemp.quantidade,
      horas_dia: itemGeradorTemp.horas_dia,
      consumo_fixo: itemGeradorTemp.consumo_fixo,
      tipo_combustivel: itemGeradorTemp.tipo_combustivel,
    };

    let novosItens = [...formGerador.itens];
    if (editingGeradorItemIndex !== null) {
      novosItens[editingGeradorItemIndex] = novoItem;
      toast.success("Item de gerador atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de gerador adicionado!");
    }

    setFormGerador({
      ...formGerador,
      itens: novosItens,
    });

    setItemGeradorTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingGeradorItemIndex(null);
  };

  const handleEditGeradorItem = (item: ItemGerador, index: number) => {
    setItemGeradorTemp(item);
    setEditingGeradorItemIndex(index);
    if (addGeradorRef.current) {
      addGeradorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCancelEditGeradorItem = () => {
    setItemGeradorTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      horas_dia: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingGeradorItemIndex(null);
  };

  const removerItemGerador = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formGerador.itens.filter((_, i) => i !== index);
    setFormGerador({
      ...formGerador,
      itens: novosItens,
    });
    if (editingGeradorItemIndex === index) {
      handleCancelEditGeradorItem();
    }
    toast.success("Item de gerador removido!");
  };

  const calcularConsolidadosGerador = (itens: ItemGerador[]) => {
    if (itens.length === 0) {
      setConsolidadosGerador([]);
      return;
    }

    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) {
        acc[item.tipo_combustivel] = [];
      }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemGerador[]>);

    const consolidados: ConsolidadoGerador[] = [];

    Object.entries(grupos).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as 'GASOLINA' | 'DIESEL';
      
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];

      itensGrupo.forEach(item => {
        const litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * formGerador.dias_operacao;
        totalLitrosSemMargem += litrosItem;
        
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- (${item.quantidade} ${item.tipo_equipamento_especifico} x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formGerador.dias_operacao} dias = ${formatNumber(litrosItem)} L ${unidade}.`);
      });

      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;

      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      
      const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      };

      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';

      const totalGeradores = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);

      // Construir string de fases da mesma forma que no salvamento
      let fasesFinaisCalc = [...fasesAtividadeGerador];
      if (customFaseAtividadeGerador.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeGerador.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      const detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalGeradores} geradores, durante ${formGerador.dias_operacao} dias de ${faseFormatada}, para ${formGerador.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Nr Geradores x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(preco)} = ${formatCurrency(valorTotal)}.`;

      consolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });

    setConsolidadosGerador(consolidados);
  };

  const salvarRegistrosConsolidadosGerador = async () => {
    if (!ptrabId || consolidadosGerador.length === 0) return;

    if (!refLPC) {
      toast.error("Configure a referência LPC antes de salvar");
      if (lpcRef.current) {
        lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (!formGerador.organizacao || !formGerador.ug) {
      toast.error("Selecione uma OM");
      return;
    }

    if (!rmFornecimento || !codugRmFornecimento) {
      toast.error("Selecione a RM de Fornecimento de Combustível");
      return;
    }

    if (formGerador.itens.length === 0) {
      toast.error("Adicione pelo menos um gerador");
      return;
    }

    // Construir string de fases
    let fasesFinais = [...fasesAtividadeGerador];
    if (customFaseAtividadeGerador.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividadeGerador.trim()];
    }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        const { error: deleteError } = await supabase
          .from("classe_iii_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("tipo_equipamento", "GERADOR")
          .eq("organizacao", formGerador.organizacao)
          .eq("ug", formGerador.ug);

        if (deleteError) {
          console.error("Erro ao deletar registros existentes de gerador para edição:", deleteError);
          throw deleteError;
        }
      }

      for (const consolidado of consolidadosGerador) {
        const registro = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'GERADOR' as TipoEquipamento,
          tipo_equipamento_detalhe: null,
          organizacao: formGerador.organizacao,
          ug: formGerador.ug,
          quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
          potencia_hp: null,
          horas_dia: null,
          km_dia: null,
          consumo_hora: null,
          consumo_km_litro: null,
          dias_operacao: formGerador.dias_operacao,
          tipo_combustivel: consolidado.tipo_combustivel,
          preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0),
          total_litros: consolidado.total_litros,
          total_litros_sem_margem: consolidado.total_litros_sem_margem,
          valor_total: consolidado.valor_total,
          detalhamento: consolidado.detalhamento,
          itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
          fase_atividade: faseFinalString,
        };

        const { error } = await supabase
          .from("classe_iii_registros")
          .insert([registro]);

        if (error) throw error;
      }

      toast.success(editingId ? "Registros de geradores atualizados com sucesso!" : "Registros de geradores salvos com sucesso!");
      // Atualiza o status do PTrab para 'em_andamento' se estiver 'aberto'
      await updatePTrabStatusIfAberto(ptrabId);

      resetFormFields();
      setTipoSelecionado(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de gerador:", error);
      toast.error("Erro ao salvar/atualizar registros de gerador");
    } finally {
      setLoading(false);
    }
  };

  const handleOMViaturaChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormViatura({
        ...formViatura,
        selectedOmId: omData.id,
        organizacao: omData.nome_om,
        ug: omData.codug_om,
      });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormViatura({
        ...formViatura,
        selectedOmId: undefined,
        organizacao: "",
        ug: "",
      });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };

  const handleTipoViaturaChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      
      setItemViaturaTemp({
        ...itemViaturaTemp,
        tipo_equipamento_especifico: tipoNome,
        tipo_combustivel: novoCombustivel,
        consumo_fixo: equipamento.consumo,
      });
    }
  };

  const adicionarOuAtualizarItemViatura = () => {
    if (!itemViaturaTemp.tipo_equipamento_especifico || itemViaturaTemp.quantidade <= 0 || itemViaturaTemp.distancia_percorrida <= 0 || itemViaturaTemp.quantidade_deslocamentos <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }

    const novoItem: ItemViatura = {
      tipo_equipamento_especifico: itemViaturaTemp.tipo_equipamento_especifico,
      quantidade: itemViaturaTemp.quantidade,
      distancia_percorrida: itemViaturaTemp.distancia_percorrida,
      quantidade_deslocamentos: itemViaturaTemp.quantidade_deslocamentos,
      consumo_fixo: itemViaturaTemp.consumo_fixo,
      tipo_combustivel: itemViaturaTemp.tipo_combustivel,
    };

    let novosItens = [...formViatura.itens];
    if (editingViaturaItemIndex !== null) {
      novosItens[editingViaturaItemIndex] = novoItem;
      toast.success("Item de viatura atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de viatura adicionado!");
    }

    setFormViatura({
      ...formViatura,
      itens: novosItens,
    });

    setItemViaturaTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      distancia_percorrida: 0,
      quantidade_deslocamentos: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingViaturaItemIndex(null);
  };

  const handleEditViaturaItem = (item: ItemViatura, index: number) => {
    setItemViaturaTemp(item);
    setEditingViaturaItemIndex(index);
    if (addViaturaRef.current) {
      addViaturaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCancelEditViaturaItem = () => {
    setItemViaturaTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0, // Alterado para 0
      distancia_percorrida: 0,
      quantidade_deslocamentos: 0, // Alterado para 0
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setEditingViaturaItemIndex(null);
  };

  const removerItemViatura = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formViatura.itens.filter((_, i) => i !== index);
    setFormViatura({
      ...formViatura,
      itens: novosItens,
    });
    if (editingViaturaItemIndex === index) {
      handleCancelEditViaturaItem();
    }
    toast.success("Item de viatura removido!");
  };

  const calcularConsolidadosViatura = (itens: ItemViatura[]) => {
    if (itens.length === 0) {
      setConsolidadosViatura([]);
      return;
    }

    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) {
        acc[item.tipo_combustivel] = [];
      }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemViatura[]>);

    const consolidados: ConsolidadoViatura[] = [];

    Object.entries(grupos).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as 'GASOLINA' | 'DIESEL';
      
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];

      itensGrupo.forEach(item => {
        const litrosItem = (item.distancia_percorrida * item.quantidade * item.quantidade_deslocamentos) / item.consumo_fixo;
        totalLitrosSemMargem += litrosItem;
        
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: (${formatNumber(item.distancia_percorrida)} km x ${item.quantidade} vtr x ${item.quantidade_deslocamentos} deslocamentos) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L = ${formatNumber(litrosItem)} L ${unidade}.`);
      });

      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;

      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      
      const formatarData = (data: string) => {
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
      };

      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';

      const totalViaturas = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);

      // Construir string de fases da mesma forma que no salvamento
      let fasesFinaisCalc = [...fasesAtividadeViatura];
      if (customFaseAtividadeViatura.trim()) {
        fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeViatura.trim()];
      }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      const detalhamento = `33.90.30 - Aquisição de Combustível (${combustivelLabel}) para ${totalViaturas} viaturas, durante ${formViatura.dias_operacao} dias de ${faseFormatada}, para ${formViatura.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} km/L.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Nr Viaturas x Nr Km percorridos/dia ÷ Consumo km/L) x Nr dias de operação.
${detalhes.join('\n')}

Total: ${formatNumber(totalLitrosSemMargem)} L ${unidadeLabel} + 30% = ${formatNumber(totalLitros)} L ${unidadeLabel}.
Valor: ${formatNumber(totalLitros)} L ${unidadeLabel} x ${formatCurrency(preco)} = ${formatCurrency(valorTotal)}.`;

      consolidados.push({
        tipo_combustivel: tipoCombustivel,
        total_litros_sem_margem: totalLitrosSemMargem,
        total_litros: totalLitros,
        valor_total: valorTotal,
        itens: itensGrupo,
        detalhamento,
      });
    });

    setConsolidadosViatura(consolidados);
  };

  const salvarRegistrosConsolidadosViatura = async () => {
    if (!ptrabId || consolidadosViatura.length === 0) return;

    if (!refLPC) {
      toast.error("Configure a referência LPC antes de salvar");
      if (lpcRef.current) {
        lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (!formViatura.organizacao || !formViatura.ug) {
      toast.error("Selecione uma OM");
      return;
    }

    if (!rmFornecimento || !codugRmFornecimento) {
      toast.error("Selecione a RM de Fornecimento de Combustível");
      return;
    }

    if (formViatura.itens.length === 0) {
      toast.error("Adicione pelo menos uma viatura");
      return;
    }

    // Construir string de fases
    let fasesFinais = [...fasesAtividadeViatura];
    if (customFaseAtividadeViatura.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividadeViatura.trim()];
    }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        const { error: deleteError } = await supabase
          .from("classe_iii_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("tipo_equipamento", "MOTOMECANIZACAO")
          .eq("organizacao", formViatura.organizacao)
          .eq("ug", formViatura.ug);

        if (deleteError) {
          console.error("Erro ao deletar registros existentes de viatura para edição:", deleteError);
          throw deleteError;
        }
      }

      for (const consolidado of consolidadosViatura) {
        const registro = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'MOTOMECANIZACAO' as TipoEquipamento,
          tipo_equipamento_detalhe: null,
          organizacao: formViatura.organizacao,
          ug: formViatura.ug,
          quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
          potencia_hp: null,
          horas_dia: null,
          km_dia: null,
          consumo_hora: null,
          consumo_km_litro: null,
          dias_operacao: formViatura.dias_operacao,
          tipo_combustivel: consolidado.tipo_combustivel,
          preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0),
          total_litros: consolidado.total_litros,
          total_litros_sem_margem: consolidado.total_litros_sem_margem,
          valor_total: consolidado.valor_total,
          detalhamento: consolidado.detalhamento,
          itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
          fase_atividade: faseFinalString,
        };

        const { error } = await supabase
          .from("classe_iii_registros")
          .insert([registro]);

        if (error) throw error;
      }

      toast.success(editingId ? "Registros de viaturas atualizados com sucesso!" : "Registros de viaturas salvos com sucesso!");
      // Atualiza o status do PTrab para 'em_andamento' se estiver 'aberto'
      await updatePTrabStatusIfAberto(ptrabId);

      resetFormFields();
      setTipoSelecionado(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de viatura:", error);
      toast.error("Erro ao salvar/atualizar registros de viatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate("/ptrab")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para PTrabs
          </Button>
          <h1 className="text-3xl font-bold text-center flex-grow">Classe III - Combustíveis</h1>
          <div className="w-fit"></div> {/* Placeholder para alinhar o título */}
        </div>

        <Card ref={lpcRef}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Fuel className="h-5 w-5 text-primary" />
              Referência LPC (Levantamento de Preços de Combustíveis)
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setIsLPCFormExpanded(!isLPCFormExpanded)}>
              {isLPCFormExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent className={isLPCFormExpanded ? "block" : "hidden"}>
            <p className="text-sm text-muted-foreground mb-4">
              Informe os dados da consulta de preços de combustíveis para o período do PTrab.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data_inicio_consulta">Data Início Consulta *</Label>
                <Input
                  id="data_inicio_consulta"
                  type="date"
                  value={formLPC.data_inicio_consulta}
                  onChange={(e) => setFormLPC({ ...formLPC, data_inicio_consulta: e.target.value })}
                  required
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_fim_consulta">Data Fim Consulta *</Label>
                <Input
                  id="data_fim_consulta"
                  type="date"
                  value={formLPC.data_fim_consulta}
                  onChange={(e) => setFormLPC({ ...formLPC, data_fim_consulta: e.target.value })}
                  required
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ambito">Âmbito da Consulta *</Label>
                <Select
                  value={formLPC.ambito}
                  onValueChange={(value: 'Nacional' | 'Estadual' | 'Municipal') => setFormLPC({ ...formLPC, ambito: value, nome_local: value === 'Nacional' ? '' : formLPC.nome_local })}
                >
                  <SelectTrigger id="ambito">
                    <SelectValue placeholder="Selecione o âmbito" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nacional">Nacional</SelectItem>
                    <SelectItem value="Estadual">Estadual</SelectItem>
                    <SelectItem value="Municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formLPC.ambito !== 'Nacional' && (
                <div className="space-y-2">
                  <Label htmlFor="nome_local">{formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'} *</Label>
                  <Input
                    id="nome_local"
                    value={formLPC.nome_local}
                    onChange={(e) => setFormLPC({ ...formLPC, nome_local: e.target.value })}
                    placeholder={formLPC.ambito === 'Estadual' ? 'Ex: Amazonas' : 'Ex: Manaus'}
                    required
                    onKeyDown={handleEnterToNextField}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="preco_diesel">Preço Diesel (R$/L) *</Label>
                <Input
                  id="preco_diesel"
                  type="number"
                  step="0.01"
                  value={formLPC.preco_diesel}
                  onChange={(e) => setFormLPC({ ...formLPC, preco_diesel: parseFloat(e.target.value) || 0 })}
                  required
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_gasolina">Preço Gasolina (R$/L) *</Label>
                <Input
                  id="preco_gasolina"
                  type="number"
                  step="0.01"
                  value={formLPC.preco_gasolina}
                  onChange={(e) => setFormLPC({ ...formLPC, preco_gasolina: parseFloat(e.target.value) || 0 })}
                  required
                  onKeyDown={handleEnterToNextField}
                />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={handleSalvarRefLPC} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Referência LPC"}
              </Button>
            </div>
          </CardContent>
          {refLPC && !isLPCFormExpanded && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                <div>
                  <p className="font-medium text-foreground">Período:</p>
                  <p>{new Date(refLPC.data_inicio_consulta).toLocaleDateString('pt-BR')} a {new Date(refLPC.data_fim_consulta).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Âmbito:</p>
                  <p>{refLPC.ambito} {refLPC.nome_local ? `(${refLPC.nome_local})` : ''}</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Preço Diesel:</p>
                  <p>{formatCurrency(refLPC.preco_diesel)}/L</p>
                </div>
                <div>
                  <p className="font-medium text-foreground">Preço Gasolina:</p>
                  <p>{formatCurrency(refLPC.preco_gasolina)}/L</p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Adicionar Novo Registro de Classe III
            </CardTitle>
            <CardDescription>
              Selecione o tipo de equipamento para adicionar um novo registro de consumo de combustível.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                variant={tipoSelecionado === 'GERADOR' ? 'default' : 'outline'}
                onClick={() => handleSelectEquipmentType('GERADOR')}
                className="flex flex-col h-auto py-4"
              >
                <Zap className="h-6 w-6 mb-2" />
                Gerador
              </Button>
              <Button
                variant={tipoSelecionado === 'MOTOMECANIZACAO' ? 'default' : 'outline'}
                onClick={() => handleSelectEquipmentType('MOTOMECANIZACAO')}
                className="flex flex-col h-auto py-4"
              >
                <Truck className="h-6 w-6 mb-2" />
                Motomecanização
              </Button>
              <Button
                variant={tipoSelecionado === 'EMBARCACAO' ? 'default' : 'outline'}
                onClick={() => handleSelectEquipmentType('EMBARCACAO')}
                className="flex flex-col h-auto py-4"
              >
                <Ship className="h-6 w-6 mb-2" />
                Embarcação
              </Button>
              {/* <Button
                variant={tipoSelecionado === 'EQUIPAMENTO_ENGENHARIA' ? 'default' : 'outline'}
                onClick={() => handleSelectEquipmentType('EQUIPAMENTO_ENGENHARIA')}
                className="flex flex-col h-auto py-4"
              >
                <Wrench className="h-6 w-6 mb-2" />
                Equip. Engenharia
              </Button> */}
            </div>

            {tipoSelecionado === 'GERADOR' && (
              <div className="mt-6 border p-4 rounded-lg space-y-4" ref={addGeradorRef}>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Adicionar Gerador
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="om-gerador">OM *</Label>
                    <OmSelector
                      selectedOmId={formGerador.selectedOmId}
                      onChange={handleOMGeradorChange}
                      placeholder="Selecione a OM..."
                      disabled={loading}
                    />
                    {formGerador.ug && (
                      <p className="text-xs text-muted-foreground">UG: {formGerador.ug}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dias_operacao_gerador">Dias de Operação *</Label>
                    <Input
                      id="dias_operacao_gerador"
                      type="number"
                      value={formGerador.dias_operacao}
                      onChange={(e) => setFormGerador({ ...formGerador, dias_operacao: parseInt(e.target.value) || 0 })}
                      min={1}
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rm_fornecimento_gerador">RM de Fornecimento de Combustível *</Label>
                    <RmSelector
                      value={rmFornecimento}
                      onChange={handleRMFornecimentoChange}
                      placeholder="Selecione a RM..."
                      disabled={loading}
                    />
                    {codugRmFornecimento && (
                      <p className="text-xs text-muted-foreground">CODUG: {codugRmFornecimento}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fase_atividade_gerador">Fase da Atividade *</Label>
                    <Popover open={isPopoverOpenGerador} onOpenChange={setIsPopoverOpenGerador}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {fasesAtividadeGerador.length > 0 ? fasesAtividadeGerador.join(', ') : "Selecione as fases"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandGroup>
                            {FASES_PADRAO.map((fase) => (
                              <CommandItem key={fase} className="flex items-center space-x-2 p-2">
                                <Checkbox
                                  id={`fase-gerador-${fase}`}
                                  checked={fasesAtividadeGerador.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChangeGerador(fase, checked as boolean)}
                                />
                                <Label htmlFor={`fase-gerador-${fase}`} className="font-normal cursor-pointer">
                                  {fase}
                                </Label>
                              </CommandItem>
                            ))}
                            <div className="flex items-center space-x-2 p-2">
                              <Input
                                placeholder="Outra fase..."
                                value={customFaseAtividadeGerador}
                                onChange={(e) => setCustomFaseAtividadeGerador(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customFaseAtividadeGerador.trim()) {
                                    e.preventDefault();
                                    if (!fasesAtividadeGerador.includes(customFaseAtividadeGerador.trim())) {
                                      setFasesAtividadeGerador([...fasesAtividadeGerador, customFaseAtividadeGerador.trim()]);
                                      setCustomFaseAtividadeGerador("");
                                    }
                                  }
                                }}
                              />
                              {customFaseAtividadeGerador.trim() && !fasesAtividadeGerador.includes(customFaseAtividadeGerador.trim()) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    setFasesAtividadeGerador([...fasesAtividadeGerador, customFaseAtividadeGerador.trim()]);
                                    setCustomFaseAtividadeGerador("");
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4 space-y-4">
                  <h4 className="text-md font-semibold">Itens de Gerador</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_equipamento_especifico_gerador">Tipo de Gerador *</Label>
                      <Select
                        value={itemGeradorTemp.tipo_equipamento_especifico}
                        onValueChange={handleTipoGeradorChange}
                      >
                        <SelectTrigger id="tipo_equipamento_especifico_gerador">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipamentosDisponiveis.map((eq) => (
                            <SelectItem key={eq.nome} value={eq.nome}>
                              {eq.nome} ({eq.consumo} L/h - {eq.combustivel === 'GAS' ? 'Gasolina' : 'Diesel'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantidade_gerador">Quantidade *</Label>
                      <Input
                        id="quantidade_gerador"
                        type="number"
                        value={itemGeradorTemp.quantidade}
                        onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, quantidade: parseInt(e.target.value) || 0 })}
                        min={1}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horas_dia_gerador">Horas/dia *</Label>
                      <Input
                        id="horas_dia_gerador"
                        type="number"
                        value={itemGeradorTemp.horas_dia}
                        onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                        min={0.1}
                        max={24}
                        step="0.1"
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingGeradorItemIndex !== null && (
                      <Button variant="outline" onClick={handleCancelEditGeradorItem}>
                        Cancelar Edição
                      </Button>
                    )}
                    <Button onClick={adicionarOuAtualizarItemGerador}>
                      {editingGeradorItemIndex !== null ? "Atualizar Item" : "Adicionar Item"}
                    </Button>
                  </div>
                </div>

                {formGerador.itens.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold mb-2">Geradores Adicionados</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Horas/dia</TableHead>
                          <TableHead>Consumo (L/h)</TableHead>
                          <TableHead>Combustível</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formGerador.itens.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.tipo_equipamento_especifico}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatNumber(item.horas_dia, 1)}</TableCell>
                            <TableCell>{formatNumber(item.consumo_fixo, 1)}</TableCell>
                            <TableCell>{item.tipo_combustivel}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleEditGeradorItem(item, index)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removerItemGerador(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {consolidadosGerador.length > 0 && (
                  <div className="mt-6 border-t pt-4 space-y-4">
                    <h4 className="text-md font-semibold">Prévia do Cálculo Consolidado</h4>
                    {consolidadosGerador.map((consolidado, index) => (
                      <Card key={index} className="bg-muted/50">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Fuel className="h-4 w-4" />
                            {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Total Litros (sem 30%):</p>
                            <p>{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Total Litros (com 30%):</p>
                            <p>{formatNumber(consolidado.total_litros)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Valor Total:</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(consolidado.valor_total)}</p>
                          </div>
                          <div className="col-span-full">
                            <p className="font-medium mb-1">Detalhamento da Memória de Cálculo:</p>
                            <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded-md border">
                              {consolidado.detalhamento}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                  <Button onClick={salvarRegistrosConsolidadosGerador} disabled={loading || formGerador.itens.length === 0}>
                    {loading ? "Salvando..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}

            {tipoSelecionado === 'MOTOMECANIZACAO' && (
              <div className="mt-6 border p-4 rounded-lg space-y-4" ref={addViaturaRef}>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Adicionar Viatura
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="om-viatura">OM *</Label>
                    <OmSelector
                      selectedOmId={formViatura.selectedOmId}
                      onChange={handleOMViaturaChange}
                      placeholder="Selecione a OM..."
                      disabled={loading}
                    />
                    {formViatura.ug && (
                      <p className="text-xs text-muted-foreground">UG: {formViatura.ug}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dias_operacao_viatura">Dias de Operação *</Label>
                    <Input
                      id="dias_operacao_viatura"
                      type="number"
                      value={formViatura.dias_operacao}
                      onChange={(e) => setFormViatura({ ...formViatura, dias_operacao: parseInt(e.target.value) || 0 })}
                      min={1}
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rm_fornecimento_viatura">RM de Fornecimento de Combustível *</Label>
                    <RmSelector
                      value={rmFornecimento}
                      onChange={handleRMFornecimentoChange}
                      placeholder="Selecione a RM..."
                      disabled={loading}
                    />
                    {codugRmFornecimento && (
                      <p className="text-xs text-muted-foreground">CODUG: {codugRmFornecimento}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fase_atividade_viatura">Fase da Atividade *</Label>
                    <Popover open={isPopoverOpenViatura} onOpenChange={setIsPopoverOpenViatura}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {fasesAtividadeViatura.length > 0 ? fasesAtividadeViatura.join(', ') : "Selecione as fases"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandGroup>
                            {FASES_PADRAO.map((fase) => (
                              <CommandItem key={fase} className="flex items-center space-x-2 p-2">
                                <Checkbox
                                  id={`fase-viatura-${fase}`}
                                  checked={fasesAtividadeViatura.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChangeViatura(fase, checked as boolean)}
                                />
                                <Label htmlFor={`fase-viatura-${fase}`} className="font-normal cursor-pointer">
                                  {fase}
                                </Label>
                              </CommandItem>
                            ))}
                            <div className="flex items-center space-x-2 p-2">
                              <Input
                                placeholder="Outra fase..."
                                value={customFaseAtividadeViatura}
                                onChange={(e) => setCustomFaseAtividadeViatura(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customFaseAtividadeViatura.trim()) {
                                    e.preventDefault();
                                    if (!fasesAtividadeViatura.includes(customFaseAtividadeViatura.trim())) {
                                      setFasesAtividadeViatura([...fasesAtividadeViatura, customFaseAtividadeViatura.trim()]);
                                      setCustomFaseAtividadeViatura("");
                                    }
                                  }
                                }}
                              />
                              {customFaseAtividadeViatura.trim() && !fasesAtividadeViatura.includes(customFaseAtividadeViatura.trim()) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    setFasesAtividadeViatura([...fasesAtividadeViatura, customFaseAtividadeViatura.trim()]);
                                    setCustomFaseAtividadeViatura("");
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4 space-y-4">
                  <h4 className="text-md font-semibold">Itens de Viatura</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_equipamento_especifico_viatura">Tipo de Viatura *</Label>
                      <Select
                        value={itemViaturaTemp.tipo_equipamento_especifico}
                        onValueChange={handleTipoViaturaChange}
                      >
                        <SelectTrigger id="tipo_equipamento_especifico_viatura">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipamentosDisponiveis.map((eq) => (
                            <SelectItem key={eq.nome} value={eq.nome}>
                              {eq.nome} ({eq.consumo} km/L - {eq.combustivel === 'GAS' ? 'Gasolina' : 'Diesel'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantidade_viatura">Quantidade *</Label>
                      <Input
                        id="quantidade_viatura"
                        type="number"
                        value={itemViaturaTemp.quantidade}
                        onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade: parseInt(e.target.value) || 0 })}
                        min={1}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="distancia_percorrida_viatura">Distância Percorrida (km/dia) *</Label>
                      <Input
                        id="distancia_percorrida_viatura"
                        type="number"
                        value={itemViaturaTemp.distancia_percorrida}
                        onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, distancia_percorrida: parseFloat(e.target.value) || 0 })}
                        min={0.1}
                        step="0.1"
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantidade_deslocamentos_viatura">Qtd Deslocamentos/dia *</Label>
                      <Input
                        id="quantidade_deslocamentos_viatura"
                        type="number"
                        value={itemViaturaTemp.quantidade_deslocamentos}
                        onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade_deslocamentos: parseInt(e.target.value) || 0 })}
                        min={1}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingViaturaItemIndex !== null && (
                      <Button variant="outline" onClick={handleCancelEditViaturaItem}>
                        Cancelar Edição
                      </Button>
                    )}
                    <Button onClick={adicionarOuAtualizarItemViatura}>
                      {editingViaturaItemIndex !== null ? "Atualizar Item" : "Adicionar Item"}
                    </Button>
                  </div>
                </div>

                {formViatura.itens.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold mb-2">Viaturas Adicionadas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Km/dia</TableHead>
                          <TableHead>Desloc./dia</TableHead>
                          <TableHead>Consumo (km/L)</TableHead>
                          <TableHead>Combustível</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formViatura.itens.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.tipo_equipamento_especifico}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatNumber(item.distancia_percorrida, 1)}</TableCell>
                            <TableCell>{item.quantidade_deslocamentos}</TableCell>
                            <TableCell>{formatNumber(item.consumo_fixo, 1)}</TableCell>
                            <TableCell>{item.tipo_combustivel}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleEditViaturaItem(item, index)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removerItemViatura(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {consolidadosViatura.length > 0 && (
                  <div className="mt-6 border-t pt-4 space-y-4">
                    <h4 className="text-md font-semibold">Prévia do Cálculo Consolidado</h4>
                    {consolidadosViatura.map((consolidado, index) => (
                      <Card key={index} className="bg-muted/50">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Fuel className="h-4 w-4" />
                            {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Total Litros (sem 30%):</p>
                            <p>{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Total Litros (com 30%):</p>
                            <p>{formatNumber(consolidado.total_litros)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Valor Total:</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(consolidado.valor_total)}</p>
                          </div>
                          <div className="col-span-full">
                            <p className="font-medium mb-1">Detalhamento da Memória de Cálculo:</p>
                            <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded-md border">
                              {consolidado.detalhamento}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                  <Button onClick={salvarRegistrosConsolidadosViatura} disabled={loading || formViatura.itens.length === 0}>
                    {loading ? "Salvando..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}

            {tipoSelecionado === 'EMBARCACAO' && (
              <div className="mt-6 border p-4 rounded-lg space-y-4" ref={addEmbarcacaoRef}>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Adicionar Embarcação
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="om-embarcacao">OM *</Label>
                    <OmSelector
                      selectedOmId={formEmbarcacao.selectedOmId}
                      onChange={handleOMEmbarcacaoChange}
                      placeholder="Selecione a OM..."
                      disabled={loading}
                    />
                    {formEmbarcacao.ug && (
                      <p className="text-xs text-muted-foreground">UG: {formEmbarcacao.ug}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dias_operacao_embarcacao">Dias de Operação *</Label>
                    <Input
                      id="dias_operacao_embarcacao"
                      type="number"
                      value={formEmbarcacao.dias_operacao}
                      onChange={(e) => setFormEmbarcacao({ ...formEmbarcacao, dias_operacao: parseInt(e.target.value) || 0 })}
                      min={1}
                      required
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rm_fornecimento_embarcacao">RM de Fornecimento de Combustível *</Label>
                    <RmSelector
                      value={rmFornecimento}
                      onChange={handleRMFornecimentoChange}
                      placeholder="Selecione a RM..."
                      disabled={loading}
                    />
                    {codugRmFornecimento && (
                      <p className="text-xs text-muted-foreground">CODUG: {codugRmFornecimento}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fase_atividade_embarcacao">Fase da Atividade *</Label>
                    <Popover open={isPopoverOpenEmbarcacao} onOpenChange={setIsPopoverOpenEmbarcacao}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {fasesAtividadeEmbarcacao.length > 0 ? fasesAtividadeEmbarcacao.join(', ') : "Selecione as fases"}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                          <CommandGroup>
                            {FASES_PADRAO.map((fase) => (
                              <CommandItem key={fase} className="flex items-center space-x-2 p-2">
                                <Checkbox
                                  id={`fase-embarcacao-${fase}`}
                                  checked={fasesAtividadeEmbarcacao.includes(fase)}
                                  onCheckedChange={(checked) => handleFaseChangeEmbarcacao(fase, checked as boolean)}
                                />
                                <Label htmlFor={`fase-embarcacao-${fase}`} className="font-normal cursor-pointer">
                                  {fase}
                                </Label>
                              </CommandItem>
                            ))}
                            <div className="flex items-center space-x-2 p-2">
                              <Input
                                placeholder="Outra fase..."
                                value={customFaseAtividadeEmbarcacao}
                                onChange={(e) => setCustomFaseAtividadeEmbarcacao(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && customFaseAtividadeEmbarcacao.trim()) {
                                    e.preventDefault();
                                    if (!fasesAtividadeEmbarcacao.includes(customFaseAtividadeEmbarcacao.trim())) {
                                      setFasesAtividadeEmbarcacao([...fasesAtividadeEmbarcacao, customFaseAtividadeEmbarcacao.trim()]);
                                      setCustomFaseAtividadeEmbarcacao("");
                                    }
                                  }
                                }}
                              />
                              {customFaseAtividadeEmbarcacao.trim() && !fasesAtividadeEmbarcacao.includes(customFaseAtividadeEmbarcacao.trim()) && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    setFasesAtividadeEmbarcacao([...fasesAtividadeEmbarcacao, customFaseAtividadeEmbarcacao.trim()]);
                                    setCustomFaseAtividadeEmbarcacao("");
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4 space-y-4">
                  <h4 className="text-md font-semibold">Itens de Embarcação</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tipo_equipamento_especifico_embarcacao">Tipo de Embarcação *</Label>
                      <Select
                        value={itemEmbarcacaoTemp.tipo_equipamento_especifico}
                        onValueChange={handleTipoEmbarcacaoChange}
                      >
                        <SelectTrigger id="tipo_equipamento_especifico_embarcacao">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {equipamentosDisponiveis.map((eq) => (
                            <SelectItem key={eq.nome} value={eq.nome}>
                              {eq.nome} ({eq.consumo} L/h - {eq.combustivel === 'GAS' ? 'Gasolina' : 'Diesel'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantidade_embarcacao">Quantidade *</Label>
                      <Input
                        id="quantidade_embarcacao"
                        type="number"
                        value={itemEmbarcacaoTemp.quantidade}
                        onChange={(e) => setItemEmbarcacaoTemp({ ...itemEmbarcacaoTemp, quantidade: parseInt(e.target.value) || 0 })}
                        min={1}
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="horas_dia_embarcacao">Horas/dia *</Label>
                      <Input
                        id="horas_dia_embarcacao"
                        type="number"
                        value={itemEmbarcacaoTemp.horas_dia}
                        onChange={(e) => setItemEmbarcacaoTemp({ ...itemEmbarcacaoTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                        min={0.1}
                        max={24}
                        step="0.1"
                        required
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingEmbarcacaoItemIndex !== null && (
                      <Button variant="outline" onClick={handleCancelEditEmbarcacaoItem}>
                        Cancelar Edição
                      </Button>
                    )}
                    <Button onClick={adicionarOuAtualizarItemEmbarcacao}>
                      {editingEmbarcacaoItemIndex !== null ? "Atualizar Item" : "Adicionar Item"}
                    </Button>
                  </div>
                </div>

                {formEmbarcacao.itens.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-md font-semibold mb-2">Embarcações Adicionadas</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Horas/dia</TableHead>
                          <TableHead>Consumo (L/h)</TableHead>
                          <TableHead>Combustível</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formEmbarcacao.itens.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.tipo_equipamento_especifico}</TableCell>
                            <TableCell>{item.quantidade}</TableCell>
                            <TableCell>{formatNumber(item.horas_dia, 1)}</TableCell>
                            <TableCell>{formatNumber(item.consumo_fixo, 1)}</TableCell>
                            <TableCell>{item.tipo_combustivel}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleEditEmbarcacaoItem(item, index)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removerItemEmbarcacao(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {consolidadosEmbarcacao.length > 0 && (
                  <div className="mt-6 border-t pt-4 space-y-4">
                    <h4 className="text-md font-semibold">Prévia do Cálculo Consolidado</h4>
                    {consolidadosEmbarcacao.map((consolidado, index) => (
                      <Card key={index} className="bg-muted/50">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Fuel className="h-4 w-4" />
                            {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Total Litros (sem 30%):</p>
                            <p>{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Total Litros (com 30%):</p>
                            <p>{formatNumber(consolidado.total_litros)} L</p>
                          </div>
                          <div>
                            <p className="font-medium">Valor Total:</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(consolidado.valor_total)}</p>
                          </div>
                          <div className="col-span-full">
                            <p className="font-medium mb-1">Detalhamento da Memória de Cálculo:</p>
                            <pre className="whitespace-pre-wrap text-xs bg-background p-3 rounded-md border">
                              {consolidado.detalhamento}
                            </pre>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={handleCancelEdit}>
                    Cancelar
                  </Button>
                  <Button onClick={salvarRegistrosConsolidadosEmbarcacao} disabled={loading || formEmbarcacao.itens.length === 0}>
                    {loading ? "Salvando..." : (editingId ? "Atualizar Registros" : "Salvar Registros")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Diálogo de Edição de Memória de Cálculo */}
        <Dialog open={editingMemoriaId !== null} onOpenChange={handleCancelarEdicaoMemoria}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Editar Memória de Cálculo</DialogTitle>
              <DialogDescription>
                Edite o detalhamento da memória de cálculo para este registro.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Textarea
                value={memoriaEdit}
                onChange={(e) => setMemoriaEdit(e.target.value)}
                rows={15}
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleRestaurarMemoriaAutomatica(editingMemoriaId!)} disabled={loading}>
                Restaurar Padrão
              </Button>
              <Button onClick={() => handleSalvarMemoriaCustomizada(editingMemoriaId!)} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button variant="ghost" onClick={handleCancelarEdicaoMemoria}>
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}