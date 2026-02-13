import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";

export interface ServicoTerceiroRegistro {
  id: string;
  p_trab_id: string;
  organizacao: string;
  ug: string;
  om_detentora: string;
  ug_detentora: string;
  dias_operacao: number;
  efetivo: number;
  fase_atividade: string | null;
  categoria: string;
  detalhes_planejamento: {
    itens_selecionados: ItemAquisicaoServico[];
  };
  valor_total: number;
  valor_nd_30: number;
  valor_nd_39: number;
  detalhamento_customizado: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Calcula os totais de um lote de serviços baseado nos itens selecionados.
 */
export const calculateServicoTotals = (itens: ItemAquisicaoServico[]) => {
  let totalGeral = 0;
  let totalND30 = 0;
  let totalND39 = 0;

  itens.forEach(item => {
    const vlrTotal = (item.quantidade || 0) * (item.valor_unitario || 0);
    totalGeral += vlrTotal;
    if (item.nd === '30') {
      totalND30 += vlrTotal;
    } else {
      totalND39 += vlrTotal;
    }
  });

  return { totalGeral, totalND30, totalND39 };
};

/**
 * Gera o texto da memória de cálculo para serviços de terceiros.
 */
export const generateServicoMemoriaCalculo = (registro: ServicoTerceiroRegistro, ptrabData: any) => {
  const itens = registro.detalhes_planejamento.itens_selecionados || [];
  
  let texto = `MEMÓRIA DE CÁLCULO - SERVIÇOS DE TERCEIROS / LOCAÇÕES\n`;
  texto += `--------------------------------------------------\n`;
  texto += `OM Favorecida: ${registro.organizacao} (${registro.ug})\n`;
  texto += `Categoria: ${registro.categoria.replace('-', ' ').toUpperCase()}\n`;
  texto += `Fase: ${registro.fase_atividade || 'Não informada'}\n`;
  texto += `Período: ${registro.dias_operacao} dia(s)\n`;
  texto += `Efetivo: ${registro.efetivo} militar(es)\n\n`;
  
  texto += `ITENS PLANEJADOS:\n`;
  itens.forEach((item, index) => {
    const totalItem = (item.quantidade || 0) * (item.valor_unitario || 0);
    texto += `${index + 1}. ${item.descricao_item}\n`;
    texto += `   Qtd: ${item.quantidade} | Vlr Unit: R$ ${item.valor_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Total: R$ ${totalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    texto += `   ND: 33.90.${item.nd} | Pregão: ${item.numero_pregao || 'N/A'}\n`;
  });
  
  texto += `\n--------------------------------------------------\n`;
  texto += `VALOR TOTAL DO REGISTRO: R$ ${registro.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
  
  return texto;
};