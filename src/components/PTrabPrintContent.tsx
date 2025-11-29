import React from "react";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PTrabData = Tables<'p_trab'>;
type ClasseIRegistro = Tables<'classe_i_registros'>;
type ClasseIIIRegistro = Tables<'classe_iii_registros'>;

interface ItemClasseII {
    item: string;
    quantidade: number;
    valor_mnt_dia: number;
    categoria: string;
}

interface ClasseIIRegistro extends Tables<'classe_ii_registros'> {
    detalhamento_customizado: string | null;
    itens_equipamentos: ItemClasseII[];
}

interface PTrabPrintContentProps {
  ptrabData: PTrabData;
  registrosClasseI: ClasseIRegistro[];
  registrosClasseII: ClasseIIRegistro[];
  registrosClasseIII: ClasseIIIRegistro[];
  totalGeral: number;
}

const formatDate = (dateString: string) => {
    try {
        return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
        return dateString;
    }
};

const formatDetalhamento = (detalhamento: string | null | undefined) => {
    if (!detalhamento) return "Não especificado.";
    // Substitui quebras de linha por <br/> para renderização HTML
    return detalhamento.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            <br />
        </React.Fragment>
    ));
};

export const PTrabPrintContent: React.FC<PTrabPrintContentProps> = ({
  ptrabData,
  registrosClasseI,
  registrosClasseII,
  registrosClasseIII,
  totalGeral,
}) => {
  
  // --- Consolidação de Totais ---
  const totalClasseI = registrosClasseI.reduce((sum, r) => sum + (r.total_qs || 0) + (r.total_qr || 0), 0);
  const totalClasseII = registrosClasseII.reduce((sum, r) => sum + (r.valor_total || 0), 0);
  const totalClasseIII = registrosClasseIII.reduce((sum, r) => sum + (r.valor_total || 0), 0);
  
  const totalClasseII_ND30 = registrosClasseII.reduce((sum, r) => sum + (r.valor_nd_30 || 0), 0);
  const totalClasseII_ND39 = registrosClasseII.reduce((sum, r) => sum + (r.valor_nd_39 || 0), 0);

  // --- Renderização ---
  return (
    <div className="p-8 bg-white text-gray-900 print:p-0 print:text-black print:text-[10pt] print:font-serif">
      
      {/* Cabeçalho */}
      <div className="text-center mb-8 print:mb-4">
        <h1 className="text-xl font-bold print:text-lg">PLANO DE TRABALHO (P-TRAB)</h1>
        <p className="text-lg font-semibold print:text-base">{ptrabData.numero_ptrab} - {ptrabData.nome_operacao}</p>
        <p className="text-sm print:text-xs">Referência: {ptrabData.comando_militar_area}</p>
      </div>

      {/* 1. Dados Básicos */}
      <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black">
        <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">1. IDENTIFICAÇÃO</h2>
        <div className="grid grid-cols-2 gap-x-4 text-sm print:text-xs">
          <p><strong>OM Responsável:</strong> {ptrabData.nome_om} (UG: {ptrabData.codug_om})</p>
          <p><strong>RM Vinculação:</strong> {ptrabData.rm_vinculacao} (UG: {ptrabData.codug_rm_vinculacao})</p>
          <p><strong>Período:</strong> {formatDate(ptrabData.periodo_inicio)} a {formatDate(ptrabData.periodo_fim)}</p>
          <p><strong>Efetivo Empregado:</strong> {ptrabData.efetivo_empregado}</p>
          <p className="col-span-2"><strong>Ações Previstas:</strong> {ptrabData.acoes}</p>
        </div>
      </section>

      {/* 2. Resumo de Custos */}
      <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black">
        <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">2. RESUMO DE CUSTOS</h2>
        <table className="w-full text-sm border-collapse print:text-xs">
          <thead>
            <tr className="bg-gray-100 print:bg-gray-200">
              <th className="text-left p-1 border border-gray-300 print:border-black">Classe</th>
              <th className="text-right p-1 border border-gray-300 print:border-black">Valor Total</th>
              <th className="text-left p-1 border border-gray-300 print:border-black">ND 33.90.30 (Material)</th>
              <th className="text-left p-1 border border-gray-300 print:border-black">ND 33.90.39 (Serviço)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1 border border-gray-300 print:border-black">I - Subsistência</td>
              <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseI)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseI)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(0)}</td>
            </tr>
            <tr>
              <td className="p-1 border border-gray-300 print:border-black">II - Intendência</td>
              <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseII)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseII_ND30)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseII_ND39)}</td>
            </tr>
            <tr>
              <td className="p-1 border border-gray-300 print:border-black">III - Combustível/Lubrificante</td>
              <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseIII)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(0)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseIII)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 font-bold print:bg-gray-300">
              <td className="p-1 border border-gray-300 print:border-black">TOTAL GERAL</td>
              <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(totalGeral)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseI + totalClasseII_ND30)}</td>
              <td className="p-1 border border-gray-300 print:border-black">{formatCurrency(totalClasseII_ND39 + totalClasseIII)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 3. Detalhamento Classe I */}
      {registrosClasseI.length > 0 && (
        <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black break-inside-avoid">
          <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">3. DETALHAMENTO CLASSE I (SUBSISTÊNCIA)</h2>
          <table className="w-full text-sm border-collapse print:text-xs">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-200">
                <th className="text-left p-1 border border-gray-300 print:border-black">OM Destino (QR)</th>
                <th className="text-center p-1 border border-gray-300 print:border-black">Efetivo</th>
                <th className="text-center p-1 border border-gray-300 print:border-black">Dias</th>
                <th className="text-right p-1 border border-gray-300 print:border-black">Total QS</th>
                <th className="text-right p-1 border border-gray-300 print:border-black">Total QR</th>
                <th className="text-right p-1 border border-gray-300 print:border-black">Total</th>
              </tr>
            </thead>
            <tbody>
              {registrosClasseI.map((r, index) => (
                <tr key={index}>
                  <td className="p-1 border border-gray-300 print:border-black">{r.organizacao} ({r.ug})</td>
                  <td className="text-center p-1 border border-gray-300 print:border-black">{r.efetivo}</td>
                  <td className="text-center p-1 border border-gray-300 print:border-black">{r.dias_operacao}</td>
                  <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(r.total_qs)}</td>
                  <td className="text-right p-1 border border-gray-300 print:border-black">{formatCurrency(r.total_qr)}</td>
                  <td className="text-right p-1 border border-gray-300 print:border-black font-semibold">{formatCurrency(r.total_qs + r.total_qr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 4. Detalhamento Classe II */}
      {registrosClasseII.length > 0 && (
        <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black break-inside-avoid">
          <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">4. DETALHAMENTO CLASSE II (INTENDÊNCIA)</h2>
          {registrosClasseII.map((r, index) => (
            <div key={index} className="mb-4 p-2 border border-gray-200 print:border-black print:text-xs break-inside-avoid">
              <p className="font-semibold mb-1">
                {r.categoria} - OM Destino: {r.organizacao} (UG: {r.ug})
              </p>
              <p className="text-xs mb-1">
                ND 30: {formatCurrency(r.valor_nd_30)} | ND 39: {formatCurrency(r.valor_nd_39)} | Total: {formatCurrency(r.valor_total)}
              </p>
              <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-1 border border-gray-200 print:bg-white print:border-gray-300">
                {formatDetalhamento(r.detalhamento_customizado || r.detalhamento)}
              </pre>
            </div>
          ))}
        </section>
      )}

      {/* 5. Detalhamento Classe III */}
      {registrosClasseIII.length > 0 && (
        <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black break-inside-avoid">
          <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">5. DETALHAMENTO CLASSE III (COMBUSTÍVEL/LUBRIFICANTE)</h2>
          {registrosClasseIII.map((r, index) => (
            <div key={index} className="mb-4 p-2 border border-gray-200 print:border-black print:text-xs break-inside-avoid">
              <p className="font-semibold mb-1">
                {r.tipo_equipamento} - {r.tipo_combustivel} - OM Destino: {r.organizacao} (UG: {r.ug})
              </p>
              <p className="text-xs mb-1">
                Valor Total: {formatCurrency(r.valor_total)}
              </p>
              <pre className="whitespace-pre-wrap text-xs bg-gray-50 p-1 border border-gray-200 print:bg-white print:border-gray-300">
                {formatDetalhamento(r.detalhamento_customizado || r.detalhamento)}
              </pre>
            </div>
          ))}
        </section>
      )}
      
      {/* Rodapé (Comentários) */}
      {ptrabData.comentario && (
        <section className="mb-6 border border-gray-300 p-4 print:p-2 print:border-black break-inside-avoid">
            <h2 className="font-bold text-base mb-2 border-b border-gray-300 print:border-black print:text-sm">6. COMENTÁRIOS</h2>
            <p className="text-sm whitespace-pre-wrap print:text-xs">{ptrabData.comentario}</p>
        </section>
      )}

      {/* Assinatura (Placeholder) */}
      <div className="mt-12 pt-8 border-t border-gray-300 text-center print:mt-6 print:pt-4 print:border-black print:text-xs">
        <p className="mb-12 print:mb-8">_________________________________________</p>
        <p>Nome do Comandante/Chefe/Diretor</p>
        <p>Comandante da {ptrabData.nome_om}</p>
      </div>
    </div>
  );
};