import React, { useCallback, useRef, useMemo } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatNumber, formatDateDDMMMAA, formatCodug } from "@/lib/formatUtils";
import { FileSpreadsheet, Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PTrabData,
  ClasseIRegistro,
  ClasseIIRegistro,
  ClasseIIIRegistro,
  LinhaClasseIII,
  GrupoOM,
  CLASSE_V_CATEGORIES,
  CLASSE_VI_CATEGORIES,
  CLASSE_VII_CATEGORIES,
  CLASSE_VIII_CATEGORIES,
  CLASSE_IX_CATEGORIES,
  calculateDays,
  formatDate,
  getClasseIILabel,
  generateClasseIXMemoriaCalculo,
  getTipoCombustivelLabel,
  LinhaTabela,
  LinhaClasseII,
} from "@/pages/PTrabReportManager";

interface PTrabLogisticoReportProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  registrosClasseII: ClasseIIRegistro[];
  registrosClasseIII: ClasseIIIRegistro[];
  nomeRM: string;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, GrupoOM>;
  calcularTotaisPorOM: (grupo: GrupoOM, nomeOM: string) => {
    total_33_90_30: number;
    total_33_90_39: number;
    total_parte_azul: number;
    total_combustivel: number;
    total_gnd3: number;
    totalDieselLitros: number;
    totalGasolinaLitros: number;
  };
  fileSuffix: string;
  generateClasseIMemoriaCalculo: (registro: ClasseIRegistro, tipo: 'QS' | 'QR' | 'OP') => string;
  generateClasseIIMemoriaCalculo: (
    registro: ClasseIIRegistro, 
    isClasseII: boolean
  ) => string;
  generateClasseVMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
  generateClasseVIIIMemoriaCalculo: (registro: ClasseIIRegistro) => string;
}

const getTipoEquipamentoLabel = (tipo: string) => {
    switch (tipo) {
        case 'GERADOR': return 'GERADOR';
        case 'EMBARCACAO': return 'EMBARCAÇÃO';
        case 'EQUIPAMENTO_ENGENHARIA': return 'EQUIPAMENTO DE ENGENHARIA';
        default: return tipo;
    }
};

const PTrabLogisticoReport: React.FC<PTrabLogisticoReportProps> = ({
  ptrabData,
  nomeRM,
  omsOrdenadas,
  gruposPorOM,
  calcularTotaisPorOM,
  fileSuffix,
  generateClasseIMemoriaCalculo,
  generateClasseIIMemoriaCalculo,
  generateClasseVMemoriaCalculo,
  generateClasseVIMemoriaCalculo,
  generateClasseVIIMemoriaCalculo,
  generateClasseVIIIMemoriaCalculo,
}) => {
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const isLubrificante = (r: ClasseIIIRegistro) => r.tipo_equipamento === 'LUBRIFICANTE_CONSOLIDADO';

  const totalGeral_33_90_30 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, '').total_33_90_30, 0), [gruposPorOM, calcularTotaisPorOM]);
  const totalGeral_33_90_39 = useMemo(() => Object.values(gruposPorOM).reduce((acc, grupo) => acc + calcularTotaisPorOM(grupo, '').total_33_90_39, 0), [gruposPorOM, calcularTotaisPorOM]);
  
  const { totalDiesel, totalGasolina, totalValorCombustivelFinal } = useMemo(() => {
    let totalDiesel = 0;
    let totalGasolina = 0;
    let totalValorCombustivelFinal = 0;
    omsOrdenadas.forEach(nomeOM => {
        const grupo = gruposPorOM[nomeOM];
        if (grupo) {
            const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
            totalDiesel += totaisOM.totalDieselLitros;
            totalGasolina += totaisOM.totalGasolinaLitros;
            totalValorCombustivelFinal += totaisOM.total_combustivel;
        }
    });
    return { totalDiesel, totalGasolina, totalValorCombustivelFinal };
  }, [omsOrdenadas, gruposPorOM, calcularTotaisPorOM]);
  
  const totalGeral_GND3_ND = totalGeral_33_90_30 + totalGeral_33_90_39;
  const valorTotalSolicitado = totalGeral_GND3_ND + totalValorCombustivelFinal;
  const diasOperacao = calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  
  const generateFileName = (reportType: 'PDF' | 'Excel') => {
    const dataAtz = formatDateDDMMMAA(ptrabData.updated_at);
    const numeroPTrab = ptrabData.numero_ptrab.replace(/\//g, '-'); 
    const isMinuta = ptrabData.numero_ptrab.startsWith("Minuta");
    const currentYear = new Date(ptrabData.periodo_inicio).getFullYear();
    let nomeBase = `P Trab Nr ${numeroPTrab}`;
    if (isMinuta) nomeBase += ` - ${currentYear} - ${ptrabData.nome_om}`;
    nomeBase += ` - ${ptrabData.nome_operacao} - Atz ${dataAtz} - ${fileSuffix}`;
    return `${nomeBase}.${reportType === 'PDF' ? 'pdf' : 'xlsx'}`;
  };

  const exportPDF = useCallback(() => {
    if (!contentRef.current) return;
    const pdfToast = toast({ title: "Gerando PDF...", description: "Aguarde enquanto o relatório é processado." });
    html2canvas(contentRef.current, { scale: 3, useCORS: true, allowTaint: true }).then((canvas) => {
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4');
      const margin = 5;
      const contentWidth = 297 - 2 * margin;
      const contentHeight = 210 - 2 * margin;
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;
      while (heightLeft > -1) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
        heightLeft -= contentHeight;
      }
      pdf.save(generateFileName('PDF'));
      pdfToast.dismiss();
    }).catch(error => {
      console.error("Erro ao gerar PDF:", error);
      pdfToast.dismiss();
    });
  }, [ptrabData, toast, diasOperacao, totalGeral_GND3_ND, valorTotalSolicitado, fileSuffix, totalDiesel, totalGasolina, totalValorCombustivelFinal]);

  const handlePrint = () => window.print();

  const exportExcel = useCallback(async () => {
    if (!ptrabData) return;
    const centerMiddleAlignment = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
    const rightMiddleAlignment = { horizontal: 'right' as const, vertical: 'middle' as const, wrapText: true };
    const leftTopAlignment = { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true };
    const cellBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
    const baseFontStyle = { name: 'Arial', size: 8 };
    const headerFontStyle = { name: 'Arial', size: 9, bold: true };
    const titleFontStyle = { name: 'Arial', size: 11, bold: true };
    const corAzul = 'FFB4C7E7';
    const corLaranja = 'FFF8CBAD';
    const corSubtotal = 'FFD3D3D3';
    const corTotalOM = 'FFE8E8E8';

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('P Trab Logístico');
      worksheet.columns = [{ width: 35 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 70 }];
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
      addHeaderRow((ptrabData.nome_om_extenso || ptrabData.nome_om).toUpperCase());
      addHeaderRow(`PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO ${ptrabData.nome_operacao.toUpperCase()}`);
      addHeaderRow('PLANO DE TRABALHO LOGÍSTICO');
      currentRow++;

      const addInfoRow = (label: string, value: string) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = { richText: [{ text: label, font: headerFontStyle }, { text: ` ${value}`, font: { name: 'Arial', size: 11 } }] };
        row.getCell(1).alignment = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true };
        worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
        currentRow++;
      };

      addInfoRow('1. NOME DA OPERAÇÃO:', ptrabData.nome_operacao);
      addInfoRow('2. PERÍODO:', `de ${formatDate(ptrabData.periodo_inicio)} a ${formatDate(ptrabData.periodo_fim)} - Nr Dias: ${diasOperacao}`);
      addInfoRow('3. EFETIVO EMPREGADO:', `${ptrabData.efetivo_empregado} militares do Exército Brasileiro`);
      addInfoRow('4. AÇÕES:', ptrabData.acoes || '');
      currentRow++;

      // Cabeçalho da Tabela
      const hdr1 = worksheet.getRow(currentRow);
      const hdr2 = worksheet.getRow(currentRow + 1);
      worksheet.mergeCells(`A${currentRow}:A${currentRow + 1}`);
      worksheet.mergeCells(`B${currentRow}:B${currentRow + 1}`);
      worksheet.mergeCells(`C${currentRow}:E${currentRow}`);
      worksheet.mergeCells(`F${currentRow}:H${currentRow}`);
      worksheet.mergeCells(`I${currentRow}:I${currentRow + 1}`);
      
      hdr1.getCell('A').value = 'DESPESAS';
      hdr1.getCell('B').value = 'OM (UGE)\nCODUG';
      hdr1.getCell('C').value = 'NATUREZA DE DESPESA';
      hdr1.getCell('F').value = 'COMBUSTÍVEL';
      hdr1.getCell('I').value = 'DETALHAMENTO / MEMÓRIA DE CÁLCULO';
      hdr2.getCell('C').value = '33.90.30';
      hdr2.getCell('D').value = '33.90.39';
      hdr2.getCell('E').value = 'TOTAL';
      hdr2.getCell('F').value = 'LITROS';
      hdr2.getCell('G').value = 'PREÇO UNIT.';
      hdr2.getCell('H').value = 'PREÇO TOTAL';
      
      [hdr1, hdr2].forEach(r => r.eachCell(c => { c.font = headerFontStyle; c.alignment = centerMiddleAlignment; c.border = cellBorder; }));
      currentRow += 2;

      for (const nomeOM of omsOrdenadas) {
        const grupo = gruposPorOM[nomeOM];
        const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
        const allExpenseLines = [...grupo.linhasQS, ...grupo.linhasQR, ...grupo.linhasClasseII, ...grupo.linhasClasseV, ...grupo.linhasClasseVI, ...grupo.linhasClasseVII, ...grupo.linhasClasseVIII, ...grupo.linhasClasseIX, ...grupo.linhasClasseIII].sort((a, b) => {
            const getClasseOrder = (linha: any) => {
                if ('tipo' in linha) return 1;
                if ('categoria_equipamento' in linha) return 3;
                const cat = linha.registro.categoria;
                if (CLASSE_V_CATEGORIES.includes(cat)) return 5;
                if (CLASSE_VI_CATEGORIES.includes(cat)) return 6;
                if (CLASSE_VII_CATEGORIES.includes(cat)) return 7;
                if (CLASSE_VIII_CATEGORIES.includes(cat) || cat === 'Remonta/Veterinária') return 8;
                if (CLASSE_IX_CATEGORIES.includes(cat)) return 9;
                return 2;
            };
            return getClasseOrder(a) - getClasseOrder(b);
        });

        for (const linha of allExpenseLines) {
            const row = worksheet.getRow(currentRow);
            const isClasseI = 'tipo' in linha;
            const isClasseIII = 'categoria_equipamento' in linha;
            
            let despesasValue = '', omValue = '', valorC = 0, valorD = 0, valorE = 0, litrosF = '', precoG = '', precoH = '', memoria = '';

            if (isClasseI) {
                const r = (linha as any).registro;
                despesasValue = 'CLASSE I - SUBSISTÊNCIA';
                omValue = (linha as any).tipo === 'QS' ? `${r.om_qs}\n(${formatCodug(r.ug_qs)})` : `${r.organizacao}\n(${formatCodug(r.ug)})`;
                valorC = (linha as any).tipo === 'QS' ? r.total_qs : r.total_qr;
                valorE = valorC;
                memoria = generateClasseIMemoriaCalculo(r, (linha as any).tipo);
            } else if (isClasseIII) {
                const l = linha as LinhaClasseIII;
                despesasValue = `CLASSE III - ${l.tipo_suprimento.replace('COMBUSTIVEL_', '')}\n${l.categoria_equipamento}`;
                omValue = `${nomeOM}\n(${formatCodug(l.registro.ug_detentora || l.registro.ug)})`;
                if (l.tipo_suprimento === 'LUBRIFICANTE') { valorC = l.valor_total_linha; valorE = l.valor_total_linha; }
                else { litrosF = `${formatNumber(l.total_litros_linha)} L`; precoG = formatCurrency(l.preco_litro_linha); precoH = formatCurrency(l.valor_total_linha); }
                memoria = l.memoria_calculo;
            } else {
                const r = (linha as any).registro;
                const cat = r.categoria;
                let prefixo = 'CLASSE II';
                if (CLASSE_V_CATEGORIES.includes(cat)) prefixo = 'CLASSE V';
                else if (CLASSE_VI_CATEGORIES.includes(cat)) prefixo = 'CLASSE VI';
                else if (CLASSE_VII_CATEGORIES.includes(cat)) prefixo = 'CLASSE VII';
                else if (CLASSE_VIII_CATEGORIES.includes(cat) || cat === 'Remonta/Veterinária') prefixo = 'CLASSE VIII';
                else if (CLASSE_IX_CATEGORIES.includes(cat)) prefixo = 'CLASSE IX';
                
                despesasValue = `${prefixo} - ${cat.toUpperCase()}`;
                omValue = `${r.organizacao}\n(${formatCodug(r.ug)})`;
                valorC = r.valor_nd_30; valorD = r.valor_nd_39; valorE = valorC + valorD;
                
                if (prefixo === 'CLASSE VIII') memoria = generateClasseVIIIMemoriaCalculo(r);
                else if (prefixo === 'CLASSE IX') memoria = generateClasseIXMemoriaCalculo(r);
                else memoria = generateClasseIIMemoriaCalculo(r, prefixo === 'CLASSE II');
            }

            row.getCell('A').value = despesasValue;
            row.getCell('B').value = omValue;
            row.getCell('C').value = valorC;
            row.getCell('D').value = valorD;
            row.getCell('E').value = valorE;
            row.getCell('F').value = litrosF;
            row.getCell('G').value = precoG;
            row.getCell('H').value = precoH;
            row.getCell('I').value = memoria;
            
            row.eachCell(c => { c.border = cellBorder; c.font = baseFontStyle; c.alignment = { vertical: 'middle', wrapText: true } });
            row.getCell('C').numFmt = 'R$ #,##0.00'; row.getCell('D').numFmt = 'R$ #,##0.00'; row.getCell('E').numFmt = 'R$ #,##0.00';
            currentRow++;
        }
        currentRow++; // Espaço entre OMs
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = generateFileName('Excel'); a.click();
    } catch (e) { console.error(e); }
  }, [ptrabData, omsOrdenadas, gruposPorOM, calcularTotaisPorOM, diasOperacao, fileSuffix, generateClasseIMemoriaCalculo, generateClasseIIMemoriaCalculo, generateClasseVMemoriaCalculo, generateClasseVIMemoriaCalculo, generateClasseVIIMemoriaCalculo, generateClasseVIIIMemoriaCalculo]);

  const renderExpenseLines = (allExpenseLines: any[], currentOMName: string) => {
    return allExpenseLines.map((linha, index) => {
        const isClasseI = 'tipo' in linha;
        const isClasseIII = 'categoria_equipamento' in linha;
        const isClasseII_IX = !isClasseI && !isClasseIII;
        
        let despesas = '', om = '', valC = 0, valD = 0, valE = 0, litros = '', pUnit = '', pTotal = '', memoria = '';

        if (isClasseI) {
            const r = linha.registro;
            despesas = `CLASSE I - SUBSISTÊNCIA`;
            om = linha.tipo === 'QS' ? `${r.om_qs}<br/>(${formatCodug(r.ug_qs)})` : `${r.organizacao}<br/>(${formatCodug(r.ug)})`;
            valC = linha.tipo === 'QS' ? r.total_qs : r.total_qr;
            valE = valC;
            memoria = generateClasseIMemoriaCalculo(r, linha.tipo);
        } else if (isClasseIII) {
            const l = linha as LinhaClasseIII;
            despesas = `CLASSE III - ${l.tipo_suprimento.replace('COMBUSTIVEL_', '')}<br/>${l.categoria_equipamento}`;
            om = `${currentOMName}<br/>(${formatCodug(l.registro.ug_detentora || l.registro.ug)})`;
            if (l.tipo_suprimento === 'LUBRIFICANTE') { valC = l.valor_total_linha; valE = l.valor_total_linha; }
            else { litros = `${formatNumber(l.total_litros_linha)} L`; pUnit = formatCurrency(l.preco_litro_linha); pTotal = formatCurrency(l.valor_total_linha); }
            memoria = l.memoria_calculo;
        } else {
            const r = linha.registro;
            const cat = r.categoria;
            let prefixo = 'CLASSE II';
            if (CLASSE_V_CATEGORIES.includes(cat)) prefixo = 'CLASSE V';
            else if (CLASSE_VI_CATEGORIES.includes(cat)) prefixo = 'CLASSE VI';
            else if (CLASSE_VII_CATEGORIES.includes(cat)) prefixo = 'CLASSE VII';
            else if (CLASSE_VIII_CATEGORIES.includes(cat) || cat === 'Remonta/Veterinária') prefixo = 'CLASSE VIII';
            else if (CLASSE_IX_CATEGORIES.includes(cat)) prefixo = 'CLASSE IX';
            
            despesas = `${prefixo} - ${cat.toUpperCase()}`;
            om = `${r.organizacao}<br/>(${formatCodug(r.ug)})`;
            valC = r.valor_nd_30; valD = r.valor_nd_39; valE = valC + valD;
            
            if (prefixo === 'CLASSE VIII') memoria = generateClasseVIIIMemoriaCalculo(r);
            else if (prefixo === 'CLASSE IX') memoria = generateClasseIXMemoriaCalculo(r);
            else memoria = generateClasseIIMemoriaCalculo(r, prefixo === 'CLASSE II');
        }

        return (
            <tr key={`${currentOMName}-${index}`} className="expense-row">
                <td className="col-despesas"><div dangerouslySetInnerHTML={{ __html: despesas }} /></td>
                <td className="col-om"><div dangerouslySetInnerHTML={{ __html: om }} /></td>
                <td className="col-nd col-valor-natureza">{valC > 0 ? formatCurrency(valC) : ''}</td>
                <td className="col-nd col-valor-natureza">{valD > 0 ? formatCurrency(valD) : ''}</td>
                <td className="col-nd col-valor-natureza">{valE > 0 ? formatCurrency(valE) : ''}</td>
                <td className="col-combustivel-data-filled">{litros}</td>
                <td className="col-combustivel-data-filled">{pUnit}</td>
                <td className="col-combustivel-data-filled">{pTotal}</td>
                <td className="col-detalhamento"><div style={{ fontSize: '6.5pt', whiteSpace: 'pre-wrap' }}>{memoria}</div></td>
            </tr>
        );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={exportPDF} variant="outline"><Download className="mr-2 h-4 w-4" /> Exportar PDF</Button>
        <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel</Button>
        <Button onClick={handlePrint} variant="default"><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
      </div>

      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        <div className="ptrab-header text-center mb-6 uppercase">
          <p className="font-bold">Ministério da Defesa / Exército Brasileiro</p>
          <p className="font-bold">{ptrabData.comando_militar_area}</p>
          <p className="font-bold">{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          <p className="font-bold mt-2">Plano de Trabalho Logístico - Operação {ptrabData.nome_operacao}</p>
        </div>

        <div className="ptrab-info text-sm mb-4 space-y-1">
          <p><span className="font-bold">1. OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} ({diasOperacao} dias)</p>
          <p><span className="font-bold">3. EFETIVO:</span> {ptrabData.efetivo_empregado} militares</p>
          <p><span className="font-bold">4. AÇÕES:</span> {ptrabData.acoes}</p>
        </div>

        <div className="ptrab-table-wrapper">
          <table className="ptrab-table w-full border-collapse border border-black text-[8pt]">
            <thead>
              <tr className="bg-gray-100">
                <th rowSpan={2} className="border border-black p-1">DESPESAS</th>
                <th rowSpan={2} className="border border-black p-1">OM (UGE)</th>
                <th colSpan={3} className="border border-black p-1 bg-blue-100">NATUREZA DE DESPESA</th>
                <th colSpan={3} className="border border-black p-1 bg-orange-100">COMBUSTÍVEL</th>
                <th rowSpan={2} className="border border-black p-1">MEMÓRIA DE CÁLCULO</th>
              </tr>
              <tr className="bg-gray-100">
                <th className="border border-black p-1 bg-blue-100 w-20">33.90.30</th>
                <th className="border border-black p-1 bg-blue-100 w-20">33.90.39</th>
                <th className="border border-black p-1 bg-blue-100 w-20">TOTAL</th>
                <th className="border border-black p-1 bg-orange-100 w-16">LITROS</th>
                <th className="border border-black p-1 bg-orange-100 w-16">UNIT.</th>
                <th className="border border-black p-1 bg-orange-100 w-20">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {omsOrdenadas.map(nomeOM => {
                const grupo = gruposPorOM[nomeOM];
                const totaisOM = calcularTotaisPorOM(grupo, nomeOM);
                const allLines = [...grupo.linhasQS, ...grupo.linhasQR, ...grupo.linhasClasseII, ...grupo.linhasClasseV, ...grupo.linhasClasseVI, ...grupo.linhasClasseVII, ...grupo.linhasClasseVIII, ...grupo.linhasClasseIX, ...grupo.linhasClasseIII].sort((a, b) => {
                    const getOrder = (l: any) => {
                        if ('tipo' in l) return 1; if ('categoria_equipamento' in l) return 3;
                        const c = l.registro.categoria;
                        if (CLASSE_V_CATEGORIES.includes(c)) return 5; if (CLASSE_VI_CATEGORIES.includes(c)) return 6;
                        if (CLASSE_VII_CATEGORIES.includes(c)) return 7; if (CLASSE_VIII_CATEGORIES.includes(c) || c === 'Remonta/Veterinária') return 8;
                        if (CLASSE_IX_CATEGORIES.includes(c)) return 9; return 2;
                    };
                    return getOrder(a) - getOrder(b);
                });
                if (allLines.length === 0) return null;
                return (
                  <React.Fragment key={nomeOM}>
                    {renderExpenseLines(allLines, nomeOM)}
                    <tr className="font-bold bg-gray-200">
                      <td colSpan={2} className="border border-black p-1 text-right italic">SOMA {nomeOM}</td>
                      <td className="border border-black p-1 text-center bg-blue-50">{formatCurrency(totaisOM.total_33_90_30)}</td>
                      <td className="border border-black p-1 text-center bg-blue-50">{formatCurrency(totaisOM.total_33_90_39)}</td>
                      <td className="border border-black p-1 text-center bg-blue-50">{formatCurrency(totaisOM.total_parte_azul)}</td>
                      <td colSpan={3} className="border border-black p-1 text-center bg-orange-50">{formatCurrency(totaisOM.total_combustivel)}</td>
                      <td className="border border-black p-1"></td>
                    </tr>
                  </React.Fragment>
                );
              })}
              <tr className="font-bold text-[10pt] bg-gray-300">
                <td colSpan={4} className="border border-black p-2 text-right uppercase">Valor Total do Plano de Trabalho</td>
                <td className="border border-black p-2 text-center">{formatCurrency(valorTotalSolicitado)}</td>
                <td colSpan={4} className="border border-black p-2 bg-gray-300"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ptrab-footer mt-12 text-center">
          <p className="mb-8">{ptrabData.local_om || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="font-bold underline uppercase">{ptrabData.nome_cmt_om || 'Comandante'}</p>
          <p className="text-xs">Comandante da {ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
        </div>
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 0.5cm; }
        .ptrab-table th, .ptrab-table td { line-height: 1.2; }
        .col-despesas { width: 15%; text-align: left; vertical-align: middle; }
        .col-om { width: 10%; text-align: center; vertical-align: middle; }
        .col-nd { vertical-align: middle; }
        .col-detalhamento { width: 30%; text-align: left; vertical-align: top; padding: 4px; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .bg-blue-100 { background-color: #dbeafe !important; }
          .bg-orange-100 { background-color: #ffedd5 !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
          .bg-gray-300 { background-color: #d1d5db !important; }
        }
      `}</style>
    </div>
  );
};

export default PTrabLogisticoReport;