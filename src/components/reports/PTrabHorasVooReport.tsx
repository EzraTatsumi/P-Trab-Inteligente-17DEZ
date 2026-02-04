import React, { useMemo } from 'react';
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
  
  const omGestora = registros.length > 0 ? (registros[0].om_detentora || registros[0].organizacao) : ptrabData.nome_om;
  const ugGestora = registros.length > 0 ? (registros[0].ug_detentora || registros[0].ug) : ptrabData.codug_om;
  const omUGDisplay = `${omGestora}/COLOG Gestor (${ugGestora})`; // Ajustando para o formato do modelo

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
    
    return detalhamentoConsolidado.trim().length > 0 ? detalhamentoConsolidado + notaDiretriz : notaDiretriz;
  }, [registros]);

  return (
    <div className="p-6 space-y-8 print:p-0 print:space-y-0 print:text-[10pt] print:font-serif" id={`report-horas-voo-${ptrabData.id}`}>
      
      {/* CABEÇALHO FORMAL */}
      <header className="text-center mb-6 print:mb-4">
        <p className="font-bold">MINISTÉRIO DA DEFESA</p>
        <p className="font-bold">EXÉRCITO BRASILEIRO</p>
        <p className="font-bold">{comandoMilitarArea.toUpperCase()}</p>
        <p className="font-bold">{nomeOMExtenso.toUpperCase()}</p>
        <p className="font-bold mt-4">PLANO DE TRABALHO LOGÍSTICO DE SOLICITAÇÃO DE RECURSOS ORÇAMENTÁRIOS E FINANCEIROS</p>
        <p className="font-bold">OPERAÇÃO {ptrabData.nome_operacao.toUpperCase()}</p>
        <p className="font-bold mt-4 border-b border-black pb-1">PLANO DE TRABALHO LOGÍSTICO - Hora de Voo</p>
      </header>

      {/* INFORMAÇÕES DA OPERAÇÃO */}
      <section className="space-y-1 mb-6 print:mb-4">
        <p><strong>1. NOME DA OPERAÇÃO:</strong> {ptrabData.nome_operacao} - Apoio Logísitico</p>
        <p><strong>2. PERÍODO:</strong> de {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)} Nr Dias: {numDias}</p>
        <p><strong>3. EFETIVO EMPREGADO:</strong> {ptrabData.efetivo_empregado}</p>
        <p><strong>4. AÇÕES REALIZADAS OU A REALIZAR:</strong> {ptrabData.acoes}</p>
      </section>

      {/* TABELA DE DESPESAS (CONSOLIDADA) */}
      <section className="mb-6 print:mb-4">
        <p className="font-bold mb-1">5. DESPESAS OPERACIONAIS REALIZADAS OU A REALIZAR:</p>
        <Table className="w-full border border-black print:border-black print:text-[9pt] [&_th]:p-1 [&_td]:p-1">
          <TableHeader>
            <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
              <TableHead rowSpan={2} className="w-[20%] border border-black text-center align-top font-bold">
                DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)
              </TableHead>
              <TableHead rowSpan={2} className="w-[10%] border border-black text-center align-top font-bold">
                OM (UGE)
              </TableHead>
              <TableHead rowSpan={2} className="w-[15%] border border-black text-center align-top font-bold">
                MUNICÍPIO(S)/ LOCALIDADE(S)
              </TableHead>
              <TableHead colSpan={3} className="w-[20%] border border-black text-center font-bold">
                NATUREZA DE DESPESA
              </TableHead>
              <TableHead rowSpan={2} className="w-[35%] border border-black text-center align-top font-bold">
                DETALHAMENTO / MEMÓRIA DE CÁLCULO
                <br/>
                <span className="font-normal text-[8pt]">(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS) OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</span>
              </TableHead>
            </TableRow>
            <TableRow className="h-auto bg-gray-100 print:bg-gray-100">
              <TableHead className="w-[6.6%] border border-black text-center font-bold">
                33.90.30
              </TableHead>
              <TableHead className="w-[6.6%] border border-black text-center font-bold">
                33.90.39
              </TableHead>
              <TableHead className="w-[6.6%] border border-black text-center font-bold">
                GND 3
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Linha de Dados Consolidada */}
            <TableRow className="h-auto">
              <TableCell className="border border-black text-left align-top">
                Horas de voo Anv Aviação do Exército
              </TableCell>
              <TableCell className="border border-black text-center align-top">
                {omUGDisplay}
              </TableCell>
              <TableCell className="border border-black text-center align-top">
                {municipiosConsolidados}
              </TableCell>
              <TableCell className={`border border-black text-center align-top ${isACargoDoCoter ? 'text-[8pt] font-bold' : ''}`}>
                {valorND30Display}
              </TableCell>
              <TableCell className={`border border-black text-center align-top ${isACargoDoCoter ? 'text-[8pt] font-bold' : ''}`}>
                {valorND39Display}
              </TableCell>
              <TableCell className={`border border-black text-center align-top ${isACargoDoCoter ? 'text-[8pt] font-bold' : ''}`}>
                {valorGND3Display}
              </TableCell>
              <TableCell className="border border-black align-top whitespace-pre-wrap text-left text-[8pt]">
                {detalhamentoConsolidado}
              </TableCell>
            </TableRow>
            
            {/* Linha de Total */}
            <TableRow className="h-auto font-bold bg-gray-50 print:bg-gray-50">
              <TableCell colSpan={3} className="border border-black text-right">
                VALOR TOTAL
              </TableCell>
              <TableCell className="border border-black text-center">
                {formatCurrency(totalND30)}
              </TableCell>
              <TableCell className="border border-black text-center">
                {formatCurrency(totalND39)}
              </TableCell>
              <TableCell className="border border-black text-center">
                {formatCurrency(totalGeral)}
              </TableCell>
              <TableCell className="border border-black">
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
  );
};

export default PTrabHorasVooReport;