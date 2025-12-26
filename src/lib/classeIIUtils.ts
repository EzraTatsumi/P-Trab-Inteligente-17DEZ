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
 * Helper function to get the label for Classe II/V/VI/VII/VIII/IX categories
 */
export const getClasseIILabel = (category: string): string => {
    switch (category) {
        case 'Vtr Administrativa': return 'Viatura Administrativa';
        case 'Vtr Operacional': return 'Viatura Operacional';
        case 'Motocicleta': return 'Motocicleta';
        case 'Vtr Blindada': return 'Viatura Blindada';
        case 'Equipamento Individual': return 'Eqp Individual';
        case 'Proteção Balística': return 'Prot Balística';
        case 'Material de Estacionamento': return 'Mat Estacionamento';
        case 'Armt L': return 'Armamento Leve';
        case 'Armt P': return 'Armamento Pesado';
        case 'IODCT': return 'IODCT';
        case 'DQBRN': return 'DQBRN';
        case 'Embarcação': return 'Embarcação';
        case 'Equipamento de Engenharia': return 'Eqp Engenharia';
        case 'Comunicações': return 'Comunicações';
        case 'Informática': return 'Informática';
        case 'Saúde': return 'Saúde';
        case 'Remonta/Veterinária': return 'Remonta/Veterinária';
        default: return category;
    }
};

/**
 * Gera a memória de cálculo detalhada para um registro de Classe II (Material de Intendência).
 * Esta função é genérica e pode ser usada para Classes V, VI, VII e VIII (Saúde/Remonta) também.
 */
export const generateClasseIIMemoriaCalculo = (registro: ClasseIIRegistroBase): string => {
    const { 
        organizacao, dias_operacao, categoria, itens_equipamentos, 
        fase_atividade, valor_nd_30, valor_nd_39, efetivo 
    } = registro;
    
    const faseFormatada = formatFasesParaTexto(fase_atividade);
    const valorTotal = valor_nd_30 + valor_nd_39;
    
    const militarPlural = efetivo === 1 ? 'militar' : 'militares';
    const preposition = getOmPreposition(organizacao);

    // 1. Determinar a ND de acordo com a alocação
    let ndHeader = "";
    if (valor_nd_30 > 0 && valor_nd_39 > 0) {
        ndHeader = "33.90.30 / 33.90.39";
    } else if (valor_nd_30 > 0) {
        ndHeader = "33.90.30";
    } else if (valor_nd_39 > 0) {
        ndHeader = "33.90.39";
    } else {
        ndHeader = "ND Não Alocada";
    }

    // 2. Agrupar itens por categoria e calcular o subtotal de valor por categoria
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
    
    // 3. Formatar a seção de cálculo agrupada
    Object.entries(gruposPorCategoria).forEach(([cat, grupo]) => {
        // Usar getClasseIILabel para garantir o rótulo correto (ex: Eqp Individual)
        detalhamentoItens += `\n--- ${getClasseIILabel(cat).toUpperCase()} (${formatNumber(grupo.totalQuantidade)} ITENS) ---\n`; 
        detalhamentoItens += `Valor Total Categoria: ${formatCurrency(grupo.totalValor)}\n`;
        detalhamentoItens += `Detalhes:\n`;
        detalhamentoItens += grupo.detalhes.join('\n');
        detalhamentoItens += `\n`;
    });
    
    detalhamentoItens = detalhamentoItens.trim();

    // 4. Construir o cabeçalho com a nova frase (REMOVIDAS AS LINHAS DE RECURSO E ALOCAÇÃO)
    const header = `${ndHeader} - Manutenção dos componentes do ${getClasseIILabel(categoria)} de ${formatNumber(efetivo)} ${militarPlural} ${preposition} ${organizacao}, durante ${formatNumber(dias_operacao)} dias de ${faseFormatada}.

Cálculo:
Fórmula Base: Nr Itens x Valor Mnt/Dia x Nr Dias de Operação.

${detalhamentoItens}

Valor Total: ${formatCurrency(valorTotal)}.`;

    return header;
};