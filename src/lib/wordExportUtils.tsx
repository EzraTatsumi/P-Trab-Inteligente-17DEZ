"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from "sonner";
import { LOGO_MD_BASE64 } from "@/lib/assetsBase64";

/** * DEFINIÇÃO DA FUNÇÃO QUE ESTAVA FALTANDO
 * Exportamos ela para que outros componentes possam usar se necessário.
 */
export const exportDORToWord = async (dorData: any, ptrabData: any) => {
  toast.info("A funcionalidade de Word está sendo preparada...");
  console.log("Dados para Word:", { dorData, ptrabData });
  // Aqui entraria a lógica da biblioteca 'docx' futuramente.
};

interface PTrabDORReportProps {
  ptrabData: any;
  dorData: any;
  selector?: React.ReactNode;
}

const PTrabDORReport: React.FC<PTrabDORReportProps> = ({ ptrabData, dorData, selector }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const dataAtual = new Date().toLocaleDateString('pt-BR');

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const loadingToast = toast.loading("Gerando PDF...");
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DOR_${ptrabData.om_nome || 'Relatorio'}.pdf`);
      toast.success("PDF gerado!", { id: loadingToast });
    } catch (e) {
      toast.error("Erro no PDF", { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        {selector}
        <Button onClick={handlePrint} variant="outline" size="sm"><Printer className="w-4 h-4 mr-2"/> Imprimir</Button>
        <Button onClick={handleExportPDF} variant="outline" size="sm"><Download className="w-4 h-4 mr-2"/> PDF</Button>
        <Button onClick={() => exportDORToWord(dorData, ptrabData)} variant="outline" size="sm"><FileText className="w-4 h-4 mr-2"/> Word</Button>
      </div>

      <div ref={reportRef} className="bg-white p-10 border shadow-sm mx-auto w-[210mm] text-black font-serif">
        <div className="flex flex-col items-center text-center mb-6">
          {/* A mágica acontece aqui: LOGO_MD_BASE64 agora é "/logo.png" */}
          <img 
            src={LOGO_MD_BASE64} 
            alt="Logo Oficial" 
            className="h-20 w-auto mb-2 object-contain"
            onError={(e) => console.error("Erro crítico: A imagem em /public/logo.png não foi encontrada!")}
          />
          <p className="font-bold uppercase text-xs">Ministério da Defesa</p>
          <p className="font-bold uppercase text-xs">{ptrabData.comando_superior || "Exército Brasileiro"}</p>
          <p className="font-bold uppercase text-xs">{ptrabData.om_nome || "Organização Militar"}</p>
        </div>

        <h2 className="text-center font-bold underline mb-8">DEMANDA DE OBJETOS E RECURSOS (DOR)</h2>
        
        <div className="border border-black mb-4">
          <div className="bg-gray-100 border-b border-black p-1 text-center font-bold text-xs uppercase">Motivação</div>
          <div className="p-2 text-sm text-justify min-h-[60px]">{dorData.motivacao}</div>
        </div>
        
        {/* Adicione outros campos conforme necessário */}
      </div>
    </div>
  );
};

export default PTrabDORReport;