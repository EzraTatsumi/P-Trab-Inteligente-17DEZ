import { formatCurrency, formatCodug, formatNumber } from "./formatUtils";
import { getClasseIIICategoryLabel } from "./classeIIIBadgeUtils";
import { RefLPC } from "@/types/refLPC";
import { Tables } from "@/integrations/supabase/types"; // Importar Tables

// Tipos necessários (copiados do formulário)
type TipoEquipamento = 'GERADOR' | 'EMBARCACAO' | 'EQUIPAMENTO_ENGENHARIA' | 'MOTOMECANIZACAO';
type CombustivelTipo = 'GASOLINA' | 'DIESEL';

// ... (ItemClasseIII interface)

// NOVO TIPO: Para exibição granular consolidada
interface GranularDisplayItem {
    om_destino: string;
    ug_destino: string;
    categoria: TipoEquipamento;
    suprimento_tipo: 'COMBUSTIVEL_GASOLINA' | 'COMBUSTIVEL_DIESEL' | 'LUBRIFICANTE';
    valor_total: number;
    total_litros: number;
    preco_litro: number;
    dias_operacao: number;
    fase_atividade: string;
    detailed_items: ItemClasseIII[];
    original_registro: Tables<'classe_iii_registros'>;
}

// Função auxiliar para pluralizar 'dia' ou 'dias'.
// ... (código restante)