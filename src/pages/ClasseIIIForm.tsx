import { useState, useMemo, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, Pencil, XCircle, Sparkles, Check, ChevronsUpDown, Info, Download, Loader2, DollarSign } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "@/lib/errorUtils";
import { classeIIIFormSchema } from "@/lib/validationSchemas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { RefLPCForm, RefLPC } from "@/types/refLPC";
import { fetchPrecosCombustivel } from "@/integrations/api/precoCombustivel";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { Tables } from "@/integrations/supabase/types";

// Tipos de Equipamento
const TIPOS_EQUIPAMENTO = [
  { value: "MOTOMECANIZACAO", label: "Motomecanização (Vtr)" },
  { value: "GERADOR", label: "Grupo Gerador" },
  { value: "EMBARCACAO", label: "Embarcação" },
  { value: "EQUIPAMENTO_ENGENHARIA", label: "Equipamento de Engenharia" },
  { value: "OUTROS", label: "Outros" },
];

interface ClasseIIIRegistro {
  id: string;
  tipoEquipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  potenciaHP?: number;
  horasDia?: number;
  diasOperacao: number;
  consumoHora?: number;
  consumoKmLitro?: number;
  kmDia?: number;
  tipoCombustivel: 'GAS' | 'OD';
  precoLitro: number;
  tipoEquipamentoDetalhe?: string;
  detalhamento?: string;
  detalhamentoCustomizado?: string;
  faseAtividade?: string;
  calculos: {
    totalLitrosSemMargem: number;
    totalLitros: number;
    valorTotal: number;
  };
}

const defaultRefLPC: RefLPCForm = {
  ambito: 'Nacional',
  data_inicio_consulta: new Date().toISOString().split('T')[0],
  data_fim_consulta: new Date().toISOString().split('T')[0],
  nome_local: '',
  preco_diesel: 0,
  preco_gasolina: 0,
};

// Fator de Margem de 30%
const MARGEM_CLASSE_III = 1.3;

export default function ClasseIIIForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiSource, setApiSource] = useState<string | null>(null);
  const [ptrabNome, setPtrabNome] = useState<string>("");
  const [registros, setRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  const [diretrizAno, setDiretrizAno] = useState<number | null>(null);
  const [fatorGerador, setFatorGerador] = useState<number>(0.15);
  const [fatorEmbarcacao, setFatorEmbarcacao] = useState<number>(0.30);
  const [fatorEngenharia, setFatorEngenharia] = useState<number>(0.20);
  const [equipamentosDisponiveis, setEquipamentosDisponiveis] = useState<TipoEquipamentoDetalhado[]>([]);
  
  // Estados do Formulário de Registro
  const [selectedOmId, setSelectedOmId] = useState<string | undefined>(undefined);
  const [om, setOm] = useState<string>("");
  const [ug, setUg] = useState<string>("");
  const [tipoEquipamento, setTipoEquipamento] = useState<string>("");
  const [tipoEquipamentoDetalhe, setTipoEquipamentoDetalhe] = useState<string>("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [potenciaHP, setPotenciaHP] = useState<number | undefined>(undefined);
  const [horasDia, setHorasDia] = useState<number | undefined>(undefined);
  const [diasOperacao, setDiasOperacao] = useState<number>(0);
  const [consumoHora, setConsumoHora] = useState<number | undefined>(undefined);
  const [consumoKmLitro, setConsumoKmLitro] = useState<number | undefined>(undefined);
  const [kmDia, setKmDia] = useState<number | undefined>(undefined);
  const [tipoCombustivel, setTipoCombustivel] = useState<'GAS' | 'OD'>('OD');
  const [precoLitro, setPrecoLitro] = useState<number>(0);
  const [faseAtividade, setFaseAtividade] = useState<string[]>(["Execução"]);
  const [customFaseAtividade, setCustomFaseAtividade] = useState<string>("");
  const [isFasePopoverOpen, setIsFasePopoverOpen] = useState(false);

  // Estados do Formulário LPC
  const [formLPC, setFormLPC] = useState<RefLPCForm>(defaultRefLPC);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [showLPCForm, setShowLPCForm] = useState(false);

  // Estados para controle de edição de detalhamento
  const [editingDetalhamentoId, setEditingDetalhamentoId] = useState<string | null>(null);
  const [detalhamentoEdit, setDetalhamentoEdit] = useState<string>("");

  const { handleEnterToNextField } = useFormNavigation();

  // =================================================================
  // EFEITOS E CARREGAMENTO DE DADOS
  // =================================================================

  useEffect(() => {
    checkAuthAndLoadData();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (ptrabId) {
      loadRefLPC(ptrabId);
    }
  }, [ptrabId]);

  useEffect(() => {
    loadDiretrizes();
  }, []);

  useEffect(() => {
    if (tipoEquipamento) {
      loadEquipamentosDisponiveis(tipoEquipamento);
    } else {
      setEquipamentosDisponiveis([]);
      setTipoEquipamentoDetalhe("");
    }
  }, [tipoEquipamento, diretrizAno]);

  useEffect(() => {
    // Atualiza campos de consumo e combustível ao selecionar um detalhe
    const selectedDetail = equipamentosDisponiveis.find(e => e.nome === tipoEquipamentoDetalhe);
    if (selectedDetail) {
      setTipoCombustivel(selectedDetail.combustivel);
      if (selectedDetail.unidade === 'L/h') {
        setConsumoHora(selectedDetail.consumo);
        setConsumoKmLitro(undefined);
      } else { // km/L
        setConsumoKmLitro(selectedDetail.consumo);
        setConsumoHora(undefined);
      }
    }
  }, [tipoEquipamentoDetalhe, equipamentosDisponiveis]);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Você precisa estar autenticado");
      navigate("/login");
      return;
    }

    if (!ptrabId) {
      toast.error("Nenhum P Trab selecionado");
      navigate("/ptrab");
      return;
    }

    await loadPTrab(ptrabId);
    await loadRegistros(ptrabId);
    await updatePTrabStatusIfAberto(ptrabId);
  };

  const loadPTrab = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab")
        .select("numero_ptrab, nome_operacao")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPtrabNome(`${data.numero_ptrab} - ${data.nome_operacao}`);
    } catch (error: any) {
      toast.error("Erro ao carregar P Trab");
      navigate("/ptrab");
    }
  };

  const loadDiretrizes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("diretrizes_custeio")
        .select("*")
        .eq("user_id", user.id)
        .order("ano_referencia", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setDiretrizAno(data.ano_referencia);
        setFatorGerador(Number(data.classe_iii_fator_gerador));
        setFatorEmbarcacao(Number(data.classe_iii_fator_embarcacao));
        setFatorEngenharia(Number(data.classe_iii_fator_equip_engenharia));
      }
    } catch (error: any) {
      console.error("Erro ao carregar diretrizes:", error);
    }
  };

  const loadEquipamentosDisponiveis = async (tipo: string) => {
    try {
      const equipamentos = await getEquipamentosPorTipo(tipo);
      setEquipamentosDisponiveis(equipamentos);
    } catch (error) {
      console.error("Erro ao carregar equipamentos:", error);
      setEquipamentosDisponiveis([]);
    }
  };

  const loadRefLPC = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("p_trab_ref_lpc")
        .select("*")
        .eq("p_trab_id", id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setRefLPC(data as RefLPC);
        setFormLPC({
          ambito: data.ambito as 'Nacional' | 'Estadual' | 'Municipal',
          data_inicio_consulta: data.data_inicio_consulta,
          data_fim_consulta: data.data_fim_consulta,
          nome_local: data.nome_local || '',
          preco_diesel: Number(data.preco_diesel),
          preco_gasolina: Number(data.preco_gasolina),
        });
        setPrecoLitro(data.preco_diesel > 0 ? Number(data.preco_diesel) : Number(data.preco_gasolina));
        setShowLPCForm(true);
      }
    } catch (error) {
      console.error("Erro ao carregar Ref LPC:", error);
    }
  };

  const loadRegistros = async (ptrabId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("classe_iii_registros")
        .select("*")
        .eq("p_trab_id", ptrabId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const registrosCarregados: ClasseIIIRegistro[] = (data || []).map((r) => {
        const calculos = calculateClasseIIICalculations(
          r.tipo_equipamento,
          r.quantidade,
          r.horas_dia,
          r.dias_operacao,
          r.consumo_hora,
          r.consumo_km_litro,
          r.km_dia,
          r.preco_litro,
          fatorGerador,
          fatorEmbarcacao,
          fatorEngenharia
        );
        return {
          id: r.id,
          tipoEquipamento: r.tipo_equipamento,
          organizacao: r.organizacao,
          ug: r.ug,
          quantidade: r.quantidade,
          potenciaHP: r.potencia_hp || undefined,
          horasDia: r.horas_dia || undefined,
          diasOperacao: r.dias_operacao,
          consumoHora: r.consumo_hora || undefined,
          consumoKmLitro: r.consumo_km_litro || undefined,
          kmDia: r.km_dia || undefined,
          tipoCombustivel: r.tipo_combustivel as 'GAS' | 'OD',
          precoLitro: Number(r.preco_litro),
          tipoEquipamentoDetalhe: r.tipo_equipamento_detalhe || undefined,
          detalhamento: r.detalhamento || undefined,
          detalhamentoCustomizado: r.detalhamento_customizado || undefined,
          faseAtividade: r.fase_atividade || undefined,
          calculos: {
            totalLitrosSemMargem: calculos.totalLitrosSemMargem,
            totalLitros: Number(r.total_litros),
            valorTotal: Number(r.valor_total),
          },
        };
      });

      setRegistros(registrosCarregados);
    } catch (error: any) {
      toast.error("Erro ao carregar registros");
    } finally {
      setLoading(false);
    }
  };

  // =================================================================
  // LÓGICA DE CÁLCULO
  // =================================================================

  const calculateClasseIIICalculations = (
    tipoEquipamento: string,
    quantidade: number,
    horasDia: number | undefined,
    diasOperacao: number,
    consumoHora: number | undefined,
    consumoKmLitro: number | undefined,
    kmDia: number | undefined,
    precoLitro: number,
    fatorGerador: number,
    fatorEmbarcacao: number,
    fatorEngenharia: number
  ) => {
    let consumoBase = 0;
    let fator = 1;
    let detalhamento = "";

    if (quantidade <= 0 || diasOperacao <= 0 || precoLitro <= 0) {
      return { totalLitrosSemMargem: 0, totalLitros: 0, valorTotal: 0, detalhamento: "Dados insuficientes para cálculo." };
    }

    let totalLitrosSemMargem = 0;

    switch (tipoEquipamento) {
      case 'GERADOR':
        if (consumoHora && horasDia) {
          consumoBase = consumoHora;
          fator = fatorGerador;
          totalLitrosSemMargem = quantidade * consumoBase * horasDia * diasOperacao;
          detalhamento = `Cálculo: Qtd (${quantidade}) x Consumo/h (${consumoBase} L/h) x Horas/dia (${horasDia}) x Dias (${diasOperacao}) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        }
        break;
      case 'EMBARCACAO':
        if (consumoHora && horasDia) {
          consumoBase = consumoHora;
          fator = fatorEmbarcacao;
          totalLitrosSemMargem = quantidade * consumoBase * horasDia * diasOperacao;
          detalhamento = `Cálculo: Qtd (${quantidade}) x Consumo/h (${consumoBase} L/h) x Horas/dia (${horasDia}) x Dias (${diasOperacao}) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        }
        break;
      case 'EQUIPAMENTO_ENGENHARIA':
        if (consumoHora && horasDia) {
          consumoBase = consumoHora;
          fator = fatorEngenharia;
          totalLitrosSemMargem = quantidade * consumoBase * horasDia * diasOperacao;
          detalhamento = `Cálculo: Qtd (${quantidade}) x Consumo/h (${consumoBase} L/h) x Horas/dia (${horasDia}) x Dias (${diasOperacao}) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        }
        break;
      case 'MOTOMECANIZACAO':
        if (consumoKmLitro && kmDia) {
          consumoBase = consumoKmLitro; // km/L
          fator = MARGEM_CLASSE_III; // Fator padrão de 30% para viaturas
          // Litros = (Qtd * Km/dia * Dias) / Consumo (km/L)
          totalLitrosSemMargem = (quantidade * kmDia * diasOperacao) / consumoBase;
          detalhamento = `Cálculo: (Qtd (${quantidade}) x Km/dia (${kmDia}) x Dias (${diasOperacao})) / Consumo (${consumoBase} km/L) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        }
        break;
      case 'OUTROS':
        // Para 'Outros', o usuário deve preencher o consumo em L/h ou km/L
        if (consumoHora && horasDia) {
          consumoBase = consumoHora;
          fator = MARGEM_CLASSE_III;
          totalLitrosSemMargem = quantidade * consumoBase * horasDia * diasOperacao;
          detalhamento = `Cálculo (L/h): Qtd (${quantidade}) x Consumo/h (${consumoBase} L/h) x Horas/dia (${horasDia}) x Dias (${diasOperacao}) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        } else if (consumoKmLitro && kmDia) {
          consumoBase = consumoKmLitro;
          fator = MARGEM_CLASSE_III;
          totalLitrosSemMargem = (quantidade * kmDia * diasOperacao) / consumoBase;
          detalhamento = `Cálculo (km/L): (Qtd (${quantidade}) x Km/dia (${kmDia}) x Dias (${diasOperacao})) / Consumo (${consumoBase} km/L) = ${formatNumber(totalLitrosSemMargem, 2)} L. Fator de Margem: ${fator * 100}%.`;
        }
        break;
    }

    const totalLitros = totalLitrosSemMargem * fator;
    const valorTotal = totalLitros * precoLitro;

    return {
      totalLitrosSemMargem,
      totalLitros,
      valorTotal,
      detalhamento,
    };
  };

  const calculos = useMemo(() => {
    return calculateClasseIIICalculations(
      tipoEquipamento,
      quantidade,
      horasDia,
      diasOperacao,
      consumoHora,
      consumoKmLitro,
      kmDia,
      precoLitro,
      fatorGerador,
      fatorEmbarcacao,
      fatorEngenharia
    );
  }, [
    tipoEquipamento,
    quantidade,
    horasDia,
    diasOperacao,
    consumoHora,
    consumoKmLitro,
    kmDia,
    precoLitro,
    fatorGerador,
    fatorEmbarcacao,
    fatorEngenharia,
  ]);

  // =================================================================
  // LÓGICA DE FORMULÁRIO E CRUD
  // =================================================================

  const resetFormFields = () => {
    setSelectedOmId(undefined);
    setOm("");
    setUg("");
    setTipoEquipamento("");
    setTipoEquipamentoDetalhe("");
    setQuantidade(0);
    setPotenciaHP(undefined);
    setHorasDia(undefined);
    setDiasOperacao(0);
    setConsumoHora(undefined);
    setConsumoKmLitro(undefined);
    setKmDia(undefined);
    setTipoCombustivel('OD');
    setPrecoLitro(refLPC ? (refLPC.preco_diesel > 0 ? refLPC.preco_diesel : refLPC.preco_gasolina) : 0);
    setEditingRegistroId(null);
    setFaseAtividade(["Execução"]);
    setCustomFaseAtividade("");
  };

  const handleOMChange = (omData: OMData | undefined) => {
    if (omData) {
      setSelectedOmId(omData.id);
      setOm(omData.nome_om);
      setUg(omData.codug_om);
    } else {
      setSelectedOmId(undefined);
      setOm("");
      setUg("");
    }
  };

  const handleFaseChange = (fase: string, isChecked: boolean) => {
    if (isChecked) {
      setFaseAtividade(prev => Array.from(new Set([...prev, fase])));
    } else {
      setFaseAtividade(prev => prev.filter(f => f !== fase));
    }
  };

  const handleCadastrar = async () => {
    if (!ptrabId) {
      toast.error("P Trab não selecionado");
      return;
    }

    const validationData = {
      organizacao: om,
      ug: ug,
      tipo_equipamento: tipoEquipamento,
      quantidade: quantidade,
      dias_operacao: diasOperacao,
      preco_litro: precoLitro,
      consumo_hora: consumoHora,
      horas_dia: horasDia,
      consumo_km_litro: consumoKmLitro,
      km_dia: kmDia,
    };

    const validationResult = classeIIIFormSchema.safeParse(validationData);

    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    if (calculos.valorTotal <= 0) {
      toast.error("O valor total calculado é zero. Verifique a quantidade, dias, consumo e preço.");
      return;
    }
    
    let fasesFinais = [...faseAtividade];
    if (customFaseAtividade.trim()) {
      fasesFinais = [...fasesFinais, customFaseAtividade.trim()];
    }
    
    const faseFinalString = fasesFinais.filter(f => f).join('; ');

    if (!faseFinalString) {
      toast.error("Selecione ou digite pelo menos uma Fase da Atividade.");
      return;
    }

    try {
      setLoading(true);

      const registroData: Tables<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        organizacao: om,
        ug: ug,
        tipo_equipamento: tipoEquipamento,
        tipo_equipamento_detalhe: tipoEquipamentoDetalhe || null,
        quantidade: quantidade,
        potencia_hp: potenciaHP || null,
        horas_dia: horasDia || null,
        dias_operacao: diasOperacao,
        consumo_hora: consumoHora || null,
        consumo_km_litro: consumoKmLitro || null,
        km_dia: kmDia || null,
        tipo_combustivel: tipoCombustivel,
        preco_litro: precoLitro,
        total_litros_sem_margem: calculos.totalLitrosSemMargem,
        total_litros: calculos.totalLitros,
        valor_total: calculos.valorTotal,
        detalhamento: calculos.detalhamento,
        detalhamento_customizado: null, // Limpa o customizado ao cadastrar/atualizar
        fase_atividade: faseFinalString,
      };

      if (editingRegistroId) {
        const { error } = await supabase
          .from("classe_iii_registros")
          .update(registroData)
          .eq("id", editingRegistroId);

        if (error) throw error;
        toast.success("Registro atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("classe_iii_registros")
          .insert([registroData]);

        if (error) throw error;
        toast.success("Registro cadastrado com sucesso!");
      }

      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      loadRegistros(ptrabId);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRemover = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este registro?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRegistros(registros.filter((r) => r.id !== id));
      toast.success("Registro removido com sucesso!");
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRegistro = async (registro: ClasseIIIRegistro) => {
    setEditingRegistroId(registro.id);
    setOm(registro.organizacao);
    setUg(registro.ug);
    setTipoEquipamento(registro.tipoEquipamento);
    setTipoEquipamentoDetalhe(registro.tipoEquipamentoDetalhe || "");
    setQuantidade(registro.quantidade);
    setPotenciaHP(registro.potenciaHP);
    setHorasDia(registro.horasDia);
    setDiasOperacao(registro.diasOperacao);
    setConsumoHora(registro.consumoHora);
    setConsumoKmLitro(registro.consumoKmLitro);
    setKmDia(registro.kmDia);
    setTipoCombustivel(registro.tipoCombustivel);
    setPrecoLitro(registro.precoLitro);
    
    // Preencher fasesAtividade
    const fasesSalvas = (registro.faseAtividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
    const fasesPadraoSelecionadas = fasesSalvas.filter(f => FASES_PADRAO.includes(f));
    const faseCustomizada = fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "";
    setFaseAtividade(fasesPadraoSelecionadas);
    setCustomFaseAtividade(faseCustomizada);

    // Buscar o ID da OM para preencher o OmSelector
    try {
      const { data: omData, error: omError } = await supabase
        .from('organizacoes_militares')
        .select('id')
        .eq('nome_om', registro.organizacao)
        .eq('codug_om', registro.ug)
        .single();
      if (omData && !omError) {
        setSelectedOmId(omData.id);
      }
    } catch (error) {
      console.error("Erro ao buscar ID da OM para edição:", error);
      setSelectedOmId(undefined);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =================================================================
  // LÓGICA DE REFERÊNCIA LPC
  // =================================================================

  const handleSaveRefLPC = async () => {
    if (!ptrabId) return;

    if (formLPC.preco_diesel <= 0 || formLPC.preco_gasolina <= 0) {
      toast.error("Preços do Diesel e Gasolina devem ser maiores que zero.");
      return;
    }

    if (formLPC.ambito !== 'Nacional' && !formLPC.nome_local?.trim()) {
      toast.error("O nome do local é obrigatório para âmbitos Estadual/Municipal.");
      return;
    }

    try {
      setLoading(true);
      const dataToSave: Tables<'p_trab_ref_lpc'> = {
        p_trab_id: ptrabId,
        ambito: formLPC.ambito,
        nome_local: formLPC.nome_local || null,
        data_inicio_consulta: formLPC.data_inicio_consulta,
        data_fim_consulta: formLPC.data_fim_consulta,
        preco_diesel: formLPC.preco_diesel,
        preco_gasolina: formLPC.preco_gasolina,
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

      // Atualiza o preço de litro no formulário de registro
      setPrecoLitro(tipoCombustivel === 'OD' ? formLPC.preco_diesel : formLPC.preco_gasolina);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleFetchPrices = async () => {
    setApiLoading(true);
    setApiSource(null);
    
    const today = new Date().toISOString().split('T')[0];
    
    let ambitoBusca = formLPC.ambito;
    let nomeLocalBusca = formLPC.nome_local;
    let dataInicioBusca = formLPC.data_inicio_consulta;
    let dataFimBusca = formLPC.data_fim_consulta;

    // 1. Lógica de validação e ajuste de parâmetros
    if (ambitoBusca === 'Nacional') {
        // Para Nacional (Web Scraping), datas e local são ignorados, mas preenchemos com a data atual se vazios para salvar no DB
        dataInicioBusca = dataInicioBusca || today;
        dataFimBusca = dataFimBusca || today;
        nomeLocalBusca = ''; // Limpa o local para Nacional
    } else {
        // Para Estadual/Municipal, datas e local são obrigatórios
        if (!dataInicioBusca || !dataFimBusca) {
            toast.error("Preencha as datas de início e fim da consulta para consultas Estaduais/Municipais.");
            setApiLoading(false);
            return;
        }
        if (!nomeLocalBusca.trim()) {
            toast.error(`Preencha o nome do ${ambitoBusca === 'Estadual' ? 'Estado' : 'Município'} para buscar preços.`);
            setApiLoading(false);
            return;
        }
    }

    try {
        const result = await fetchPrecosCombustivel(
            ambitoBusca,
            nomeLocalBusca,
            dataInicioBusca,
            dataFimBusca
        );

        setFormLPC(prev => ({
            ...prev,
            ambito: ambitoBusca,
            nome_local: nomeLocalBusca,
            data_inicio_consulta: dataInicioBusca,
            data_fim_consulta: dataFimBusca,
            preco_diesel: result.preco_diesel,
            preco_gasolina: result.preco_gasolina,
        }));
        setApiSource(result.fonte);
        toast.success(`Preços atualizados via API: Diesel ${formatCurrency(result.preco_diesel)}, Gasolina ${formatCurrency(result.preco_gasolina)}.`);
    } catch (error: any) {
        console.error("Erro ao buscar preços via API:", error);
        toast.error(error.message || "Erro ao buscar preços via API. Verifique os dados de consulta.");
    } finally {
        setApiLoading(false);
    }
  };

  // =================================================================
  // LÓGICA DE DETALHAMENTO CUSTOMIZADO
  // =================================================================

  const handleIniciarEdicaoDetalhamento = (registro: ClasseIIIRegistro) => {
    setEditingDetalhamentoId(registro.id);
    setDetalhamentoEdit(registro.detalhamentoCustomizado || registro.detalhamento || "");
  };

  const handleCancelarEdicaoDetalhamento = () => {
    setEditingDetalhamentoId(null);
    setDetalhamentoEdit("");
  };

  const handleSalvarDetalhamentoCustomizado = async (registroId: string) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: detalhamentoEdit,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Detalhamento atualizado com sucesso!");
      handleCancelarEdicaoDetalhamento();
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarDetalhamentoAutomatico = async (registroId: string) => {
    if (!confirm("Deseja restaurar o detalhamento automático? O texto customizado será perdido.")) {
      return;
    }
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from("classe_iii_registros")
        .update({
          detalhamento_customizado: null,
        })
        .eq("id", registroId);

      if (error) throw error;

      toast.success("Detalhamento restaurado!");
      await loadRegistros(ptrabId!);
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // =================================================================
  // RENDERIZAÇÃO
  // =================================================================

  const totalGeral = registros.reduce((sum, r) => sum + r.calculos.valorTotal, 0);
  const displayFases = [...faseAtividade, customFaseAtividade.trim()].filter(f => f).join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-2">
        <Button
          variant="ghost"
          onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="p-6 backdrop-blur-sm bg-card/95 border-primary/10">
          <div className="mb-4">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Classe III - Combustíveis e Lubrificantes
            </h1>
            <p className="text-muted-foreground">
              Configure a necessidade de combustíveis para viaturas, geradores e embarcações.
            </p>
          </div>

          {/* Seção de Referência LPC */}
          <Card className="mb-6 p-4 bg-primary/5 border-primary/10">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowLPCForm(!showLPCForm)}
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Referência de Preços (LPC)
              </h3>
              {showLPCForm ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
            </div>
            
            {showLPCForm && (
              <div className="mt-4 space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ambito">Âmbito da Consulta</Label>
                    <Select
                      value={formLPC.ambito}
                      onValueChange={(value: 'Nacional' | 'Estadual' | 'Municipal') => setFormLPC(prev => ({ ...prev, ambito: value, nome_local: value === 'Nacional' ? '' : prev.nome_local }))}
                    >
                      <SelectTrigger id="ambito">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="Nacional">Nacional (Petrobras)</SelectItem>
                        <SelectItem value="Estadual">Estadual (ANP)</SelectItem>
                        <SelectItem value="Municipal">Municipal (ANP)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="nome_local">
                      {formLPC.ambito === 'Estadual' ? 'Estado' : formLPC.ambito === 'Municipal' ? 'Município' : 'Local (N/A)'}
                    </Label>
                    <Input
                      id="nome_local"
                      value={formLPC.nome_local || ''}
                      onChange={(e) => setFormLPC(prev => ({ ...prev, nome_local: e.target.value }))}
                      placeholder={formLPC.ambito === 'Nacional' ? 'Não aplicável' : 'Ex: São Paulo ou SP'}
                      disabled={formLPC.ambito === 'Nacional'}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_inicio_consulta">Data Início Consulta</Label>
                    <Input
                      id="data_inicio_consulta"
                      type="date"
                      value={formLPC.data_inicio_consulta}
                      onChange={(e) => setFormLPC(prev => ({ ...prev, data_inicio_consulta: e.target.value }))}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_fim_consulta">Data Fim Consulta</Label>
                    <Input
                      id="data_fim_consulta"
                      type="date"
                      value={formLPC.data_fim_consulta}
                      onChange={(e) => setFormLPC(prev => ({ ...prev, data_fim_consulta: e.target.value }))}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="preco_diesel">Preço Diesel (R$/L)</Label>
                    <Input
                      id="preco_diesel"
                      type="number"
                      step="0.001"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={formLPC.preco_diesel || ''}
                      onChange={(e) => setFormLPC(prev => ({ ...prev, preco_diesel: parseFloat(e.target.value) || 0 }))}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="preco_gasolina">Preço Gasolina (R$/L)</Label>
                    <Input
                      id="preco_gasolina"
                      type="number"
                      step="0.001"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={formLPC.preco_gasolina || ''}
                      onChange={(e) => setFormLPC(prev => ({ ...prev, preco_gasolina: parseFloat(e.target.value) || 0 }))}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <Button 
                    type="button" 
                    onClick={handleFetchPrices} 
                    disabled={apiLoading || loading}
                    className="gap-2"
                  >
                    {apiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {apiLoading ? "Buscando..." : "Buscar Preços via API"}
                  </Button>
                  
                  <Button 
                    type="button" 
                    onClick={handleSaveRefLPC} 
                    disabled={loading || formLPC.preco_diesel <= 0 || formLPC.preco_gasolina <= 0}
                    variant="secondary"
                  >
                    Salvar Referência LPC
                  </Button>
                </div>
                
                {apiSource && (
                  <p className="text-xs text-muted-foreground">
                    Última busca: {apiSource}
                  </p>
                )}
                
                {refLPC && (
                  <div className="mt-4 p-3 border rounded-md bg-background">
                    <p className="text-sm font-semibold">Referência Salva:</p>
                    <p className="text-xs text-muted-foreground">
                      Âmbito: {refLPC.ambito} {refLPC.nome_local ? `(${refLPC.nome_local})` : ''} | 
                      Diesel: {formatCurrency(refLPC.preco_diesel)} | 
                      Gasolina: {formatCurrency(refLPC.preco_gasolina)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Formulário de Registro de Equipamento */}
          <form onSubmit={(e) => { e.preventDefault(); handleCadastrar(); }} className="space-y-6">
            <h3 className="text-xl font-bold mb-4">Registro de Consumo</h3>
            
            {/* Linha 1: OM e Tipo de Equipamento */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="om">OM de Destino</Label>
                <OmSelector
                  selectedOmId={selectedOmId}
                  onChange={handleOMChange}
                  placeholder="Selecione uma OM..."
                />
                {ug && (
                  <p className="text-xs text-muted-foreground">
                    CODUG: {ug}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tipoEquipamento">Tipo de Equipamento</Label>
                <Select
                  value={tipoEquipamento}
                  onValueChange={setTipoEquipamento}
                >
                  <SelectTrigger id="tipoEquipamento">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {TIPOS_EQUIPAMENTO.map(tipo => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Detalhe, Qtd, Dias */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoEquipamentoDetalhe">Detalhe do Equipamento</Label>
                {equipamentosDisponiveis.length > 0 ? (
                  <Select
                    value={tipoEquipamentoDetalhe}
                    onValueChange={setTipoEquipamentoDetalhe}
                  >
                    <SelectTrigger id="tipoEquipamentoDetalhe">
                      <SelectValue placeholder="Selecione o modelo..." />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {equipamentosDisponiveis.map(eq => (
                        <SelectItem key={eq.nome} value={eq.nome}>
                          {eq.nome} ({eq.unidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="tipoEquipamentoDetalhe"
                    value={tipoEquipamentoDetalhe}
                    onChange={(e) => setTipoEquipamentoDetalhe(e.target.value)}
                    placeholder="Ex: Vtr 5 ton ou Gerador 15 kva"
                    onKeyDown={handleEnterToNextField}
                  />
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={quantidade === 0 ? "" : quantidade.toString()}
                  onChange={(e) => setQuantidade(Number(e.target.value))}
                  placeholder="Ex: 5"
                  onKeyDown={handleEnterToNextField}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="diasOperacao">Dias de atividade</Label>
                <Input
                  id="diasOperacao"
                  type="number"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={diasOperacao === 0 ? "" : diasOperacao.toString()}
                  onChange={(e) => setDiasOperacao(Number(e.target.value))}
                  placeholder="Ex: 30"
                  onKeyDown={handleEnterToNextField}
                />
              </div>
            </div>

            {/* Linha 3: Consumo e Preço */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoCombustivel">Combustível</Label>
                <Select
                  value={tipoCombustivel}
                  onValueChange={(value: 'GAS' | 'OD') => {
                    setTipoCombustivel(value);
                    // Atualiza o preço com base no LPC salvo
                    if (refLPC) {
                      setPrecoLitro(value === 'OD' ? refLPC.preco_diesel : refLPC.preco_gasolina);
                    }
                  }}
                  disabled={!!tipoEquipamentoDetalhe && equipamentosDisponiveis.length > 0}
                >
                  <SelectTrigger id="tipoCombustivel">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="OD">Óleo Diesel (OD)</SelectItem>
                    <SelectItem value="GAS">Gasolina (GAS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="precoLitro">Preço por Litro (R$)</Label>
                <Input
                  id="precoLitro"
                  type="number"
                  step="0.001"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={precoLitro || ''}
                  onChange={(e) => setPrecoLitro(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 6.50"
                  onKeyDown={handleEnterToNextField}
                />
                {refLPC && (
                  <p className="text-xs text-muted-foreground">
                    LPC: Diesel {formatCurrency(refLPC.preco_diesel)} | Gasolina {formatCurrency(refLPC.preco_gasolina)}
                  </p>
                )}
              </div>

              {/* Campos de Consumo (Condicionais) */}
              {tipoEquipamento === 'MOTOMECANIZACAO' || (tipoEquipamento === 'OUTROS' && !consumoHora) || (consumoKmLitro !== undefined && consumoKmLitro !== null) ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="consumoKmLitro">Consumo (km/L)</Label>
                    <Input
                      id="consumoKmLitro"
                      type="number"
                      step="0.1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={consumoKmLitro || ''}
                      onChange={(e) => setConsumoKmLitro(parseFloat(e.target.value) || undefined)}
                      placeholder="Ex: 5.0"
                      disabled={!!tipoEquipamentoDetalhe && equipamentosDisponiveis.length > 0}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kmDia">KM/Dia</Label>
                    <Input
                      id="kmDia"
                      type="number"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={kmDia || ''}
                      onChange={(e) => setKmDia(parseFloat(e.target.value) || undefined)}
                      placeholder="Ex: 100"
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="consumoHora">Consumo (L/h)</Label>
                    <Input
                      id="consumoHora"
                      type="number"
                      step="0.1"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={consumoHora || ''}
                      onChange={(e) => setConsumoHora(parseFloat(e.target.value) || undefined)}
                      placeholder="Ex: 4.0"
                      disabled={!!tipoEquipamentoDetalhe && equipamentosDisponiveis.length > 0}
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="horasDia">Horas/Dia</Label>
                    <Input
                      id="horasDia"
                      type="number"
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={horasDia || ''}
                      onChange={(e) => setHorasDia(parseFloat(e.target.value) || undefined)}
                      placeholder="Ex: 8"
                      onKeyDown={handleEnterToNextField}
                    />
                  </div>
                </>
              )}
            </div>
            
            {/* Linha 4: Fase da Atividade */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="faseAtividade">Fase da Atividade</Label>
                <Popover open={isFasePopoverOpen} onOpenChange={setIsFasePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isFasePopoverOpen}
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
                            onSelect={() => handleFaseChange(fase, !faseAtividade.includes(fase))}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={faseAtividade.includes(fase)}
                                onChange={(e) => handleFaseChange(fase, e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label>{fase}</Label>
                            </div>
                            {faseAtividade.includes(fase) && <Check className="ml-auto h-4 w-4" />}
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

            {/* Preview dos Cálculos */}
            {quantidade > 0 && diasOperacao > 0 && precoLitro > 0 && (
              <div className="p-6 bg-primary/5 rounded-lg border border-primary/10 space-y-4">
                <h3 className="font-semibold text-lg mb-4">Cálculo de Consumo</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Consumo Base (Sem Margem)</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatNumber(calculos.totalLitrosSemMargem, 2)} L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Litros (c/ Margem {MARGEM_CLASSE_III * 100}%)</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatNumber(calculos.totalLitros, 2)} L
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Total (R$ {precoLitro.toFixed(2)}/L)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(calculos.valorTotal)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Botão Cadastrar/Atualizar e Cancelar */}
            <div className="flex justify-end gap-2 mt-4">
              {editingRegistroId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFormFields}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar Edição
                </Button>
              )}
              <Button
                type="submit"
                className="gap-2"
                disabled={loading || !om || !ug || quantidade <= 0 || diasOperacao <= 0 || precoLitro <= 0 || calculos.valorTotal <= 0}
              >
                <Plus className="h-4 w-4" />
                {loading ? "Aguarde..." : (editingRegistroId ? "Atualizar Registro" : "Cadastrar Registro")}
              </Button>
            </div>
          </form>

          {/* Tabela de Registros */}
          {registros.length > 0 && (
            <div className="space-y-4 mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Registros Cadastrados
                </h2>
                <Badge variant="secondary" className="text-sm">
                  {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-semibold text-sm w-[15%]">OM</th>
                        <th className="text-left p-3 font-semibold text-sm w-[15%]">Equipamento</th>
                        <th className="text-center p-3 font-semibold text-sm w-[8%]">Qtd</th>
                        <th className="text-center p-3 font-semibold text-sm w-[8%]">Dias</th>
                        <th className="text-center p-3 font-semibold text-sm w-[8%]">Comb.</th>
                        <th className="text-right p-3 font-semibold text-sm w-[15%]">Total Litros</th>
                        <th className="text-right p-3 font-semibold text-sm w-[15%]">Valor Total</th>
                        <th className="text-center p-3 font-semibold text-sm w-[10%]">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((registro) => (
                        <tr key={registro.id} className="border-t hover:bg-muted/50">
                          <td className="p-3 text-sm">{registro.organizacao} ({registro.ug})</td>
                          <td className="p-3 text-sm">
                            {registro.tipoEquipamentoDetalhe || registro.tipoEquipamento}
                          </td>
                          <td className="p-3 text-sm text-center">{registro.quantidade}</td>
                          <td className="p-3 text-sm text-center">{registro.diasOperacao}</td>
                          <td className="p-3 text-sm text-center">{registro.tipoCombustivel}</td>
                          <td className="p-3 px-4 text-sm text-right font-medium text-blue-600 whitespace-nowrap">
                            {formatNumber(registro.calculos.totalLitros, 2)} L
                          </td>
                          <td className="p-3 px-4 text-sm text-right font-bold whitespace-nowrap">
                            {formatCurrency(registro.calculos.valorTotal)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleIniciarEdicaoDetalhamento(registro)}
                                      disabled={loading}
                                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                    >
                                      <Info className={`h-4 w-4 ${registro.detalhamentoCustomizado ? 'text-green-600' : ''}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {registro.detalhamentoCustomizado ? "Editar Detalhamento (Customizado)" : "Ver/Editar Detalhamento"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditRegistro(registro)}
                                disabled={loading}
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemover(registro.id)}
                                disabled={loading}
                                className="h-8 w-8 text-destructive hover:text-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t-2">
                      <tr>
                        <td colSpan={6} className="p-3 text-right text-sm font-semibold">
                          TOTAL GERAL:
                        </td>
                        <td className="p-3 px-4 text-sm text-right font-extrabold text-primary text-base whitespace-nowrap">
                          {formatCurrency(totalGeral)}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </Card>
        
        {/* Diálogo de Edição de Detalhamento */}
        {editingDetalhamentoId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-3xl p-6">
              <h4 className="text-xl font-bold mb-4">Editar Detalhamento/Memória de Cálculo</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Edite o texto que será usado na memória de cálculo do PTrab impresso.
              </p>
              <Textarea
                value={detalhamentoEdit}
                onChange={(e) => setDetalhamentoEdit(e.target.value)}
                rows={15}
                className="font-mono text-xs"
              />
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="ghost"
                  onClick={() => handleRestaurarDetalhamentoAutomatico(editingDetalhamentoId)}
                  disabled={loading || !registros.find(r => r.id === editingDetalhamentoId)?.detalhamentoCustomizado}
                  className="gap-2 text-muted-foreground"
                >
                  Restaurar Automático
                </Button>
                <Button
                  onClick={() => handleSalvarDetalhamentoCustomizado(editingDetalhamentoId)}
                  disabled={loading}
                >
                  Salvar Detalhamento
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelarEdicaoDetalhamento}
                >
                  Cancelar
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}