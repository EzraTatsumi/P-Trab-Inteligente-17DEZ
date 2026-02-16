"use client";

import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Printer, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatCodug } from "@/lib/formatUtils";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PTrabDORReportProps {
  ptrabData: any;
  dorData: any;
}

const PTrabDORReport: React.FC<PTrabDORReportProps> = ({ ptrabData, dorData }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    
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
    pdf.save(`DOR_${dorData.numero_dor || 'SN'}_${ptrabData.nome_om}.pdf`);
  };

  const dataAtual = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const anoAtual = new Date().getFullYear();

  const bodyStyle = { fontFamily: 'Calibri, sans-serif', fontSize: '12pt', color: 'black', lineHeight: '1.2' };
  const headerTitleStyle = { backgroundColor: '#BFBFBF' };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Download className="h-4 w-4 mr-2" /> Exportar PDF
        </Button>
      </div>

      <div 
        ref={reportRef}
        className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none p-[20mm] text-black print:p-0"
        style={bodyStyle}
      >
        {/* Cabeçalho do Documento */}
        <div className="border border-black grid grid-cols-[180px_1fr_200px] items-stretch mb-4">
          <div className="border-r border-black p-1 flex items-center justify-center text-center">
            <img 
              src="/logo_md.png" 
              alt="MD" 
              className="max-h-20 w-auto"
              onError={(e: any) => e.target.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Coat_of_arms_of_Brazil.svg/100px-Coat_of_arms_of_Brazil.svg.png"}
            />
          </div>
          <div className="border-r border-black p-1 flex flex-col items-center justify-center text-center font-bold uppercase text-[11pt]">
            <p>Ministério da Defesa</p>
            <p>Exército Brasileiro</p>
            <p>{ptrabData.comando_militar_area}</p>
            <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
          <div className="p-1 flex flex-col items-center justify-center text-center font-bold text-[11pt]">
            <p>DOR nº {dorData.numero_dor || '___'} / {anoAtual}</p>
            <p className="mt-2">{new Date(dorData.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Seções do DOR */}
        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>
            DADOS DO ÓRGÃO REQUISITANTE
          </div>
          <div className="border-b border-black py-0 px-2 font-bold">Órgão:</div>
          <div className="border-b border-black py-0 px-2">{ptrabData.nome_om_extenso || ptrabData.nome_om}</div>
          <div className="border-b border-black py-0 px-2 font-bold">Responsável pela Demanda:</div>
          <div className="border-b border-black py-0 px-2">{ptrabData.nome_cmt_om || "Não informado"}</div>
          <div className="grid grid-cols-2">
            <div className="py-0 px-2 border-r border-black"><b>E-mail:</b> {dorData.email}</div>
            <div className="py-0 px-2"><b>Telefone:</b> {dorData.telefone}</div>
          </div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>Anexos</div>
          <div className="py-0 px-2 text-center">{dorData.anexos}</div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black py-0 px-2" style={headerTitleStyle}><b>Ação Orçamentária (AO):</b> {dorData.acao_orcamentaria}</div>
          <div className="py-0 px-2"><b>Plano Orçamentário (PO):</b> {dorData.plano_orcamentario}</div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>OBJETO DE REQUISIÇÃO</div>
          <div className="py-0 px-2"><b>Evento:</b> {dorData.evento}</div>
          <div className="border-t border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>DESCRIÇÃO DO ITEM</div>
          
          <div className="grid grid-cols-[130px_50px_110px_1fr] border-b border-black font-bold text-center text-[10pt]">
            <div className="border-r border-black py-0 px-1">UGE</div>
            <div className="border-r border-black py-0 px-1">GND</div>
            <div className="border-r border-black py-0 px-1">VALOR</div>
            <div className="py-0 px-1">Descrição</div>
          </div>

          {dorData.itens_dor?.map((item: any, idx: number) => (
            <div key={idx} className={cn("grid grid-cols-[130px_50px_110px_1fr] text-[10pt] text-center", idx !== dorData.itens_dor.length - 1 && "border-b border-black")}>
              <div className="border-r border-black py-0 px-1">{item.uge_name} ({formatCodug(item.uge_code)})</div>
              <div className="border-r border-black py-0 px-1">{item.gnd}</div>
              <div className="border-r border-black py-0 px-1">{formatNumber(item.valor_num)}</div>
              <div className="py-0 px-1 uppercase">{item.descricao}</div>
            </div>
          ))}
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>FINALIDADE</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap">{dorData.finalidade}</div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>MOTIVAÇÃO</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap">{dorData.motivacao}</div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>CONSEQUÊNCIA DO NÃO ATENDIMENTO</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap">{dorData.consequencia}</div>
        </div>

        <div className="border border-black mb-4">
          <div className="border-b border-black p-0.5 font-bold text-center uppercase" style={headerTitleStyle}>OBSERVAÇÕES GERAIS</div>
          <div className="p-1 px-2 text-justify whitespace-pre-wrap">{dorData.observacoes}</div>
        </div>

        <div className="mt-8 flex flex-col items-center text-center">
          <p>{ptrabData.local_om}, {dataAtual}.</p>
          <div className="mt-12">
            <p className="font-bold uppercase">{ptrabData.nome_cmt_om}</p>
            <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabDORReport;