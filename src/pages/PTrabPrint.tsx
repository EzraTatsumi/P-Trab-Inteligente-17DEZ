import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Printer, FileText, Download, Loader2, Check, XCircle } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as ExcelJS from 'exceljs';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from 'use-debounce';
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PTrab {
  id: string;
  numero_ptrab: string;
  nome_operacao: string;
  comando_militar_area: string;
  nome_om: string;
  nome_om_extenso?: string;
  codug_om?: string;
  rm_vinculacao?: string;
  codug_rm_vinculacao?: string;
  periodo_inicio: string;
  periodo_fim: string;
  efetivo_empregado: string;
  acoes: string;
  status: string;
  nome_cmt_om?: string;
  local_om?: string;
  totalLogistica?: number;
  totalOperacional?: number;
  updated_at: string;
  comentario?: string;
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
  complemento_qr: number;
  etapa_qr: number;
  total_qr: number;
  total_geral: number;
  memoria_calculo_qs_customizada?: string;
  memoria_calculo_qr_customizada?: string;
  fase_atividade?: string;
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
  detalhamento_customizado?: string;
  itens_equipamentos?: any;
  fase_atividade?: string;
}

interface RefLPC {
  id: string;
  ambito: string;
  nome_local?: string;
  data_inicio_consulta: string;
  data_fim_consulta: string;
  preco_diesel: number;
  preco_gasolina: number;
}

interface VisualizacaoConfig {
  id: string;
  mostrar_memoria_calculo_classe_i: boolean;
  mostrar_memoria_calculo_classe_iii: boolean;
  mostrar_comentarios: boolean;
  mostrar_totais_por_classe: boolean;
  mostrar_totais_gerais: boolean;
  mostrar_detalhes_ptrab: boolean;
  mostrar_tabela_classe_i: boolean;
  mostrar_tabela_classe_iii: boolean;
  mostrar_ref_lpc: boolean;
  mostrar_fase_atividade: boolean;
  mostrar_om_extenso_cabecalho: boolean;
  mostrar_codug_om_cabecalho: boolean;
  mostrar_rm_vinculacao_cabecalho: boolean;
  mostrar_codug_rm_vinculacao_cabecalho: boolean;
  mostrar_nome_cmt_om_cabecalho: boolean;
  mostrar_local_om_cabecalho: boolean;
  mostrar_acoes_ptrab: boolean;
  mostrar_comentario_ptrab: boolean;
}

const FASES_PADRAO = ["Reconhecimento", "Mobilização", "Execução", "Reversão"];

export default function PTrabPrint() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ptrabId = searchParams.get("ptrabId");
  const [ptrab, setPTrab] = useState<PTrab | null>(null);
  const [classeIRegistros, setClasseIRegistros] = useState<ClasseIRegistro[]>([]);
  const [classeIIIRegistros, setClasseIIIRegistros] = useState<ClasseIIIRegistro[]>([]);
  const [refLPC, setRefLPC] = useState<RefLPC | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<VisualizacaoConfig>({
    id: '',
    mostrar_memoria_calculo_classe_i: true,
    mostrar_memoria_calculo_classe_iii: true,
    mostrar_comentarios: true,
    mostrar_totais_por_classe: true,
    mostrar_totais_gerais: true,
    mostrar_detalhes_ptrab: true,
    mostrar_tabela_classe_i: true,
    mostrar_tabela_classe_iii: true,
    mostrar_ref_lpc: true,
    mostrar_fase_atividade: true,
    mostrar_om_extenso_cabecalho: true,
    mostrar_codug_om_cabecalho: true,
    mostrar_rm_vinculacao_cabecalho: true,
    mostrar_codug_rm_vinculacao_cabecalho: true,
    mostrar_nome_cmt_om_cabecalho: true,
    mostrar_local_om_cabecalho: true,
    mostrar_acoes_ptrab: true,
    mostrar_comentario_ptrab: true,
  });

  const [debouncedConfig] = useDebounce(config, 500);

  useEffect(() => {
    if (ptrabId) {
      fetchPTrabData();
      fetchVisualizacaoConfig();
    } else {
      toast.error("ID do PTrab não encontrado.");
      navigate("/ptrab");
    }
  }, [ptrabId, navigate]);

  useEffect(() => {
    if (config.id) {
      saveVisualizacaoConfig(debouncedConfig);
    }
  }, [debouncedConfig]);

  const fetchVisualizacaoConfig = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('visualizacao_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error("Erro ao carregar configuração de visualização:", error);
      toast.error("Erro ao carregar configurações de visualização.");
    } else if (data) {
      setConfig(data);
    } else {
      // Create default config if none exists
      const { data: newConfig, error: insertError } = await supabase
        .from('visualizacao_config')
        .insert([{ user_id: user.id }])
        .select()
        .single();
      if (insertError) {
        console.error("Erro ao criar configuração de visualização padrão:", insertError);
        toast.error("Erro ao criar configurações padrão.");
      } else if (newConfig) {
        setConfig(newConfig);
      }
    }
  };

  const saveVisualizacaoConfig = useCallback(async (currentConfig: VisualizacaoConfig) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentConfig.id) return;

    const { error } = await supabase
      .from('visualizacao_config')
      .update(currentConfig)
      .eq('id', currentConfig.id);

    if (error) {
      console.error("Erro ao salvar configuração de visualização:", error);
      toast.error("Erro ao salvar configurações de visualização.");
    }
  }, []);

  const fetchPTrabData = async () => {
    setLoading(true);
    try {
      const { data: ptrabData, error: ptrabError } = await supabase
        .from("p_trab")
        .select("*")
        .eq("id", ptrabId!)
        .single();

      if (ptrabError) throw ptrabError;
      setPTrab(ptrabData as PTrab);

      const { data: classeIData, error: classeIError } = await supabase
        .from("classe_i_registros")
        .select("*")
        .eq("p_trab_id", ptrabId!)
        .order("created_at", { ascending: true });

      if (classeIError) console.error("Erro ao carregar Classe I:", classeIError);
      setClasseIRegistros((classeIData || []) as ClasseIRegistro[]);

      const { data: classeIIIData, error: classeIIIError } = await supabase
        .from("classe_iii_registros")
        .select("*")
        .eq("p_trab_id", ptrabId!)
        .order("created_at", { ascending: true });

      if (classeIIIError) console.error("Erro ao carregar Classe III:", classeIIIError);
      setClasseIIIRegistros((classeIIIData || []) as ClasseIIIRegistro[]);

      const { data: refLPCData, error: refLPCError } = await supabase
        .from("p_trab_ref_lpc")
        .select("*")
        .eq("p_trab_id", ptrabId!)
        .maybeSingle();

      if (refLPCError) console.error("Erro ao carregar Ref LPC:", refLPCError);
      setRefLPC((refLPCData || null) as RefLPC | null);

    } catch (error: any) {
      toast.error("Erro ao carregar dados do PTrab.");
      console.error(error);
      navigate("/ptrab");
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (inicio: string, fim: string) => {
    const start = new Date(inicio);
    const end = new Date(fim);
    const diff = end.getTime() - start.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24)) + 1;
  };

  const formatFasesParaTexto = (faseCSV: string | undefined): string => {
    if (!faseCSV) return 'operação';
    
    const fases = faseCSV.split(';').map(f => f.trim()).filter(f => f);
    
    if (fases.length === 0) return 'operação';
    
    const fasesOrdenadas = fases.sort((a, b) => {
      const indexA = FASES_PADRAO.indexOf(a);
      const indexB = FASES_PADRAO.indexOf(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    if (fasesOrdenadas.length === 1) return fasesOrdenadas[0];
    if (fasesOrdenadas.length === 2) return `${fasesOrdenadas[0]} e ${fasesOrdenadas[1]}`;
    
    const ultimaFase = fasesOrdenadas[fasesOrdenadas.length - 1];
    const demaisFases = fasesOrdenadas.slice(0, -1).join(', ');
    return `${demaisFases} e ${ultimaFase}`;
  };

  const handleExportPDF = async () => {
    setExporting(true);
    if (contentRef.current) {
      const input = contentRef.current;
      const originalPadding = input.style.padding;
      input.style.padding = '20px'; // Adiciona um padding para melhor visualização no PDF

      try {
        const canvas = await html2canvas(input, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }

        pdf.save(`PTrab_${ptrab?.numero_ptrab.replace(/\//g, '-')}.pdf`);
        toast.success("PDF exportado com sucesso!");
      } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        toast.error("Erro ao exportar PDF.");
      } finally {
        input.style.padding = originalPadding; // Restaura o padding original
        setExporting(false);
      }
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PTrab Detalhes');

      // PTrab Details
      worksheet.addRow(['PTrab Detalhes']);
      worksheet.addRow(['Número do PTrab:', ptrab?.numero_ptrab]);
      worksheet.addRow(['Nome da Operação:', ptrab?.nome_operacao]);
      worksheet.addRow(['Comando Militar de Área:', ptrab?.comando_militar_area]);
      worksheet.addRow(['OM:', `${ptrab?.nome_om} (${ptrab?.codug_om})`]);
      worksheet.addRow(['Período:', `${new Date(ptrab!.periodo_inicio).toLocaleDateString('pt-BR')} a ${new Date(ptrab!.periodo_fim).toLocaleDateString('pt-BR')}`]);
      worksheet.addRow(['Efetivo Empregado:', ptrab?.efetivo_empregado]);
      worksheet.addRow(['Ações:', ptrab?.acoes]);
      worksheet.addRow(['Status:', ptrab?.status]);
      worksheet.addRow(['Comentário:', ptrab?.comentario]);
      worksheet.addRow([]);

      // Totals
      worksheet.addRow(['Totais do PTrab']);
      worksheet.addRow(['Total Logística:', ptrab?.totalLogistica]);
      worksheet.addRow(['Total Operacional:', ptrab?.totalOperacional]);
      worksheet.addRow(['Total Geral:', (ptrab?.totalLogistica || 0) + (ptrab?.totalOperacional || 0)]);
      worksheet.addRow([]);

      // Classe I Registros
      if (classeIRegistros.length > 0) {
        worksheet.addRow(['Registros de Classe I']);
        worksheet.addRow([
          'Organização', 'UG', 'OM QS', 'UG QS', 'Efetivo', 'Dias Operação', 'Nr Ref Int',
          'Valor QS', 'Complemento QS', 'Etapa QS', 'Total QS',
          'Valor QR', 'Complemento QR', 'Etapa QR', 'Total QR', 'Total Geral', 'Fase Atividade',
          'Memória Cálculo QS', 'Memória Cálculo QR'
        ]);
        classeIRegistros.forEach(reg => {
          worksheet.addRow([
            reg.organizacao, reg.ug, reg.om_qs, reg.ug_qs, reg.efetivo, reg.dias_operacao, reg.nr_ref_int,
            reg.valor_qs, reg.complemento_qs, reg.etapa_qs, reg.total_qs,
            reg.valor_qr, reg.complemento_qr, reg.etapa_qr, reg.total_qr, reg.total_geral,
            formatFasesParaTexto(reg.fase_atividade),
            reg.memoria_calculo_qs_customizada || 'Automático',
            reg.memoria_calculo_qr_customizada || 'Automático'
          ]);
        });
        worksheet.addRow([]);
      }

      // Classe III Registros
      if (classeIIIRegistros.length > 0) {
        worksheet.addRow(['Registros de Classe III']);
        worksheet.addRow([
          'Tipo Equipamento', 'Detalhe', 'Organização', 'UG', 'Quantidade', 'Horas/dia', 'Km/dia',
          'Dias Operação', 'Consumo Hora', 'Consumo Km/L', 'Tipo Combustível', 'Preço Litro',
          'Total Litros', 'Valor Total', 'Fase Atividade', 'Detalhamento'
        ]);
        classeIIIRegistros.forEach(reg => {
          worksheet.addRow([
            reg.tipo_equipamento, reg.tipo_equipamento_detalhe, reg.organizacao, reg.ug, reg.quantidade,
            reg.horas_dia, reg.km_dia, reg.dias_operacao, reg.consumo_hora, reg.consumo_km_litro,
            reg.tipo_combustivel, reg.preco_litro, reg.total_litros, reg.valor_total,
            formatFasesParaTexto(reg.fase_atividade),
            reg.detalhamento_customizado || reg.detalhamento
          ]);
        });
        worksheet.addRow([]);
      }

      // Ref LPC
      if (refLPC) {
        worksheet.addRow(['Referência LPC']);
        worksheet.addRow(['Âmbito:', refLPC.ambito]);
        worksheet.addRow(['Local:', refLPC.nome_local]);
        worksheet.addRow(['Data Início Consulta:', new Date(refLPC.data_inicio_consulta).toLocaleDateString('pt-BR')]);
        worksheet.addRow(['Data Fim Consulta:', new Date(refLPC.data_fim_consulta).toLocaleDateString('pt-BR')]);
        worksheet.addRow(['Preço Diesel:', refLPC.preco_diesel]);
        worksheet.addRow(['Preço Gasolina:', refLPC.preco_gasolina]);
        worksheet.addRow([]);
      }

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PTrab_${ptrab?.numero_ptrab.replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Excel exportado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar Excel:", error);
      toast.error("Erro ao exportar Excel.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Carregando PTrab para visualização...</p>
      </div>
    );
  }

  if (!ptrab) {
    return null;
  }

  const totalGeral = (ptrab.totalLogistica || 0) + (ptrab.totalOperacional || 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para PTrab
          </Button>
          <h1 className="text-3xl font-bold text-center flex-grow">Visualização para Impressão</h1>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              {exporting ? "Gerando PDF..." : "Exportar PDF"}
            </Button>
            <Button onClick={handleExportExcel} disabled={exporting} variant="secondary">
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? "Gerando Excel..." : "Exportar Excel"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna de Configurações */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Opções de Visualização</CardTitle>
              <CardDescription>Personalize o que será exibido na impressão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Detalhes do PTrab</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mostrar_detalhes_ptrab"
                    checked={config.mostrar_detalhes_ptrab}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_detalhes_ptrab: checked as boolean }))}
                  />
                  <Label htmlFor="mostrar_detalhes_ptrab">Mostrar Detalhes do PTrab</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_om_extenso_cabecalho"
                    checked={config.mostrar_om_extenso_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_om_extenso_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_om_extenso_cabecalho">Nome OM (Extenso)</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_codug_om_cabecalho"
                    checked={config.mostrar_codug_om_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_codug_om_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_codug_om_cabecalho">CODUG OM</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_rm_vinculacao_cabecalho"
                    checked={config.mostrar_rm_vinculacao_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_rm_vinculacao_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_rm_vinculacao_cabecalho">RM Vinculação</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_codug_rm_vinculacao_cabecalho"
                    checked={config.mostrar_codug_rm_vinculacao_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_codug_rm_vinculacao_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_codug_rm_vinculacao_cabecalho">CODUG RM Vinculação</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_nome_cmt_om_cabecalho"
                    checked={config.mostrar_nome_cmt_om_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_nome_cmt_om_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_nome_cmt_om_cabecalho">Nome Cmt OM</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_local_om_cabecalho"
                    checked={config.mostrar_local_om_cabecalho}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_local_om_cabecalho: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_local_om_cabecalho">Local OM</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_acoes_ptrab"
                    checked={config.mostrar_acoes_ptrab}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_acoes_ptrab: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_acoes_ptrab">Ações do PTrab</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_comentario_ptrab"
                    checked={config.mostrar_comentario_ptrab}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_comentario_ptrab: checked as boolean }))}
                    disabled={!config.mostrar_detalhes_ptrab}
                  />
                  <Label htmlFor="mostrar_comentario_ptrab">Comentário do PTrab</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Classe I</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mostrar_tabela_classe_i"
                    checked={config.mostrar_tabela_classe_i}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_tabela_classe_i: checked as boolean }))}
                  />
                  <Label htmlFor="mostrar_tabela_classe_i">Mostrar Tabela Classe I</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_memoria_calculo_classe_i"
                    checked={config.mostrar_memoria_calculo_classe_i}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_memoria_calculo_classe_i: checked as boolean }))}
                    disabled={!config.mostrar_tabela_classe_i}
                  />
                  <Label htmlFor="mostrar_memoria_calculo_classe_i">Mostrar Memória de Cálculo</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Classe III</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mostrar_tabela_classe_iii"
                    checked={config.mostrar_tabela_classe_iii}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_tabela_classe_iii: checked as boolean }))}
                  />
                  <Label htmlFor="mostrar_tabela_classe_iii">Mostrar Tabela Classe III</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_memoria_calculo_classe_iii"
                    checked={config.mostrar_memoria_calculo_classe_iii}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_memoria_calculo_classe_iii: checked as boolean }))}
                    disabled={!config.mostrar_tabela_classe_iii}
                  />
                  <Label htmlFor="mostrar_memoria_calculo_classe_iii">Mostrar Memória de Cálculo</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_ref_lpc"
                    checked={config.mostrar_ref_lpc}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_ref_lpc: checked as boolean }))}
                    disabled={!config.mostrar_tabela_classe_iii}
                  />
                  <Label htmlFor="mostrar_ref_lpc">Mostrar Referência LPC</Label>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <Checkbox
                    id="mostrar_fase_atividade"
                    checked={config.mostrar_fase_atividade}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_fase_atividade: checked as boolean }))}
                    disabled={!config.mostrar_tabela_classe_iii}
                  />
                  <Label htmlFor="mostrar_fase_atividade">Mostrar Fase da Atividade</Label>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Totais</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mostrar_totais_por_classe"
                    checked={config.mostrar_totais_por_classe}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_totais_por_classe: checked as boolean }))}
                  />
                  <Label htmlFor="mostrar_totais_por_classe">Mostrar Totais por Classe</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mostrar_totais_gerais"
                    checked={config.mostrar_totais_gerais}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, mostrar_totais_gerais: checked as boolean }))}
                  />
                  <Label htmlFor="mostrar_totais_gerais">Mostrar Total Geral</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Área de Visualização */}
          <div className="lg:col-span-3 bg-white p-8 shadow-lg rounded-lg min-h-[80vh]">
            <div ref={contentRef} className="print-area text-black text-sm leading-relaxed">
              {/* Cabeçalho do PTrab */}
              {config.mostrar_detalhes_ptrab && (
                <div className="mb-8 text-center">
                  <h2 className="text-xl font-bold mb-2">PLANO DE TRABALHO Nº {ptrab.numero_ptrab}</h2>
                  <p className="text-lg font-semibold">{ptrab.nome_operacao}</p>
                  <p className="mt-4">
                    {config.mostrar_om_extenso_cabecalho && ptrab.nome_om_extenso && (
                      <span className="block">{ptrab.nome_om_extenso}</span>
                    )}
                    <span className="block">
                      {ptrab.nome_om}
                      {config.mostrar_codug_om_cabecalho && ptrab.codug_om && ` (UG: ${ptrab.codug_om})`}
                    </span>
                    {config.mostrar_rm_vinculacao_cabecalho && ptrab.rm_vinculacao && (
                      <span className="block">
                        {ptrab.rm_vinculacao}
                        {config.mostrar_codug_rm_vinculacao_cabecalho && ptrab.codug_rm_vinculacao && ` (CODUG: ${ptrab.codug_rm_vinculacao})`}
                      </span>
                    )}
                    {config.mostrar_nome_cmt_om_cabecalho && ptrab.nome_cmt_om && (
                      <span className="block">Cmt: {ptrab.nome_cmt_om}</span>
                    )}
                    {config.mostrar_local_om_cabecalho && ptrab.local_om && (
                      <span className="block">{ptrab.local_om}</span>
                    )}
                  </p>
                  <p className="mt-4">
                    Período: {new Date(ptrab.periodo_inicio).toLocaleDateString('pt-BR')} a{" "}
                    {new Date(ptrab.periodo_fim).toLocaleDateString('pt-BR')} ({calculateDays(ptrab.periodo_inicio, ptrab.periodo_fim)} dias)
                  </p>
                  <p>Efetivo Empregado: {ptrab.efetivo_empregado}</p>
                  {config.mostrar_acoes_ptrab && ptrab.acoes && (
                    <div className="mt-4 text-left mx-auto max-w-prose">
                      <p className="font-semibold">Ações:</p>
                      <pre className="whitespace-pre-wrap text-sm">{ptrab.acoes}</pre>
                    </div>
                  )}
                  {config.mostrar_comentario_ptrab && ptrab.comentario && (
                    <div className="mt-4 text-left mx-auto max-w-prose">
                      <p className="font-semibold">Comentário:</p>
                      <pre className="whitespace-pre-wrap text-sm">{ptrab.comentario}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Tabela de Classe I */}
              {config.mostrar_tabela_classe_i && classeIRegistros.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4">CLASSE I - ALIMENTAÇÃO</h3>
                  <table className="w-full border-collapse border border-gray-400">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 p-2 text-left">OM</th>
                        <th className="border border-gray-400 p-2 text-left">OM QS</th>
                        <th className="border border-gray-400 p-2 text-right">Efetivo</th>
                        <th className="border border-gray-400 p-2 text-right">Dias</th>
                        <th className="border border-gray-400 p-2 text-right">Ref Int</th>
                        <th className="border border-gray-400 p-2 text-right">Total QS</th>
                        <th className="border border-gray-400 p-2 text-right">Total QR</th>
                        <th className="border border-gray-400 p-2 text-right">Total Geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classeIRegistros.map((reg) => (
                        <tr key={reg.id}>
                          <td className="border border-gray-400 p-2">{reg.organizacao} ({reg.ug})</td>
                          <td className="border border-gray-400 p-2">{reg.om_qs} ({reg.ug_qs})</td>
                          <td className="border border-gray-400 p-2 text-right">{reg.efetivo}</td>
                          <td className="border border-gray-400 p-2 text-right">{reg.dias_operacao}</td>
                          <td className="border border-gray-400 p-2 text-right">{reg.nr_ref_int}</td>
                          <td className="border border-gray-400 p-2 text-right">{formatCurrency(reg.total_qs)}</td>
                          <td className="border border-gray-400 p-2 text-right">{formatCurrency(reg.total_qr)}</td>
                          <td className="border border-gray-400 p-2 text-right font-semibold">{formatCurrency(reg.total_geral)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {config.mostrar_memoria_calculo_classe_i && classeIRegistros.map((reg) => (
                    <div key={`memoria-i-${reg.id}`} className="mt-4 border p-3 rounded-md bg-gray-50">
                      <p className="font-semibold mb-1">Memória de Cálculo Classe I - {reg.organizacao} (QS):</p>
                      <pre className="whitespace-pre-wrap text-xs">{reg.memoria_calculo_qs_customizada || reg.detalhamento_customizado || "N/A"}</pre>
                      <p className="font-semibold mt-2 mb-1">Memória de Cálculo Classe I - {reg.organizacao} (QR):</p>
                      <pre className="whitespace-pre-wrap text-xs">{reg.memoria_calculo_qr_customizada || reg.detalhamento_customizado || "N/A"}</pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Tabela de Classe III */}
              {config.mostrar_tabela_classe_iii && classeIIIRegistros.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4">CLASSE III - COMBUSTÍVEIS</h3>
                  {config.mostrar_ref_lpc && refLPC && (
                    <div className="mb-4 border p-3 rounded-md bg-gray-50 text-xs">
                      <p className="font-semibold">Referência LPC:</p>
                      <p>Período: {new Date(refLPC.data_inicio_consulta).toLocaleDateString('pt-BR')} a {new Date(refLPC.data_fim_consulta).toLocaleDateString('pt-BR')}</p>
                      <p>Âmbito: {refLPC.ambito} {refLPC.nome_local ? `(${refLPC.nome_local})` : ''}</p>
                      <p>Preço Diesel: {formatCurrency(refLPC.preco_diesel)}/L | Preço Gasolina: {formatCurrency(refLPC.preco_gasolina)}/L</p>
                    </div>
                  )}
                  <table className="w-full border-collapse border border-gray-400">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 p-2 text-left">Tipo Equip.</th>
                        <th className="border border-gray-400 p-2 text-left">OM</th>
                        <th className="border border-gray-400 p-2 text-right">Qtd</th>
                        <th className="border border-gray-400 p-2 text-right">Dias</th>
                        <th className="border border-gray-400 p-2 text-left">Combustível</th>
                        <th className="border border-gray-400 p-2 text-right">Litros (c/ 30%)</th>
                        <th className="border border-gray-400 p-2 text-right">Valor Total</th>
                        {config.mostrar_fase_atividade && <th className="border border-gray-400 p-2 text-left">Fase</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {classeIIIRegistros.map((reg) => (
                        <tr key={reg.id}>
                          <td className="border border-gray-400 p-2">{reg.tipo_equipamento_detalhe || reg.tipo_equipamento}</td>
                          <td className="border border-gray-400 p-2">{reg.organizacao} ({reg.ug})</td>
                          <td className="border border-gray-400 p-2 text-right">{reg.quantidade}</td>
                          <td className="border border-gray-400 p-2 text-right">{reg.dias_operacao}</td>
                          <td className="border border-gray-400 p-2 text-left">{reg.tipo_combustivel}</td>
                          <td className="border border-gray-400 p-2 text-right">{formatNumber(reg.total_litros)} L</td>
                          <td className="border border-gray-400 p-2 text-right font-semibold">{formatCurrency(reg.valor_total)}</td>
                          {config.mostrar_fase_atividade && <td className="border border-gray-400 p-2 text-left">{formatFasesParaTexto(reg.fase_atividade)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {config.mostrar_memoria_calculo_classe_iii && classeIIIRegistros.map((reg) => (
                    <div key={`memoria-iii-${reg.id}`} className="mt-4 border p-3 rounded-md bg-gray-50">
                      <p className="font-semibold mb-1">Memória de Cálculo Classe III - {reg.organizacao} ({reg.tipo_equipamento_detalhe || reg.tipo_equipamento}):</p>
                      <pre className="whitespace-pre-wrap text-xs">{reg.detalhamento_customizado || reg.detalhamento || "N/A"}</pre>
                    </div>
                  ))}
                </div>
              )}

              {/* Totais */}
              {(config.mostrar_totais_por_classe || config.mostrar_totais_gerais) && (
                <div className="mt-8 pt-4 border-t border-gray-300">
                  <h3 className="text-lg font-bold mb-4">TOTAIS DO PTrab</h3>
                  {config.mostrar_totais_por_classe && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="font-semibold">Total Logístico (Classe I + Classe III):</p>
                        <p className="text-lg text-orange-600 font-bold">{formatCurrency(ptrab.totalLogistica || 0)}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Total Operacional:</p>
                        <p className="text-lg text-blue-600 font-bold">{formatCurrency(ptrab.totalOperacional || 0)}</p>
                      </div>
                    </div>
                  )}
                  {config.mostrar_totais_gerais && (
                    <div className="mt-4">
                      <p className="font-semibold text-xl">TOTAL GERAL DO PTrab:</p>
                      <p className="text-2xl text-green-600 font-bold">{formatCurrency(totalGeral)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}