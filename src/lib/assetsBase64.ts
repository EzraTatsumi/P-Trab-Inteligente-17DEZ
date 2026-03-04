"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCodug } from "@/lib/formatUtils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from "sonner";
import { exportDORToWord } from "@/lib/wordExportUtils";
import { LOGO_MD_BASE64 } from "@/lib/assetsBase64";

interface PTrabDORReportProps {
  ptrabData: any;
  dorData: any;
  selector?: React.ReactNode;
}

const PTrabDORReport: React.FC<PTrabDORReportProps> = ({ ptrabData, dorData, selector }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportWord = async () => {
    try {
      await exportDORToWord(ptrabData, dorData);
      toast.success("Documento Word gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar para Word:", error);
      toast.error("Falha ao gerar documento Word.");
    }
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        <Button onClick={handleExportWord} variant="outline">
          <FileText className="mr-2 h-4 w-4" /> Exportar Word
        </Button>
      </div>

      <div ref={reportRef} className="max-w-[210mm] mx-auto bg-white p-[20mm] shadow-lg text-black">
        {/* Cabeçalho com o Logo em Base64 */}
        <div className="border border-black grid grid-cols-[180px_1fr_200px] items-stretch">
          <div className="border-r border-black p-2 flex items-center justify-center">
            <img src={LOGO_MD_BASE64} alt="MD" className="max-h-20 w-auto" />
          </div>
          <div className="border-r border-black p-2 text-center font-bold uppercase text-sm flex flex-col justify-center">
            <p>Ministério da Defesa</p>
            <p>Exército Brasileiro</p>
            <p>{ptrabData.nome_om}</p>
          </div>
          <div className="p-2 text-center font-bold flex flex-col justify-center text-sm">
            <p>DOR nº {dorData.numero_dor || '___'}</p>
            <p>{dataAtual}</p>
          </div>
        </div>
        
        {/* Restante do conteúdo do seu relatório... */}
      </div>
    </div>
  );
};

export default PTrabDORReport;