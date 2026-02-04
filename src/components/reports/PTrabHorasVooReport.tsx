import React, { useMemo, useRef } from 'react';
import { PTrabData, HorasVooRegistro, calculateDays, formatDate } from '@/pages/PTrabReportManager';
import { formatCurrency, formatNumber } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plane } from 'lucide-react';

interface PTrabHorasVooReportProps {
  ptrabData: PTrabData;
  omsOrdenadas: string[];
  gruposPorOM: Record<string, HorasVooRegistro[]>;
  fileSuffix: string;
}

const PTrabHorasVooReport: React.FC<PTrabHorasVooReportProps> = ({
  ptrabData,
  omsOrdenadas,
  gruposPorOM,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const registros = useMemo(() => omsOrdenadas.flatMap(om => gruposPorOM[om]), [omsOrdenadas, gruposPorOM]);

  const totalGeral = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_total, 0);
  }, [registros]);

  const totalND30 = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_nd_30, 0);
  }, [registros]);

  const totalND39 = useMemo(() => {
    return registros.reduce((acc, r) => acc + r.valor_nd_39, 0);
  }, [registros]);

  // Lógica para exibir "A CARGO DO COTER"
  const isACargoDoCoter = totalND30 === 0 && totalND39 === 0;
  const valorND30Display = isACargoDoCoter ? 'Será definido pelo COTER' : formatCurrency(totalND30);
  const valorND39Display = isACargoDoCoter ? 'Será definido pelo COTER' : formatCurrency(totalND39);
  const valorGND3Display = isACargoDoCoter ? 'Será definido pelo COTER' : formatCurrency(totalGeral);
  
  const numDias = useMemo(() => {
    return calculateDays(ptrabData.periodo_inicio, ptrabData.periodo_fim);
  }, [ptrabData.periodo_inicio, ptrabData.periodo_fim]);
  
  const dataAtual = useMemo(() => {
    // Usa a data de atualização do PTrab para consistência, formatada como "dd de mês de aaaa"
    const date = new Date(ptrabData.updated_at);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('pt-BR', options);
  }, [ptrabData.updated_at]);
  
  const localOM = ptrabData.local_om || 'Localidade-UF';
  const nomeCmtOM = ptrabData.nome_cmt_om || 'NOME DO COMANDANTE';
  const nomeOMExtenso = ptrabData.nome_om_extenso || ptrabData.nome_om;
  const comandoMilitarArea = ptrabData.comando_militar_area || 'COMANDO MILITAR DE ÁREA';
  
  // A OM Gestora para o relatório de HV é o valor completo do campo codug_destino
  const omUGDisplay = registros.length > 0 ? registros[0].codug_destino : 'N/A'; 

  const municipiosConsolidados = useMemo(() => {
    return registros.map(r => r.municipio).filter((v, i, a) => a.indexOf(v) === i).join('/');
  }, [registros]);

  const detalhamentoConsolidado = useMemo(() => {
    // Concatena todos os detalhamentos customizados ou detalhamentos padrão
    const detalhes = registros.map(r => {
      const detalhe = r.detalhamento_customizado || r.detalhamento || '';
      const ugDetentora = r.ug_detentora || r.ug;
      
      const tipoAnv = r.tipo_anv;
      const quantidadeHv = formatNumber(r.quantidade_hv, 2);
      
      // Se houver detalhamento customizado, usá-lo.
      if (detalhe.trim().length > 0) {
          return detalhe;
      }
      
      // Detalhamento padrão (se não houver customizado)
      return `ND 33.90.30 – Aquisição de Suprimento de Aviação, referente a ${quantidadeHv} HV na Anv ${tipoAnv} (UG: ${ugDetentora}).`;
    }).filter(d => d.trim().length > 0).join('\n\n');
    
    // Adiciona a nota sobre a diretriz de custeio (usando o texto exato do modelo)
    const notaDiretriz = "\n\nTudo conforme o DIEx nº 972-DMAvEx/COLOG, de 16 de dezembro de 2022, do Subcomandate Logístico versando sobre o valor da hora de voo para o ano de 2023. O valor foi convertido para REAIS utilizando-se da cotação do dólar (PTAX do DÓLAR).";
    
    return detalhes.trim().length > 0 ? detalhes + notaDiretriz : notaDiretriz;
  }, [registros]);

  return (
    <div className="min-h-screen bg-background">
      {/* Botões de Exportação/Impressão padronizados (fora do ref) */}
      {/* ... (omitted for brevity, assuming they are handled in PTrabReportManager) ... */}

      {/* Conteúdo do Relatório (para impressão) */}
      <div ref={contentRef} className="bg-white p-8 shadow-xl print:p-0 print:shadow-none" style={{ padding: '0.5cm' }}>
        
        {/* CABEÇALHO FORMAL - CORRIGIDO O ESPAÇAMENTO E O SUBLINHADO */}
        <div className="ptrab-header">
          <p className="text-[11pt] font-bold uppercase">Ministério da Defesa</p>
          <p className="text-[11pt] font-bold uppercase">Exército Brasileiro</p>
          <p className="text-[11pt] font-bold uppercase">{comandoMilitarArea.toUpperCase()}</p>
          <p className="text-[11pt] font-bold uppercase">{nomeOMExtenso.toUpperCase()}</p>
          
          {/* Título Principal */}
          <p className="text-[11pt] font-bold uppercase">
            PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS OPERAÇÃO {ptrabData.nome_operacao.toUpperCase()}
          </p>
          
          {/* Título do Relatório (Sublinhado e Contido) */}
          <div className="mx-auto w-fit">
            <p className="text-[11pt] font-bold uppercase underline">
              PLANO DE TRABALHO LOGÍSTICO - Hora de Voo
            </p>
          </div>
        </div>

        {/* INFORMAÇÕES DA OPERAÇÃO - CORRIGIDO O ESPAÇAMENTO */}
        <div className="ptrab-info">
          <p className="info-item"><span className="font-bold">1. NOME DA OPERAÇÃO:</span> {ptrabData.nome_operacao}</p>
          <p className="info-item"><span className="font-bold">2. PERÍODO:</span> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} - Nr Dias: {numDias}</p>
          <p className="info-item"><span className="font-bold">3. EFETIVO EMPREGADO:</span> {ptrabData.efetivo_empregado} militares do Exército Brasileiro</p>
          <p className="info-item"><span className="font-bold">4. AÇÕES:</span> {ptrabData.acoes}</p>
          <p className="info-item font-bold">5. DESPESAS OPERACIONAIS:</p>
        </div>

        {/* TABELA DE DESPESAS (CONSOLIDADA) */}
        <section className="mb-6 print:mb-4">
          <Table className="w-full border border-black print:border-black print:text-[9pt] [&_th]:p-1 [&_td]:p-1">
            <TableHeader>
              <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
                <TableHead rowSpan={2} className="w-[20%] border border-black text-center align-middle font-bold bg-[#E8E8E8] text-black">
                  DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)
                </TableHead>
                <TableHead rowSpan={2} className="w-[10%] border border-black text-center align-middle font-bold bg-[#E8E8E8] text-black">
                  OM (UGE)<br/>CODUG
                </TableHead>
                <TableHead rowSpan={2} className="w-[15%] border border-black text-center align-middle font-bold bg-[#E8E8E8] text-black">
                  MUNICÍPIO(S)/ LOCALIDADE(S)
                </TableHead>
                <TableHead colSpan={3} className="w-[20%] border border-black text-center font-bold bg-[#B4C7E7] text-black">
                  NATUREZA DE DESPESA
                </TableHead>
                <TableHead rowSpan={2} className="w-[35%] border border-black text-center align-middle font-bold bg-[#E8E8E8] text-black">
                  DETALHAMENTO / MEMÓRIA DE CÁLCULO<br/>
                  <span className="font-normal text-[8pt]">(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS)<br/><span className="font-bold underline">OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</span></span>
                </TableHead>
              </TableRow>
              <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black">
                  33.90.30
                </TableHead>
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black">
                  33.90.39
                </TableHead>
                <TableHead className="w-[6.6%] border border-black text-center font-bold bg-[#B4C7E7] text-black">
                  GND 3
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Linha de Dados Consolidada */}
              <TableRow className="h-auto">
                <TableCell className="border border-black text-left align-middle">
                  Horas de voo Anv Aviação do Exército
                </TableCell>
                <TableCell className="border border-black text-center align-middle">
                  {omUGDisplay}
                </TableCell>
                <TableCell className="border border-black text-center align-middle">
                  {municipiosConsolidados}
                </TableCell>
                <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] ${isACargoDoCoter ? 'text-[8pt] font-bold' : ''}`}>
                  {valorND30Display}
                </TableCell>
                <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] ${isACargoDoCoter ? 'text-[8pt] font-bold' : ''}`}>
                  {valorND39Display}
                </TableCell>
                <TableCell className={`border border-black text-center align-middle bg-[#B4C7E7] font-bold ${isACargoDoCoter ? 'text-[8pt]' : ''}`}>
                  {valorGND3Display}
                </TableCell>
                <TableCell className="border border-black align-middle whitespace-pre-wrap text-left text-[8pt]">
                  {detalhamentoConsolidado}
                </TableCell>
              </TableRow>
              
              {/* Linha de Total */}
              <TableRow className="h-auto font-bold bg-[#E8E8E8] print:bg-[#E8E8E8]">
                <TableCell colSpan={3} className="border border-black text-right">
                  VALOR TOTAL
                </TableCell>
                <TableCell className="border border-black text-center bg-[#B4C7E7]">
                  {formatCurrency(totalND30)}
                </TableCell>
                <TableCell className="border border-black text-center bg-[#B4C7E7]">
                  {formatCurrency(totalND39)}
                </TableCell>
                <TableCell className="border border-black text-center bg-[#E8E8E8]">
                  {formatCurrency(totalGeral)}
                </TableCell>
                <TableCell className="border border-black bg-[#E8E8E8]">
                  {/* Vazio */}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        {/* RODAPÉ */}
        <footer className="mt-12 print:mt-8 text-center">
          <p className="mb-12 print:mb-8">{localOM}, {dataAtual}.</p>
          
          <div className="mt-12 print:mt-8">
            <p className="font-bold">{nomeCmtOM.toUpperCase()}</p>
            <p className="border-t border-black inline-block pt-1">Comandante da {nomeOMExtenso}</p>
          </div>
        </footer>
      </div>
      
      {/* ESTILOS CSS INLINE PARA CONTROLE FINO DE IMPRESSÃO */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 0.5cm;
        }
        
        /* REGRAS DE ESTILO UNIFICADAS (TELA E IMPRESSÃO) */
        .ptrab-header { text-align: center; margin-bottom: 1.5rem; line-height: 1.4; }
        .ptrab-header p { font-size: 11pt; margin: 0; padding: 0; } /* ZERANDO MARGENS PADRÃO DO P */
        .ptrab-info { margin-bottom: 0.3rem; font-size: 10pt; line-height: 1.3; }
          .info-item { margin-bottom: 0.15rem; } /* Espaçamento mínimo entre itens */
        
        /* Estilos da Tabela */
        .ptrab-table { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; line-height: 1.1; }
        .ptrab-table th, .ptrab-table td { border: 1px solid #000; padding: 3px 4px; vertical-align: middle; font-size: 8pt; }
        .ptrab-table thead th { background-color: #E8E8E8; font-weight: bold; text-align: center; font-size: 9pt; }
        
        /* Cores específicas para Horas de Voo */
        .bg-\\[\\#B4C7E7\\] { background-color: #B4C7E7 !important; }
        .bg-\\[\\#E8E8E8\\] { background-color: #E8E8E8 !important; }

        /* REGRAS ESPECÍFICAS DE IMPRESSÃO */
        @media print {
          @page { size: landscape; margin: 0.5cm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
          
          /* Garante que as cores de fundo sejam impressas */
          .bg-\\[\\#B4C7E7\\], .bg-\\[\\#E8E8E8\\], .bg-gray-100 {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
};

export default PTrabHorasVooReport;