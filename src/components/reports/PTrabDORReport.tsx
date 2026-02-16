"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCodug } from "@/lib/formatUtils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from "sonner";

interface PTrabDORReportProps {
  ptrabData: any;
  dorData: any;
  selector?: React.ReactNode;
}

const PTrabDORReport: React.FC<PTrabDORReportProps> = ({ ptrabData, dorData, selector }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    toast.loading("Gerando PDF de alta fidelidade...", { id: "pdf-gen" });
    
    try {
      // Pequeno delay para garantir que o DOM esteja estável
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(reportRef.current, {
        scale: 3, // Alta resolução
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1000, // Largura fixa para consistência
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`DOR_${dorData.numero_dor || 'SN'}_${ptrabData.nome_om}.pdf`);
      toast.success("PDF exportado com sucesso!", { id: "pdf-gen" });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Falha ao gerar PDF.", { id: "pdf-gen" });
    }
  };

  const handleExportExcel = () => {
    toast.info("A exportação para Excel do DOR está em desenvolvimento.");
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const anoAtual = new Date().getFullYear();

  // Estilos inline para garantir fidelidade no html2canvas
  const tableStyle: React.CSSProperties = { 
    width: '100%', 
    borderCollapse: 'collapse', 
    border: '1.5px solid black',
    marginBottom: '16px',
    tableLayout: 'fixed'
  };
  
  const cellStyle: React.CSSProperties = { 
    border: '1px solid black', 
    padding: '2px 8px', 
    verticalAlign: 'top',
    color: 'black'
  };
  
  const headerCellStyle: React.CSSProperties = { 
    ...cellStyle, 
    backgroundColor: '#BFBFBF', 
    textAlign: 'center', 
    fontWeight: 'bold', 
    textTransform: 'uppercase',
    fontSize: '11pt'
  };

  const labelStyle: React.CSSProperties = { 
    fontWeight: 'bold', 
    display: 'block',
    fontSize: '11pt'
  };

  return (
    <div className="space-y-6">
      {/* Barra de Ações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border print:hidden">
        <div className="flex items-center gap-3">
          {selector}
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={handleExportPDF} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button onClick={handleExportExcel} variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button onClick={handlePrint} variant="default">
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Container do Relatório (Folha A4) */}
      <div 
        ref={reportRef}
        className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-[15mm] text-black print:p-0"
        style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: '12pt' }}
      >
        {/* Cabeçalho do Documento (Tabela para evitar desalinhamento) */}
        <table style={{ ...tableStyle, border: '1.5px solid black', minHeight: '100px' }}>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, width: '180px', textAlign: 'center', verticalAlign: 'middle' }}>
                <img 
                  src="/logo_md.png" 
                  alt="MD" 
                  className="max-h-20 w-auto mx-auto object-contain"
                  onError={(e: any) => e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Coat_of_arms_of_Brazil.svg/100px-Coat_of_arms_of_Brazil.svg.png"}
                />
              </td>
              <td style={{ ...cellStyle, textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '11pt', lineHeight: '1.2' }}>
                <p>Ministério da Defesa</p>
                <p>Exército Brasileiro</p>
                <p>{ptrabData.comando_militar_area}</p>
                <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
              </td>
              <td style={{ ...cellStyle, width: '200px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '11pt', lineHeight: '1.2' }}>
                <p>Documento de Oficialização da Requisição – DOR</p>
                <p className="mt-1">nº {dorData.numero_dor || '___'} / {anoAtual}</p>
                <p className="mt-2 font-normal">{new Date(dorData.created_at).toLocaleDateString('pt-BR')}</p>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 1. DADOS DO ÓRGÃO REQUISITANTE */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>DADOS DO ÓRGÃO REQUISITANTE</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, borderBottom: 'none' }}>
                <span style={labelStyle}>Órgão:</span>
              </td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, borderTop: 'none' }}>
                {ptrabData.nome_om_extenso || ptrabData.nome_om}
              </td>
            </tr>
            <tr>
              <td style={{ padding: 0, border: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...cellStyle, width: '50%', borderLeft: 'none', borderBottom: 'none' }}>
                        <span style={labelStyle}>Responsável pela Demanda:</span>
                      </td>
                      <td style={{ ...cellStyle, width: '50%', borderRight: 'none', borderBottom: 'none' }}></td>
                    </tr>
                    <tr>
                      <td style={{ ...cellStyle, borderLeft: 'none', borderTop: 'none' }}>
                        {ptrabData.nome_cmt_om || "Não informado"}
                      </td>
                      <td style={{ ...cellStyle, borderRight: 'none', borderTop: 'none' }}></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style={{ padding: 0, border: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...cellStyle, width: '50%', borderLeft: 'none', borderBottom: 'none' }}>
                        <span style={{ ...labelStyle, display: 'inline' }}>E-mail: </span>
                        <span style={{ fontWeight: 'normal' }}>{dorData.email}</span>
                      </td>
                      <td style={{ ...cellStyle, width: '50%', borderRight: 'none', borderBottom: 'none' }}>
                        <span style={{ ...labelStyle, display: 'inline' }}>Telefone: </span>
                        <span style={{ fontWeight: 'normal' }}>{dorData.telefone}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 2. ANEXOS */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>Anexos</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{dorData.anexos}</td>
            </tr>
          </tbody>
        </table>

        {/* 3. AO / PO */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={{ ...cellStyle, backgroundColor: '#BFBFBF', fontWeight: 'bold' }}>
                <span style={{ display: 'inline' }}>Ação Orçamentária (AO): </span>
                <span style={{ fontWeight: 'normal' }}>{dorData.acao_orcamentaria}</span>
              </td>
            </tr>
            <tr>
              <td style={cellStyle}>
                <span style={{ ...labelStyle, display: 'inline' }}>Plano Orçamentário (PO): </span>
                <span style={{ fontWeight: 'normal' }}>{dorData.plano_orcamentario}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. OBJETO DE REQUISIÇÃO */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td colSpan={4} style={headerCellStyle}>OBJETO DE REQUISIÇÃO</td>
            </tr>
            <tr>
              <td colSpan={4} style={cellStyle}>
                <span style={{ ...labelStyle, display: 'inline' }}>Evento: </span>
                <span style={{ fontWeight: 'normal' }}>{dorData.evento}</span>
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={headerCellStyle}>DESCRIÇÃO DO ITEM (BEM E/OU SERVIÇO)</td>
            </tr>
            <tr style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '10pt' }}>
              <td style={{ ...cellStyle, width: '150px' }}>UGE</td>
              <td style={{ ...cellStyle, width: '60px' }}>GND</td>
              <td style={{ ...cellStyle, width: '120px' }}>VALOR</td>
              <td style={cellStyle}>Descrição</td>
            </tr>
            {dorData.itens_dor?.map((item: any, idx: number) => (
              <tr key={idx} style={{ fontSize: '10pt', textAlign: 'center' }}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 'bold' }}>{item.uge_name || item.uge || "N/I"}</div>
                  {(item.uge_code || item.ug) && (
                    <div style={{ fontSize: '9pt', fontWeight: 'normal' }}>({formatCodug(item.uge_code || item.ug)})</div>
                  )}
                </td>
                <td style={{ ...cellStyle, verticalAlign: 'middle' }}>{item.gnd}</td>
                <td style={{ ...cellStyle, verticalAlign: 'middle', fontWeight: 'bold' }}>{formatNumber(item.valor_num)}</td>
                <td style={{ ...cellStyle, textAlign: 'left', textTransform: 'uppercase', verticalAlign: 'middle' }}>{item.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5. FINALIDADE */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>FINALIDADE</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{dorData.finalidade}</td>
            </tr>
          </tbody>
        </table>

        {/* 6. MOTIVAÇÃO */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>MOTIVAÇÃO</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{dorData.motivacao}</td>
            </tr>
          </tbody>
        </table>

        {/* 7. CONSEQUÊNCIA */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>CONSEQUÊNCIA DO NÃO ATENDIMENTO</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>{dorData.consequencia}</td>
            </tr>
          </tbody>
        </table>

        {/* 8. OBSERVAÇÕES */}
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={headerCellStyle}>OBSERVAÇÕES GERAIS</td>
            </tr>
            <tr>
              <td style={{ ...cellStyle, textAlign: 'justify', whiteSpace: 'pre-wrap', fontSize: '10pt' }}>{dorData.observacoes}</td>
            </tr>
          </tbody>
        </table>

        {/* ASSINATURA */}
        <table style={{ ...tableStyle, minHeight: '150px' }}>
          <tbody>
            <tr>
              <td style={{ border: 'none', textAlign: 'center', paddingTop: '20px' }}>
                <p>{ptrabData.local_om || "Local não informado"}, {dataAtual}.</p>
              </td>
            </tr>
            <tr>
              <td style={{ border: 'none', textAlign: 'center', paddingBottom: '20px', paddingTop: '60px' }}>
                <p style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>{ptrabData.nome_cmt_om || "NOME DO ORDENADOR DE DESPESAS"}</p>
                <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PTrabDORReport;