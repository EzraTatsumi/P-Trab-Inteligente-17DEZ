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
import { ArrowLeft, Fuel, Ship, Truck, Zap, Pencil, Trash2, AlertCircle, XCircle, ChevronDown, ChevronUp, Sparkles, ClipboardList, Check, Cloud, Tractor, Droplet } from "lucide-react"; // Adicionado Droplet
import { Badge } from "@/components/ui/badge";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { OMData } from "@/lib/omUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getEquipamentosPorTipo, TipoEquipamentoDetalhado } from "@/data/classeIIIData";
import { RefLPC, RefLPCForm } from "@/types/refLPC";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { updatePTrabStatusIfAberto } from "@/lib/ptrabUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";

type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';

// Opções fixas de fase de atividade
const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

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
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  itens_equipamentos?: any;
  total_litros_sem_margem?: number;
  fase_atividade?: string;
  // NOVOS CAMPOS DE LUBRIFICANTE
  consumo_lubrificante_litro?: number;
  preco_lubrificante?: number;
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
  // NOVOS CAMPOS DE LUBRIFICANTE
  consumo_lubrificante_litro: number;
  preco_lubrificante: number;
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

// NOVO TIPO PARA CONSOLIDADO DE LUBRIFICANTE
interface ConsolidadoLubrificante {
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

// NOVAS INTERFACES PARA EQUIPAMENTO DE ENGENHARIA
interface ItemEngenharia {
  tipo_equipamento_especifico: string;
  quantidade: number;
  horas_dia: number;
  consumo_fixo: number;
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
}

interface FormDataEngenharia {
  selectedOmId?: string;
  organizacao: string;
  ug: string;
  dias_operacao: number;
  itens: ItemEngenharia[];
  fase_atividade?: string;
}

interface ConsolidadoEngenharia {
  tipo_combustivel: 'GASOLINA' | 'DIESEL';
  total_litros_sem_margem: number;
  total_litros: number;
  valor_total: number;
  itens: ItemEngenharia[];
  detalhamento: string;
}
// FIM NOVAS INTERFACES

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
  const addEmbarcacaoRef = useRef<HTMLDivElement>(null);
  const addEngenhariaRef = useRef<HTMLDivElement>(null); // Novo ref
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

  // Estados para Fase da Atividade - Engenharia
  const [fasesAtividadeEngenharia, setFasesAtividadeEngenharia] = useState<string[]>(["Execução"]);
  const [customFaseAtividadeEngenharia, setCustomFaseAtividadeEngenharia] = useState<string>("");
  const [isPopoverOpenEngenharia, setIsPopoverOpenEngenharia] = useState(false);

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
  
  // Handlers para mudança de fase - Engenharia
  const handleFaseChangeEngenharia = (fase: string, checked: boolean) => {
    if (checked) {
      setFasesAtividadeEngenharia([...fasesAtividadeEngenharia, fase]);
    } else {
      setFasesAtividadeEngenharia(fasesAtividadeEngenharia.filter(f => f !== fase));
    }
  };

  const [formData, setFormData] = useState<FormData>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    tipo_equipamento_especifico: "",
    quantidade: 1,
    horas_dia: undefined,
    km_dia: undefined,
    dias_operacao: 1,
    tipo_combustivel: "DIESEL",
    consumo_fixo: 0,
    preco_litro: 0,
  });

  const [rmFornecimento, setRmFornecimento] = useState<string>(""); // Novo estado para o nome da RM fornecedora
  const [codugRmFornecimento, setCodugRmFornecimento] = useState<string>(""); // Novo estado para o CODUG da RM fornecedora
  
  // NOVOS ESTADOS PARA OM DE DESTINO DO LUBRIFICANTE
  const [selectedOmLubrificanteId, setSelectedOmLubrificanteId] = useState<string | undefined>(undefined);
  const [omLubrificante, setOmLubrificante] = useState<string>("");
  const [ugLubrificante, setUgLubrificante] = useState<string>("");

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

  const [itemGeradorTemp, setItemGeradorTemp] = useState<ItemGerador>({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL",
    // NOVOS CAMPOS DE LUBRIFICANTE
    consumo_lubrificante_litro: 0,
    preco_lubrificante: 0,
  });
  const [editingGeradorItemIndex, setEditingGeradorItemIndex] = useState<number | null>(null);

  const [consolidadosGerador, setConsolidadosGerador] = useState<ConsolidadoGerador[]>([]);
  // NOVO TIPO PARA CONSOLIDADO DE LUBRIFICANTE
  const [consolidadoLubrificante, setConsolidadoLubrificante] = useState<ConsolidadoLubrificante | null>(null);

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
  
  // NOVOS ESTADOS PARA ENGENHARIA
  const [formEngenharia, setFormEngenharia] = useState<FormDataEngenharia>({
    selectedOmId: undefined,
    organizacao: "",
    ug: "",
    dias_operacao: 0,
    itens: [],
  });

  const [itemEngenhariaTemp, setItemEngenhariaTemp] = useState({
    tipo_equipamento_especifico: "",
    quantidade: 0,
    horas_dia: 0,
    consumo_fixo: 0,
    tipo_combustivel: "DIESEL" as 'GASOLINA' | 'DIESEL',
  });

  const [editingEngenhariaItemIndex, setEditingEngenhariaItemIndex] = useState<number | null>(null);
  const [consolidadosEngenharia, setConsolidadosEngenharia] = useState<ConsolidadoEngenharia[]>([]);
  // FIM NOVOS ESTADOS

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
    if (tipoSelecionado) {
      carregarEquipamentos();
    }
  }, [tipoSelecionado]);

  useEffect(() => {
    if (tipoSelecionado === 'GERADOR' && formGerador.itens.length > 0) {
      calcularConsolidadosGerador(formGerador.itens);
    } else if (tipoSelecionado === 'GERADOR' && formGerador.itens.length === 0) {
      setConsolidadosGerador([]);
      setConsolidadoLubrificante(null);
    }
  }, [formGerador.dias_operacao, refLPC, formGerador.itens, rmFornecimento, codugRmFornecimento, omLubrificante, ugLubrificante]); // Adicionado omLubrificante/ugLubrificante

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
  
  // NOVO EFEITO PARA ENGENHARIA
  useEffect(() => {
    if (tipoSelecionado === 'EQUIPAMENTO_ENGENHARIA' && formEngenharia.itens.length > 0) {
      calcularConsolidadosEngenharia(formEngenharia.itens);
    }
  }, [formEngenharia.dias_operacao, refLPC, formEngenharia.itens, rmFornecimento, codugRmFornecimento]);
  // FIM NOVO EFEITO

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

  const carregarEquipamentos = async () => {
    if (!tipoSelecionado) return;
    const equipamentos = await getEquipamentosPorTipo(tipoSelecionado);
    setEquipamentosDisponiveis(equipamentos);
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

      toast.success("Memória de cálculo restaurada!");
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao restaurar memória:", error);
      toast.error("Erro ao restaurar memória automática");
    } finally {
      setLoading(false);
    }
  };

  // Função para formatar as fases de forma natural no texto
  const formatFasesParaTexto = (faseCSV: string | null | undefined): string => {
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

  const resetFormFields = () => {
    setEditingId(null);
    setFormData({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      tipo_equipamento_especifico: "",
      quantidade: 1,
      horas_dia: undefined,
      km_dia: undefined,
      dias_operacao: 1,
      tipo_combustivel: "DIESEL",
      consumo_fixo: 0,
      preco_litro: refLPC?.preco_diesel ?? 0,
    });
    setRmFornecimento("");
    setCodugRmFornecimento("");
    setSelectedOmLubrificanteId(undefined); // Reset Lubrificante OM
    setOmLubrificante("");
    setUgLubrificante("");
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
      quantidade: 0,
      horas_dia: 0,
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
      // NOVOS CAMPOS DE LUBRIFICANTE
      consumo_lubrificante_litro: 0,
      preco_lubrificante: 0,
    });
    setEditingGeradorItemIndex(null);
    setConsolidadosGerador([]);
    setConsolidadoLubrificante(null); // Reset Lubrificante
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
    
    // Reset Engenharia
    setFormEngenharia({
      selectedOmId: undefined,
      organizacao: "",
      ug: "",
      dias_operacao: 0,
      itens: [],
    });
    setItemEngenhariaTemp({
      tipo_equipamento_especifico: "",
      quantidade: 0,
      horas_dia: 0,
      consumo_fixo: 0,
      tipo_combustivel: "DIESEL",
    });
    setConsolidadosEngenharia([]);
    setEditingEngenhariaItemIndex(null);
    
    // Reset fases
    setFasesAtividadeGerador(["Execução"]);
    setCustomFaseAtividadeGerador("");
    setFasesAtividadeViatura(["Execução"]);
    setCustomFaseAtividadeViatura("");
    setFasesAtividadeEmbarcacao(["Execução"]);
    setCustomFaseAtividadeEmbarcacao("");
    setFasesAtividadeEngenharia(["Execução"]);
    setCustomFaseAtividadeEngenharia("");
  };

  const handleCancelEdit = () => {
    resetFormFields();
    setTipoSelecionado(null);
  };

  const handleEditar = async (registro: ClasseIIIRegistro) => {
    resetFormFields();
    setEditingId(registro.id);
    setTipoSelecionado(registro.tipo_equipamento as TipoEquipamento);
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

    if (registro.tipo_equipamento === 'GERADOR' || registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR') {
      // Para edição de gerador, precisamos carregar todos os registros (combustível e lubrificante)
      // para a mesma OM/UG e consolidá-los no formulário.
      
      // 1. Buscar todos os registros de GERADOR e LUBRIFICANTE_GERADOR para esta OM/UG
      const { data: relatedRecords, error: relatedError } = await supabase
        .from("classe_iii_registros")
        .select("*, consumo_lubrificante_litro, preco_lubrificante")
        .eq("p_trab_id", ptrabId!)
        .in("tipo_equipamento", ["GERADOR", "LUBRIFICANTE_GERADOR"])
        .eq("organizacao", registro.organizacao)
        .eq("ug", registro.ug);
        
      if (relatedError) {
        console.error("Erro ao carregar registros relacionados para edição:", relatedError);
        toast.error("Erro ao carregar registros relacionados para edição.");
        return;
      }
      
      // 2. Extrair a lista de itens (itens_equipamentos) de um dos registros (eles devem ser iguais)
      const itemRecord = relatedRecords?.find(r => r.itens_equipamentos);
      const itens = (itemRecord?.itens_equipamentos as ItemGerador[]) || [];
      
      // 3. Preencher o formulário de Gerador
      setFormGerador({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: itens,
      });
      
      // 4. Preencher a OM de destino do Lubrificante (se houver registro de lubrificante)
      const lubrificanteRecord = relatedRecords?.find(r => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR');
      if (lubrificanteRecord) {
        // A OM de destino do lubrificante é a OM do registro (organizacao/ug)
        // Precisamos buscar o ID da OM de destino do lubrificante para preencher o OmSelector
        let lubOmId: string | undefined = undefined;
        try {
          const { data: lubOmData, error: lubOmError } = await supabase
            .from('organizacoes_militares')
            .select('id')
            .eq('nome_om', lubrificanteRecord.organizacao)
            .eq('codug_om', lubrificanteRecord.ug)
            .single();
          if (lubOmData && !lubOmError) {
            lubOmId = lubOmData.id;
          }
        } catch (error) {
          console.error("Erro ao buscar OM de lubrificante para edição:", error);
        }
        
        setSelectedOmLubrificanteId(lubOmId);
        setOmLubrificante(lubrificanteRecord.organizacao);
        setUgLubrificante(lubrificanteRecord.ug);
      } else {
        // Se não houver registro de lubrificante, assume-se a OM detentora
        setSelectedOmLubrificanteId(selectedOmIdForEdit);
        setOmLubrificante(registro.organizacao);
        setUgLubrificante(registro.ug);
      }
      
      // 5. Preencher as fases (pegar de qualquer registro)
      const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
      setFasesAtividadeGerador(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
      setCustomFaseAtividadeGerador(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
      
      // O editingId é mantido para indicar que estamos em modo de edição, mas o salvamento
      // será feito deletando e reinserindo todos os registros consolidados para esta OM/UG.
      setEditingId(registro.id); 

    } else if (registro.tipo_equipamento === 'MOTOMECANIZACAO') {
      setFormViatura({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemViatura[]) || [],
      });
      const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
      setFasesAtividadeViatura(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
      setCustomFaseAtividadeViatura(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    } else if (registro.tipo_equipamento === 'EMBARCACAO') {
      setFormEmbarcacao({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemEmbarcacao[]) || [],
      });
      const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
      setFasesAtividadeEmbarcacao(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
      setCustomFaseAtividadeEmbarcacao(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
    } else if (registro.tipo_equipamento === 'EQUIPAMENTO_ENGENHARIA') {
      setFormEngenharia({
        selectedOmId: selectedOmIdForEdit,
        organizacao: registro.organizacao,
        ug: registro.ug,
        dias_operacao: registro.dias_operacao,
        itens: (registro.itens_equipamentos as ItemEngenharia[]) || [],
      });
      const fasesSalvas = (registro.fase_atividade || 'Execução').split(';').map(f => f.trim()).filter(f => f);
      setFasesAtividadeEngenharia(fasesSalvas.filter(f => FASES_PADRAO.includes(f)));
      setCustomFaseAtividadeEngenharia(fasesSalvas.find(f => !FASES_PADRAO.includes(f)) || "");
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

  // --- Lógica Comum de OM e RM ---
  const handleRMFornecimentoChange = (rmName: string, rmCodug: string) => {
    setRmFornecimento(rmName);
    setCodugRmFornecimento(rmCodug);
  };

  // --- Lógica Gerador ---
  const handleOMGeradorChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormGerador({ ...formGerador, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
      
      // Define a OM detentora como OM de destino do lubrificante por padrão
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
  
  // NOVO HANDLER PARA OM DE DESTINO DO LUBRIFICANTE
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
  
  const handleTipoGeradorChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemGeradorTemp({ 
        ...itemGeradorTemp, 
        tipo_equipamento_especifico: tipoNome, 
        tipo_combustivel: novoCombustivel, 
        consumo_fixo: equipamento.consumo,
        // Resetar campos de lubrificante ao mudar o tipo
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
      });
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
    setEditingGeradorItemIndex(null);
  };
  const handleEditGeradorItem = (item: ItemGerador, index: number) => {
    setItemGeradorTemp(item);
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
    setEditingGeradorItemIndex(null);
  };
  const removerItemGerador = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formGerador.itens.filter((_, i) => i !== index);
    setFormGerador({ ...formGerador, itens: novosItens });
    if (editingGeradorItemIndex === index) { handleCancelEditGeradorItem(); }
    toast.success("Item de gerador removido!");
  };
  
  const calcularConsolidadosGerador = (itens: ItemGerador[]) => {
    if (itens.length === 0) { 
      setConsolidadosGerador([]); 
      setConsolidadoLubrificante(null);
      return; 
    }
    
    // --- CÁLCULO DE COMBUSTÍVEL (ND 33.90.39) ---
    const gruposCombustivel = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemGerador[]>);
    
    const consolidadosCombustivel: ConsolidadoGerador[] = [];
    Object.entries(gruposCombustivel).forEach(([combustivel, itensGrupo]) => {
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
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';
      const totalGeradores = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividadeGerador];
      if (customFaseAtividadeGerador.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeGerador.trim()]; }
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
    setConsolidadosGerador(consolidadosCombustivel);
    
    // --- CÁLCULO DE LUBRIFICANTE (ND 33.90.30) ---
    let totalLitrosLubrificante = 0;
    let totalValorLubrificante = 0;
    const itensComLubrificante = itens.filter(item => item.consumo_lubrificante_litro > 0 && item.preco_lubrificante > 0);
    const detalhesLubrificante: string[] = [];
    
    itensComLubrificante.forEach(item => {
      // Cálculo: (Quantidade * Horas/dia * Dias Operação) / 100h * Consumo Lubrificante
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
      let fasesFinaisCalc = [...fasesAtividadeGerador];
      if (customFaseAtividadeGerador.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeGerador.trim()]; }
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
    
    setConsolidadoLubrificante(consolidadoLubrificante);
  };
  
  const salvarRegistrosConsolidadosGerador = async () => {
    if (!ptrabId) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); if (lpcRef.current) { lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (!formGerador.organizacao || !formGerador.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formGerador.itens.length === 0) { toast.error("Adicione pelo menos um gerador"); return; }
    if (consolidadoLubrificante && (!omLubrificante || !ugLubrificante)) { toast.error("Selecione a OM de destino do Lubrificante (ND 30)"); return; }
    
    let fasesFinais = [...fasesAtividadeGerador];
    if (customFaseAtividadeGerador.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeGerador.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    
    const registrosParaSalvar: TablesInsert<'classe_iii_registros'>[] = [];
    
    // 1. Preparar registros de COMBUSTÍVEL (ND 33.90.39)
    for (const consolidado of consolidadosGerador) {
      const registro: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'GERADOR',
        tipo_equipamento_detalhe: null,
        organizacao: formGerador.organizacao, // OM Detentora
        ug: formGerador.ug, // UG Detentora
        quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formGerador.dias_operacao,
        tipo_combustivel: consolidado.tipo_combustivel,
        preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0),
        total_litros: consolidado.total_litros,
        total_litros_sem_margem: consolidado.total_litros_sem_margem,
        valor_total: consolidado.valor_total,
        detalhamento: consolidado.detalhamento,
        itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
        fase_atividade: faseFinalString,
        // Lubrificante fields are 0 for the fuel record
        consumo_lubrificante_litro: 0,
        preco_lubrificante: 0,
      };
      registrosParaSalvar.push(registro);
    }
    
    // 2. Preparar registro de LUBRIFICANTE (ND 33.90.30)
    if (consolidadoLubrificante) {
      // Usamos o tipo 'LUBRIFICANTE_GERADOR' para diferenciar este registro
      const registroLubrificante: TablesInsert<'classe_iii_registros'> = {
        p_trab_id: ptrabId,
        tipo_equipamento: 'LUBRIFICANTE_GERADOR', // Novo tipo para identificar
        tipo_equipamento_detalhe: null,
        organizacao: omLubrificante, // OM de Destino do Recurso (Pode ser diferente da detentora)
        ug: ugLubrificante, // UG de Destino do Recurso
        quantidade: consolidadoLubrificante.itens.reduce((sum, item) => sum + item.quantidade, 0),
        dias_operacao: formGerador.dias_operacao,
        tipo_combustivel: 'LUBRIFICANTE', // Tipo de combustível genérico para lubrificante
        preco_litro: 0, // Preço unitário não se aplica ao total consolidado
        total_litros: consolidadoLubrificante.total_litros,
        total_litros_sem_margem: consolidadoLubrificante.total_litros, // Sem margem para lubrificante
        valor_total: consolidadoLubrificante.valor_total,
        detalhamento: consolidadoLubrificante.detalhamento,
        itens_equipamentos: JSON.parse(JSON.stringify(consolidadoLubrificante.itens)),
        fase_atividade: faseFinalString,
        // Campos de lubrificante (usamos os valores do primeiro item para fins de exibição na tabela, mas o cálculo é consolidado)
        consumo_lubrificante_litro: consolidadoLubrificante.itens[0]?.consumo_lubrificante_litro || 0,
        preco_lubrificante: consolidadoLubrificante.itens[0]?.preco_lubrificante || 0,
      };
      registrosParaSalvar.push(registroLubrificante);
    }

    try {
      setLoading(true);
      
      // 3. Deletar registros existentes (Combustível e Lubrificante) para esta OM/Tipo
      // Para a edição, precisamos deletar todos os registros que pertencem à OM detentora original
      // e que são do tipo GERADOR ou LUBRIFICANTE_GERADOR.
      const { error: deleteError } = await supabase
        .from("classe_iii_registros")
        .delete()
        .eq("p_trab_id", ptrabId)
        .in("tipo_equipamento", ["GERADOR", "LUBRIFICANTE_GERADOR"])
        .eq("organizacao", formGerador.organizacao) // Usar a OM detentora como filtro de exclusão
        .eq("ug", formGerador.ug);
      if (deleteError) { console.error("Erro ao deletar registros existentes de gerador/lubrificante para edição:", deleteError); throw deleteError; }
      
      // 4. Inserir novos registros
      const { error: insertError } = await supabase.from("classe_iii_registros").insert(registrosParaSalvar);
      if (insertError) throw insertError;
      
      toast.success(editingId ? "Registros de geradores e lubrificantes atualizados com sucesso!" : "Registros de geradores e lubrificantes salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      setTipoSelecionado(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de gerador/lubrificante:", error);
      toast.error("Erro ao salvar/atualizar registros de gerador/lubrificante");
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica Viatura ---
  const handleOMViaturaChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormViatura({ ...formViatura, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormViatura({ ...formViatura, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };
  const handleTipoViaturaChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemViaturaTemp({ ...itemViaturaTemp, tipo_equipamento_especifico: tipoNome, tipo_combustivel: novoCombustivel, consumo_fixo: equipamento.consumo });
    }
  };
  const adicionarOu AtualizarItemViatura = () => {
    if (!itemViaturaTemp.tipo_equipamento_especifico || itemViaturaTemp.quantidade <= 0 || itemViaturaTemp.distancia_percorrida <= 0 || itemViaturaTemp.quantidade_deslocamentos <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }
    const novoItem: ItemViatura = { ...itemViaturaTemp };
    let novosItens = [...formViatura.itens];
    if (editingViaturaItemIndex !== null) {
      novosItens[editingViaturaItemIndex] = novoItem;
      toast.success("Item de viatura atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de viatura adicionado!");
    }
    setFormViatura({ ...formViatura, itens: novosItens });
    setItemViaturaTemp({ tipo_equipamento_especifico: "", quantidade: 0, distancia_percorrida: 0, quantidade_deslocamentos: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingViaturaItemIndex(null);
  };
  const handleEditViaturaItem = (item: ItemViatura, index: number) => {
    setItemViaturaTemp(item);
    setEditingViaturaItemIndex(index);
    if (addViaturaRef.current) { addViaturaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  const handleCancelEditViaturaItem = () => {
    setItemViaturaTemp({ tipo_equipamento_especifico: "", quantidade: 0, distancia_percorrida: 0, quantidade_deslocamentos: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingViaturaItemIndex(null);
  };
  const removerItemViatura = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formViatura.itens.filter((_, i) => i !== index);
    setFormViatura({ ...formViatura, itens: novosItens });
    if (editingViaturaItemIndex === index) { handleCancelEditViaturaItem(); }
    toast.success("Item de viatura removido!");
  };
  const calcularConsolidadosViatura = (itens: ItemViatura[]) => {
    if (itens.length === 0) { setConsolidadosViatura([]); return; }
    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
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
        detalhes.push(`- ${item.quantidade} ${item.tipo_equipamento_especifico}: (${formatNumber(item.distancia_percorrida)} km x ${item.quantidade} vtr x ${item.quantidade_deslocamentos} desloc) ÷ ${formatNumber(item.consumo_fixo, 1)} km/L = ${formatNumber(litrosItem)} L ${unidade}.`);
      });
      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';
      const totalViaturas = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividadeViatura];
      if (customFaseAtividadeViatura.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeViatura.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      const detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalViaturas} viaturas, durante ${formViatura.dias_operacao} dias de ${faseFormatada}, para ${formViatura.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Rendimento das viaturas:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} km/L.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Distância a percorrer × Nr Viaturas × Nr Deslocamentos) ÷ Rendimento (km/L).
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
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); if (lpcRef.current) { lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (!formViatura.organizacao || !formViatura.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formViatura.itens.length === 0) { toast.error("Adicione pelo menos uma viatura"); return; }
    let fasesFinais = [...fasesAtividadeViatura];
    if (customFaseAtividadeViatura.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeViatura.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
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
        if (deleteError) { console.error("Erro ao deletar registros existentes de viatura para edição:", deleteError); throw deleteError; }
      }
      for (const consolidado of consolidadosViatura) {
        const registro: TablesInsert<'classe_iii_registros'> = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'MOTOMECANIZACAO',
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
          consumo_lubrificante_litro: 0,
          preco_lubrificante: 0,
        };
        const { error } = await supabase.from("classe_iii_registros").insert([registro]);
        if (error) throw error;
      }
      toast.success(editingId ? "Registros de viaturas atualizados com sucesso!" : "Registros de viaturas salvos com sucesso!");
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

  // --- Lógica Embarcação ---
  const handleOMEmbarcacaoChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormEmbarcacao({ ...formEmbarcacao, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormEmbarcacao({ ...formEmbarcacao, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };
  const handleTipoEmbarcacaoChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const combustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemEmbarcacaoTemp({ ...itemEmbarcacaoTemp, tipo_equipamento_especifico: tipoNome, consumo_fixo: equipamento.consumo, tipo_combustivel: combustivel as 'GASOLINA' | 'DIESEL' });
    }
  };
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
    setItemEmbarcacaoTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setTimeout(() => { addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };
  const removerItemEmbarcacao = (index: number) => {
    const novosItens = formEmbarcacao.itens.filter((_, i) => i !== index);
    setFormEmbarcacao({ ...formEmbarcacao, itens: novosItens });
    toast.success("Item removido!");
  };
  const handleEditEmbarcacaoItem = (item: ItemEmbarcacao, index: number) => {
    setItemEmbarcacaoTemp({ ...item });
    setEditingEmbarcacaoItemIndex(index);
    setTimeout(() => { addEmbarcacaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };
  const handleCancelEditEmbarcacaoItem = () => {
    setItemEmbarcacaoTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingEmbarcacaoItemIndex(null);
  };
  const calcularConsolidadosEmbarcacao = (itens: ItemEmbarcacao[]) => {
    if (!refLPC || !formEmbarcacao.organizacao || !rmFornecimento) { setConsolidadosEmbarcacao([]); return; }
    const gruposPorCombustivel = itens.reduce((grupos, item) => {
      if (!grupos[item.tipo_combustivel]) { grupos[item.tipo_combustivel] = []; }
      grupos[item.tipo_combustivel].push(item);
      return grupos;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemEmbarcacao[]>);
    const novosConsolidados: ConsolidadoEmbarcacao[] = [];
    Object.entries(gruposPorCombustivel).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as 'GASOLINA' | 'DIESEL';
      const precoLitro = tipoCombustivel === 'GASOLINA' ? refLPC.preco_gasolina : refLPC.preco_diesel;
      let totalLitrosSemMargem = 0;
      let fasesFinaisCalc = [...fasesAtividadeEmbarcacao];
      if (customFaseAtividadeEmbarcacao.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEmbarcacao.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      let detalhamento = `33.90.39 - Aquisição de Combustível (${tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}) para Embarcações, durante ${formEmbarcacao.dias_operacao} dias de ${faseFormatada}, para ${formEmbarcacao.organizacao}.\nFornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})\n\nCálculo:\n`;
      itensGrupo.forEach(item => {
        const litrosSemMargemItem = item.quantidade * item.consumo_fixo * item.horas_dia * formEmbarcacao.dias_operacao;
        totalLitrosSemMargem += litrosSemMargemItem;
        detalhamento += `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.\n`;
        detalhamento += `  (${item.quantidade} embarcações x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formEmbarcacao.dias_operacao} dias = ${formatNumber(litrosSemMargemItem)} L.\n`;
      });
      const totalLitros = totalLitrosSemMargem * 1.3;
      const valorTotal = totalLitros * precoLitro;
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';
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
  const salvarRegistrosConsolidadosEmbarcacao = async () => {
    if (!ptrabId || consolidadosEmbarcacao.length === 0) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); if (lpcRef.current) { lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (!formEmbarcacao.organizacao || !formEmbarcacao.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de fornecimento de combustível"); return; }
    if (formEmbarcacao.itens.length === 0) { toast.error("Adicione pelo menos uma embarcação"); return; }
    let fasesFinais = [...fasesAtividadeEmbarcacao];
    if (customFaseAtividadeEmbarcacao.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeEmbarcacao.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    setLoading(true);
    try {
      if (editingId) {
        const { error: deleteError } = await supabase
          .from("classe_iii_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("tipo_equipamento", "EMBARCACAO")
          .eq("organizacao", formEmbarcacao.organizacao)
          .eq("ug", formEmbarcacao.ug);
        if (deleteError) { console.error("Erro ao deletar registros existentes de embarcação para edição:", deleteError); throw deleteError; }
      }
      for (const consolidado of consolidadosEmbarcacao) {
        const precoLitro = consolidado.tipo_combustivel === 'GASOLINA' ? refLPC!.preco_gasolina : refLPC!.preco_diesel;
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
        const { error } = await supabase.from("classe_iii_registros").insert([registro]);
        if (error) throw error;
      }
      toast.success(`${consolidadosEmbarcacao.length} ${consolidadosEmbarcacao.length === 1 ? 'registro salvo' : 'registros salvos'} com sucesso!`);
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      setTipoSelecionado(null);
      await fetchRegistros();
    } catch (error: any) {
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  // --- Lógica Equipamento de Engenharia ---
  const handleOMEngenhariaChange = (omData: OMData | undefined) => {
    if (omData) {
      setFormEngenharia({ ...formEngenharia, selectedOmId: omData.id, organizacao: omData.nome_om, ug: omData.codug_om });
      setRmFornecimento(omData.rm_vinculacao);
      setCodugRmFornecimento(omData.codug_rm_vinculacao);
    } else {
      setFormEngenharia({ ...formEngenharia, selectedOmId: undefined, organizacao: "", ug: "" });
      setRmFornecimento("");
      setCodugRmFornecimento("");
    }
  };
  const handleTipoEngenhariaChange = (tipoNome: string) => {
    const equipamento = equipamentosDisponiveis.find(eq => eq.nome === tipoNome);
    if (equipamento) {
      const novoCombustivel = equipamento.combustivel === 'GAS' ? 'GASOLINA' : 'DIESEL';
      setItemEngenhariaTemp({ ...itemEngenhariaTemp, tipo_equipamento_especifico: tipoNome, tipo_combustivel: novoCombustivel, consumo_fixo: equipamento.consumo });
    }
  };
  const adicionarOuAtualizarItemEngenharia = () => {
    if (!itemEngenhariaTemp.tipo_equipamento_especifico || itemEngenhariaTemp.quantidade <= 0 || itemEngenhariaTemp.horas_dia <= 0) {
      toast.error("Preencha todos os campos do item");
      return;
    }
    const novoItem: ItemEngenharia = { ...itemEngenhariaTemp };
    let novosItens = [...formEngenharia.itens];
    if (editingEngenhariaItemIndex !== null) {
      novosItens[editingEngenhariaItemIndex] = novoItem;
      toast.success("Item de engenharia atualizado!");
    } else {
      novosItens.push(novoItem);
      toast.success("Item de engenharia adicionado!");
    }
    setFormEngenharia({ ...formEngenharia, itens: novosItens });
    setItemEngenhariaTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingEngenhariaItemIndex(null);
  };
  const handleEditEngenhariaItem = (item: ItemEngenharia, index: number) => {
    setItemEngenhariaTemp(item);
    setEditingEngenhariaItemIndex(index);
    if (addEngenhariaRef.current) { addEngenhariaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };
  const handleCancelEditEngenhariaItem = () => {
    setItemEngenhariaTemp({ tipo_equipamento_especifico: "", quantidade: 0, horas_dia: 0, consumo_fixo: 0, tipo_combustivel: "DIESEL" });
    setEditingEngenhariaItemIndex(null);
  };
  const removerItemEngenharia = (index: number) => {
    if (!confirm("Deseja realmente remover este item?")) return;
    const novosItens = formEngenharia.itens.filter((_, i) => i !== index);
    setFormEngenharia({ ...formEngenharia, itens: novosItens });
    if (editingEngenhariaItemIndex === index) { handleCancelEditEngenhariaItem(); }
    toast.success("Item de engenharia removido!");
  };
  const calcularConsolidadosEngenharia = (itens: ItemEngenharia[]) => {
    if (itens.length === 0) { setConsolidadosEngenharia([]); return; }
    const grupos = itens.reduce((acc, item) => {
      if (!acc[item.tipo_combustivel]) { acc[item.tipo_combustivel] = []; }
      acc[item.tipo_combustivel].push(item);
      return acc;
    }, {} as Record<'GASOLINA' | 'DIESEL', ItemEngenharia[]>);
    const consolidados: ConsolidadoEngenharia[] = [];
    Object.entries(grupos).forEach(([combustivel, itensGrupo]) => {
      const tipoCombustivel = combustivel as 'GASOLINA' | 'DIESEL';
      let totalLitrosSemMargem = 0;
      const detalhes: string[] = [];
      itensGrupo.forEach(item => {
        const litrosItem = item.quantidade * item.horas_dia * item.consumo_fixo * formEngenharia.dias_operacao;
        totalLitrosSemMargem += litrosItem;
        const unidade = tipoCombustivel === 'GASOLINA' ? 'GAS' : 'OD';
        detalhes.push(`- (${item.quantidade} ${item.tipo_equipamento_especifico} x ${formatNumber(item.horas_dia, 1)} horas/dia x ${formatNumber(item.consumo_fixo, 1)} L/h) x ${formEngenharia.dias_operacao} dias = ${formatNumber(litrosItem)} L ${unidade}.`);
      });
      const totalLitros = totalLitrosSemMargem * 1.3;
      const preco = tipoCombustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0);
      const valorTotal = totalLitros * preco;
      const combustivelLabel = tipoCombustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel';
      const unidadeLabel = tipoCombustivel === 'GASOLINA' ? 'Gas' : 'OD';
      const formatarData = (data: string) => { const [ano, mes, dia] = data.split('-'); return `${dia}/${mes}/${ano}`; };
      const dataInicioFormatada = refLPC ? formatarData(refLPC.data_inicio_consulta) : '';
      const dataFimFormatada = refLPC ? formatarData(refLPC.data_fim_consulta) : '';
      const localConsulta = refLPC?.ambito === 'Nacional' ? '' : refLPC?.nome_local ? `(${refLPC.nome_local})` : '';
      const totalEquipamentos = itensGrupo.reduce((sum, item) => sum + item.quantidade, 0);
      let fasesFinaisCalc = [...fasesAtividadeEngenharia];
      if (customFaseAtividadeEngenharia.trim()) { fasesFinaisCalc = [...fasesFinaisCalc, customFaseAtividadeEngenharia.trim()]; }
      const faseFinalStringCalc = fasesFinaisCalc.filter(f => f).join('; ');
      const faseFormatada = formatFasesParaTexto(faseFinalStringCalc);
      const detalhamento = `33.90.39 - Aquisição de Combustível (${combustivelLabel}) para ${totalEquipamentos} equipamentos de engenharia, durante ${formEngenharia.dias_operacao} dias de ${faseFormatada}, para ${formEngenharia.organizacao}.
Fornecido por: ${rmFornecimento} (CODUG: ${codugRmFornecimento})

Cálculo:
${itensGrupo.map(item => `- ${item.tipo_equipamento_especifico}: ${formatNumber(item.consumo_fixo, 1)} L/h.`).join('\n')}

Consulta LPC de ${dataInicioFormatada} a ${dataFimFormatada} ${localConsulta}: ${combustivelLabel} - ${formatCurrency(preco)}.

Fórmula: (Nr Equipamentos x Nr Horas utilizadas/dia x Consumo/hora) x Nr dias de operação.
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
    setConsolidadosEngenharia(consolidados);
  };
  const salvarRegistrosConsolidadosEngenharia = async () => {
    if (!ptrabId || consolidadosEngenharia.length === 0) return;
    if (!refLPC) { toast.error("Configure a referência LPC antes de salvar"); if (lpcRef.current) { lpcRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
    if (!formEngenharia.organizacao || !formEngenharia.ug) { toast.error("Selecione uma OM"); return; }
    if (!rmFornecimento || !codugRmFornecimento) { toast.error("Selecione a RM de Fornecimento de Combustível"); return; }
    if (formEngenharia.itens.length === 0) { toast.error("Adicione pelo menos um equipamento"); return; }
    let fasesFinais = [...fasesAtividadeEngenharia];
    if (customFaseAtividadeEngenharia.trim()) { fasesFinais = [...fasesFinais, customFaseAtividadeEngenharia.trim()]; }
    const faseFinalString = fasesFinais.filter(f => f).join('; ');
    if (!faseFinalString) { toast.error("Selecione ou digite pelo menos uma Fase da Atividade."); return; }
    try {
      setLoading(true);
      if (editingId) {
        const { error: deleteError } = await supabase
          .from("classe_iii_registros")
          .delete()
          .eq("p_trab_id", ptrabId)
          .eq("tipo_equipamento", "EQUIPAMENTO_ENGENHARIA")
          .eq("organizacao", formEngenharia.organizacao)
          .eq("ug", formEngenharia.ug);
        if (deleteError) { console.error("Erro ao deletar registros existentes de engenharia para edição:", deleteError); throw deleteError; }
      }
      for (const consolidado of consolidadosEngenharia) {
        const registro: TablesInsert<'classe_iii_registros'> = {
          p_trab_id: ptrabId,
          tipo_equipamento: 'EQUIPAMENTO_ENGENHARIA',
          tipo_equipamento_detalhe: null,
          organizacao: formEngenharia.organizacao,
          ug: formEngenharia.ug,
          quantidade: consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0),
          potencia_hp: null,
          horas_dia: null,
          km_dia: null,
          consumo_hora: null,
          consumo_km_litro: null,
          dias_operacao: formEngenharia.dias_operacao,
          tipo_combustivel: consolidado.tipo_combustivel,
          preco_litro: consolidado.tipo_combustivel === 'GASOLINA' ? (refLPC?.preco_gasolina ?? 0) : (refLPC?.preco_diesel ?? 0),
          total_litros: consolidado.total_litros,
          total_litros_sem_margem: consolidado.total_litros_sem_margem,
          valor_total: consolidado.valor_total,
          detalhamento: consolidado.detalhamento,
          itens_equipamentos: JSON.parse(JSON.stringify(consolidado.itens)),
          fase_atividade: faseFinalString,
          consumo_lubrificante_litro: 0,
          preco_lubrificante: 0,
        };
        const { error } = await supabase.from("classe_iii_registros").insert([registro]);
        if (error) throw error;
      }
      toast.success(editingId ? "Registros de engenharia atualizados com sucesso!" : "Registros de engenharia salvos com sucesso!");
      await updatePTrabStatusIfAberto(ptrabId);
      resetFormFields();
      setTipoSelecionado(null);
      fetchRegistros();
    } catch (error) {
      console.error("Erro ao salvar/atualizar registros de engenharia:", error);
      toast.error("Erro ao salvar/atualizar registros de engenharia");
    } finally {
      setLoading(false);
    }
  };
  // FIM Lógica Equipamento de Engenharia

  if (!tipoSelecionado) {
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

          <Card className="mb-6 border-2 border-primary/20" ref={lpcRef}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Fuel className="h-5 w-5" />
                  Referência de Preços - Consulta LPC
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsLPCFormExpanded(!isLPCFormExpanded)}
                >
                  {isLPCFormExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {isLPCFormExpanded && (
              <CardContent>
                {!refLPC && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Configure a referência de preços LPC para este P Trab antes de adicionar registros de Classe III.
                    </AlertDescription>
                  </Alert>
                )}
                
                <form onSubmit={(e) => { e.preventDefault(); handleSalvarRefLPC(); }}>
                  <div className="flex justify-end mb-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      disabled 
                      className="gap-2 text-muted-foreground"
                    >
                      <Cloud className="h-4 w-4" />
                      Consultar via API (Em breve)
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Data Início Consulta</Label>
                      <Input
                        type="date"
                        value={formLPC.data_inicio_consulta}
                        onChange={(e) => setFormLPC({...formLPC, data_inicio_consulta: e.target.value})}
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Data Fim Consulta</Label>
                      <Input
                        type="date"
                        value={formLPC.data_fim_consulta}
                        onChange={(e) => setFormLPC({...formLPC, data_fim_consulta: e.target.value})}
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Âmbito da Pesquisa</Label>
                      <Select
                        value={formLPC.ambito}
                        onValueChange={(val) => setFormLPC({...formLPC, ambito: val as 'Nacional' | 'Estadual' | 'Municipal'})}
                      >
                        <SelectTrigger>
                          <SelectValue />
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
                        <Label>{formLPC.ambito === 'Estadual' ? 'Estado' : 'Município'}</Label>
                        <Input
                          value={formLPC.nome_local || ''}
                          onChange={(e) => setFormLPC({...formLPC, nome_local: e.target.value})}
                          placeholder={formLPC.ambito === 'Estadual' ? 'Ex: Rio de Janeiro' : 'Ex: Niterói'}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Preço Diesel</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                          value={formLPC.preco_diesel.toFixed(2)}
                          onChange={(e) => setFormLPC({...formLPC, preco_diesel: parseFloat(e.target.value) || 0})}
                          onKeyDown={handleEnterToNextField}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$/litro
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Preço Gasolina</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-16"
                          value={formLPC.preco_gasolina.toFixed(2)}
                          onChange={(e) => setFormLPC({...formLPC, preco_gasolina: parseFloat(e.target.value) || 0})}
                          onKeyDown={handleEnterToNextField}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$/litro
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-4">
                    <Button type="submit">
                      {refLPC ? "Atualizar Referência LPC" : "Salvar Referência LPC"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Classe III - Combustíveis e Lubrificantes</CardTitle>
              <CardDescription>
                Selecione o tipo de equipamento para cadastrar as necessidades
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!refLPC && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Configure a referência LPC antes de adicionar equipamentos.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('GERADOR')}
                  disabled={!refLPC}
                >
                  <Zap className="mr-3 h-6 w-6" />
                  Gerador
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('EMBARCACAO')}
                  disabled={!refLPC}
                >
                  <Ship className="mr-3 h-6 w-6" />
                  Embarcação
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('EQUIPAMENTO_ENGENHARIA')}
                  disabled={!refLPC}
                >
                  <Tractor className="mr-3 h-6 w-6" />
                  Equipamento de Engenharia
                </Button>
                <Button
                  variant="outline"
                  className="h-24 text-lg"
                  onClick={() => handleSelectEquipmentType('MOTOMECANIZACAO')}
                  disabled={!refLPC}
                >
                  <Truck className="mr-3 h-6 w-6" />
                  Motomecanização
                </Button>
              </div>

              {registros.length > 0 && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="h-5 w-5" /> {/* Ícone de estrela */}
                        OMs Cadastradas
                      </h3>
                      <Badge variant="secondary" className="text-sm">
                        {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
                      </Badge>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                          <thead className="bg-muted">
                            <tr>
                              <th className="text-left p-3 font-semibold text-sm w-[20%]">OM</th>
                              <th className="text-left p-3 font-semibold text-sm w-[12%]">UG</th>
                              <th className="text-left p-3 font-semibold text-sm w-[15%]">Tipo</th>
                              <th className="text-left p-3 font-semibold text-sm w-[12%]">Suprimento</th> {/* Rótulo alterado */}
                              <th className="text-right p-3 font-semibold text-sm w-[13%]">Total Litros</th>
                              <th className="text-right p-3 font-semibold text-sm w-[13%]">Valor Total</th>
                              <th className="text-center p-3 font-semibold text-sm w-[15%]">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registros.map((registro) => {
                              const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR';
                              const tipoLabel = isLubrificante ? 'Lubrificante (Gerador)' : getTipoLabel(registro.tipo_equipamento as TipoEquipamento);
                              
                              let suprimentoText: string;
                              let suprimentoBadgeClass: string;

                              if (isLubrificante) {
                                suprimentoText = 'Lubrificante';
                                suprimentoBadgeClass = 'bg-purple-600 text-white';
                              } else if (registro.tipo_combustivel === 'DIESEL') {
                                suprimentoText = 'Óleo Diesel';
                                suprimentoBadgeClass = 'bg-primary text-primary-foreground'; // Mantendo primary para Diesel
                              } else {
                                suprimentoText = 'Gasolina';
                                suprimentoBadgeClass = 'bg-amber-500 text-black hover:bg-amber-600'; // Nova cor para Gasolina
                              }
                              
                              return (
                                <tr key={registro.id} className="border-t hover:bg-muted/50 transition-colors">
                                  <td className="p-3 text-sm">{registro.organizacao}</td>
                                  <td className="p-3 text-sm">{registro.ug}</td>
                                  <td className="p-3 text-sm">{tipoLabel}</td>
                                  <td className="p-3 text-sm">
                                    <Badge variant="default" className={suprimentoBadgeClass}>
                                      {suprimentoText}
                                    </Badge>
                                  </td>
                                  <td className="p-3 text-sm text-right font-medium">{formatNumber(registro.total_litros)} L</td>
                                  <td className="p-3 text-sm text-right font-medium">{formatCurrency(registro.valor_total)}</td>
                                  <td className="p-3 text-sm">
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleEditar(registro)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeletar(registro.id)}
                                        disabled={loading}
                                        className="h-8 w-8 text-destructive hover:text-destructive/10"
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
                            <tr>
                              <td colSpan={4} className="p-3 text-sm font-semibold">TOTAL COMBUSTÍVEL (ND 39)</td>
                              <td className="p-3 text-sm text-right font-bold">
                                {formatNumber(registros.filter(r => r.tipo_equipamento !== 'LUBRIFICANTE_GERADOR').reduce((sum, r) => sum + r.total_litros, 0))} L
                              </td>
                              <td className="p-3 text-sm text-right font-bold text-primary">
                                {formatCurrency(registros.filter(r => r.tipo_equipamento !== 'LUBRIFICANTE_GERADOR').reduce((sum, r) => sum + r.valor_total, 0))}
                              </td>
                              <td></td>
                            </tr>
                            <tr>
                              <td colSpan={4} className="p-3 text-sm font-semibold">TOTAL LUBRIFICANTE (ND 30)</td>
                              <td className="p-3 text-sm text-right font-bold">
                                {formatNumber(registros.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR').reduce((sum, r) => sum + r.total_litros, 0))} L
                              </td>
                              <td className="p-3 text-sm text-right font-bold text-purple-600">
                                {formatCurrency(registros.filter(r => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR').reduce((sum, r) => sum + r.valor_total, 0))}
                              </td>
                              <td></td>
                            </tr>
                            <tr className="bg-primary/10 border-t-2">
                              <td colSpan={4} className="p-3 text-sm font-bold text-primary">
                                CUSTO TOTAL CLASSE III
                              </td>
                              <td className="p-3 text-sm text-right font-bold">
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
                      const isLubrificante = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR';

                      return (
                        <Card key={`memoria-${registro.id}`} className="p-6 bg-muted/30">
                          {/* LINHA 1: Título + Badge Combustível */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-semibold text-foreground">
                                {registro.organizacao} (UG: {registro.ug})
                              </h4>
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
                                : 'bg-primary text-primary-foreground'}
                            >
                              {isLubrificante ? 'LUBRIFICANTE (ND 30)' : 'COMBUSTÍVEL (ND 39)'}
                            </Badge>
                          </div>
                          
                          <div className="h-px bg-border my-4" />
                          
                          {/* LINHA 2: Botões de Edição */}
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
                          
                          {/* ÁREA DA MEMÓRIA */}
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

  if (tipoSelecionado === 'GERADOR') {
    const totalGeradores = formGerador.itens.reduce((sum, item) => sum + item.quantidade, 0);
    const isFormValid = formGerador.organizacao && formGerador.ug && rmFornecimento && codugRmFornecimento && formGerador.dias_operacao > 0 && formGerador.itens.length > 0;
    const isItemValid = itemGeradorTemp.tipo_equipamento_especifico && itemGeradorTemp.quantidade > 0 && itemGeradorTemp.horas_dia > 0;
    
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleCancelEdit}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Grupo Gerador - Entrada por OM</CardTitle>
              <CardDescription>
                Configure os geradores por Organização Militar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UG Detentora</Label>
                      <Input value={formGerador.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Campos de RM e CODUG de Fornecimento lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rmFornecimentoGerador">RM de Fornecimento de Combustível *</Label>
                      <RmSelector
                        value={rmFornecimento}
                        onChange={handleRMFornecimentoChange}
                        placeholder="Selecione a RM de fornecimento..."
                        disabled={!formGerador.organizacao}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CODUG da RM de Fornecimento</Label>
                      <Input value={codugRmFornecimento} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Dias de Atividade e Fase da Atividade lado a lado */}
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
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fase da Atividade *</Label>
                      <Popover open={isPopoverOpenGerador} onOpenChange={setIsPopoverOpenGerador}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            type="button"
                            className="w-full justify-between max-w-xs"
                          >
                            {fasesAtividadeGerador.length === 0 && !customFaseAtividadeGerador.trim()
                              ? "Selecione as fases..."
                              : [...fasesAtividadeGerador, customFaseAtividadeGerador.trim()].filter(f => f).join(', ')}
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
                                  onSelect={() => handleFaseChangeGerador(fase, !fasesAtividadeGerador.includes(fase))}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>{fase}</span>
                                  <Checkbox
                                    checked={fasesAtividadeGerador.includes(fase)}
                                    onCheckedChange={(checked) => handleFaseChangeGerador(fase, !!checked)}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <div className="p-2 border-t">
                              <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                              <Input
                                value={customFaseAtividadeGerador}
                                onChange={(e) => setCustomFaseAtividadeGerador(e.target.value)}
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
                {/* Linha em branco adicionada aqui */}
                <div className="mb-6" /> 

                {formGerador.organizacao && (
                  <div className="space-y-4 border-t pt-6" ref={addGeradorRef}>
                    <h3 className="text-lg font-semibold">2. Adicionar Geradores</h3>
                    
                    {/* LINHA 1: DADOS DO GERADOR (3 COLUNAS) - COMBUSTÍVEL */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Tipo de Gerador *</Label>
                        <Select 
                          value={itemGeradorTemp.tipo_equipamento_especifico}
                          onValueChange={handleTipoGeradorChange}
                          disabled={!refLPC}
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
                          disabled={!refLPC}
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
                          disabled={!refLPC}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>
                    </div>
                    
                    {/* LINHA 2: DADOS DO LUBRIFICANTE (3 COLUNAS) */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border-t border-border">
                      <div className="space-y-2">
                        <Label>Consumo Lubrificante (L/100h)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={itemGeradorTemp.consumo_lubrificante_litro === 0 ? "" : itemGeradorTemp.consumo_lubrificante_litro.toString()}
                          onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, consumo_lubrificante_litro: parseFloat(e.target.value) || 0 })}
                          placeholder="Ex: 0.5"
                          disabled={!refLPC}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Preço Lubrificante (R$/L)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={itemGeradorTemp.preco_lubrificante === 0 ? "" : itemGeradorTemp.preco_lubrificante.toString()}
                          onChange={(e) => setItemGeradorTemp({ ...itemGeradorTemp, preco_lubrificante: parseFloat(e.target.value) || 0 })}
                          placeholder="Ex: 35.00"
                          disabled={!refLPC}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>OM Destino Recurso (ND 30) *</Label>
                        <OmSelector
                          selectedOmId={selectedOmLubrificanteId}
                          onChange={handleOMLubrificanteChange}
                          placeholder="Selecione a OM de destino..."
                          disabled={!formGerador.organizacao}
                        />
                        <p className="text-xs text-muted-foreground">OM que receberá o recurso de lubrificante.</p>
                      </div>
                    </div>
                    {/* FIM DADOS DO LUBRIFICANTE */}

                    <div className="flex justify-end">
                      <Button 
                        type="button" 
                        onClick={adicionarOuAtualizarItemGerador} 
                        className="w-full md:w-auto" 
                        disabled={!refLPC || !isItemValid}
                      >
                        {editingGeradorItemIndex !== null ? "Atualizar Item" : "Adicionar"}
                      </Button>
                    </div>

                    {itemGeradorTemp.consumo_fixo > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                  <div className="space-y-4 border-t pt-6">
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
                                disabled={!refLPC}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItemGerador(index)}
                                disabled={!refLPC}
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

                {(consolidadosGerador.length > 0 || consolidadoLubrificante) && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">4. Consolidação de Custos</h3>
                    
                    {/* CONSOLIDAÇÃO DE COMBUSTÍVEL */}
                    {consolidadosGerador.map((consolidado, index) => (
                      <Card key={index} className="p-4 border-l-4 border-primary">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg flex items-center gap-2 text-primary">
                              <Fuel className="h-5 w-5" />
                              {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'} (ND 33.90.39)
                            </h4>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total com 30%</p>
                              <p className="text-lg font-bold text-primary">{formatCurrency(consolidado.valor_total)}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Geradores</p>
                              <p className="font-medium">{consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sem margem</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Com margem (30%)</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros)} L</p>
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
                      <Card className="p-4 border-l-4 border-purple-600">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg flex items-center gap-2 text-purple-600">
                              <Droplet className="h-5 w-5" />
                              Lubrificante (ND 33.90.30)
                            </h4>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Valor Total</p>
                              <p className="text-lg font-bold text-purple-600">{formatCurrency(consolidadoLubrificante.valor_total)}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Geradores c/ Lub</p>
                              <p className="font-medium">{consolidadoLubrificante.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Litros</p>
                              <p className="font-medium">{formatNumber(consolidadoLubrificante.total_litros, 2)} L</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">OM Destino Recurso</p>
                              <p className="font-medium">{omLubrificante} (UG: {ugLubrificante})</p>
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

                    <div className="flex gap-3 pt-4">
                      {editingId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={handleCancelEdit}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Edição
                        </Button>
                      )}
                      <Button 
                        type="submit" 
                        disabled={!refLPC || loading || !isFormValid || (consolidadoLubrificante && (!omLubrificante || !ugLubrificante))}
                      >
                        {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosGerador.length + (consolidadoLubrificante ? 1 : 0)} registros)
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tipoSelecionado === 'MOTOMECANIZACAO') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleCancelEdit}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Motomecanização - Entrada por OM</CardTitle>
              <CardDescription>
                Configure as viaturas por Organização Militar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosViatura(); }}>
                <div className="space-y-3"> {/* Alterado de space-y-4 para space-y-3 */}
                  <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Organização Militar (OM) *</Label>
                      <OmSelector
                        selectedOmId={formViatura.selectedOmId}
                        onChange={handleOMViaturaChange}
                        placeholder="Selecione a OM..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UG</Label>
                      <Input value={formViatura.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Campos de RM e CODUG de Fornecimento lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rmFornecimentoViatura">RM de Fornecimento de Combustível *</Label>
                      <RmSelector
                        value={rmFornecimento}
                        onChange={handleRMFornecimentoChange}
                        placeholder="Selecione a RM de fornecimento..."
                        disabled={!formViatura.organizacao}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CODUG da RM de Fornecimento</Label>
                      <Input value={codugRmFornecimento} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Dias de Atividade e Fase da Atividade lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dias de Atividade *</Label>
                      <Input
                        type="number"
                        min="1"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none max-w-xs"
                        value={formViatura.dias_operacao || ""}
                        onChange={(e) => setFormViatura({ ...formViatura, dias_operacao: parseInt(e.target.value) || 0 })}
                        placeholder="Ex: 7"
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fase da Atividade *</Label>
                      <Popover open={isPopoverOpenViatura} onOpenChange={setIsPopoverOpenViatura}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            type="button"
                            className="w-full justify-between"
                          >
                            {fasesAtividadeViatura.length === 0 && !customFaseAtividadeViatura.trim()
                              ? "Selecione as fases..."
                              : [...fasesAtividadeViatura, customFaseAtividadeViatura.trim()].filter(f => f).join(', ')}
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
                                  onSelect={() => handleFaseChangeViatura(fase, !fasesAtividadeViatura.includes(fase))}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>{fase}</span>
                                  <Checkbox
                                    checked={fasesAtividadeViatura.includes(fase)}
                                    onCheckedChange={(checked) => handleFaseChangeViatura(fase, !!checked)}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <div className="p-2 border-t">
                              <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                              <Input
                                value={customFaseAtividadeViatura}
                                onChange={(e) => setCustomFaseAtividadeViatura(e.target.value)}
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
                {/* Linha em branco adicionada aqui */}
                <div className="mb-6" />

                {formViatura.organizacao && (
                  <div className="space-y-4 border-t pt-6" ref={addViaturaRef}>
                    <h3 className="text-lg font-semibold">2. Adicionar Viaturas</h3>
                    
                    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo de Viatura *</Label>
                          <Select 
                            value={itemViaturaTemp.tipo_equipamento_especifico}
                            onValueChange={handleTipoViaturaChange}
                            disabled={!refLPC}
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
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Distância a ser percorrida (km) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={itemViaturaTemp.distancia_percorrida === 0 ? "" : itemViaturaTemp.distancia_percorrida.toString()}
                            onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, distancia_percorrida: parseFloat(e.target.value) || 0 })}
                            placeholder="Ex: 150"
                            disabled={!refLPC}
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Quantidade de Deslocamentos *</Label>
                          <Input
                            type="number"
                            min="1"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={itemViaturaTemp.quantidade_deslocamentos === 0 ? "" : itemViaturaTemp.quantidade_deslocamentos.toString()}
                            onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade_deslocamentos: parseInt(e.target.value) || 0 })}
                            placeholder="Ex: 5"
                            disabled={!refLPC}
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantidade de Viaturas *</Label>
                          <Input
                            type="number"
                            min="1"
                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={itemViaturaTemp.quantidade === 0 ? "" : itemViaturaTemp.quantidade.toString()}
                            onChange={(e) => setItemViaturaTemp({ ...itemViaturaTemp, quantidade: parseInt(e.target.value) || 0 })}
                            placeholder="Ex: 3"
                            disabled={!refLPC}
                            onKeyDown={handleEnterToNextField}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>&nbsp;</Label>
                          <Button type="button" onClick={adicionarOuAtualizarItemViatura} className="w-full" disabled={!refLPC}>
                            {editingViaturaItemIndex !== null ? "Atualizar Viatura" : "Adicionar Viatura"}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {itemViaturaTemp.consumo_fixo > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Consumo: {formatNumber(itemViaturaTemp.consumo_fixo, 1)} km/L
                        </Badge>
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Combustível: {itemViaturaTemp.tipo_combustivel}
                        </Badge>
                      </div>
                    )}
                    {editingViaturaItemIndex !== null && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEditViaturaItem}
                        className="mt-2"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar Edição do Item
                      </Button>
                    )}
                  </div>
                )}

                {formViatura.itens.length > 0 && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">3. Viaturas Configuradas</h3>
                    
                    <div className="space-y-2">
                      {formViatura.itens.map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantidade} vtr • {formatNumber(item.distancia_percorrida)} km • {item.quantidade_deslocamentos} desloc • {formatNumber(item.consumo_fixo, 1)} km/L • {item.tipo_combustivel}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditViaturaItem(item, index)}
                                disabled={!refLPC}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItemViatura(index)}
                                disabled={!refLPC}
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

                {consolidadosViatura.length > 0 && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">4. Consolidação por Combustível</h3>
                    
                    {consolidadosViatura.map((consolidado, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg">
                              {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                            </h4>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total com 30%</p>
                              <p className="text-lg font-bold">{formatCurrency(consolidado.valor_total)}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Viaturas</p>
                              <p className="font-medium">{consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sem margem</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Com margem (30%)</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros)} L</p>
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

                    <div className="flex gap-3 pt-4">
                      {editingId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={handleCancelEdit}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Edição
                        </Button>
                      )}
                      <Button type="submit" disabled={!refLPC || loading}>
                        {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosViatura.length} {consolidadosViatura.length === 1 ? 'tipo' : 'tipos'} de combustível)
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tipoSelecionado === 'EMBARCACAO') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleCancelEdit}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Tipo de Embarcação - Entrada por OM</CardTitle>
              <CardDescription>
                Configure as embarcações por Organização Militar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosEmbarcacao(); }}>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Organização Militar (OM) *</Label>
                      <OmSelector
                        selectedOmId={formEmbarcacao.selectedOmId}
                        onChange={handleOMEmbarcacaoChange}
                        placeholder="Selecione a OM..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UG</Label>
                      <Input value={formEmbarcacao.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rmFornecimentoEmbarcacao">RM de Fornecimento de Combustível *</Label>
                      <RmSelector
                        value={rmFornecimento}
                        onChange={handleRMFornecimentoChange}
                        placeholder="Selecione a RM de fornecimento..."
                        disabled={!formEmbarcacao.organizacao}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CODUG da RM de Fornecimento</Label>
                      <Input value={codugRmFornecimento} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Dias de Atividade e Fase da Atividade lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dias de Atividade *</Label>
                      <Input
                        type="number"
                        min="1"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={formEmbarcacao.dias_operacao || ""}
                        onChange={(e) => setFormEmbarcacao({ ...formEmbarcacao, dias_operacao: parseInt(e.target.value) || 0 })}
                        placeholder="Ex: 7"
                        onKeyDown={handleEnterToNextField}
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
                          >
                            {fasesAtividadeEmbarcacao.length === 0 && !customFaseAtividadeEmbarcacao.trim()
                              ? "Selecione as fases..."
                              : [...fasesAtividadeEmbarcacao, customFaseAtividadeEmbarcacao.trim()].filter(f => f).join(', ')}
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
                                  onSelect={() => handleFaseChangeEmbarcacao(fase, !fasesAtividadeEmbarcacao.includes(fase))}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>{fase}</span>
                                  <Checkbox
                                    checked={fasesAtividadeEmbarcacao.includes(fase)}
                                    onCheckedChange={(checked) => handleFaseChangeEmbarcacao(fase, !!checked)}
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

                {formEmbarcacao.organizacao && (
                  <div className="space-y-4 border-t pt-6" ref={addEmbarcacaoRef}>
                    <h3 className="text-lg font-semibold">2. Adicionar Embarcações</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Tipo de Embarcação *</Label>
                        <Select 
                          value={itemEmbarcacaoTemp.tipo_equipamento_especifico}
                          onValueChange={handleTipoEmbarcacaoChange}
                          disabled={!refLPC}
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
                          disabled={!refLPC}
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
                          disabled={!refLPC}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button type="button" onClick={adicionarOuAtualizarItemEmbarcacao} className="w-full" disabled={!refLPC}>
                          {editingEmbarcacaoItemIndex !== null ? "Atualizar Item" : "Adicionar"}
                        </Button>
                      </div>
                    </div>

                    {itemEmbarcacaoTemp.consumo_fixo > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Consumo: {formatNumber(itemEmbarcacaoTemp.consumo_fixo, 1)} L/h
                        </Badge>
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Combustível: {itemEmbarcacaoTemp.tipo_combustivel}
                        </Badge>
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
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">3. Embarcações Configuradas</h3>
                    
                    <div className="space-y-2">
                      {formEmbarcacao.itens.map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantidade} unidade(s) • {formatNumber(item.horas_dia, 1)}h/dia • {formatNumber(item.consumo_fixo, 1)} L/h • {item.tipo_combustivel}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditEmbarcacaoItem(item, index)}
                                disabled={!refLPC}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItemEmbarcacao(index)}
                                disabled={!refLPC}
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

                {consolidadosEmbarcacao.length > 0 && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">4. Consolidação por Combustível</h3>
                    
                    {consolidadosEmbarcacao.map((consolidado, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg">
                              {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                            </h4>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total com 30%</p>
                              <p className="text-lg font-bold">{formatCurrency(consolidado.valor_total)}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Embarcações</p>
                              <p className="font-medium">{consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sem margem</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Com margem (30%)</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros)} L</p>
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

                    <div className="flex gap-3 pt-4">
                      {editingId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={handleCancelEdit}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Edição
                        </Button>
                      )}
                      <Button type="submit" disabled={!refLPC || loading}>
                        {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosEmbarcacao.length} {consolidadosEmbarcacao.length === 1 ? 'tipo' : 'tipos'} de combustível)
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tipoSelecionado === 'EQUIPAMENTO_ENGENHARIA') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            onClick={handleCancelEdit}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Equipamento de Engenharia - Entrada por OM</CardTitle>
              <CardDescription>
                Configure os equipamentos de engenharia por Organização Militar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={(e) => { e.preventDefault(); salvarRegistrosConsolidadosEngenharia(); }}>
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">1. Dados da Organização</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Organização Militar (OM) *</Label>
                      <OmSelector
                        selectedOmId={formEngenharia.selectedOmId}
                        onChange={handleOMEngenhariaChange}
                        placeholder="Selecione a OM..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>UG</Label>
                      <Input value={formEngenharia.ug} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rmFornecimentoEngenharia">RM de Fornecimento de Combustível *</Label>
                      <RmSelector
                        value={rmFornecimento}
                        onChange={handleRMFornecimentoChange}
                        placeholder="Selecione a RM de fornecimento..."
                        disabled={!formEngenharia.organizacao}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>CODUG da RM de Fornecimento</Label>
                      <Input value={codugRmFornecimento} readOnly disabled onKeyDown={handleEnterToNextField} />
                    </div>
                  </div>

                  {/* Dias de Atividade e Fase da Atividade lado a lado */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dias de Atividade *</Label>
                      <Input
                        type="number"
                        min="1"
                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={formEngenharia.dias_operacao || ""}
                        onChange={(e) => setFormEngenharia({ ...formEngenharia, dias_operacao: parseInt(e.target.value) || 0 })}
                        placeholder="Ex: 7"
                        onKeyDown={handleEnterToNextField}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fase da Atividade *</Label>
                      <Popover open={isPopoverOpenEngenharia} onOpenChange={setIsPopoverOpenEngenharia}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            type="button"
                            className="w-full justify-between"
                          >
                            {fasesAtividadeEngenharia.length === 0 && !customFaseAtividadeEngenharia.trim()
                              ? "Selecione as fases..."
                              : [...fasesAtividadeEngenharia, customFaseAtividadeEngenharia.trim()].filter(f => f).join(', ')}
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
                                  onSelect={() => handleFaseChangeEngenharia(fase, !fasesAtividadeEngenharia.includes(fase))}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>{fase}</span>
                                  <Checkbox
                                    checked={fasesAtividadeEngenharia.includes(fase)}
                                    onCheckedChange={(checked) => handleFaseChangeEngenharia(fase, !!checked)}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <div className="p-2 border-t">
                              <Label className="text-xs text-muted-foreground mb-1 block">Outra Atividade (Opcional)</Label>
                              <Input
                                value={customFaseAtividadeEngenharia}
                                onChange={(e) => setCustomFaseAtividadeEngenharia(e.target.value)}
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

                {formEngenharia.organizacao && (
                  <div className="space-y-4 border-t pt-6" ref={addEngenhariaRef}>
                    <h3 className="text-lg font-semibold">2. Adicionar Equipamento de Engenharia</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Tipo de Equipamento *</Label>
                        <Select 
                          value={itemEngenhariaTemp.tipo_equipamento_especifico}
                          onValueChange={handleTipoEngenhariaChange}
                          disabled={!refLPC}
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
                          value={itemEngenhariaTemp.quantidade === 0 ? "" : itemEngenhariaTemp.quantidade.toString()}
                          onChange={(e) => setItemEngenhariaTemp({ ...itemEngenhariaTemp, quantidade: parseInt(e.target.value) || 0 })}
                          placeholder="Ex: 1"
                          disabled={!refLPC}
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
                          value={itemEngenhariaTemp.horas_dia === 0 ? "" : itemEngenhariaTemp.horas_dia.toString()}
                          onChange={(e) => setItemEngenhariaTemp({ ...itemEngenhariaTemp, horas_dia: parseFloat(e.target.value) || 0 })}
                          placeholder="Ex: 8"
                          disabled={!refLPC}
                          onKeyDown={handleEnterToNextField}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>&nbsp;</Label>
                        <Button type="button" onClick={adicionarOuAtualizarItemEngenharia} className="w-full" disabled={!refLPC}>
                          {editingEngenhariaItemIndex !== null ? "Atualizar Item" : "Adicionar"}
                        </Button>
                      </div>
                    </div>

                    {itemEngenhariaTemp.consumo_fixo > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Consumo: {formatNumber(itemEngenhariaTemp.consumo_fixo, 1)} L/h
                        </Badge>
                        <Badge variant="default" className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Combustível: {itemEngenhariaTemp.tipo_combustivel}
                        </Badge>
                      </div>
                    )}
                    {editingEngenhariaItemIndex !== null && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEditEngenhariaItem}
                        className="mt-2"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar Edição do Item
                      </Button>
                    )}
                  </div>
                )}

                {formEngenharia.itens.length > 0 && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">3. Equipamentos Configurados</h3>
                    
                    <div className="space-y-2">
                      {formEngenharia.itens.map((item, index) => (
                        <Card key={index} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium">{item.tipo_equipamento_especifico}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantidade} unidade(s) • {formatNumber(item.horas_dia, 1)}h/dia • {formatNumber(item.consumo_fixo, 1)} L/h • {item.tipo_combustivel}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditEngenhariaItem(item, index)}
                                disabled={!refLPC}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItemEngenharia(index)}
                                disabled={!refLPC}
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

                {consolidadosEngenharia.length > 0 && (
                  <div className="space-y-4 border-t pt-6">
                    <h3 className="text-lg font-semibold">4. Consolidação por Combustível</h3>
                    
                    {consolidadosEngenharia.map((consolidado, index) => (
                      <Card key={index} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-lg">
                              {consolidado.tipo_combustivel === 'GASOLINA' ? 'Gasolina' : 'Óleo Diesel'}
                            </h4>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total com 30%</p>
                              <p className="text-lg font-bold">{formatCurrency(consolidado.valor_total)}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Equipamentos</p>
                              <p className="font-medium">{consolidado.itens.reduce((sum, item) => sum + item.quantidade, 0)} unidades</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sem margem</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros_sem_margem)} L</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Com margem (30%)</p>
                              <p className="font-medium">{formatNumber(consolidado.total_litros)} L</p>
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

                    <div className="flex gap-3 pt-4">
                      {editingId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={handleCancelEdit}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar Edição
                        </Button>
                      )}
                      <Button type="submit" disabled={!refLPC || loading}>
                        {loading ? "Aguarde..." : (editingId ? "Atualizar Registros" : "Salvar Registros")} ({consolidadosEngenharia.length} {consolidadosEngenharia.length === 1 ? 'tipo' : 'tipos'} de combustível)
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}