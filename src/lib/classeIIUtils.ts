import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { getOmPreposition, formatFasesParaTexto } from "@/lib/classeIUtils"; // Importando utilitários de formatação

// Tipos necessários para a memória de cálculo
interface ItemClasseII {
  item: string;
  quantidade: number;
  valor_mnt_dia: number;
  categoria: string;
  memoria_customizada?: string | null;
}

interface ClasseIIRegistroBase {
  organizacao: string; // OM Detentora
  ug: string; // UG Detentora
  dias_operacao: number;
  categoria: string;
  itens_equipamentos: ItemClasseII[];
  fase_atividade?: string | null;
  valor_nd_30: number;
  valor_nd_39: number;
  efetivo: number;
}

/**
 * Gera a memória de cálculo detalhada para um registro de Classe II (Material de Intendência).
 * Esta função é genérica e pode ser usada para Classes V, VI, VII e VIII (Saúde/Remonta) também.
 */
export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistroBase): string => {
    const { 
        organizacao, ug, dias_operacao, categoria, itens_equipamentos, 
        fase_atividade, valor_nd_30, valor_nd_39, efetivo 
    } = registro;
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    const valorTotal = valor_nd_30 + valor_nd_39;
    
    const militarPlural = efetivo === 1 ? 'militar' : 'militares';
    const preposition = getOmPreposition(organizacao);

    // 1. Agrupar itens por categoria e calcular o subtotal de valor por categoria
    const gruposPorCategoria = itens_equipamentos.reduce((acc, item) => {
        const itemCategoria = item.categoria;
        const valorItem = item.quantidade * item.valor_mnt_dia * dias_operacao;
        
        if (!acc[itemCategoria]) {
            acc[itemCategoria] = {
                totalValor: 0,
                totalQuantidade: 0,
                detalhes: [],
            };
        }
        
        acc[itemCategoria].totalValor += valorItem;
        acc[itemCategoria].totalQuantidade += item.quantidade;
        
        // NOVO FORMATO DE FÓRMULA EXPLÍCITA
        acc[itemCategoria].detalhes.push(
            `- ${formatNumber(item.quantidade)} un. x ${formatCurrency(item.valor_mnt_dia)}/dia x ${formatNumber(dias_operacao)} dias = ${formatCurrency(valorItem)}.`
        );
        
        return acc;
    }, {} as Record<string, { totalValor: number, totalQuantidade: number, detalhes: string[] }>);

    let detalhamentoItens = "";
    let totalItensGeral = 0;
    
    // 2. Formatar a seção de cálculo agrupada
    Object.entries(gruposPorCategoria).forEach(([cat, grupo]) => {
        totalItensGeral += grupo.totalQuantidade;
        
        // Usamos o rótulo da categoria principal (Classe II) no cabeçalho, mas detalhamos por subcategoria se necessário.
        // Para Classe II, a categoria é a subcategoria (Equipamento Individual, etc.)
        detalhamentoItens += `\n--- ${cat.toUpperCase()} (${formatNumber(grupo.totalQuantidade)} ITENS) ---\n`;
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    // 3. Construir o cabeçalho adaptado da Classe I
    const header = `33.90.30 / 33.90.39 - Aquisição de Material de Intendência (${categoria}) para atender a manutenção de material de ${formatNumber(efetivo)} ${militarPlural} ${preposition} ${organizacao}, durante ${formatNumber(dias_operacao)} dias de ${faseFormatada}.
Recurso destinado à OM proprietária: ${organizacao} (UG: ${ug})

Alocação:
- ND 33.90.30 (Material): ${formatCurrency(valor_nd_30)}
- ND 33.90.39 (Serviço): ${formatCurrency(valor_nd_39)}

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;

    return header;
};