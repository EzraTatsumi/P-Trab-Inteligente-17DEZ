import { DetailedArpItem } from "./pncp";
import { ItemAquisicao } from "./diretrizesMaterialConsumo";

/**
 * Status de validação de um item PNCP.
 */
export type InspectionStatus = 'pending' | 'valid' | 'needs_catmat_info' | 'duplicate';

/**
 * Estrutura de um item durante a fase de inspeção.
 * Contém o item PNCP original, o formato final desejado (ItemAquisicao) e o status de validação.
 */
export interface InspectionItem {
    // Dados originais do PNCP
    originalPncpItem: DetailedArpItem;
    
    // Dados mapeados para o formato final (ItemAquisicao)
    mappedItem: ItemAquisicao;
    
    // Status da inspeção
    status: InspectionStatus;
    
    // Mensagens de erro/aviso
    messages: string[];
    
    // Campo para o usuário preencher se o status for 'needs_catmat_info'
    userShortDescription: string;
    
    // NOVO: Descrição completa do item obtida do catálogo PNCP (4_consultarItemMaterial)
    fullPncpDescription: string;
    
    // NOVO: Nome do PDM (Padrão de Material)
    nomePdm: string | null;
}