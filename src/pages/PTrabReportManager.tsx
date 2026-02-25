"use client";

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

export const generateClasseIMemoriaCalculoUnificada = (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP'): string => {
    if (registro.categoria === 'RACAO_OPERACIONAL') {
        if (tipo === 'OP') {
            if (registro.memoria_calculo_op_customizada) return registro.memoria_calculo_op_customizada;
            return generateRacaoOperacionalMemoriaCalculo({ ...registro, diasOperacao: registro.dias_operacao, omQS: null, ugQS: null, nrRefInt: null, valorQS: null, valorQR: null, calculos: {} as any } as any);
        }
        return "Memória não aplicável.";
    }
    if (tipo === 'QS') return registro.memoriaQSCustomizada || "Memória QS padrão";
    if (tipo === 'QR') return registro.memoriaQRCustomizada || "Memória QR padrão";
    return "";
};

export const generateClasseIIMemoriaCalculo = (registro: any, isClasseII: boolean): string => registro.detalhamento_customizado || "Memória de cálculo padrão";
export const generateDiariaMemoriaCalculoUnificada = (registro: any, diretrizesOp: any) => registro.detalhamento_customizado || "Memória Diária padrão";
export const generateVerbaOperacionalMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Verba padrão";
export const generateSuprimentoFundosMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Suprimento padrão";
export const generatePassagemMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Passagem padrão";
export const generateConcessionariaMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Concessionária padrão";
export const generateMaterialConsumoMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Consumo padrão";
export const generateComplementoMemoriaCalculada = (registro: any, subType?: any) => registro.detalhamento_customizado || "Memória Complemento padrão";
export const generateServicoMemoriaCalculada = (registro: any) => registro.detalhamento_customizado || "Memória Serviço padrão";

// =================================================================
// COMPONENTE PRINCIPAL
// =================================================================

type ReportType = 'logistico' | 'racao_operacional' | 'operacional' | 'material_permanente' | 'hora_voo' | 'dor';

const REPORT_OPTIONS = [
  { value: 'logistico', label: 'P Trab Logístico', icon: Package, iconClass: 'text-orange-500', fileSuffix: 'Aba Log' },
  { value: 'racao_operacional', label: 'P Trab Cl I - Ração Operacional', icon: Utensils, iconClass: 'text-orange-500', fileSuffix: 'Aba Rç Op' },
  { value: 'operacional', label: 'P Trab Operacional', icon: Briefcase, iconClass: 'text-blue-500', fileSuffix: 'Aba Op' }, 
  { value: 'material_permanente', label: 'P Trab Material Permanente', icon: HardHat, iconClass: 'text-green-500', fileSuffix: 'Aba Mat Perm' },
  { value: 'hora_voo', label: 'P Trab Hora de Voo', icon: Plane, iconClass: 'text-purple-500', fileSuffix: 'Aba HV' },
  { value: 'dor', label: 'DOR', icon: ClipboardList, iconClass: 'text-gray-500', fileSuffix: 'Aba DOR' },
] as const;

const NoDataFallback = ({ reportName, message }: { reportName: string, message: string }) => (
    <div className="text-center py-16 border border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
        <Frown className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">{reportName}</h3>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">{message}</p>
    </div>
);

const PTrabReportManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get('ptrabId');
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportType>('logistico');
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);

  // Estados de dados
  const [registrosClasseI, setRegistrosClasseI] = useState<ClasseIRegistro[]>([]);
  const [registrosClasseII, setRegistrosClasseII] = useState<ClasseIIRegistro[]>([]);
  const [registrosClasseIII, setRegistrosClasseIII] = useState<ClasseIIIRegistro[]>([]);
  const [registrosDiaria, setRegistrosDiaria] = useState<DiariaRegistro[]>([]);
  const [registrosVerbaOperacional, setRegistrosVerbaOperacional] = useState<VerbaOperacionalRegistro[]>([]);
  const [registrosPassagem, setRegistrosPassagem] = useState<PassagemRegistro[]>([]);
  const [registrosConcessionaria, setRegistrosConcessionaria] = useState<ConcessionariaRegistro[]>([]);
  const [registrosMaterialConsumo, setRegistrosMaterialConsumo] = useState<MaterialConsumoRegistro[]>([]);
  const [registrosComplementoAlimentacao, setRegistrosComplementoAlimentacao] = useState<ComplementoAlimentacaoRegistro[]>([]);
  const [registrosServicosTerceiros, setRegistrosServicosTerceiros] = useState<ServicoTerceiroRegistro[]>([]);
  const [registrosHorasVoo, setRegistrosHorasVoo] = useState<HorasVooRegistro[]>([]);
  const [diretrizesOperacionais, setDiretrizesOperacionais] = useState<any>(null);
  const [diretrizesPassagens, setDiretrizesPassagens] = useState<any[]>([]);
  
  const { user } = { user: { id: 'ghost-user' } };

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
    
    if (isGhostMode()) {
        setPtrabData(GHOST_DATA.p_trab_exemplo);
        // Mock data for Ghost Mode to show report
        setRegistrosMaterialConsumo([{
          id: 'ghost-mc-1',
          p_trab_id: ptrabId || 'ghost',
          organizacao: '1º BIS',
          ug: '160222',
          dias_operacao: 15,
          efetivo: 150,
          group_name: 'Material de Construção',
          valor_total: 1250.50,
          valor_nd_30: 1250.50,
          valor_nd_39: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          itens_aquisicao: [] as any
        } as any]);
    } else {
        // Fetch real data logic would go here
    }
    setLoading(false);
  }, [ptrabId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const hasDataForReport = useMemo(() => {
    if (isGhostMode()) return true;
    switch (selectedReport) {
      case 'logistico': return registrosClasseI.length > 0 || registrosClasseII.length > 0 || registrosClasseIII.length > 0;
      case 'operacional': return registrosDiaria.length > 0 || registrosMaterialConsumo.length > 0 || registrosServicosTerceiros.length > 0;
      case 'hora_voo': return registrosHorasVoo.length > 0;
      default: return false;
    }
  }, [selectedReport, registrosClasseI, registrosClasseII, registrosClasseIII, registrosDiaria, registrosMaterialConsumo, registrosServicosTerceiros, registrosHorasVoo]);

  const renderReport = () => {
    if (!ptrabData) return null;
    const currentOption = REPORT_OPTIONS.find(o => o.value === selectedReport)!;

    if (!hasDataForReport) {
        return <NoDataFallback reportName={currentOption.label} message="Não há dados registrados para este relatório." />;
    }

    switch (selectedReport) {
      case 'logistico':
        return (
          <PTrabLogisticoReport
            ptrabData={ptrabData}
            registrosClasseI={registrosClasseI}
            registrosClasseII={registrosClasseII}
            registrosClasseIII={registrosClasseIII}
            nomeRM={ptrabData.rm_vinculacao || ""}
            omsOrdenadas={[ptrabData.nome_om]}
            gruposPorOM={{}}
            calcularTotaisPorOM={() => ({})}
            fileSuffix={currentOption.fileSuffix}
            generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada as any}
            generateClasseIIMemoriaCalculo={generateClasseIIMemoriaCalculo as any}
            generateClasseVMemoriaCalculo={(r: any) => generateClasseIIMemoriaCalculo(r, false)}
            generateClasseVIMemoriaCalculo={(r: any) => generateClasseIIMemoriaCalculo(r, false)}
            generateClasseVIIMemoriaCalculo={(r: any) => generateClasseIIMemoriaCalculo(r, false)}
            generateClasseVIIIMemoriaCalculo={(r: any) => generateClasseIIMemoriaCalculo(r, false)}
          />
        );
      case 'racao_operacional':
        return <PTrabRacaoOperacionalReport ptrabData={ptrabData} registrosClasseI={registrosClasseI} fileSuffix={currentOption.fileSuffix} generateClasseIMemoriaCalculo={generateClasseIMemoriaCalculoUnificada as any} />;
      case 'operacional':
        return (
            <PTrabOperacionalReport
                ptrab={ptrabData}
                diarias={registrosDiaria}
                passagens={registrosPassagem}
                verbaOperacional={registrosVerbaOperacional}
                concessionarias={registrosConcessionaria}
                horasVoo={registrosHorasVoo}
                materialConsumo={registrosMaterialConsumo}
                complementoAlimentacao={registrosComplementoAlimentacao}
                servicosTerceiros={registrosServicosTerceiros}
                materialPermanente={[]}
            />
        );
      case 'hora_voo':
        return <PTrabHorasVooReport ptrabData={ptrabData} omsOrdenadas={[ptrabData.nome_om]} gruposPorOM={{}} fileSuffix={currentOption.fileSuffix} />;
      default:
        return <div className="text-center py-12 text-muted-foreground">Relatório não implementado.</div>;
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <PageMetadata title="Relatórios P Trab" description="Gerenciador de Relatórios do P Trab" canonicalPath="/ptrab/relatorios" />
      
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border/50 shadow-sm">
        <div className="container max-w-7xl mx-auto py-4 px-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/ptrab')}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Relatório:</span>
            </div>
            <Select value={selectedReport} onValueChange={(value) => setSelectedReport(value as ReportType)}>
              <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className={`h-4 w-4 ${option.iconClass}`} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto py-4 px-4">
        {renderReport()}
      </div>
    </div>
  );
};

export default PTrabReportManager;