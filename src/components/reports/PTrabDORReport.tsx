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
      const canvas = await html2canvas(reportRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1200,
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

  const bodyStyle = { 
    fontFamily: 'Calibri, Arial, sans-serif', 
    fontSize: '12pt', 
    color: 'black', 
    lineHeight: '1.2' 
  };
  
  const headerTitleStyle = { 
    backgroundColor: '#BFBFBF',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    padding: '2px 0',
  };

  return (
    <div className="space-y-6">
      {/* Barra de Ações Padronizada */}
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

      {/* Container do Relatório */}
      <div 
        ref={reportRef}
        className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-[15mm] text-black print:p-0"
        style={bodyStyle}
      >
        {/* Cabeçalho do Documento */}
        <div className="border-[1.5px] border-black flex items-stretch mb-4 min-h-[100px]">
          <div className="w-[180px] border-r border-black p-2 flex items-center justify-center">
            <img 
              src="/logo_md.png" 
              alt="MD" 
              className="max-h-20 w-auto object-contain"
              onError={(e: any) => e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Coat_of_arms_of_Brazil.svg/100px-Coat_of_arms_of_Brazil.svg.png"}
            />
          </div>
          <div className="flex-1 border-r border-black p-2 flex flex-col items-center justify-center text-center font-bold uppercase text-[11pt] leading-tight">
            <p>Ministério da Defesa</p>
            <p>Exército Brasileiro</p>
            <p>{ptrabData.comando_militar_area}</p>
            <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
          <div className="w-[200px] p-2 flex flex-col items-center justify-center text-center font-bold text-[11pt] leading-tight">
            <p>DOR nº {dorData.numero_dor || '___'} / {anoAtual}</p>
            <p className="mt-2">{new Date(dorData.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* DADOS DO ÓRGÃO REQUISITANTE */}
        <div className="border-[1.5px] border-black mb-4 overflow-hidden">
          <div className="border-b border-black" style={headerTitleStyle}>DADOS DO ÓRGÃO REQUISITANTE</div>
          
          <div className="border-b border-black py-0 px-2 font-bold">
            Órgão:
          </div>
          <div className="border-b border-black py-0 px-2">
            {ptrabData.nome_om_extenso || ptrabData.nome_om}
          </div>
          
          <div className="grid grid-cols-2 border-b border-black">
            <div className="py-0 px-2 border-r border-black font-bold">
              Responsável pela Demanda:
            </div>
            <div className="py-0 px-2"></div>
          </div>
          
          <div className="border-b border-black py-0 px-2">
            {ptrabData.nome_cmt_om || "Não informado"}
          </div>
          
          <div className="grid grid-cols-2">
            <div className="py-0 px-2 border-r border-black flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">E-mail:</span>
              <span>{dorData.email}</span>
            </div>
            <div className="py-0 px-2 flex items-center gap-1">
              <span className="font-bold whitespace-nowrap">Telefone:</span>
              <span>{dorData.telefone}</span>
            </div>
          </div>
        </div>

        {/* ANEXOS */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black" style={headerTitleStyle}>Anexos</div>
          <div className="py-0 px-2 text-center min-h-[1.2em]">{dorData.anexos}</div>
        </div>

        {/* AO / PO */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black py-0 px-2 flex items-center gap-2" style={headerTitleStyle}>
            <span className="font-bold shrink-0">Ação Orçamentária (AO):</span>
            <span className="font-normal">{dorData.acao_orcamentaria}</span>
          </div>
          <div className="py-0 px-2 flex items-center gap-2">
            <span className="font-bold shrink-0">Plano Orçamentário (PO):</span>
            <span className="font-normal">{dorData.plano_orcamentario}</span>
          </div>
        </div>

        {/* OBJETO DE REQUISIÇÃO */}
        <div className="border-[1.5px] border-black mb-4 overflow-hidden">
          <div className="border-b border-black" style={headerTitleStyle}>OBJETO DE REQUISIÇÃO</div>
          
          <div className="grid grid-cols-[120px_1fr] border-b border-black">
            <div className="py-0 px-2 border-r border-black font-bold flex items-center">
              Evento:
            </div>
            <div className="py-0 px-2">
              {dorData.evento}
            </div>
          </div>
          
          <div className="border-b border-black" style={headerTitleStyle}>DESCRIÇÃO DO ITEM (BEM E/OU SERVIÇO)</div>
          
          <div className="flex border-b border-black font-bold text-center text-[10pt]">
            <div className="w-[150px] border-r border-black p-1">UGE</div>
            <div className="w-[60px] border-r border-black p-1">GND</div>
            <div className="w-[120px] border-r border-black p-1">VALOR</div>
            <div className="flex-1 p-1">Descrição</div>
          </div>

          {dorData.itens_dor?.map((item: any, idx: number) => (
            <div key={idx} className={cn("flex text-[10pt] text-center min-h-[32px]", idx !== dorData.itens_dor.length - 1 && "border-b border-black")}>
              <div className="w-[150px] border-r border-black p-1 flex flex-col items-center justify-center leading-tight">
                <span className="font-bold">{item.uge_name || item.uge || "N/I"}</span>
                {(item.uge_code || item.ug) && (
                  <span className="text-[9pt]">({formatCodug(item.uge_code || item.ug)})</span>
                )}
              </div>
              <div className="w-[60px] border-r border-black p-1 flex items-center justify-center">{item.gnd}</div>
              <div className="w-[120px] border-r border-black p-1 flex items-center justify-center font-bold">{formatNumber(item.valor_num)}</div>
              <div className="flex-1 p-1 uppercase flex items-center justify-center text-center px-2 leading-tight">{item.descricao}</div>
            </div>
          ))}
        </div>

        {/* FINALIDADE */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black" style={headerTitleStyle}>FINALIDADE</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap leading-normal">{dorData.finalidade}</div>
        </div>

        {/* MOTIVAÇÃO */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black" style={headerTitleStyle}>MOTIVAÇÃO</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap leading-normal">{dorData.motivacao}</div>
        </div>

        {/* CONSEQUÊNCIA */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black" style={headerTitleStyle}>CONSEQUÊNCIA DO NÃO ATENDIMENTO</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap leading-normal">{dorData.consequencia}</div>
        </div>

        {/* OBSERVAÇÕES */}
        <div className="border-[1.5px] border-black mb-4">
          <div className="border-b border-black" style={headerTitleStyle}>OBSERVAÇÕES GERAIS</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap text-[10pt] leading-tight">{dorData.observacoes}</div>
        </div>

        {/* ASSINATURA */}
        <div className="mt-4 border-[1.5px] border-black p-1 flex flex-col items-center min-h-[150px] justify-between text-center">
          <div className="pt-1">
            <p>{ptrabData.local_om || "Local não informado"}, {dataAtual}.</p>
          </div>
          <div className="pb-2">
            <p className="font-bold uppercase">{ptrabData.nome_cmt_om || "NOME DO ORDENADOR DE DESPESAS"}</p>
            <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabDORReport;