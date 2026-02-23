"use client";

import React from 'react';
import { 
  PTrabOperacionalReportProps, 
  formatCurrency, 
  formatDate, 
  calculateDays,
  getTipoCombustivelLabel
} from "@/pages/PTrabReportManager";

const PTrabOperacionalReport: React.FC<PTrabOperacionalReportProps> = ({
  ptrabData,
  omsOrdenadas,
  gruposPorOM,
  fileSuffix,
  generateDiariaMemoriaCalculo,
  generateVerbaOperacionalMemoriaCalculo,
  generateSuprimentoFundosMemoriaCalculo,
  generatePassagemMemoriaCalculo,
  generateConcessionariaMemoriaCalculo,
  generateMaterialConsumoMemoriaCalculo,
  generateComplementoMemoriaCalculo,
  generateServicoMemoriaCalculo,
  diretrizesOperacionais
}) => {
  
  const calcularTotalGeral = () => {
    let total = 0;
    Object.values(gruposPorOM).forEach(grupo => {
      total += grupo.diarias.reduce((acc, r) => acc + (r.valor_total || 0), 0);
      total += grupo.verbaOperacional.reduce((acc, r) => acc + (r.valor_total_solicitado || 0), 0);
      total += grupo.suprimentoFundos.reduce((acc, r) => acc + (r.valor_total_solicitado || 0), 0);
      total += grupo.passagens.reduce((acc, r) => acc + (r.valor_total || 0), 0);
      total += grupo.concessionarias.reduce((acc, r) => acc + (r.valor_total || 0), 0);
      total += grupo.materialConsumo.reduce((acc, r) => acc + (r.valor_total || 0), 0);
      total += grupo.complementoAlimentacao.reduce((acc, item) => acc + (item.registro.valor_total || 0), 0);
      total += grupo.servicosTerceiros.reduce((acc, r) => acc + (r.valor_total || 0), 0);
    });
    return total;
  };

  return (
    <div className="bg-white p-8 shadow-lg border border-gray-200 min-h-[29.7cm] w-full max-w-[21cm] mx-auto text-black font-serif text-[11pt] leading-tight print:shadow-none print:border-0">
      {/* Cabeçalho Padrão */}
      <div className="text-center mb-6 uppercase font-bold">
        <p>MINISTÉRIO DA DEFESA</p>
        <p>EXÉRCITO BRASILEIRO</p>
        <p>{ptrabData.comando_militar_area}</p>
        <p>{ptrabData.nome_om_extenso || ptrabData.nome_om}</p>
        <div className="mt-4 border-y border-black py-2">
          <p>PLANO DE TRABALHO OPERACIONAL - {ptrabData.numero_ptrab}</p>
          <p>OPERAÇÃO: {ptrabData.nome_operacao}</p>
        </div>
      </div>

      {/* Tabela de Custos por OM */}
      {omsOrdenadas.map((omNome, index) => {
        const grupo = gruposPorOM[omNome];
        const hasData = grupo.diarias.length > 0 || 
                        grupo.verbaOperacional.length > 0 || 
                        grupo.suprimentoFundos.length > 0 || 
                        grupo.passagens.length > 0 ||
                        grupo.concessionarias.length > 0 ||
                        grupo.materialConsumo.length > 0 ||
                        grupo.complementoAlimentacao.length > 0 ||
                        grupo.servicosTerceiros.length > 0;

        if (!hasData) return null;

        return (
          <div key={omNome} className="mb-8 break-inside-avoid">
            <h3 className="font-bold border-b border-black mb-2">
              {index + 1}. {omNome}
            </h3>
            
            <table className="w-full border-collapse border border-black mb-4 text-[10pt]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-1 text-left">Descrição do Item / Natureza de Despesa</th>
                  <th className="border border-black p-1 text-center w-24">GND</th>
                  <th className="border border-black p-1 text-right w-32">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {/* Diárias */}
                {grupo.diarias.map((r, i) => (
                  <tr key={`diaria-${i}`}>
                    <td className="border border-black p-1">Diárias Militares (Nacional) - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total)}</td>
                  </tr>
                ))}

                {/* Passagens */}
                {grupo.passagens.map((r, i) => (
                  <tr key={`passagem-${i}`}>
                    <td className="border border-black p-1">Passagens e Despesas com Locomoção - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total)}</td>
                  </tr>
                ))}

                {/* Material de Consumo (ADICIONADO) */}
                {grupo.materialConsumo.map((r, i) => (
                  <tr key={`mat-${i}`}>
                    <td className="border border-black p-1">{r.group_name || 'Material de Consumo'} - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total)}</td>
                  </tr>
                ))}

                {/* Verba Operacional */}
                {grupo.verbaOperacional.map((r, i) => (
                  <tr key={`verba-${i}`}>
                    <td className="border border-black p-1">Verba Operacional - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total_solicitado)}</td>
                  </tr>
                ))}

                {/* Suprimento de Fundos */}
                {grupo.suprimentoFundos.map((r, i) => (
                  <tr key={`suprimento-${i}`}>
                    <td className="border border-black p-1">Suprimento de Fundos - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total_solicitado)}</td>
                  </tr>
                ))}

                {/* Concessionárias */}
                {grupo.concessionarias.map((r, i) => (
                  <tr key={`conc-${i}`}>
                    <td className="border border-black p-1">Serviços de Utilidade Pública (Concessionárias) - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total)}</td>
                  </tr>
                ))}

                {/* Complemento de Alimentação */}
                {grupo.complementoAlimentacao.map((item, i) => (
                  <tr key={`comp-${i}`}>
                    <td className="border border-black p-1">
                      {item.registro.categoria_complemento === 'genero' 
                        ? `Complemento de Alimentação (Gêneros - ${item.subType})` 
                        : `Complemento de Alimentação (${item.registro.categoria_complemento === 'agua' ? 'Água Mineral' : 'Lanche'})`}
                      {` - ${item.registro.fase_atividade}`}
                    </td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(item.registro.valor_total)}</td>
                  </tr>
                ))}

                {/* Serviços de Terceiros */}
                {grupo.servicosTerceiros.map((r, i) => (
                  <tr key={`serv-${i}`}>
                    <td className="border border-black p-1">Outros Serviços de Terceiros - {r.fase_atividade}</td>
                    <td className="border border-black p-1 text-center">3</td>
                    <td className="border border-black p-1 text-right">{formatCurrency(r.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Memórias de Cálculo da OM */}
            <div className="mt-4 space-y-4 text-[9pt] italic text-gray-700">
              <p className="font-bold not-italic text-black underline">Memórias de Cálculo - {omNome}:</p>
              
              {grupo.diarias.map((r, i) => (
                <div key={`mem-diaria-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateDiariaMemoriaCalculo(r, diretrizesOperacionais)}
                </div>
              ))}

              {grupo.passagens.map((r, i) => (
                <div key={`mem-passagem-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generatePassagemMemoriaCalculo(r)}
                </div>
              ))}

              {/* Memória de Material de Consumo (ADICIONADO) */}
              {grupo.materialConsumo.map((r, i) => (
                <div key={`mem-mat-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateMaterialConsumoMemoriaCalculo(r)}
                </div>
              ))}

              {grupo.verbaOperacional.map((r, i) => (
                <div key={`mem-verba-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateVerbaOperacionalMemoriaCalculo(r)}
                </div>
              ))}

              {grupo.suprimentoFundos.map((r, i) => (
                <div key={`mem-suprimento-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateSuprimentoFundosMemoriaCalculo(r)}
                </div>
              ))}

              {grupo.concessionarias.map((r, i) => (
                <div key={`mem-conc-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateConcessionariaMemoriaCalculo(r)}
                </div>
              ))}

              {grupo.complementoAlimentacao.map((item, i) => (
                <div key={`mem-comp-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateComplementoMemoriaCalculo(item.registro, item.subType)}
                </div>
              ))}

              {grupo.servicosTerceiros.map((r, i) => (
                <div key={`mem-serv-${i}`} className="whitespace-pre-wrap border-l-2 border-gray-300 pl-2">
                  {generateServicoMemoriaCalculo(r)}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Total Geral do Relatório */}
      <div className="mt-8 border-t-2 border-black pt-2 flex justify-between font-bold text-[12pt]">
        <span>TOTAL GERAL DO PLANO OPERACIONAL:</span>
        <span>{formatCurrency(calcularTotalGeral())}</span>
      </div>

      {/* Assinaturas */}
      <div className="mt-16 grid grid-cols-2 gap-8 text-center uppercase text-[10pt]">
        <div>
          <div className="border-t border-black pt-1">
            <p>{ptrabData.nome_cmt_om || "Comandante da OM"}</p>
            <p>Ordenador de Despesas</p>
          </div>
        </div>
        <div>
          <div className="border-t border-black pt-1">
            <p>S-4 / Fiscal Administrativo</p>
            <p>Elaborador do P Trab</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PTrabOperacionalReport;