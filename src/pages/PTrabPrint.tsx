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
  complemento_qr: number;
  etapa_qr: number;
  total_qr: number;
  total_geral: number;
  memoria_calculo_qs_customizada?: string | null;
  memoria_calculo_qr_customizada?: string | null;
  fase_atividade?: string | null;
}

interface ClasseIIIRegistro {
  id: string;
  tipo_equipamento: string;
  organizacao: string;
  ug: string;
  quantidade: number;
  tipo_combustivel: string;
  preco_litro: number;
  total_litros: number;
  valor_total: number;
  detalhamento?: string;
  detalhamento_customizado?: string | null;
  tipo_equipamento_detalhe?: string;
}

const PTrabPrint = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const ptrabId = searchParams.get('ptrabId');
  const [ptrabData, setPtrabData] = useState<PTrabData | null>(null);
  const [registros, setRegistros] = useState<ClasseIRegistro[]>([]);
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
        .select('*, memoria_calculo_qs_customizada, memoria_calculo_qr_customizada, fase_atividade')
        .eq('p_trab_id', ptrabId);

      if (classeIError) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os registros",
          variant: "destructive",
        });
      }

      const { data: classeIIIData, error: classeIIIError } = await supabase
        .from('classe_iii_registros')
        .select('*, detalhamento_customizado')
        .eq('p_trab_id', ptrabId);

      if (classeIIIError) {
        console.error("Erro ao carregar Classe III:", classeIIIError);
      }

      setPtrabData(ptrab);
      setRegistros(classeIData || []);
      setRegistrosClasseIII(classeIIIData || []);
      setLoading(false);
    };

    loadData();
  }, [ptrabId, navigate, toast]);

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

  const handlePrint = () => {
    window.print();
  };

  const handleExportSuccess = () => {
    if (ptrabData && ptrabData.status !== 'completo' && ptrabData.status !== 'arquivado') {
      setShowCompleteStatusDialog(true);
    } else {
      navigate('/ptrab'); // Redireciona se o status já for completo/arquivado ou se não houver dados
    }
  };

  const handleConfirmCompleteStatus = async () => {
    if (!ptrabData) return;

    try {
      const { error } = await supabase
        .from("p_trab")
        .update({ status: "completo" })
        .eq("id", ptrabData.id);

      if (error) throw error;

      toast({
        title: "Status atualizado!",
        description: `O status do P Trab ${ptrabData.numero_ptrab} foi alterado para "Completo".`,
        duration: 3000,
      });
      navigate('/ptrab');
    } catch (error) {
      console.error("Erro ao atualizar status para completo:", error);
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
        duration: 5000,
      });
    }
  }, [ptrabData, toast, handleExportSuccess]);

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('P Trab');
      
      worksheet.columns = [
        { width: 35 }, // A - DESPESAS
        { width: 20 }, // B - OM (UGE) CODUG
        { width: 15 }, // C - 33.90.30
        { width: 15 }, // D - 33.90.39
        { width: 15 }, // E - GND 3
        { width: 15 }, // F - LITROS
        { width: 15 }, // G - PREÇO UNITÁRIO
        { width: 18 }, // H - PREÇO TOTAL
        { width: 70 }, // I - DETALHAMENTO
      ];
      
      let currentRow = 1;
      
      const addHeaderRow = (text: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = text;
        row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addHeaderRow('MINISTÉRIO DA DEFESA');
      addHeaderRow('EXÉRCITO BRASILEIRO');
      addHeaderRow(ptrabData.comando_militar_area.toUpperCase());
      addHeaderRow((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
      currentRow++;
      
      const titleRow = worksheet.getRow(currentRow);
      titleRow.getCell(1).value = `PLANO DE TRABALHO LOGÍSTICO - OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`;
      titleRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, underline: true };
      titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
      currentRow++;
      
      currentRow++;
      
      const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
      
      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(1).font = { name: 'Arial', size: 11, bold: true };
        row.getCell(2).value = value;
        row.getCell(2).font = { name: 'Arial', size: 11 };
        worksheet.mergeCells(`B${currentRow}:I${currentRow}`);
        currentRow++;
      };
      
      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      
      const despesasRow = worksheet.getRow(currentRow);
      despesasRow.getCell(1).value = '5. DESPESAS OPERACIONAIS:';
      despesasRow.getCell(1).font = { name: 'Arial', size: 11, bold: true };
      currentRow++;
      currentRow++;
      
      const headerRow1 = currentRow;
      const headerRow2 = currentRow + 1;
      
      const hdr1 = worksheet.getRow(headerRow1);
      hdr1.getCell('A').value = 'DESPESAS';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO';
      
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
        font: { name: 'Arial', size: 9, bold: true },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true },
        border: {
          top: { style: 'thin' as const },
          left: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          right: { style: 'thin' as const }
        }
      };
      
      ['A', 'B', 'C', 'F', 'I'].forEach(col => {
        hdr1.getCell(col).style = headerStyle;
      });
      
      ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        hdr2.getCell(col).style = headerStyle;
      });
      
      hdr1.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      hdr1.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
      hdr2.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      hdr2.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      hdr2.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      hdr2.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
      hdr2.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
      hdr2.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
      
      currentRow = headerRow2 + 1;

      // Reusable alignment styles
      const centerTopAlignment = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
      const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
      
      interface LinhaTabela {
        registro: ClasseIRegistro;
        tipo: 'QS' | 'QR';
      }
      
      interface GrupoOM {
        linhasQS: LinhaTabela[];
        linhasQR: LinhaTabela[];
      }
      
      const gruposPorOM: Record<string, GrupoOM> = {};
      
      registros.forEach((registro) => {
        const omFornecedora = registro.om_qs;
        if (!gruposPorOM[omFornecedora]) {
          gruposPorOM[omFornecedora] = { linhasQS: [], linhasQR: [] };
        }
        gruposPorOM[omFornecedora].linhasQS.push({ registro, tipo: 'QS' });
        
        const omDestino = registro.organizacao;
        if (!gruposPorOM[omDestino]) {
          gruposPorOM[omDestino] = { linhasQS: [], linhasQR: [] };
        }
        gruposPorOM[omDestino].linhasQR.push({ registro, tipo: 'QR' });
      });
      
      const omsOrdenadas = Object.keys(gruposPorOM).sort((a, b) => {
        const aTemRM = a.includes('RM') || a.includes('R M');
        const bTemRM = b.includes('RM') || b.includes('R M');
        if (aTemRM && !bTemRM) return -1;
        if (!aTemRM && bTemRM) return 1;
        return a.localeCompare(b);
      });
      
      const nomeRM = omsOrdenadas.find(om => om.includes('RM') || om.includes('R M')) || ptrabData.nome_om;
      
      const calcularTotaisPorOM = (grupo: GrupoOM, nomeOM: string) => {
        const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.total_qs, 0);
        const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.total_qr, 0);
        
        const classeIIIDestaOM = (nomeOM === nomeRM) ? registrosClasseIII : [];
        
        const totalDiesel = classeIIIDestaOM
          .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
          .reduce((acc, reg) => acc + reg.total_litros, 0);
        const totalGasolina = classeIIIDestaOM
          .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
          .reduce((acc, reg) => acc + reg.total_litros, 0);
        const valorDiesel = classeIIIDestaOM
          .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
          .reduce((acc, reg) => acc + reg.valor_total, 0);
        const valorGasolina = classeIIIDestaOM
          .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
          .reduce((acc, reg) => acc + reg.valor_total, 0);
        
        const totalCombustivelValor = valorDiesel + valorGasolina; // Valor total da Classe III (H)
        const totalParteAzul = totalQS + totalQR; // Total Classe I (C)
        
        // REGRA DO USUÁRIO: Classe III não entra nas colunas azuis (ND 39 = 0).
        // O total GND 3 é a soma da Classe I (ND 30) + Classe III (Valor Total Combustível).
        const totalGeral = totalParteAzul + totalCombustivelValor; 
        
        return {
          total_33_90_30: totalParteAzul, // Total Classe I
          total_33_90_39: 0, // Classe III não é lançada aqui, conforme instrução do usuário
          total_parte_azul: totalParteAzul,
          total_combustivel: totalCombustivelValor,
          total_gnd3: totalGeral,
          totalDiesel,
          totalGasolina,
          valorDiesel,
          valorGasolina,
        };
      };
      
      const cellBorder = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        bottom: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };
      
      omsOrdenadas.forEach((nomeOM) => {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        
        if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.length === 0)) return;
        
        grupo.linhasQS.forEach((linha) => {
          const row = worksheet.getRow(currentRow);
          row.getCell('A').value = `CLASSE I - SUBSISTÊNCIA\n${linha.registro.organizacao}`;
          row.getCell('B').value = `${linha.registro.om_qs}\n(${linha.registro.ug_qs})`;
          row.getCell('C').value = linha.registro.total_qs;
          row.getCell('C').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
          row.getCell('C').style = { ...row.getCell('C').style, alignment: centerTopAlignment }; // Aplicar alinhamento explícito
          row.getCell('E').value = linha.registro.total_qs;
          row.getCell('E').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
          row.getCell('E').style = { ...row.getCell('E').style, alignment: centerTopAlignment }; // Aplicar alinhamento explícito
          
          const detalhamentoQS = linha.registro.memoria_calculo_qs_customizada || 
                                 generateClasseIMemoriaCalculo(linha.registro).qs;
          
          row.getCell('I').value = detalhamentoQS;
          row.getCell('I').alignment = { wrapText: true, vertical: 'top' };
          row.getCell('I').font = { name: 'Arial', size: 6.5 };
          
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
            if (!row.getCell(col).font) {
              row.getCell(col).font = { name: 'Arial', size: 8 };
            }
            row.getCell(col).alignment = { ...row.getCell(col).alignment, vertical: 'top' };
          });
          
          currentRow++;
        });
        
        grupo.linhasQR.forEach((linha) => {
          const row = worksheet.getRow(currentRow);
          row.getCell('A').value = `CLASSE I - SUBSISTÊNCIA`;
          row.getCell('B').value = `${linha.registro.organizacao}\n(${linha.registro.ug})`;
          row.getCell('C').value = linha.registro.total_qr;
          row.getCell('C').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
          row.getCell('C').style = { ...row.getCell('C').style, alignment: centerTopAlignment }; // Aplicar alinhamento explícito
          row.getCell('E').value = linha.registro.total_qr;
          row.getCell('E').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
          row.getCell('E').style = { ...row.getCell('E').style, alignment: centerTopAlignment }; // Aplicar alinhamento explícito
          
          const detalhamentoQR = linha.registro.memoria_calculo_qr_customizada || 
                                 generateClasseIMemoriaCalculo(linha.registro).qr;
          
          row.getCell('I').value = detalhamentoQR;
          row.getCell('I').alignment = { wrapText: true, vertical: 'top' };
          row.getCell('I').font = { name: 'Arial', size: 6.5 };
          
          ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            row.getCell(col).border = cellBorder;
            if (!row.getCell(col).font) {
              row.getCell(col).font = { name: 'Arial', size: 8 };
            }
            row.getCell(col).alignment = { ...row.getCell(col).alignment, vertical: 'top' };
          });
          
          currentRow++;
        });
        
        if (nomeOM === nomeRM) {
          registrosClasseIII.forEach((registro) => {
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
            row.getCell('A').value = `CLASSE III - ${getTipoCombustivelLabel(registro.tipo_combustivel)}\n${getTipoEquipamentoLabel(registro.tipo_equipamento)}\n${registro.organizacao}`;
            row.getCell('B').value = `${nomeRM}\n(${gruposPorOM[nomeRM]?.linhasQS[0]?.registro.ug_qs || 'UG'})`;
            
            // REGRA DO USUÁRIO: Colunas azuis (C, D, E) devem ser vazias/zero para Classe III
            row.getCell('C').value = ''; // 33.90.30
            row.getCell('D').value = ''; // 33.90.39
            row.getCell('E').value = ''; // TOTAL ND
            
            // Colunas Laranjas (F, G, H) permanecem preenchidas
            row.getCell('F').value = Math.round(registro.total_litros);
            row.getCell('F').numFmt = '#,##0 "L"';
            row.getCell('F').style = { ...row.getCell('F').style, alignment: centerTopAlignment };
            row.getCell('G').value = registro.preco_litro;
            row.getCell('G').numFmt = 'R$ #,##0.00';
            row.getCell('G').style = { ...row.getCell('G').style, alignment: centerTopAlignment };
            row.getCell('H').value = registro.valor_total;
            row.getCell('H').numFmt = 'R$ #,##0.00';
            row.getCell('H').style = { ...row.getCell('H').style, alignment: centerTopAlignment };
            
            const detalhamentoCombustivel = registro.detalhamento_customizado || registro.detalhamento || '';
            
            row.getCell('I').value = detalhamentoCombustivel;
            row.getCell('I').alignment = { wrapText: true, vertical: 'top' };
            row.getCell('I').font = { name: 'Arial', size: 6.5 };
            
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
              row.getCell(col).border = cellBorder;
              if (!row.getCell(col).font) {
                row.getCell(col).font = { name: 'Arial', size: 8 };
              }
              row.getCell(col).alignment = { ...row.getCell(col).alignment, vertical: 'top' };
            });
            
            currentRow++;
          });
        }
        
        const subtotalRow = worksheet.getRow(currentRow);
        subtotalRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
        worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
        subtotalRow.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
        subtotalRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        subtotalRow.getCell('C').value = totaisOM.total_33_90_30; // Total Classe I
        subtotalRow.getCell('C').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
        subtotalRow.getCell('C').font = { bold: true };
        subtotalRow.getCell('C').style = { ...subtotalRow.getCell('C').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        
        subtotalRow.getCell('D').value = totaisOM.total_33_90_39; // Zero
        subtotalRow.getCell('D').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
        subtotalRow.getCell('D').font = { bold: true };
        subtotalRow.getCell('D').style = { ...subtotalRow.getCell('D').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito

        subtotalRow.getCell('E').value = totaisOM.total_parte_azul; // Total ND (C+D) -> Apenas C
        subtotalRow.getCell('E').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
        subtotalRow.getCell('E').font = { bold: true };
        subtotalRow.getCell('E').style = { ...subtotalRow.getCell('E').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        
        if (nomeOM === nomeRM && totaisOM.totalDiesel > 0) {
          subtotalRow.getCell('F').value = `${formatNumber(totaisOM.totalDiesel)} L OD`;
          subtotalRow.getCell('F').font = { bold: true };
          subtotalRow.getCell('F').style = { ...subtotalRow.getCell('F').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        }
        if (nomeOM === nomeRM && totaisOM.totalGasolina > 0) {
          subtotalRow.getCell('G').value = `${formatNumber(totaisOM.totalGasolina)} L GAS`;
          subtotalRow.getCell('G').font = { bold: true };
          subtotalRow.getCell('G').style = { ...subtotalRow.getCell('G').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        }
        if (nomeOM === nomeRM && totaisOM.total_combustivel > 0) {
          subtotalRow.getCell('H').value = totaisOM.total_combustivel;
          subtotalRow.getCell('H').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
          subtotalRow.getCell('H').font = { bold: true };
          subtotalRow.getCell('H').style = { ...subtotalRow.getCell('H').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        }
        
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            subtotalRow.getCell(col).border = cellBorder;
        });
        
        currentRow++;
        
        const totalOMRow = worksheet.getRow(currentRow);
        totalOMRow.getCell('A').value = `VALOR TOTAL DO ${nomeOM}`;
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        totalOMRow.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
        totalOMRow.getCell('A').font = { name: 'Arial', size: 8, bold: true };
        
        totalOMRow.getCell('E').value = totaisOM.total_gnd3;
        totalOMRow.getCell('E').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
        totalOMRow.getCell('E').font = { bold: true };
        totalOMRow.getCell('E').style = { ...totalOMRow.getCell('E').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
        
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
            totalOMRow.getCell(col).border = cellBorder;
        });
        
        currentRow++;
      });
      
      currentRow++;
      
      const totalGeral_33_90_30 = registros.reduce((acc, reg) => acc + reg.total_qs + reg.total_qr, 0);
      const totalValorCombustivel = registrosClasseIII.reduce((acc, reg) => acc + reg.valor_total, 0);
      
      // REGRA DO USUÁRIO: 33.90.39 é zero, e o total geral é a soma de 33.90.30 + Valor Total Combustível
      const totalGeral_33_90_39 = 0; 
      const totalGeralAcumulado = totalGeral_33_90_30 + totalValorCombustivel; 
      
      const totalDiesel = registrosClasseIII
        .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const totalGasolina = registrosClasseIII
        .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
        .reduce((acc, reg) => acc + reg.total_litros, 0);
      const valorDiesel = registrosClasseIII
        .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
        .reduce((acc, reg) => acc + reg.valor_total, 0);
      const valorGasolina = registrosClasseIII
        .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
        .reduce((acc, reg) => acc + reg.valor_total, 0);
      const totalValorCombustivelFinal = valorDiesel + valorGasolina;
      
      const somaRow = worksheet.getRow(currentRow);
      somaRow.getCell('A').value = 'SOMA POR ND E GP DE DESPESA';
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      somaRow.getCell('A').alignment = { horizontal: 'right', vertical: 'middle' };
      somaRow.getCell('A').font = { bold: true };
      
      somaRow.getCell('C').value = totalGeral_33_90_30; // Total Classe I
      somaRow.getCell('C').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
      somaRow.getCell('C').font = { bold: true };
      somaRow.getCell('C').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      somaRow.getCell('C').style = { ...somaRow.getCell('C').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      
      somaRow.getCell('D').value = totalGeral_33_90_39; // Zero
      somaRow.getCell('D').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
      somaRow.getCell('D').font = { bold: true };
      somaRow.getCell('D').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      somaRow.getCell('D').style = { ...somaRow.getCell('D').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      
      somaRow.getCell('E').value = totalGeralAcumulado; // Total C + H
      somaRow.getCell('E').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
      somaRow.getCell('E').font = { bold: true };
      somaRow.getCell('E').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB4C7E7' } };
      somaRow.getCell('E').style = { ...somaRow.getCell('E').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      
      if (totalDiesel > 0) {
        somaRow.getCell('F').value = `${formatNumber(totalDiesel)} L OD`;
        somaRow.getCell('F').font = { bold: true };
        somaRow.getCell('F').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
        somaRow.getCell('F').style = { ...somaRow.getCell('F').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      }
      
      if (totalGasolina > 0) {
        somaRow.getCell('G').value = `${formatNumber(totalGasolina)} L GAS`;
        somaRow.getCell('G').font = { bold: true };
        somaRow.getCell('G').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
        somaRow.getCell('G').style = { ...somaRow.getCell('G').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      }
      
      if (totalValorCombustivelFinal > 0) {
        somaRow.getCell('H').value = totalValorCombustivelFinal;
        somaRow.getCell('H').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
        somaRow.getCell('H').font = { bold: true };
        somaRow.getCell('H').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
        somaRow.getCell('H').style = { ...somaRow.getCell('H').style, alignment: centerMiddleAlignment }; // Aplicar alinhamento explícito
      }
      
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
        somaRow.getCell(col).border = cellBorder;
      });
      
      currentRow++;
      
      const valorTotalRow = worksheet.getRow(currentRow);
      valorTotalRow.getCell('G').value = 'VALOR TOTAL';
      valorTotalRow.getCell('G').font = { bold: true };
      valorTotalRow.getCell('G').alignment = { horizontal: 'center', vertical: 'middle' };
      
      valorTotalRow.getCell('H').value = totalGeralAcumulado; // Total C + H
      valorTotalRow.getCell('H').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
      valorTotalRow.getCell('H').font = { bold: true };
      valorTotalRow.getCell('H').alignment = { horizontal: 'center' };
      
      ['G', 'H'].forEach(col => {
        valorTotalRow.getCell(col).border = cellBorder;
      });
      
      currentRow++;
      
      const gndLabelRow = worksheet.getRow(currentRow);
      gndLabelRow.getCell('H').value = 'GND - 3';
      gndLabelRow.getCell('H').font = { bold: true };
      gndLabelRow.getCell('H').alignment = { horizontal: 'center', vertical: 'middle' };
      gndLabelRow.getCell('H').border = {
        top: { style: 'thin' as const },
        left: { style: 'thin' as const },
        right: { style: 'thin' as const }
      };
      
      currentRow++;
      
      const gndValueRow = worksheet.getRow(currentRow);
      gndValueRow.getCell('H').value = totalGeralAcumulado; // Total C + H
      gndValueRow.getCell('H').numFmt = 'R$ #,##0.00'; // Alterado para formato brasileiro
      gndValueRow.getCell('H').font = { bold: true };
      gndValueRow.getCell('H').alignment = { horizontal: 'center', vertical: 'middle' };
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
  }, [ptrabData, registros, registrosClasseIII, toast, handleExportSuccess]);
      
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
  const totalGeral_33_90_30 = registros.reduce((acc, reg) => acc + reg.total_qs + reg.total_qr, 0);
  const totalValorCombustivel = registrosClasseIII.reduce((acc, reg) => acc + reg.valor_total, 0);
  
  // REGRA DO USUÁRIO: 33.90.39 é zero, e o total geral é a soma de 33.90.30 + Valor Total Combustível
  const totalGeral_33_90_39 = 0;
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39; // Soma das colunas azuis (C+D)
  
  // O valor total solicitado é a soma de todos os itens (Classe I + Classe III)
  const valorTotalSolicitado = totalGeral_33_90_30 + totalValorCombustivel;
  
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);

  // Nova estrutura: agrupar por OM (subseções dinâmicas)
  interface LinhaTabela {
    registro: ClasseIRegistro;
    tipo: 'QS' | 'QR';
  }

  interface GrupoOM {
    linhasQS: LinhaTabela[];
    linhasQR: LinhaTabela[];
  }

  const gruposPorOM: Record<string, GrupoOM> = {};

  // Processar cada registro: QS vai para om_qs, QR vai para organizacao
  registros.forEach((registro) => {
    // Adicionar linha QS ao grupo da OM fornecedora (om_qs)
    const omFornecedora = registro.om_qs;
    if (!gruposPorOM[omFornecedora]) {
      gruposPorOM[omFornecedora] = { linhasQS: [], linhasQR: [] };
    }
    gruposPorOM[omFornecedora].linhasQS.push({ registro, tipo: 'QS' });

    // Adicionar linha QR ao grupo da OM de destino (organizacao)
    const omDestino = registro.organizacao;
    if (!gruposPorOM[omDestino]) {
      gruposPorOM[omDestino] = { linhasQS: [], linhasQR: [] };
    }
    gruposPorOM[omDestino].linhasQR.push({ registro, tipo: 'QR' });
  });

  // Ordenar as OMs: primeiro as que contêm "RM", depois as demais em ordem alfabética
  const omsOrdenadas = Object.keys(gruposPorOM).sort((a, b) => {
    const aTemRM = a.includes('RM') || a.includes('R M');
    const bTemRM = b.includes('RM') || b.includes('R M');
    
    if (aTemRM && !bTemRM) return -1;
    if (!aTemRM && bTemRM) return 1;
    return a.localeCompare(b);
  });

  // Identificar a RM (primeira OM que contém "RM")
  const nomeRM = omsOrdenadas.find(om => om.includes('RM') || om.includes('R M')) || ptrabData.nome_om; // Fallback para nome_om do PTrab

  // Calcular totais por OM
  const calcularTotaisPorOM = (grupo: GrupoOM, nomeOM: string) => {
    const totalQS = grupo.linhasQS.reduce((acc, linha) => acc + linha.registro.total_qs, 0);
    const totalQR = grupo.linhasQR.reduce((acc, linha) => acc + linha.registro.total_qr, 0);
    
    // Se esta OM for a RM, incluir TODOS os combustíveis
    const classeIIIDestaOM = (nomeOM === nomeRM) 
      ? registrosClasseIII 
      : [];
    
    // Totais de combustível por tipo (apenas para RM)
    const totalDiesel = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.total_litros, 0);
    const totalGasolina = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.total_litros, 0);
    const valorDiesel = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    const valorGasolina = classeIIIDestaOM
      .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
      .reduce((acc, reg) => acc + reg.valor_total, 0);
    
    const totalCombustivel = valorDiesel + valorGasolina;
    const totalParteAzul = totalQS + totalQR; // APENAS QS + QR (ND 30)
    
    // REGRA DO USUÁRIO: GND 3 é a soma da Classe I (ND 30) + Classe III (Valor Total Combustível).
    const totalGeral = totalParteAzul + totalCombustivel; 
    
    return {
      total_33_90_30: totalParteAzul, // Total Classe I
      total_33_90_39: 0, // Classe III não é lançada aqui
      total_parte_azul: totalParteAzul, // Usado para a coluna TOTAL (E) no subtotal
      total_combustivel: totalCombustivel, // Total da parte laranja
      total_gnd3: totalGeral, // Soma de parte azul + parte laranja
      totalDiesel,
      totalGasolina,
      valorDiesel,
      valorGasolina,
    };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden sticky top-0 z-50 bg-background border-b border-border shadow-sm">
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
          <p className="text-[11pt] font-bold uppercase mt-4">
            Plano de Trabalho Logístico de Solicitação de Recursos Orçamentários e Financeiros Operação {ptrabData.nome_operacao}
          </p>
          <p className="text-[11pt] font-bold uppercase mt-4 underline">Plano de Trabalho Logístico</p>
        </div>

        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1.NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2.PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {diasOperacao}</p>
          <p className="info-item"><span className="font-bold">3.EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4.AÇÕES REALIZADAS OU A REALIZAR:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5.DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        </div>

        {registros.length > 0 || registrosClasseIII.length > 0 ? (
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
                if (grupo.linhasQS.length === 0 && grupo.linhasQR.length === 0 && (nomeOM !== nomeRM || registrosClasseIII.length === 0)) {
                  return [];
                }
                
                return [
                  // Renderizar todas as linhas QS
                  ...grupo.linhasQS.map((linha) => (
                    <tr key={`${linha.registro.id}-qs`}>
                      <td className="col-despesas">
                        <div>CLASSE I - SUBSISTÊNCIA</div>
                        <div>{linha.registro.organizacao}</div>
                      </td>
                      <td className="col-om">
                        <div>{linha.registro.om_qs}</div>
                        <div>({linha.registro.ug_qs})</div>
                      </td>
                      <td className="col-valor-natureza">{formatCurrency(linha.registro.total_qs)}</td>
                      <td className="col-valor-natureza"></td>
                      <td className="col-valor-natureza">{formatCurrency(linha.registro.total_qs)}</td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                        <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {linha.registro.memoria_calculo_qs_customizada || 
                           generateClasseIMemoriaCalculo(linha.registro).qs}
                        </pre>
                      </td>
                    </tr>
                  )),
                  
                  // Renderizar todas as linhas QR
                  ...grupo.linhasQR.map((linha) => (
                    <tr key={`${linha.registro.id}-qr`}>
                      <td className="col-despesas">
                        <div>CLASSE I - SUBSISTÊNCIA</div>
                      </td>
                      <td className="col-om">
                        <div>{linha.registro.organizacao}</div>
                        <div>({linha.registro.ug})</div>
                      </td>
                      <td className="col-valor-natureza">{formatCurrency(linha.registro.total_qr)}</td>
                      <td className="col-valor-natureza"></td>
                      <td className="col-valor-natureza">{formatCurrency(linha.registro.total_qr)}</td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-combustivel-data-filled"></td>
                      <td className="col-detalhamento" style={{ fontSize: '6.5pt' }}>
                        <pre style={{ fontSize: '6.5pt', fontFamily: 'inherit', whiteSpace: 'pre-wrap', margin: 0 }}>
                          {linha.registro.memoria_calculo_qr_customizada || 
                           generateClasseIMemoriaCalculo(linha.registro).qr}
                        </pre>
                      </td>
                    </tr>
                  )),
                  
                  // Renderizar linhas de Classe III APENAS na RM
                  ...(nomeOM === nomeRM ? registrosClasseIII.map((registro) => {
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
                          <div>({gruposPorOM[nomeRM]?.linhasQS[0]?.registro.ug_qs || 'UG'})</div>
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
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_33_90_39)}</td> {/* Deve ser 0 */}
                    <td className="text-center font-bold">{formatCurrency(totaisOM.total_parte_azul)}</td> {/* TOTAL ND (C+D) -> Apenas C */}
                    {/* Parte Laranja (Combustivel) */}
                    <td className="text-center font-bold border border-black">
                      {nomeOM === nomeRM && totaisOM.totalDiesel > 0 
                        ? `${formatNumber(totaisOM.totalDiesel)} L OD` 
                        : ''}
                    </td>
                    <td className="text-center font-bold border border-black">
                      {nomeOM === nomeRM && totaisOM.totalGasolina > 0 
                        ? `${formatNumber(totaisOM.totalGasolina)} L GAS` 
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
                // Valor total solicitado: Soma do TOTAL (azul) + PREÇO TOTAL (laranja)
                // totalGeral_GND3_ND (SUM(C+D)) + totalValorCombustivel (SUM(H))
                
                // Totais de combustível por tipo (para exibição na parte laranja)
                const totalDiesel = registrosClasseIII
                  .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const totalGasolina = registrosClasseIII
                  .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
                  .reduce((acc, reg) => acc + reg.total_litros, 0);
                const valorDiesel = registrosClasseIII
                  .filter(reg => reg.tipo_combustivel === 'DIESEL' || reg.tipo_combustivel === 'OD')
                  .reduce((acc, reg) => acc + reg.valor_total, 0);
                const valorGasolina = registrosClasseIII
                  .filter(reg => reg.tipo_combustivel === 'GASOLINA' || reg.tipo_combustivel === 'GAS')
                  .reduce((acc, reg) => acc + reg.valor_total, 0);
                const totalValorCombustivelFinal = valorDiesel + valorGasolina;

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
            <AlertDialogTitle>Atualizar Status do P Trab</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja alterar o status do P Trab "{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}" para "Completo" após a exportação?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleConfirmCompleteStatus}>Sim, alterar</AlertDialogAction>
            <AlertDialogCancel onClick={handleCancelCompleteStatus}>Não, obrigado</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PTrabPrint;