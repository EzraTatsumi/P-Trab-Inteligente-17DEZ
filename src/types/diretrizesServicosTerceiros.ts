import { Tables } from "@/integrations/supabase/types";

/**
 * Estrutura de um item de serviço dentro de uma Diretriz de Serviços de Terceiros.
 */
export interface ItemServico {
  id: string;
  codigo_catser: string;      // Código CATSER (equivalente ao CATMAT para serviços)
  descricao_item: string;     // Descrição completa do serviço
  nome_reduzido: string;      // Nome simplificado para exibição em relatórios
  unidade_medida: string;     // Unidade (ex: Mês, Hora, Posto, Unidade)
  valor_unitario: number;     // Valor de referência
  numero_pregao: string;      // Número do Pregão/ARP
  uasg: string;               // UASG do órgão gerenciador
}

/**
 * Estrutura da Diretriz de Serviços de Terceiros (Tabela diretrizes_servicos_terceiros).
 * O campo itens_aquisicao é armazenado como JSONB no banco, mas aqui o tipamos como ItemServico[].
 */
export interface DiretrizServicoTerceiro extends Omit<Tables<'diretrizes_servicos_terceiros'>, 'itens_aquisicao'> {
  itens_aquisicao: ItemServico[];
}