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

  const detalhamentoConsolidado = useMemo(() => {
    // Concatena todos os detalhamentos customizados ou detalhamentos padrão
    const detalhes = registros.map(r => {
      const detalhe = r.detalhamento_customizado || r.detalhamento || '';
      const omDetentora = r.om_detentora || r.organizacao;
      const ugDetentora = r.ug_detentora || r.ug;
      
      const tipoAnv = r.tipo_anv;
      const quantidadeHv = formatNumber(r.quantidade_hv, 2);
      const municipio = r.municipio;
      
      // Se houver detalhamento customizado, usá-lo.
      if (detalhe.trim().length > 0) {
          return detalhe;
      }
      
      // Detalhamento padrão (se não houver customizado)
      return `ND 33.90.30: Aquisição de Suprimento de Aviação, referente a ${quantidadeHv} HV na Anv ${tipoAnv} (UG: ${ugDetentora}). Localidade: ${municipio}.`;
    }).filter(d => d.trim().length > 0).join('\n\n');
    
    // Adiciona a nota sobre a diretriz de custeio
    const notaDiretriz = "\n\nTudo conforme a Diretriz de Custeio Logístico do COLOG e valores de hora de voo definidos pelo DMAvEx.";
    
    return detalhes + notaDiretriz;
  }, [registros]);

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
  
  const municipiosConsolidados = useMemo(() => {
    return registros.map(r => r.municipio).filter((v, i, a) => a.indexOf(v) === i).join('/');
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
        <Table className="w-full border border-black print:border-black print:text-[9pt]">
          <TableHeader>
            <TableRow className="h-auto">
              <TableHead rowSpan={2} className="w-[20%] border border-black text-center align-top p-1 font-bold bg-gray-100 print:bg-gray-100">
                DESPESAS (ORDENAR POR CLASSE DE SUBSISTÊNCIA)
              </TableHead>
              <TableHead rowSpan={2} className="w-[10%] border border-black text-center align-top p-1 font-bold bg-gray-100 print:bg-gray-100">
                OM (UGE)
              </TableHead>
              <TableHead rowSpan={2} className="w-[15%] border border-black text-center align-top p-1 font-bold bg-gray-100 print:bg-gray-100">
                MUNICÍPIO(S)/ LOCALIDADE(S)
              </TableHead>
              <TableHead colSpan={3} className="w-[20%] border border-black text-center p-1 font-bold bg-gray-100 print:bg-gray-100">
                NATUREZA DE DESPESA
              </TableHead>
              <TableHead rowSpan={2} className="w-[35%] border border-black text-center align-top p-1 font-bold bg-gray-100 print:bg-gray-100">
                DETALHAMENTO / MEMÓRIA DE CÁLCULO
                <br/>
                <span className="font-normal text-[8pt]">(DISCRIMINAR EFETIVOS, QUANTIDADES, VALORES UNITÁRIOS E TOTAIS) OBSERVAR A DIRETRIZ DE CUSTEIO LOGÍSTICO DO COLOG</span>
              </TableHead>
            </TableRow>
            <TableRow className="h-auto">
              <TableHead className="w-[6.6%] border border-black text-center p-1 font-bold bg-gray-100 print:bg-gray-100">
                33.90.30
              </TableHead>
              <TableHead className="w-[6.6%] border border-black text-center p-1 font-bold bg-gray-100 print:bg-gray-100">
                33.90.39
              </TableHead>
              <TableHead className="w-[6.6%] border border-black text-center p-1 font-bold bg-gray-100 print:bg-gray-100">
                GND 3
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Linha de Dados Consolidada */}
            <TableRow className="h-auto">
              <TableCell className="border border-black text-left align-top p-1">
                Horas de voo Anv Aviação do Exército
              </TableCell>
              <TableCell className="border border-black text-center align-top p-1">
                {ptrabData.nome_om} ({ptrabData.codug_om})
              </TableCell>
              <TableCell className="border border-black text-center align-top p-1">
                {municipiosConsolidados}
              </TableCell>
              <TableCell className="border border-black text-center align-top p-1">
                {formatCurrency(totalND30)}
              </TableCell>
              <TableCell className="border border-black text-center align-top p-1">
                {formatCurrency(totalND39)}
              </TableCell>
              <TableCell className="border border-black text-center align-top p-1">
                {formatCurrency(totalGeral)}
              </TableCell>
              <TableCell className="border border-black align-top p-1 whitespace-pre-wrap text-left text-[8pt]">
                {detalhamentoConsolidado}
              </TableCell>
            </TableRow>
            
            {/* Linha de Total */}
            <TableRow className="h-auto font-bold bg-gray-50 print:bg-gray-50">
              <TableCell colSpan={3} className="border border-black text-right p-1">
                VALOR TOTAL
              </TableCell>
              <TableCell className="border border-black text-center p-1">
                {formatCurrency(totalND30)}
              </TableCell>
              <TableCell className="border border-black text-center p-1">
                {formatCurrency(totalND39)}
              </TableCell>
              <TableCell className="border border-black text-center p-1">
                {formatCurrency(totalGeral)}
              </TableCell>
              <TableCell className="border border-black p-1">
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