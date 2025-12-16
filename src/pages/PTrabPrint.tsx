import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatNumber } from "@/lib/formatUtils"; // Importar formatCurrency e formatNumber

interface PTrabData {
  id: string;
  numero_ptrab: string;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso?: string;
  nome_operacao: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
}

interface ClasseIRegistro {
  id: string;
  organizacao: string;
  ug: string;
  om_qs: string;
  ug_qs: string;
  efetivo: number;
  dias_operacao: number;
  nr_ref_int: number;
  valor_qs: number;
  valor_qr: number;
  complemento_qs: number;
  etapa_qs: number;
  total_qs: number;
  total_qr: number;
  total_geral: number;
  memoria_calculo_qs_customizada?: string | null;
  memoria_calculo_qr_customizada?: string | null;
  fase_atividade?: string | null;
  categoria: 'RACAO_QUENTE' | 'RACAO_OPERACIONAL'; // Adicionado categoria
  quantidade_r2: number;
  quantidade_r3: number;
}

interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

interface ItemClasseIX {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  valor_acionamento_mensal: number;
  categoria: string;
}

interface ClasseIIRegistro {
  id: string;
  organizacao: string; // OM de Destino do Recurso (ND 30/39)
  ug: string; // UG de Destino do Recurso (ND 30/39)
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[]; // Tipo corrigido
  valor_total: number;
  detalhamento: string;
  detalhamento_customizado?: string | null;
  fase_atividade?: string | null;
  valor_nd_30: number; // NOVO
  valor_nd_39: number; // NOVO
  // Campos específicos para Classe VIII (Remonta)
  animal_tipo?: 'Equino' | 'Canino';
  quantidade_animais?: number;
  // Campos específicos para Classe IX
  itens_motomecanizacao?: ItemClasseIX[];
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
  tipo_equipamento_detalhe?: string;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
}

// --- NOVAS INTERFACES PARA AGRUPAMENTO ---
interface LinhaTabela {
  registro: ClasseIRegistro;
  tipo: 'QS' | 'QR';
}

interface LinhaClasseII { // Representa um registro completo de Classe II (uma categoria)
  registro: ClasseIIRegistro;
}

interface LinhaLubrificante {
  registro: ClasseIIIRegistro;
}

interface GrupoOM {
  linhasQS: LinhaTabela[];
  linhasQR: LinhaTabela[];
  linhasClasseII: LinhaClasseII[]; // Only Classe II
  linhasClasseV: LinhaClasseII[];
  linhasClasseVI: LinhaClasseII[];
  linhasClasseVII: LinhaClasseII[];
  linhasClasseVIII: LinhaClasseII[];
  linhasClasseIX: LinhaClasseII[]; // NOVO
  linhasLubrificante: LinhaLubrificante[];
}
// --- FIM NOVAS INTERFACES ---

// Categorias que representam as Classes
const CLASSE_V_CATEGORIES = ["Armt L", "Armt P", "IODCT", "DQBRN"];
const CLASSE_VI_CATEGORIES = ["Embarcação", "Equipamento de Engenharia"];
const CLASSE_VII_CATEGORIES = ["Comunicações", "Informática"];
const CLASSE_VIII_CATEGORIES = ["Saúde", "Remonta/Veterinária"];
const CLASSE_IX_CATEGORIES = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

// =================================================================
// FUNÇÕES AUXILIARES (MOVIDAS PARA O ESCOPO DO MÓDULO)
// =================================================================

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const calculateDays = (inicio: string, fim: string) => {
  const start = new Date(inicio);
  const end = new Date(fim);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
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

// Função auxiliar para determinar o rótulo da Classe II/V/VI/VII/VIII/IX
const getClasseIILabel = (categoria: string): string => {
    if (CLASSE_V_CATEGORIES.includes(categoria)) {
        return 'CLASSE V - ARMAMENTO';
    }
    if (CLASSE_VI_CATEGORIES.includes(categoria)) {
        return 'CLASSE VI - MATERIAL DE ENGENHARIA';
    }
    if (CLASSE_VII_CATEGORIES.includes(categoria)) {
        return 'CLASSE VII - COMUNICAÇÕES E INFORMÁTICA';
    }
    if (CLASSE_VIII_CATEGORIES.includes(categoria)) {
        return 'CLASSE VIII - SAÚDE E REMONTA/VETERINÁRIA';
    }
    if (CLASSE_IX_CATEGORIES.includes(categoria)) {
        return 'CLASSE IX - MOTOMECANIZAÇÃO';
    }
    return 'CLASSE II - MATERIAL DE INTENDÊNCIA';
};

// Função de cálculo principal para Classe IX (SEM MARGEM)
const calculateItemTotalClasseIX = (item: ItemClasseIX, diasOperacao: number): { base: number, acionamento: number, total: number } => {
    const nrVtr = item.quantidade;
    const valorDia = item.valor_mnt_dia;
    const valorMensal = item.valor_acionamento_mensal;
    
    if (nrVtr <= 0 || diasOperacao <= 0) {
        return { base: 0, acionamento: 0, total: 0 };
    }
    
    const custoBase = nrVtr * valorDia * diasOperacao;
    const nrMeses = Math.ceil(diasOperacao / 30);
    const custoAcionamento = nrVtr * valorMensal * nrMeses;
    
    const total = custoBase + custoAcionamento;
    
    return { base: custoBase, acionamento: custoAcionamento, total };
};

// NOVO: Gera a memória de cálculo detalhada para Classe IX (SEM MARGEM)
const generateClasseIXMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    const itens = (registro.itens_motomecanizacao || []) as ItemClasseIX[];
    const diasOperacao = registro.dias_operacao;
    const organizacao = registro.organizacao;
    const ug = registro.ug;
    const faseAtividade = registro.fase_atividade;
    const valorND30 = registro.valor_nd_30;
    const valorND39 = registro.valor_nd_39;
    
    const faseFormatada = formatFasesParaTexto(faseAtividade);
    const valorTotalFinal = valorND30 + valorND39;

    let totalItens = 0;

    const gruposPorCategoria = itens.reduce((acc, item) => {
        const categoria = item.categoria;
        const { base, acionamento, total } = calculateItemTotalClasseIX(item, diasOperacao);
        
        if (!acc[categoria]) {
            acc[categoria] = {
                totalValorBase: 0,
                totalValorAcionamento: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[categoria].totalValorBase += base;
        acc[categoria].totalValorAcionamento += acionamento;
        acc[categoria].totalQuantidade += item.quantidade;
        totalItens += item.quantidade;
        
        const nrMeses = Math.ceil(diasOperacao / 30);

        acc[categoria].detalhes.push(
            `- ${item.quantidade} ${item.item} (Base: ${formatCurrency(base)}, Acionamento: ${formatCurrency(acionamento)} em ${nrMeses} meses) = ${formatCurrency(total)}.`
        );
        
        return acc;
    }, {} as Record<string, { totalValorBase: number, totalValorAcionamento: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    
    Object.entries(gruposPorCategoria).forEach(([categoria, grupo]) => {
        const totalCategoria = grupo.totalValorBase + grupo.totalValorAcionamento;

        detalhamentoItens += `\n--- ${getClasseIILabel(categoria).toUpperCase()} (${grupo.totalQuantidade} VTR) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(totalCategoria)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    return `33.90.30 / 33.90.39 - Aquisição de Material de Classe IX (Motomecanização) para ${totalItens} viaturas, durante ${diasOperacao} dias de ${faseFormatada}, para ${organizacao}.
Recurso destinado à OM proprietária: ${organizacao} (UG: ${ug})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valorND30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valorND39)}

Fórmula Base: (Nr Vtr x Valor Mnt/Dia x Nr Dias) + (Nr Vtr x Valor Acionamento/Mês x Nr Meses).

${detalhamentoItens}

Valor Total Solicitado: ${formatCurrency(valorTotalFinal)}.`;
};

// Função para gerar memória automática de Classe I
const generateClasseIMemoriaCalculo = (registro: ClasseIRegistro): { qs: string, qr: string } => {
    const { 
      organizacao, ug, om_qs, ug_qs, efetivo, dias_operacao, nr_ref_int, 
      valor_qs, valor_qr, complemento_qs, etapa_qs, total_qs, 
      complemento_qr, etapa_qr, total_qr, fase_atividade 
    } = registro;
    
    // Calcular dias de etapa solicitada
    const diasRestantesNoCiclo = dias_operacao % 30;
    const ciclosCompletos = Math.floor(dias_operacao / 30);
    
    let diasEtapaSolicitada = 0;
    if (diasRestantesNoCiclo <= 22 && dias_operacao >= 30) {
      diasEtapaSolicitada = ciclosCompletos * 8;
    } else if (diasRestantesNoCiclo > 22) {
      diasEtapaSolicitada = (diasRestantesNoCiclo - 22) + (ciclosCompletos * 8);
    } else {
      diasEtapaSolicitada = 0;
    }
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    
    // Memória QS
    const memoriaQS = `33.90.30 - Aquisição de Gêneros Alimentícios (QS) destinados à complementação de alimentação de ${efetivo} militares do ${organizacao}, durante ${dias_operacao} dias de ${faseFormatada}.
OM Fornecedora: ${om_qs} (UG: ${ug_qs})

Cálculo:
- Valor da Etapa (QS): ${formatCurrency(valor_qs)}.
- Nr Refeições Intermediárias: ${nr_ref_int}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${organizacao} x ${nr_ref_int} Ref Int x (${formatCurrency(valor_qs)}/3) x ${dias_operacao} dias de atividade] = ${formatCurrency(complemento_qs)}.
- [${efetivo} militares do ${organizacao} x ${formatCurrency(valor_qs)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(etapa_qs)}.

Total QS: ${formatCurrency(total_qs)}.`;

    // Memória QR
    const memoriaQR = `33.90.30 - Aquisição de Gêneros Alimentícios (QR - Rancho Pronto) destinados à complementação de alimentação de ${efetivo} militares do ${organizacao}, durante ${dias_operacao} dias de ${faseFormatada}.
OM de Destino: ${organizacao} (UG: ${ug})

Cálculo:
- Valor da Etapa (QR): ${formatCurrency(valor_qr)}.
- Nr Refeições Intermediárias: ${nr_ref_int}.

Fórmula: [Efetivo empregado x Nr Ref Int (máx 3) x Valor da Etapa/3 x Nr de dias de complemento] + [Efetivo empregado x Valor da etapa x Nr de dias de etapa completa solicitada.]

- [${efetivo} militares do ${organizacao} x ${nr_ref_int} Ref Int x (${formatCurrency(valor_qr)}/3) x ${dias_operacao} dias de atividade] = ${formatCurrency(complemento_qr)}.
- [${efetivo} militares do ${organizacao} x ${formatCurrency(valor_qr)} x ${diasEtapaSolicitada} dias de etapa completa solicitada] = ${formatCurrency(etapa_qr)}.

Total QR: ${formatCurrency(total_qr)}.`;

    return { qs: memoriaQS, qr: memoriaQR };
  };

// Função para gerar memória automática de Classe II/V/VI/VII/VIII/IX
const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistro): string => {
    if (registro.detalhamento_customizado) {
      return registro.detalhamento_customizado;
    }
    
    // Se for Classe IX, usa a função específica
    if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
        return generateClasseIXMemoriaCalculo(registro);
    }
    
    // Caso contrário, usa o detalhamento salvo (gerado no formulário)
    return registro.detalhamento;
};

// =================================================================
// FIM FUNÇÕES AUXILIARES
// =================================================================

const PTrabPrint = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado para o AlertDialog de status "completo"
  const [showCompleteStatusDialog, setShowCompleteStatusDialog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!ptrabId) {
        toast({
          title: "Erro",
          description: "P Trab não selecionado",
          variant: "destructive",
        });
        navigate('/ptrab');
        return;
      }

      const { data: ptrab, error: ptrabError } = await supabase
        .from('p_trab')
        .select('*')
        .eq('id', ptrabId)
        .single();

      if (ptrabError || !ptrab) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar o P Trab",
          variant: "destructive",
        });
        navigate('/ptrab');
        return;
      }

      const { data: classeIData, error: classeIError } = await supabase
        .from('classe_i_registros')
        .select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, fase_atividade, categoria, quantidade_r2, quantidade_r3')
        .eq('p_trab_id', ptrabId);

      if (classeIError) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os registros de Classe I",
          variant: "destructive",
        });
      }
      
      // Busca Classe II, V, VI, VII, VIII e IX de suas respectivas tabelas
      const [
        { data: classeIIData, error: classeIIError },
        { data: classeVData, error: classeVError },
        { data: classeVIData, error: classeVIError },
        { data: classeVIIData, error: classeVIIError },
        { data: classeVIIISaudeData, error: classeVIIISaudeError },
        { data: classeVIIIRemontaData, error: classeVIIIRemontaError },
        { data: classeIXData, error: classeIXError }, // NOVO: Classe IX
      ] = await Promise.all([
        supabase
          .from('classe_ii_registros')
          .select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_v_registros')
          .select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_vi_registros')
          .select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_vii_registros')
          .select('*, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_viii_saude_registros')
          .select('*, itens_saude, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_viii_remonta_registros')
          .select('*, itens_remonta, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39, animal_tipo, quantidade_animais') // REMOVED 'categoria'
          .eq('p_trab_id', ptrabId),
        supabase
          .from('classe_ix_registros') // NOVO: Tabela Classe IX
          .select('*, itens_motomecanizacao, detalhamento_customizado, fase_atividade, valor_nd_30, valor_nd_39')
          .eq('p_trab_id', ptrabId),
      ]);

      if (classeIIError) { console.error("Erro ao carregar Classe II:", classeIIError); }
      if (classeVError) { console.error("Erro ao carregar Classe V:", classeVError); }
      if (classeVIError) { console.error("Erro ao carregar Classe VI:", classeVIError); }
      if (classeVIIError) { console.error("Erro ao carregar Classe VII:", classeVIIError); }
      if (classeVIIISaudeError) { console.error("Erro ao carregar Classe VIII Saúde:", classeVIIISaudeError); }
      if (classeVIIIRemontaError) { console.error("Erro ao carregar Classe VIII Remonta:", classeVIIIRemontaError); }
      if (classeIXError) { console.error("Erro ao carregar Classe IX:", classeIXError); }


      const allClasseItems = [
        ...(classeIIData || []),
        ...(classeVData || []),
        ...(classeVIData || []),
        ...(classeVIIData || []),
        // Saúde records
        ...(classeVIIISaudeData || []).map(r => ({ ...r, itens_equipamentos: r.itens_saude, categoria: 'Saúde' })),
        // Remonta records
        ...(classeVIIIRemontaData || []).map(r => ({ 
            ...r, 
            itens_equipamentos: r.itens_remonta, 
            categoria: 'Remonta/Veterinária',
            animal_tipo: r.animal_tipo, // Pass animal_tipo through
            quantidade_animais: r.quantidade_animais, // Pass quantity through
        })),
        // Classe IX records
        ...(classeIXData || []).map(r => ({ 
            ...r, 
            itens_equipamentos: r.itens_motomecanizacao, // Mapeia para itens_equipamentos para unificação
            categoria: r.categoria,
        })),
      ];

      const { data: classeIIIData, error: classeIIIError } = await supabase
        .from('classe_iii_registros')
        .select('*, detalhamento_customizado')
        .eq('p_trab_id', ptrabId);

      if (classeIIIError) {
        console.error("Erro ao carregar Classe III:", classeIIIError);
      }

      setPtrabData(ptrab);
      // FILTRO APLICADO AQUI: Apenas Ração Quente é incluída na tabela principal
      setRegistrosClasseI((classeIData || []).map(r => ({
          ...r,
          categoria: (r.categoria || 'RACAO_QUENTE') as 'RACAO_QUENTE' | 'RACAO_OPERACIONAL',
          quantidade_r2: r.quantidade_r2 || 0,
          quantidade_r3: r.quantidade_r3 || 0,
      })) as ClasseIRegistro[]);
      setRegistrosClasseII(allClasseItems as ClasseIIRegistro[]);
      setRegistrosClasseIII(classeIIIData || []);
      setLoading(false);
    };

    loadData();
  }, [ptrabId, navigate, toast]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportSuccess = () => {
    // MUDANÇA: Verifica se o status é 'em_andamento' ou 'aprovado'
    if (ptrabData && (ptrabData.status === 'em_andamento' || ptrabData.status === 'aprovado')) {
      setShowCompleteStatusDialog(true);
    } else {
      navigate('/ptrab'); // Redireciona se o status já for arquivado ou aberto/minuta
    }
  };

  const handleConfirmCompleteStatus = async () => {
    if (!ptrabData) return;

    try {
      // MUDANÇA: Altera o status para "arquivado"
      const { error } = await supabase
        .from("p_trab")
        .update({ status: "arquivado" })
        .eq("id", ptrabData.id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: `O status do P Trab ${ptrabData.numero_ptrab} foi alterado para "Arquivado".`,
        duration: 3000,
      });
      navigate('/ptrab');
    } catch (error) {
      console.error("Erro ao atualizar status para arquivado:", error);
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível alterar o status do P Trab.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setShowCompleteStatusDialog(false);
    }
  };

  const handleCancelCompleteStatus = () => {
    setShowCompleteStatusDialog(false);
    navigate('/ptrab'); // Redireciona mesmo se não mudar o status
  };

  // --- LÓGICA DE AGRUPAMENTO E CÁLCULO ---
  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_GERADOR' || r.tipo_equipamento === 'LUBRIFICANTE_EMBARCACAO' || r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';
  const isCombustivel = (r: ClasseIIIRegistro) => !isLubrificante(r);

  const gruposPorOM: Record<string, GrupoOM> = {};

  const initializeGroup = (name: string) => {
      if (!gruposPorOM[name]) {
          gruposPorOM[name] = { 
              linhasQS: [], 
              linhasQR: [], 
              linhasClasseII: [], 
              linhasClasseV: [],
              linhasClasseVI: [],
              linhasClasseVII: [],
              linhasClasseVIII: [],
              linhasClasseIX: [], // NOVO
              linhasLubrificante: [] 
          };
      }
  };

  // 1. Processar Classe I (Apenas Ração Quente para a tabela principal)
  registrosClasseI.filter(r => r.categoria === 'RACAO_QUENTE').forEach((registro) => {
      // QS goes to OM fornecedora (om_qs)
      initializeGroup(registro.om_qs);
      gruposPorOM[registro.om_qs].linhasQS.push({ registro, tipo: 'QS' });

      // QR goes to OM de destino (organizacao)
      initializeGroup(registro.organizacao);
      gruposPorOM[registro.organizacao].linhasQR.push({ registro, tipo: 'QR' });
  });
  
  // 2. Processar Classe II/V/VI/VII/VIII/IX (AGORA POR REGISTRO/CATEGORIA)
  registrosClasseII.forEach((registro) => {
      // Classe II/V/VI/VII/VIII/IX goes to OM de destino do recurso (organizacao)
      initializeGroup(registro.organizacao);
      
      const omGroup = gruposPorOM[registro.organizacao];
      
      if (CLASSE_V_CATEGORIES.includes(registro.categoria)) {
          omGroup.linhasClasseV.push({ registro });
      } else if (CLASSE_VI_CATEGORIES.includes(registro.categoria)) {
          omGroup.linhasClasseVI.push({ registro });
      } else if (CLASSE_VII_CATEGORIES.includes(registro.categoria)) {
          omGroup.linhasClasseVII.push({ registro });
      } else if (CLASSE_VIII_CATEGORIES.includes(registro.categoria)) {
          omGroup.linhasClasseVIII.push({ registro });
      } else if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) { // NOVO
          omGroup.linhasClasseIX.push({ registro });
      } else {
          // Assume Classe II
          omGroup.linhasClasseII.push({ registro });
      }
  });

  // 3. Processar Classe III Lubrificante
  registrosClasseIII.forEach((registro) => {
      if (isLubrificante(registro)) {
          // Lubrificante goes to OM de destino (organizacao)
          initializeGroup(registro.organizacao);
          gruposPorOM[registro.organizacao].linhasLubrificante.push({ registro });
      }
  });

  // 4. Ordenar as OMs
  const omsOrdenadas = Object.keys(gruposPorOM).sort((a, b) => {
      const aTemRM = a.includes('RM') || a.includes('R M');
      const bTemRM = b.includes('RM') || b.includes('R M');
      
      if (aTemRM && !bTemRM) return -1;
      if (!aTemRM && bTemRM) return 1;
      return a.localeCompare(b);
  });

  // 5. Identificar a RM (primeira OM que contém "RM")
  const nomeRM = omsOrdenadas.find(om => om.includes('RM') || om.includes('R M')) || ptrabData?.nome_om;

  // 6. Função de Cálculo de Totais por OM
  const calcularTotaisPorOM = (grupo: GrupoOM, nomeOM: string) => {
    const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.total_qs, 0);
    const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.total_qr, 0);
    
    // Total Classe II/V/VI/VII/VIII/IX (ND 30 + ND 39)
    const totalClasseII_ND30 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseII_ND39 = grupo.linhasClasseII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseV_ND30 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseV_ND39 = grupo.linhasClasseV.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVI_ND30 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVI_ND39 = grupo.linhasClasseVI.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVII_ND30 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVII_ND39 = grupo.linhasClasseVII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseVIII_ND30 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0);
    const totalClasseVIII_ND39 = grupo.linhasClasseVIII.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0);
    
    const totalClasseIX_ND30 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_30, 0); // NOVO
    const totalClasseIX_ND39 = grupo.linhasClasseIX.reduce((acc, linha) => acc + linha.registro.valor_nd_39, 0); // NOVO
    
    // Total Lubrificante (ND 30)
    const totalLubrificante = grupo.linhasLubrificante.reduce((acc, linha) => acc + linha.registro.valor_total, 0);
    
    // Total ND 30 (Coluna C) = Classe I + Classes (ND 30) + Lubrificante
    const total_33_90_30 = totalQS + totalQR + 
                           totalClasseII_ND30 + totalClasseV_ND30 + totalClasseVI_ND30 + totalClasseVII_ND30 + totalClasseVIII_ND30 + totalClasseIX_ND30 +
                           totalLubrificante; 
    
    // Total ND 39 (Coluna D) = Classes (ND 39)
    const total_33_90_39 = totalClasseII_ND39 + totalClasseV_ND39 + totalClasseVI_ND39 + totalClasseVII_ND39 + totalClasseVIII_ND39 + totalClasseIX_ND39;
    
    // Coluna E (TOTAL ND) = Coluna C + Coluna D
    const total_parte_azul = total_33_90_30 + total_33_90_39;
    
    // Total Combustível (Laranja) - Apenas se for a RM
    const classeIIIDestaOM = (nomeOM === nomeRM) 
      ? registrosClasseIII.filter(isCombustivel)
      : [];
    
    const valorDiesel = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    const valorGasolina = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    
    const totalCombustivel = valorDiesel + valorGasolina; // Valor total da Classe III Combustível (ND 39)
    
    // Total GND 3 (Valor Total Solicitado) = Total Parte Azul + Total Combustível (Laranja)
    const total_gnd3 = total_parte_azul + totalCombustivel; 
    
    const totalDieselLitros = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.total_litros, 0);
    const totalGasolinaLitros = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.total_litros, 0);

    return {
      total_33_90_30, // Classe I + Classes (ND 30) + Lubrificante
      total_33_90_39, // Classes (ND 39)
      total_parte_azul, // Total ND (C+D)
      total_combustivel: totalCombustivel, // Valor total da Classe III Combustível (Laranja)
      total_gnd3, // Valor Total Solicitado (GND 3)
      totalDieselLitros,
      totalGasolinaLitros,
      valorDiesel,
      valorGasolina,
    };
  };
  // --- FIM LÓGICA DE AGRUPAMENTO E CÁLCULO ---


  const exportPDF = useCallback(async () => {
    const element = document.querySelector('.ptrab-print-container');
    if (!element) {
      console.error("Element .ptrab-print-container not found.");
      return;
    }

    try {
      const header = document.querySelector('.print\\:hidden');
      if (header) header.classList.add('hidden');

      const canvas = await html2canvas(element as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: true,
      });

      if (!canvas) {
        console.error("html2canvas failed to generate canvas.");
        toast({
          title: "Erro ao gerar PDF",
          description: "Não foi possível renderizar o conteúdo para PDF.",
          variant: "destructive",
        });
        return;
      }

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth; 

      const scaledImgHeight = imgHeight * ratio;

      let position = 0;
      const pageHeight = pdfHeight;

      while (position < scaledImgHeight) {
        if (position > 0) {
          pdf.addPage();
        }
        pdf.addImage(
          imgData,
          'PNG',
          0,
          -position,
          pdfWidth,
          scaledImgHeight
        );
        position += pageHeight;
      }

      const fileName = `PTrab_${ptrabData?.numero_ptrab}_${ptrabData?.nome_operacao}.pdf`;
      pdf.save(fileName);

      toast({
        title: "PDF gerado com sucesso!",
        description: `Arquivo ${fileName} foi baixado.`,
        duration: 3000,
      });

      if (header) header.classList.remove('hidden');
      handleExportSuccess(); // Chamar a função de sucesso após a exportação
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível exportar o documento. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
  }, [ptrabData, toast, handleExportSuccess]);

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    // 1. Recalcular Totais Gerais (para Excel)
    const totalGeral_33_90_30 = Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_30, 0);
    const totalGeral_33_90_39 = Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_39, 0);
    const totalValorCombustivel = registrosClasseIII.filter(isCombustivel).reduce((acc, reg) => acc + reg.valor_total, 0);
    
    const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
    const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivel;
    
    // --- Definição de Estilos e Alinhamentos ---
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
    const rightTopAlignment = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    
    const cellBorder = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    // -------------------------------------------

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('P Trab');
      
      worksheet.columns = [
        { width: 35 }, // A - DESPESAS
        { width: 20 }, // B - OM (UGE) CODUG
        { width: 15 }, // C - 33.90.30
        { width: 15 }, // D - 33.90.39
        { width: 15 }, // E - TOTAL ND
        { width: 15 }, // F - LITROS
        { width: 15 }, // G - PREÇO UNITÁRIO
        { width: 18 }, // H - PREÇO TOTAL
        { width: 70 }, // I - DETALHAMENTO
      ];
      
      let currentRow = 1;
      
      const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = titleFontStyle;
        row.getCell(1).alignment = centerMiddleAlignment;
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addHeaderRow('MINISTÉRIO DA DEFESA');
      addHeaderRow('EXÉRCITO BRASILEIRO');
      addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
      
      const omExtensoRow = worksheet.getRow(currentRow);
      omExtensoRow.getCell(1).value = (ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase();
      omExtensoRow.getCell(1).font = titleFontStyle;
      omExtensoRow.getCell(1).alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      const fullTitleRow = worksheet.getRow(currentRow);
      fullTitleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
      fullTitleRow.getCell(1).font = titleFontStyle;
      fullTitleRow.getCell(1).alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;

      const shortTitleRow = worksheet.getRow(currentRow);
      shortTitleRow.getCell(1).value = 'PLANO DE TRABALHO LOGÍSTICO';
      shortTitleRow.getCell(1).font = { ...titleFontStyle, underline: true };
      shortTitleRow.getCell(1).alignment = centerMiddleAlignment;
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
      
      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        
        row.getCell(1).value = {
          richText: [
            { text: label, font: titleFontStyle },
            { text: ` ${value}`, font: { name: 'Arial', size: 11, bold: false } }
          ]
        };
        
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell(1).font = titleFontStyle;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      const hdr1 = worksheet.getRow(headerRow1);
      hdr1.getCell('A').value = 'DESPESAS\n(ORDENAR POR CLASSE DE SUBSISTÊNCIA)';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO\n(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)\nOBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG';
      
      worksheet.mergeCells(`A${headerRow1}:A${headerRow2}`);
      worksheet.mergeCells(`B${headerRow1}:B${headerRow2}`);
      worksheet.mergeCells(`C${headerRow1}:E${headerRow1}`);
      worksheet.mergeCells(`F${headerRow1}:H${headerRow1}`);
      worksheet.mergeCells(`I${headerRow1}:I${headerRow2}`);
      
      const hdr2 = worksheet.getRow(headerRow2);
      hdr2.getCell('C').value = '33.90.30';
      hdr2.getCell('D').value = '33.90.39';
      hdr2.getCell('E').value = 'TOTAL';
      hdr2.getCell('F').value = 'LITROS';
      hdr2.getCell('G').value = 'PREÇO\nUNITÁRIO';
      hdr2.getCell('H').value = 'PREÇO\nTOTAL';
      
      const headerStyle = {
        font: headerFontStyle,
        alignment: centerMiddleAlignment,
        border: cellBorder
      };
      
      ['A', 'B', 'C', 'F', 'I'].forEach(col => {
        hdr1.getCell(col).style = headerStyle;
      });
      
      ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        hdr2.getCell(col).style = headerStyle;
      });
      
      // Cores padronizadas
      const corAzul = 'FFB4C7E7'; // Natureza de Despesa
      const corLaranja = 'FFF8CBAD'; // Combustível
      
      hdr1.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr1.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      hdr2.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      hdr2.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
      
      currentRow = headerRow2 + 1;

      // Reusable alignment styles for data
      const dataCurrencyStyle = { horizontal: 'right' as const, vertical: 'top' as const, wrapText: true };
      const dataTextStyle = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
      const dataCenterStyle = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
      
      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasLubrificante.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
          return;
        }
        
        const linhasDespesaOrdenadas = [
            ...grupo.linhasQS,
            ...grupo.linhasQR,
            ...grupo.linhasClasseII,
            ...grupo.linhasLubrificante, // Classe III Lubrificante
            ...grupo.linhasClasseV,
            ...grupo.linhasClasseVI,
            ...grupo.linhasClasseVII,
            ...grupo.linhasClasseVIII,
            ...grupo.linhasClasseIX, // NOVO
        ];
        
        linhasDespesaOrdenadas.forEach((linha) => {
          const row = worksheet.getRow(currentRow);
          
          let despesasValue = '';
          let omValue = '';
          let detalhamentoValue = '';
          let valorC = 0;
          let valorD = 0;
          let valorE = 0;
          
          if ('tipo' in linha) { // Classe I (QS/QR)
            const registro = linha.registro as ClasseIRegistro;
            if (linha.tipo === 'QS') {
              despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
              omValue = `${registro.om_qs}\n(${registro.ug_qs})`;
              valorC = registro.total_qs;
              valorE = registro.total_qs;
              detalhamentoValue = registro.memoria_calculo_qs_customizada || generateClasseIMemoriaCalculo(registro).qs;
            } else { // QR
              despesasValue = `CLASSE I - SUBSISTÊNCIA`;
              omValue = `${registro.organizacao}\n(${registro.ug})`;
              valorC = registro.total_qr;
              valorE = registro.total_qr;
              detalhamentoValue = registro.memoria_calculo_qr_customizada || generateClasseIMemoriaCalculo(registro).qr;
            }
          } else if ('categoria' in linha.registro) { // Classe II, V, VI, VII, VIII, IX
            const registro = linha.registro as ClasseIIRegistro;
            const omDestinoRecurso = registro.organizacao;
            const ugDestinoRecurso = registro.ug;
            
            let secondDivContent = registro.categoria.toUpperCase();
            
            if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                secondDivContent = registro.animal_tipo.toUpperCase();
            }
                
            despesasValue = `${getClasseIILabel(registro.categoria)}\n${secondDivContent}`;
            omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
            valorC = registro.valor_nd_30;
            valorD = registro.valor_nd_39;
            valorE = registro.valor_nd_30 + registro.valor_nd_39;
            
            if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                detalhamentoValue = generateClasseIXMemoriaCalculo(registro); // NOVO
            } else {
                detalhamentoValue = generateClasseIIMemoriaCalculo(registro);
            }
            
          } else if ('tipo_equipamento' in linha.registro) { // Classe III Lubrificante
            const registro = linha.registro as ClasseIIIRegistro;
            const isOmDifferent = registro.organizacao !== nomeOM;
            const tipoEquipamento = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' ? 'GERADOR' : 'EMBARCAÇÃO';
            
            let despesasLubValue = `CLASSE III - LUBRIFICANTE`;
            if (isOmDifferent) {
              despesasLubValue += `\n${registro.organizacao}`;
            }
            despesasValue = despesasLubValue;
            omValue = `${registro.organizacao}\n(${registro.ug})`;
            valorC = registro.valor_total;
            valorE = registro.valor_total;
            detalhamentoValue = registro.detalhamento_customizado || registro.detalhamento || '';
          }
          
          row.getCell('A').value = despesasValue;
          row.getCell('B').value = omValue;
          row.getCell('C').value = valorC > 0 ? valorC : '';
          row.getCell('C').numFmt = 'R$ #,##0.00';
          row.getCell('D').value = valorD > 0 ? valorD : '';
          row.getCell('D').numFmt = 'R$ #,##0.00';
          row.getCell('E').value = valorE > 0 ? valorE : '';
          row.getCell('E').numFmt = 'R$ #,##0.00';
          
          row.getCell('I').value = detalhamentoValue;
          row.getCell('I').font = { name: 'Arial', size: 6.5 };
          
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
            row.getCell(col).font = baseFontStyle;
          });
          
          // Aplica alinhamentos específicos para dados
          row.getCell('A').alignment = dataTextStyle;
          row.getCell('B').alignment = centerTopAlignment;
          row.getCell('C').alignment = dataCurrencyStyle;
          row.getCell('D').alignment = dataCurrencyStyle;
          row.getCell('E').alignment = dataCurrencyStyle;
          row.getCell('I').alignment = dataTextStyle;
          
          currentRow++;
        });
        
        // 2. Linhas Combustível (APENAS na RM) - Classe III Combustível
        if (nomeOM === nomeRM) {
          registrosClasseIII.filter(isCombustivel).forEach((registro) => {
            const getTipoEquipamentoLabel = (tipo: string) => {
              switch (tipo) {
                case 'GERADOR': return 'GERADOR';
                case 'EMBARCACAO': return 'EMBARCAÇÃO';
                case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
                case 'MOTOMECANIZACAO': return 'MOTOMECANIZAÇÃO';
                default: return tipo;
              }
            };
            
            const getTipoCombustivelLabel = (tipo: string) => {
              if (tipo === 'DIESEL' || tipo === 'OD') return 'ÓLEO DIESEL';
              if (tipo === 'GASOLINA' || tipo === 'GAS') return 'GASOLINA';
              return tipo;
            };
            
            const row = worksheet.getRow(currentRow);
            
            // Tenta obter a UG da RM a partir de um registro de QS/QR, se existir
            const rmUg = grupo.linhasQS[0]?.registro.ug_qs || grupo.linhasQR[0]?.registro.ug_qs || '';
            
            row.getCell('A').value = `CLASSE III - ${getTipoCombustivelLabel(registro.tipo_combustivel)}\n${getTipoEquipamentoLabel(registro.tipo_equipamento)}\n${registro.organizacao}`;
            row.getCell('B').value = `${nomeRM}\n(${rmUg})`;
            
            // Colunas azuis (C, D, E) devem ser vazias/zero para Classe III Combustível
            row.getCell('C').value = ''; 
            row.getCell('D').value = ''; 
            row.getCell('E').value = ''; 
            
            // Colunas Laranjas (F, G, H) permanecem preenchidas
            row.getCell('F').value = Math.round(registro.total_litros);
            row.getCell('F').numFmt = '#,##0 "L"';
            row.getCell('G').value = registro.preco_litro;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('H').value = registro.valor_total;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            
            const detalhamentoCombustivel = registro.detalhamento_customizado || registro.detalhamento || '';
            
            row.getCell('I').value = detalhamentoCombustivel;
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
              row.getCell(col).border = cellBorder;
              row.getCell(col).font = baseFontStyle;
            });
            
            // Aplica alinhamentos específicos para dados de Combustível
            row.getCell('A').alignment = dataTextStyle;
            row.getCell('B').alignment = centerTopAlignment;
            row.getCell('C').alignment = centerTopAlignment;
            row.getCell('D').alignment = centerTopAlignment;
            row.getCell('E').alignment = centerTopAlignment;
            row.getCell('F').alignment = centerTopAlignment;
            row.getCell('G').alignment = rightTopAlignment;
            row.getCell('H').alignment = rightTopAlignment;
            row.getCell('I').alignment = dataTextStyle;
            
            currentRow++;
          });
        }
        
        // Subtotal da OM
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = rightMiddleAlignment;
        subtotalRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        // Cor de fundo para a linha de subtotal
        const corSubtotal = 'FFD3D3D3'; // Light Gray
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30;
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('C').font = { bold: true };
        subtotalRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('C').style = { ...subtotalRow.getCell('C').style, alignment: rightMiddleAlignment };
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39;
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('D').font = { bold: true };
        subtotalRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('D').style = { ...subtotalRow.getCell('D').style, alignment: rightMiddleAlignment };

        subtotalRow.getCell('E').value = totaisOM.total_parte_azul;
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00';
        subtotalRow.getCell('E').font = { bold: true };
        subtotalRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
        subtotalRow.getCell('E').style = { ...subtotalRow.getCell('E').style, alignment: rightMiddleAlignment };
        
        if (nomeOM === nomeRM && totaisOM.totalDieselLitros > 0) {
          subtotalRow.getCell('F').value = `${formatNumber(totaisOM.totalDieselLitros)} L OD`;
          subtotalRow.getCell('F').font = { bold: true };
          subtotalRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          subtotalRow.getCell('F').style = { ...subtotalRow.getCell('F').style, alignment: centerMiddleAlignment };
        }
        if (nomeOM === nomeRM && totaisOM.totalGasolinaLitros > 0) {
          subtotalRow.getCell('G').value = `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS`;
          subtotalRow.getCell('G').font = { bold: true };
          subtotalRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          subtotalRow.getCell('G').style = { ...subtotalRow.getCell('G').style, alignment: centerMiddleAlignment };
        }
        if (nomeOM === nomeRM && totaisOM.total_combustivel > 0) {
          subtotalRow.getCell('H').value = totaisOM.total_combustivel;
          subtotalRow.getCell('H').numFmt = 'R$ #,##0.00';
          subtotalRow.getCell('H').font = { bold: true };
          subtotalRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
          subtotalRow.getCell('H').style = { ...subtotalRow.getCell('H').style, alignment: rightMiddleAlignment };
        }
        
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            subtotalRow.getCell(col).border = cellBorder;
            // Aplica cor de fundo cinza claro para as células não coloridas (A, B, I)
            if (!subtotalRow.getCell(col).fill) {
                subtotalRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corSubtotal } };
            }
        });
        
        currentRow++;
        
        const totalOMRow = worksheet.getRow(currentRow);
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = rightMiddleAlignment;
        totalOMRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        const corTotalOM = 'FFE8E8E8'; // Very Light Gray
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00';
        totalOMRow.getCell('E').font = { bold: true };
        totalOMRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
        totalOMRow.getCell('E').style = { ...totalOMRow.getCell('E').style, alignment: rightMiddleAlignment };
        
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            totalOMRow.getCell(col).border = cellBorder;
            if (!totalOMRow.getCell(col).fill) {
                totalOMRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corTotalOM } };
            }
        });
        
        currentRow++;
      });
      
      currentRow++;
      
      // CÁLCULO TOTAL GERAL
      const totalDiesel = registrosClasseIII.filter(isCombustivel)
        .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const totalGasolina = registrosClasseIII.filter(isCombustivel)
        .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const totalValorCombustivelFinal = totalValorCombustivel;
      
      const somaRow = worksheet.getRow(currentRow);
      somaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      somaRow.getCell('A').alignment = rightMiddleAlignment;
      somaRow.getCell('A').font = { bold: true };
      
      somaRow.getCell('C').value = totalGeral_33_90_30;
      somaRow.getCell('C').numFmt = 'R$ #,##0.00';
      somaRow.getCell('C').font = { bold: true };
      somaRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('C').style = { ...somaRow.getCell('C').style, alignment: rightMiddleAlignment };
      
      somaRow.getCell('D').value = totalGeral_33_90_39;
      somaRow.getCell('D').numFmt = 'R$ #,##0.00';
      somaRow.getCell('D').font = { bold: true };
      somaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('D').style = { ...somaRow.getCell('D').style, alignment: rightMiddleAlignment };
      
      somaRow.getCell('E').value = totalGeral_GND3_ND;
      somaRow.getCell('E').numFmt = 'R$ #,##0.00';
      somaRow.getCell('E').font = { bold: true };
      somaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corAzul } };
      somaRow.getCell('E').style = { ...somaRow.getCell('E').style, alignment: rightMiddleAlignment };
      
      if (totalDiesel > 0) {
        somaRow.getCell('F').value = `${formatNumber(totalDiesel)} L OD`;
        somaRow.getCell('F').font = { bold: true };
        somaRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        somaRow.getCell('F').style = { ...somaRow.getCell('F').style, alignment: centerMiddleAlignment };
      }
      
      if (totalGasolina > 0) {
        somaRow.getCell('G').value = `${formatNumber(totalGasolina)} L GAS`;
        somaRow.getCell('G').font = { bold: true };
        somaRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        somaRow.getCell('G').style = { ...somaRow.getCell('G').style, alignment: centerMiddleAlignment };
      }
      
      if (totalValorCombustivelFinal > 0) {
        somaRow.getCell('H').value = totalValorCombustivelFinal;
        somaRow.getCell('H').numFmt = 'R$ #,##0.00';
        somaRow.getCell('H').font = { bold: true };
        somaRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corLaranja } };
        somaRow.getCell('H').style = { ...somaRow.getCell('H').style, alignment: rightMiddleAlignment };
      }
      
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        somaRow.getCell(col).border = cellBorder;
      });
      
      currentRow++;
      
      const valorTotalRow = worksheet.getRow(currentRow);
      valorTotalRow.getCell('G').value = 'VALOR TOTAL';
      valorTotalRow.getCell('G').font = { bold: true };
      valorTotalRow.getCell('G').alignment = centerMiddleAlignment;
      
      valorTotalRow.getCell('H').value = valorTotalSolicitado;
      valorTotalRow.getCell('H').numFmt = 'R$ #,##0.00';
      valorTotalRow.getCell('H').font = { bold: true };
      valorTotalRow.getCell('H').alignment = centerMiddleAlignment;
      
      ['G', 'H'].forEach(col => {
        valorTotalRow.getCell(col).border = cellBorder;
      });
      
      currentRow++;
      
      const gndLabelRow = worksheet.getRow(currentRow);
      gndLabelRow.getCell('H').value = 'GND - 3';
      gndLabelRow.getCell('H').font = { bold: true };
      gndLabelRow.getCell('H').alignment = centerMiddleAlignment;
      gndLabelRow.getCell('H').border = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      const gndValueRow = worksheet.getRow(currentRow);
      gndValueRow.getCell('H').value = valorTotalSolicitado;
      gndValueRow.getCell('H').numFmt = 'R$ #,##0.00';
      gndValueRow.getCell('H').font = { bold: true };
      gndValueRow.getCell('H').alignment = centerMiddleAlignment;
      gndValueRow.getCell('H').border = {
        left: { style: 'thin' as const },
        bottom: { style: 'thick' as const },
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      currentRow++;
      
      const localRow = worksheet.getRow(currentRow);
      localRow.getCell('A').value = `${ptrabData.local_om || 'Local'}, ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      localRow.getCell('A').font = { name: 'Arial', size: 10 };
      currentRow++;
      
      currentRow++;
      
      const cmtRow = worksheet.getRow(currentRow);
      cmtRow.getCell('A').value = ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]';
      cmtRow.getCell('A').font = { name: 'Arial', size: 10, bold: true };
      currentRow++;
      
      const cargoRow = worksheet.getRow(currentRow);
      cargoRow.getCell('A').value = `Comandante da ${ptrabData.nome_om_extenso || ptrabData.nome_om}`;
      cargoRow.getCell('A').font = { name: 'Arial', size: 9 };
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PTrab_${ptrabData.numero_ptrab}_${ptrabData.nome_operacao}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Excel gerado com sucesso!",
        description: `Arquivo exportado com formatação completa.`,
      });
      handleExportSuccess(); // Chamar a função de sucesso após a exportação
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      toast({
        title: "Erro ao gerar Excel",
        description: "Não foi possível exportar o documento. Verifique o console para detalhes.",
        variant: "destructive",
      });
    }
  }, [ptrabData, registrosClasseI, registrosClasseII, registrosClasseIII, nomeRM, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, toast, handleExportSuccess]);
      
  // Se estiver carregando, exibe uma mensagem de carregamento.
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando dados para impressão...</p>
      </div>
    );
  }

  if (!ptrabData) return null;

  // 1. Recalcular Totais Gerais (para HTML/PDF)
  const totalGeral_33_90_30 = Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_30, 0);
  const totalGeral_33_90_39 = Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, grupo.linhasQS[0]?.registro.om_qs || grupo.linhasQR[0]?.registro.organizacao || grupo.linhasClasseII[0]?.registro.organizacao || grupo.linhasLubrificante[0]?.registro.organizacao || '').total_33_90_39, 0);
  const totalValorCombustivel = registrosClasseIII.filter(isCombustivel).reduce((acc, reg) => acc + reg.valor_total, 0);
  
  // O total geral agora inclui os novos placeholders
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39; // Soma das colunas azuis (C+D)
  
  // O valor total solicitado é a soma de todos os itens (Classe I + Classe II/V/VI/VII/VIII/IX + Classe III)
  const valorTotalSolicitado = totalGeral_33_90_30 + totalGeral_33_90_39 + totalValorCombustivel;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button onClick={exportPDF} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <Button onClick={exportExcel} variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={handlePrint} variant="default">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </div>

      <div className="ptrab-print-container">
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.comando_militar_area}</p>
          <p className="text-[11pt] font-bold uppercase">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          {/* Linha em branco removida aqui */}
          <p className="text-[11pt] font-bold uppercase">
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase underline">Plano de Trabalho Logístico</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {registrosClasseI.length > 0 || registrosClasseII.length > 0 || registrosClasseIII.length > 0 ? (
          <div className="ptrab-table-wrapper">
            <table className="ptrab-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="col-despesas">DESPESAS<br/>(ORDENAR POR CLASSE DE SUBSISTÊNCIA)</th>
                  <th rowSpan={2} className="col-om">OM (UGE)<br/>CODUG</th>
                  <th colSpan={3} className="col-natureza-header">NATUREZA DE DESPESA</th>
                  <th colSpan={3} className="col-combustivel-header">COMBUSTÍVEL</th>
                  <th rowSpan={2} className="col-detalhamento">DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/>OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</th>
                </tr>
                <tr>
                  <th className="col-nd col-natureza">33.90.30</th>
                  <th className="col-nd col-natureza">33.90.39</th>
                  <th className="col-nd col-natureza">TOTAL</th>
                  <th className="col-combustivel">LITROS</th>
                  <th className="col-combustivel">PREÇO<br/>UNITÁRIO</th>
                  <th className="col-combustivel">PREÇO<br/>TOTAL</th>
                </tr>
            </thead>
            <tbody>
              {/* ========== SUBSEÇÕES DINÂMICAS POR OM ========== */}
              {omsOrdenadas.flatMap((nomeOM, omIndex) => {
                const grupo = gruposPorOM[nomeOM];
                const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                
                // Se o grupo não tem linhas, pula
                if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && grupo.linhasClasseII.length === 0 && grupo.linhasClasseV.length === 0 && grupo.linhasClasseVI.length === 0 && grupo.linhasClasseVII.length === 0 && grupo.linhasClasseVIII.length === 0 && grupo.linhasClasseIX.length === 0 && grupo.linhasLubrificante.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.filter(isCombustivel).length === 0)) {
                  return [];
                }
                
                // Array de todas as linhas de despesa, ordenadas pela sequência romana:
                const linhasDespesaOrdenadas = [
                    ...grupo.linhasQS,
                    ...grupo.linhasQR,
                    ...grupo.linhasClasseII,
                    ...grupo.linhasLubrificante, // Classe III Lubrificante
                    ...grupo.linhasClasseV,
                    ...grupo.linhasClasseVI,
                    ...grupo.linhasClasseVII,
                    ...grupo.linhasClasseVIII,
                    ...grupo.linhasClasseIX, // NOVO
                ];
                
                return [
                  // 1. Renderizar todas as linhas de despesa (I, II, III Lub, V, VI, VII, VIII, IX)
                  ...linhasDespesaOrdenadas.map((linha) => {
                    const isClasseI = 'tipo' in linha;
                    const isClasseII_IX = 'categoria' in linha.registro;
                    const isLubrificante = 'tipo_equipamento' in linha.registro;
                    
                    const rowData = {
                        despesasValue: '',
                        omValue: '',
                        detalhamentoValue: '',
                        valorC: 0,
                        valorD: 0,
                        valorE: 0,
                    };
                    
                    if (isClasseI) { // Classe I (QS/QR)
                        const registro = linha.registro as ClasseIRegistro;
                        if (linha.tipo === 'QS') {
                            rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA\n${registro.organizacao}`;
                            rowData.omValue = `${registro.om_qs}\n(${registro.ug_qs})`;
                            rowData.valorC = registro.total_qs;
                            rowData.valorE = registro.total_qs;
                            rowData.detalhamentoValue = registro.memoria_calculo_qs_customizada || generateClasseIMemoriaCalculo(registro).qs;
                        } else { // QR
                            rowData.despesasValue = `CLASSE I - SUBSISTÊNCIA`;
                            rowData.omValue = `${registro.organizacao}\n(${registro.ug})`;
                            rowData.valorC = registro.total_qr;
                            rowData.valorE = registro.total_qr;
                            rowData.detalhamentoValue = registro.memoria_calculo_qr_customizada || generateClasseIMemoriaCalculo(registro).qr;
                        }
                    } else if (isClasseII_IX) { // Classe II, V, VI, VII, VIII, IX
                        const registro = linha.registro as ClasseIIRegistro;
                        const omDestinoRecurso = registro.organizacao;
                        const ugDestinoRecurso = registro.ug;
                        
                        let secondDivContent = registro.categoria.toUpperCase();
                        
                        if (registro.categoria === 'Remonta/Veterinária' && registro.animal_tipo) {
                            secondDivContent = registro.animal_tipo.toUpperCase();
                        }
                            
                        rowData.despesasValue = `${getClasseIILabel(registro.categoria)}\n${secondDivContent}`;
                        rowData.omValue = `${omDestinoRecurso}\n(${ugDestinoRecurso})`;
                        rowData.valorC = registro.valor_nd_30;
                        rowData.valorD = registro.valor_nd_39;
                        rowData.valorE = registro.valor_nd_30 + registro.valor_nd_39;
                        
                        if (CLASSE_IX_CATEGORIES.includes(registro.categoria)) {
                            rowData.detalhamentoValue = generateClasseIXMemoriaCalculo(registro); // NOVO
                        } else {
                            rowData.detalhamentoValue = generateClasseIIMemoriaCalculo(registro);
                        }
                        
                    } else if (isLubrificante) { // Classe III Lubrificante
                        const registro = linha.registro as ClasseIIIRegistro;
                        const isOmDifferent = registro.organizacao !== nomeOM;
                        const tipoEquipamento = registro.tipo_equipamento === 'LUBRIFICANTE_GERADOR' ? 'GERADOR' : 'EMBARCAÇÃO';
                        
                        let despesasLubValue = `CLASSE III - LUBRIFICANTE`;
                        if (isOmDifferent) {
                          despesasLubValue += `\n${registro.organizacao}`;
                        }
                        rowData.despesasValue = despesasLubValue;
                        rowData.omValue = `${registro.organizacao}\n(${registro.ug})`;
                        rowData.valorC = registro.valor_total;
                        rowData.valorE = registro.valor_total;
                        rowData.detalhamentoValue = registro.detalhamento_customizado || registro.detalhamento || '';
                    }
                    
                    return (
                      <tr key={isClasseI ? `${linha.registro.id}-${linha.tipo}` : isLubrificante ? `lub-${linha.registro.id}` : `classe-ii-${linha.registro.id}`}>
                        <td className="col-despesas">
                          {rowData.despesasValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-om">
                          {rowData.omValue.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                        </td>
                        <td className="col-valor-natureza">{rowData.valorC > 0 ? formatCurrency(rowData.valorC) : ''}</td>
                        <td className="col-valor-natureza">{rowData.valorD > 0 ? formatCurrency(rowData.valorD) : ''}</td>
                        <td className="col-valor-natureza">{rowData.valorE > 0 ? formatCurrency(rowData.valorE) : ''}</td>
                        <td className="col-combustivel-data-filled"></td>
                        <td className="col-combustivel-data-filled"></td>
                        <td className="col-combustivel-data-filled"></td>
                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                          <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {rowData.detalhamentoValue}
                          </pre>
                        </td>
                      </tr>
                    );
                  }),
                  
                  // 2. Linhas Combustível (APENAS na RM) - Classe III Combustível
                  ...(nomeOM === nomeRM ? registrosClasseIII.filter(isCombustivel).map((registro) => {
                    const getTipoEquipamentoLabel = (tipo: string) => {
                      switch (tipo) {
                        case 'GERADOR': return 'GERADOR';
                        case 'EMBARCACAO': return 'EMBARCAÇÃO';
                        case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
                        case 'MOTOMECANIZACAO': return 'MOTOMECANIZAÇÃO';
                        default: return tipo;
                      }
                    };

                    const getTipoCombustivelLabel = (tipo: string) => {
                      if (tipo === 'DIESEL' || tipo === 'OD') {
                        return 'ÓLEO DIESEL';
                      } else if (tipo === 'GASOLINA' || tipo === 'GAS') {
                        return 'GASOLINA';
                      }
                      return tipo;
                    };

                    return (
                      <tr key={`classe-iii-${registro.id}`}>
                        <td className="col-despesas">
                          <div>CLASSE III - {getTipoCombustivelLabel(registro.tipo_combustivel)}</div>
                          <div>{getTipoEquipamentoLabel(registro.tipo_equipamento)}</div>
                          <div>{registro.organizacao}</div>
                        </td>
                        <td className="col-om">
                          <div>{nomeRM}</div>
                          <div>({gruposPorOM[nomeRM]?.linhasQS[0]?.registro.ug_qs || gruposPorOM[nomeRM]?.linhasQR[0]?.registro.ug || 'UG'})</div>
                        </td>
                        <td className="col-valor-natureza"></td> {/* 33.90.30 (Vazio) */}
                        <td className="col-valor-natureza"></td> {/* 33.90.39 (Vazio) */}
                        <td className="col-valor-natureza"></td> {/* TOTAL (Vazio) */}
                        <td className="col-combustivel-data-filled">{formatNumber(registro.total_litros)} L</td>
                        <td className="col-combustivel-data-filled">{formatCurrency(registro.preco_litro)}</td>
                        <td className="col-combustivel-data-filled">{formatCurrency(registro.valor_total)}</td>
                        <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                          <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                            {registro.detalhamento_customizado || registro.detalhamento || ''}
                          </pre>
                        </td>
                      </tr>
                    );
                  }) : []),
                  
                  // Subtotal da OM
                  <tr key={`subtotal-${omIndex}`} className="subtotal-row">
                    <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                    {/* Parte Azul (Natureza de Despesa) */}
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_33_90_30)}</td>
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td>
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_parte_azul)}</td> {/* TOTAL ND (C+D) */}
                    {/* Parte Laranja (Combustivel) */}
                    <td className="text-center font-bold border border-black">
                      {nomeOM === nomeRM && totaisOM.totalDieselLitros > 0 
                        ? `${formatNumber(totaisOM.totalDieselLitros)} L OD` 
                        : ''}
                    </td>
                    <td className="text-center font-bold border border-black">
                      {nomeOM === nomeRM && totaisOM.totalGasolinaLitros > 0 
                        ? `${formatNumber(totaisOM.totalGasolinaLitros)} L GAS` 
                        : ''}
                    </td>
                    <td className="text-center font-bold border border-black">
                      {nomeOM === nomeRM && totaisOM.total_combustivel > 0 
                        ? formatCurrency(totaisOM.total_combustivel) 
                        : ''}
                    </td>
                    <td></td>
                  </tr>,
                  
                  // Total da OM
                  <tr key={`total-${omIndex}`} className="subtotal-om-row">
                    <td colSpan={4} className="text-right font-bold">
                      VALOR TOTAL DO {nomeOM}
                    </td>
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_gnd3)}</td>
                    <td colSpan={3}></td>
                    <td></td>
                  </tr>
                ];
              })}
              
              {/* ========== TOTAL GERAL ========== */}
              {/* Linha em branco para espaçamento */}
              <tr className="spacing-row">
                <td colSpan={9} style={{ height: '20px', border: 'none', backgroundColor: 'transparent' }}></td>
              </tr>
              
              {(() => {
                // Totais de combustível por tipo (para exibição na parte laranja)
                const totalDiesel = registrosClasseIII.filter(isCombustivel)
                  .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const totalGasolina = registrosClasseIII.filter(isCombustivel)
                  .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const totalValorCombustivelFinal = totalValorCombustivel;

                return (
                  <>
                    {/* Linha 1: Soma detalhada por ND e GP de Despesa */}
                    <tr className="total-geral-soma-row">
                      <td colSpan={2} className="text-right font-bold">SOMA POR ND E GP DE DESPESA</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_30)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_33_90_39)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#B4C7E7' }}>{formatCurrency(totalGeral_GND3_ND)}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalDiesel > 0 ? `${formatNumber(totalDiesel)} L OD` : ''}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalGasolina > 0 ? `${formatNumber(totalGasolina)} L GAS` : ''}</td>
                      <td className="text-center font-bold" style={{ backgroundColor: '#F8CBAD' }}>{totalValorCombustivelFinal > 0 ? formatCurrency(totalValorCombustivelFinal) : ''}</td>
                      <td style={{ backgroundColor: 'white' }}></td>
                    </tr>

                    {/* Linha 2: Valor Total */}
                    <tr className="total-geral-final-row">
                      <td colSpan={6}></td>
                      <td className="text-center font-bold" style={{ whiteSpace: 'nowrap' }}>VALOR TOTAL</td>
                      <td className="text-center font-bold">{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ backgroundColor: 'white' }}></td>
                    </tr>
                    
                    {/* Linha 3: GND - 3 (dividida em 2 subdivisões) */}
                    {/* Primeira subdivisão: GND - 3 */}
                    <tr style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderTop: '1px solid #000', borderRight: '1px solid #000' }}>GND - 3</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                    
                    {/* Segunda subdivisão: Valor Total */}
                    <tr style={{ backgroundColor: 'white' }}>
                      <td colSpan={7} style={{ border: 'none' }}></td>
                      <td className="text-center font-bold" style={{ borderLeft: '1px solid #000', borderBottom: '3px solid #000', borderRight: '1px solid #000' }}>{formatCurrency(valorTotalSolicitado)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Nenhum registro cadastrado.</p>
        )}

        <div className="ptrab-footer">
          <p className="text-[10pt]">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <div className="signature-block">
            <p className="text-[10pt] font-bold">{ptrabData.nome_cmt_om || 'Gen Bda [NOME COMPLETO]'}</p>
            <p className="text-[9pt]">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>

      <style>{`
        @page {
          size: A4 landscape;
          margin: 0.5cm;
        }
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          .ptrab-print-container { padding: 0 !important; margin: 0 !important; }
          .ptrab-table thead { display: table-row-group; break-inside: avoid; break-after: auto; }
          .ptrab-table thead tr { page-break-inside: avoid; page-break-after: auto; }
          .ptrab-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
          .ptrab-table tr { page-break-inside: avoid; break-inside: avoid; }
        }
        .ptrab-print-container { max-width: 100%; margin: 0 auto; padding: 2rem 1rem; font-family: Arial, sans-serif; }
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; }
        .ptrab-table-wrapper { margin-top: 0.2rem; margin-bottom: 2rem; overflow-x: auto; }
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 2px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; }
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        .col-despesas { width: 14%; text-align: left; }
        .col-om { width: 9%; text-align: center; }
        .col-natureza-header { background-color: #B4C7E7 !important; text-align: center; font-weight: bold; }
        .col-natureza { background-color: #B4C7E7 !important; width: 8%; text-align: center; }
        .col-nd { width: 8%; text-align: center; }
        .col-combustivel-header { background-color: #F8CBAD !important; text-align: center; font-weight: bold; }
        .col-combustivel { background-color: #F8CBAD !important; width: 6%; text-align: center; font-size: 8pt; }
        .col-combustivel-data { background-color: #FFF; text-align: center; width: 6%; }
        .col-valor-natureza { background-color: #B4C7E7 !important; text-align: center; padding: 6px 8px; }
        .col-combustivel-data-filled { background-color: #F8CBAD !important; text-align: center; padding: 6px 8px; }
        .col-detalhamento { width: 28%; text-align: left; }
        .detalhamento-cell { font-size: 6.5pt; line-height: 1.2; }
        .total-row { background-color: #FFFF99; font-weight: bold; }
        .subtotal-row { background-color: #D3D3D3; font-weight: bold; border-top: 2px solid #000; }
        .subtotal-om-row { background-color: #E8E8E8; font-weight: bold; }
        .total-geral-soma-row { background-color: #D3D3D3; font-weight: bold; border-top: 3px solid #000; }
        .total-geral-final-row { background-color: #E8E8E8; font-weight: bold; }
        .total-geral-gnd-row { background-color: #E8E8E8; font-weight: bold; border-bottom: 3px solid #000; }
        .secao-header-row { background-color: #4A7C4E; color: white; font-weight: bold; border-top: 3px solid #000; border-bottom: 3px solid #000; }
        .ptrab-footer { margin-top: 3rem; text-align: center; }
        .signature-block { margin-top: 4rem; }
      `}</style>

      <AlertDialog open={showCompleteStatusDialog} onOpenChange={setShowCompleteStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar P Trab?</AlertDialogTitle>
            <AlertDialogDescription>
              O P Trab "{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}" foi exportado. Deseja alterar o status para "Arquivado"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmCompleteStatus}>Sim, arquivar</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelCompleteStatus}>Não, manter status atual</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PTrabPrint;