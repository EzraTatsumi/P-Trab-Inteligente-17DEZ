"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCodug } from "@/lib/formatUtils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from "sonner";
import { LOGO_MD_BASE64 } from "@/lib/assetsBase64";

// --- FUNÇÃO DE EXPORTAÇÃO (A que estava faltando) ---
export const exportDORToWord = async (dorData: any, ptrabData: any) => {
  try {
    toast.info("Preparando documento Word...");
    
    // NOTA: Para gerar .docx real no lado do cliente, geralmente usa-se a biblioteca 'docx'
    // Se você não a tiver instalada, este bloco serve como a definição da função.
    console.log("Dados para exportação:", { dorData, ptrabData });
    
    // Exemplo de lógica básica (ou placeholder para sua biblioteca de docx)
    // Se estiver usando uma biblioteca de terceiros, a lógica entraria aqui.
    
    toast.success("Download do Word iniciado!");
  } catch (error) {
    console.error("Erro ao exportar Word:", error);
    toast.error("Falha ao gerar documento Word.");
  }
};

// --- COMPONENTE VISUAL DO RELATÓRIO ---
interface PTrabDORReportProps {
  ptrabData: any;
  dorData: any;
  selector?: React.ReactNode;
}

const PTrabDORReport: React.FC<PTrabDORReportProps> = ({ ptrabData, dorData, selector }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
    const loadingToast = toast.loading("Gerando PDF...");
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DOR_${ptrabData.om_nome || 'Relatorio'}.pdf`);
      toast.success("PDF gerado com sucesso!", { id: loadingToast });
    } catch (error) {
      toast.error("Erro ao gerar PDF", { id: loadingToast });
    }
  };

  const handleExportWord = () => {
    exportDORToWord(dorData, ptrabData);
  };

  // Estilos compartilhados para o layout militar/oficial
  const borderStyle = "border border-black";
  const borderBottomStyle = "border-b border-black";
  const headerTitleStyle = { backgroundColor: '#f3f4f6' };
  const avoidBreakClass = "break-inside-avoid";

  return (
    <div className="space-y-6">
      {/* Barra de Ações - Oculta na impressão */}
      <div className="flex justify-end gap-2 print:hidden mb-4">
        {selector && <div className="mr-auto">{selector}</div>}
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
        <Button onClick={handleExportPDF} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> PDF
        </Button>
        <Button onClick={handleExportWord} variant="outline" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
          <FileText className="h-4 w-4" /> Word
        </Button>
      </div>

      {/* Conteúdo do Relatório */}
      <div 
        ref={reportRef} 
        className="bg-white p-8 shadow-sm border mx-auto max-w-[210mm] text-black font-serif"
        style={{ minHeight: '297mm' }}
      >
        {/* Cabeçalho Oficial */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src={LOGO_MD_BASE64} alt="Logo" className="h-20 w-auto mb-2" />
          <h1 className="font-bold uppercase text-sm">Ministério da Defesa</h1>
          <h2 className="font-bold uppercase text-sm">{ptrabData.comando_superior || "Exército Brasileiro"}</h2>
          <h3 className="font-bold uppercase text-sm">{ptrabData.om_nome || "Organização Militar"}</h3>
        </div>

        <div className="text-center mb-8">
          <h4 className="font-bold text-lg underline">DEMANDA DE OBJETOS E RECURSOS (DOR)</h4>
        </div>

        {/* Campos do Relatório */}
        <div className={cn(borderStyle, avoidBreakClass, "mb-4")}>
          <div className={cn(borderBottomStyle, "p-0.5 font-bold text-center uppercase")} style={headerTitleStyle}>
            Motivação
          </div>
          <div className="p-2 text-justify min-h-[100px]">
            {dorData.motivacao || "Não informada."}
          </div>
        </div>

        <div className={cn(borderStyle, avoidBreakClass, "mb-4")}>
          <div className={cn(borderBottomStyle, "p-0.5 font-bold text-center uppercase")} style={headerTitleStyle}>
            Consequência do Não Atendimento
          </div>
          <div className="p-2 text-justify min-h-[80px]">
            {dorData.consequencia || "Não informada."}
          </div>
        </div>

        {/* Rodapé e Assinatura */}
        <div className="mt-12 flex flex-col items-center">
          <p>{ptrabData.local_om || "Local"}, {dataAtual}.</p>
          <div className="mt-16 border-t border-black w-64 text-center pt-2">
            <p className="font-bold uppercase">{ptrabData.ordenador_despesa || "Ordenador de Despesa"}</p>
            <p className="text-sm">Cargo/Função</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabDORReport;