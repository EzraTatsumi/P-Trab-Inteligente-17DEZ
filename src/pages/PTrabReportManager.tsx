import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, FileText, Package, Utensils, Briefcase, HardHat, Plane, ClipboardList, Frown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PTrabLogisticoReport from "@/components/reports/PTrabLogisticoReport";
import PTrabRacaoOperacionalReport from "@/components/reports/PTrabRacaoOperacionalReport";
import PTrabOperacionalReport from "@/components/reports/PTrabOperacionalReport"; 
import PTrabHorasVooReport from "@/components/reports/PTrabHorasVooReport"; 
import PTrabMaterialPermanenteReport from "@/components/reports/PTrabMaterialPermanenteReport";
import DORReport from "@/components/reports/DORReport";
import {
  generateRacaoQuenteMemoriaCalculo,
  generateRacaoOperacionalMemoriaCalculo,
  calculateClasseICalculations,
} from "@/lib/classeIUtils";
import { generateClasseIIMemoriaCalculo as generateClasseIIUtility } from "@/lib/classeIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVUtility } from "@/lib/classeVUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIUtility } from "@/lib/classeVIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIUtility } from "@/lib/classeVIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseVIIIUtility } from "@/lib/classeVIIIUtils";
import { generateCategoryMemoriaCalculo as generateClasseIXUtility, calculateItemTotalClasseIX as calculateItemTotalClasseIXUtility } from "@/lib/classeIXUtils";
import { generateGranularMemoriaCalculo as generateClasseIIIGranularUtility, calculateItemTotals } from "@/lib/classeIIIUtils";
import { 
  generateDiariaMemoriaCalculo as generateDiariaMemoriaCalculoUtility, 
  calculateDiariaTotals,
  DestinoDiaria,
  QuantidadesPorPosto,
} from "@/lib/diariaUtils"; 
import { 
  generateVerbaOperacionalMemoriaCalculo as generateVerbaOperacionalMemoriaCalculoUtility,
} from "@/lib/verbaOperacionalUtils"; 
import { 
  generateSuprimentoFundosMemoriaCalculo as generateSuprimentoFundosMemoriaCalculoUtility,
} from "@/lib/suprimentoFundosUtils"; 
import { 
  generatePassagemMemoriaCalculo,
  PassagemRegistro as PassagemRegistroType, 
} from "@/lib/passagemUtils"; 
import { 
  ConcessionariaRegistroComDiretriz, 
  generateConcessionariaMemoriaCalculo as generateConcessionariaMemoriaCalculoUtility,
} from "@/lib/concessionariaUtils"; 
import { 
  MaterialConsumoRegistro as MaterialConsumoRegistroType,
  generateMaterialConsumoMemoriaCalculo as generateMaterialConsumoMemoriaCalculoUtility,
} from "@/lib/materialConsumoUtils"; 
import { 
  ComplementoAlimentacaoRegistro as ComplementoAlimentacaoRegistroType,
  generateComplementoMemoriaCalculo as generateComplementoMemoriaCalculoUtility,
} from "@/lib/complementoAlimentacaoUtils"; 
import { 
  ServicoTerceiroRegistro as ServicoTerceiroRegistroType,
  generateServicoMemoriaCalculo as generateServicoMemoriaCalculoUtility,
} from "@/lib/servicosTerceirosUtils";
import { RefLPC } from "@/types/refLPC";
import { fetchDiretrizesOperacionais, fetchDiretrizesPassagens } from "@/lib/ptrabUtils"; 
import { Tables, Json } from "@/integrations/supabase/types"; 
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { GHOST_DATA, isGhostMode } from "@/lib/ghostStore";
import { runMission06 } from "@/tours/missionTours";
import PageMetadata from "@/components/PageMetadata";

// =================================================================
// TIPOS E FUNÇÕES AUXILIARES (Exportados para uso nos relatórios)
// =================================================================

export interface PTrabData {
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
  updated_at: string;
  rm_vinculacao: string;
}

export interface ClasseIRegistro extends Tables<'classe_i_registros'> {
    diasOperacao: number;
    faseAtividade: string | null;
    omQS: string;
    ugQS: string;
    nrRefInt: number;
    valorQS: number;
    valorQR: number;
    quantidadeR2: number;
    quantidadeR3: number;
    totalQS: number;
    totalQR: number;
    totalGeral: number;
    complementoQS: number;
    etapaQS: number;
    complementoQR: number;
    etapaQR: number;
    memoriaQSCustomizada: string | null;
    memoriaQRCustomizada: string | null;
    calculos: any;
}

export interface DiariaRegistro extends Tables<'diaria_registros'> {
  destino: DestinoDiaria;
  quantidades_por_posto: QuantidadesPorPosto;
  valor_total: number;
  valor_nd_15: number;
  valor_nd_30: number;
  valor_taxa_embarque: number;
  is_aereo: boolean;
}

export interface VerbaOperacionalRegistro extends Tables<'verba_operacional_registros'> {
  valor_total_solicitado: number;
  valor_nd_30: number;
  valor_nd_39: number;
  dias_operacao: number;
  quantidade_equipes: number;
}

export type PassagemRegistro = PassagemRegistroType;

export interface ConcessionariaRegistro extends Tables<'concessionaria_registros'> {
  totalND39?: number;
  diretriz?: Tables<'diretrizes_concessionaria'>;
}

export type MaterialConsumoRegistro = MaterialConsumoRegistroType; 

export type ComplementoAlimentacaoRegistro = ComplementoAlimentacaoRegistroType;

export type ServicoTerceiroRegistro = ServicoTerceiroRegistroType;

export type MaterialPermanenteRegistro = Tables<'material_permanente_registros'>;

export interface HorasVooRegistro extends Tables<'horas_voo_registros'> {
  quantidade_hv: number;
  valor_nd_30: number;
  valor_nd_39: number;
  valor_total: number;
  dias_operacao: number;
}

export interface ItemClasseIII {
  item: string; 
  categoria: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
  consumo_fixo: number; 
  tipo_combustivel_fixo: 'GASOLINA' | 'DIESEL'; 
  unidade_fixa: 'L/h' | 'km/L';
  quantidade: number;
  horas_dia: number;
  distancia_percorrida: number;
  quantidade_deslocamentos: number;
  dias_utilizados: number;
  consumo_lubrificante_litro: number; 
  preco_lubrificante: number; 
  memoria_customizada?: string | null; 
  preco_lubrificante_input: string; 
  consumo_lubrificante_input: string; 
}

export interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

export interface ClasseIIRegistro extends Tables<'classe_ii_registros'> {
  animal_tipo?: 'Equino' | 'Canino' | null;
  quantidade_animais?: number;
  itens_remonta?: Json; 
  itens_saude?: Json; 
  itens_motomecanizacao?: Json;
  efetivo: number; 
}

export interface ClasseIIIRegistro extends Omit<Tables<'classe_iii_registros'>, 'itens_equipamentos'> {
  potencia_hp: number | null;
  horas_dia: number | null;
  consumo_hora: number | null;
  consumo_km_litro: number | null;
  km_dia: number | null;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  consumo_lubrificante_litro: number | null;
  preco_lubrificante: number | null;
  valor_nd_30: number;
  valor_nd_39: number;
  itens_equipamentos: ItemClasseIII[] | null;
}

export interface LinhaTabela {
  registro: ClasseIRegistro;
  valor_nd_30: number; 
  valor_nd_39: number; 
  tipo: 'QS' | 'QR';
}

export interface LinhaClasseII {
  registro: ClasseIIRegistro;
  valor_nd_30: number; 
  valor_nd_39: number; 
}

export interface LinhaClasseIII {
  registro: ClasseIIIRegistro;
  categoria_equipamento: 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO' | 'LUBRIFICANTE';
  tipo_suprimento: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
  valor_total_linha: number;
  total_litros_linha: number;
  preco_litro_linha: number;
  memoria_calculo: string; 
}

export interface LinhaConcessionaria {
  registro: ConcessionariaRegistro;
  valor_nd_39: number;
}

export interface GrupoOMOperacional {
  diarias: DiariaRegistro[];
  verbaOperacional: VerbaOperacionalRegistro[];
  suprimentoFundos: VerbaOperacionalRegistro[];
  passagens: PassagemRegistro[];
  concessionarias: ConcessionariaRegistro[];
  materialConsumo: MaterialConsumoRegistro[]; 
  complementoAlimentacao: { registro: ComplementoAlimentacaoRegistro, subType?: 'QS' | 'QR' }[];
  servicosTerceiros: ServicoTerceiroRegistro[];
  materialPermanente: MaterialPermanenteRegistro[];
  horasVoo: HorasVooRegistro[];
}

export interface GrupoOM {
  linhasQS: LinhaTabela[];
  linhasQR: LinhaTabela[];
  linhasClasseII: LinhaClasseII[];
  linhasClasseV: LinhaClasseII[];
  linhasClasseVI: LinhaClasseII[];
  linhasClasseVII: LinhaClasseII[];
  linhasClasseVIII: LinhaClasseII[];
  linhasClasseIX: LinhaClasseII[];
  linhasClasseIII: LinhaClasseIII[];
  linhasConcessionaria: LinhaConcessionaria[]; 
}

export const CLASSE_V_CATEGORIES = ["Armt L", "Armt P", "IODCT", "DQBRN"];
export const CLASSE_VI_CATEGORIES = ["Gerador", "Embarcação", "Equipamento de Engenharia"];
export const CLASSE_VII_CATEGORIES = ["Comunicações", "Informática"];
export const CLASSE_VIII_CATEGORIES = ["Saúde", "Remonta/Veterinária"];
export const CLASSE_IX_CATEGORIES = ["Vtr Administrativa", "Vtr Operacional", "Motocicleta", "Vtr Blindada"];

export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

export const calculateDays = (inicio: string, fim: string) => {
  const start = new Date(inicio);
  const end = new Date(fim);
  const diff = end.getTime() - start.getTime();
  return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
};

export const getClasseIILabel = (category: string): string => {
    switch (category) {
        case 'Vtr Administrativa': return 'Viatura Administrativa';
        case 'Vtr Operacional': return 'Viatura Operacional';
        case 'Motocicleta': return 'Motocicleta';
        case 'Vtr Blindada': return 'Viatura Blindada';
        case 'Equipamento Individual': return 'Eqp Individual';
        case 'Proteção Balística': return 'Prot Balística';
        case 'Material de Estacionamento': return 'Mat Estacionamento';
        case 'Armt L': return 'Armamento Leve';
        case 'Armt P': return 'Armamento Pesado';
        case 'IODCT': return 'IODCT';
        case 'DQBRN': return 'DQBRN';
        case 'Gerador': return 'Gerador';
        case 'Embarcação': return 'Embarcação';
        case 'Equipamento de Engenharia': return 'Eqp Engenharia';
        case 'Comunicações': return 'Comunicações';
        case 'Informática': return 'Informática';
        case 'Saúde': return 'Saúde';
        case 'Remonta/Veterinária': return 'Remonta/Veterinária';
        default: return category;
    }
};

type ReportType = 'logistico' | 'racao_operacional' | 'operacional' | 'material_permanente' | 'hora_voo' | 'dor';

const REPORT_OPTIONS = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, 
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
] as const;

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [fullReportData, setFullReportData] = useState<any>(null);
  
  const { user } = { user: { id: 'ghost-user' } }; // Simulação simplificada de sessão

  useEffect(() => {
    const startTour = searchParams.get('startTour') === 'true';
    if (startTour && isGhostMode() && user?.id) {
      setTimeout(() => {
        runMission06(user.id, () => {
            navigate('/ptrab?showHub=true');
        });
      }, 500);
    }
  }, [searchParams, user?.id]);

  const loadData = useCallback(async () => {
    if (!ptrabId && !isGhostMode()) {
        navigate('/ptrab');
        return;
    }
    setLoading(true);
    try {
        if (isGhostMode()) {
            setPtrabData(GHOST_DATA.p_trab_exemplo);
            // Dados fictícios para o relatório em modo fantasma seriam necessários aqui se não existissem no componente
        } else {
            const { data, error } = await supabase.rpc('get_ptrab_full_report_data', { p_ptrab_id: ptrabId });
            if (error) throw error;
            if (data) {
                setFullReportData(data);
                setPtrabData(data.p_trab);
            }
        }
    } catch (error) {
        console.error("Erro ao carregar dados do relatório:", error);
        toast.error("Erro ao carregar os dados completos do P Trab.");
    } finally {
        setLoading(false);
    }
  }, [ptrabId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <PageMetadata 
        title="Relatórios P Trab" 
        description="Gerenciador de Relatórios do P Trab" 
        canonicalPath="/ptrab/relatorios" 
      />
      <div className="print:hidden p-4 border-b flex justify-between items-center sticky top-0 bg-background z-10">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          <Select value={selectedReport} onValueChange={(v) => setSelectedReport(v as ReportType)}>
              <SelectTrigger className="w-[300px]"><SelectValue /></SelectTrigger>
              <SelectContent>{REPORT_OPTIONS.map(o => (<SelectItem key={o.value} value={o.value}><div className="flex items-center gap-2"><o.icon className={o.iconClass} />{o.label}</div></SelectItem>))}</SelectContent>
          </Select>
      </div>
      <div className="container max-w-7xl mx-auto py-8">
          {selectedReport === 'logistico' && ptrabData && (
              <PTrabLogisticoReport 
                ptrab={ptrabData}
                classeI={fullReportData?.classe_i || []}
                classeII={fullReportData?.classe_ii || []}
                classeIII={fullReportData?.classe_iii || []}
                classeV={fullReportData?.classe_v || []}
                classeVI={fullReportData?.classe_vi || []}
                classeVII={fullReportData?.classe_vii || []}
                classeVIII_Saude={fullReportData?.classe_viii_saude || []}
                classeVIII_Remonta={fullReportData?.classe_viii_remonta || []}
                classeIX={fullReportData?.classe_ix || []}
                concessionarias={fullReportData?.concessionarias || []}
              />
          )}

          {selectedReport === 'racao_operacional' && ptrabData && (
              <PTrabRacaoOperacionalReport 
                ptrab={ptrabData}
                classeI={fullReportData?.classe_i || []}
              />
          )}

          {selectedReport === 'operacional' && ptrabData && (
              <PTrabOperacionalReport 
                ptrab={ptrabData} 
                diarias={fullReportData?.diarias || []} 
                passagens={fullReportData?.passagens || []} 
                verbaOperacional={fullReportData?.verba_operacional || []} 
                concessionarias={fullReportData?.concessionarias || []} 
                horasVoo={fullReportData?.horas_voo || []} 
                materialConsumo={fullReportData?.material_consumo || []} 
                complementoAlimentacao={fullReportData?.complemento_alimentacao || []} 
                servicosTerceiros={fullReportData?.servicos_terceiros || []} 
                materialPermanente={fullReportData?.material_permanente || []} 
              />
          )}

          {selectedReport === 'material_permanente' && ptrabData && (
              <PTrabMaterialPermanenteReport 
                ptrab={ptrabData}
                materialPermanente={fullReportData?.material_permanente || []}
              />
          )}

          {selectedReport === 'hora_voo' && ptrabData && (
              <PTrabHorasVooReport 
                ptrab={ptrabData}
                horasVoo={fullReportData?.horas_voo || []}
              />
          )}

          {selectedReport === 'dor' && ptrabData && (
              <DORReport 
                ptrab={ptrabData}
                dorRegistros={fullReportData?.dor || []}
              />
          )}

          {!ptrabData && (
              <div className="text-center py-20">
                  <Frown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold">P Trab não encontrado</h3>
                  <p className="text-muted-foreground mt-2">Os dados deste Plano de Trabalho não puderam ser carregados.</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default PTrabReportManager;