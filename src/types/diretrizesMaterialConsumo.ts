import { Tables } from "@/integrations/supabase/types";

// 1. ItemAquisicao: Represents a single item imported from PNCP/ARP, stored inside itens_aquisicao JSONB array.
export interface ItemAquisicao {
    id: string; // Unique ID (e.g., PNCP control + item number)
    codigo_catmat: string;
    descricao_item: string; // Full description
    descricao_reduzida: string | null; // Short description from catalogo_catmat
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    
    // Fields added during form processing:
    quantidade: number; // Quantity requested for this item
    valor_total: number; // valor_unitario * quantidade
    nd: '33.90.30' | '33.90.39'; // Natureza da Despesa (inferred from item type/context)
    
    // Fields injected from the parent Diretriz (used in AcquisitionGroupForm)
    nr_subitem: string;
    nome_subitem: string;
}

// 2. DiretrizMaterialConsumo: Represents a row in the 'diretrizes_material_consumo' table, with typed JSONB field.
export interface DiretrizMaterialConsumo extends Omit<Tables<'diretrizes_material_consumo'>, 'itens_aquisicao'> {
    itens_aquisicao: ItemAquisicao[];
}

// 3. StagingRow: Represents a row read from the Excel file during import, used for validation staging.
export interface StagingRow {
    // Fields for Diretriz (Subitem ND)
    nr_subitem: string;
    nome_subitem: string;
    descricao_subitem: string | null;
    
    // Fields for ItemAquisicao (Acquisition Item)
    item_id: string; // Unique ID for the item (PNCP control + item number)
    codigo_catmat: string;
    descricao_item: string;
    descricao_reduzida: string | null;
    valor_unitario: number;
    numero_pregao: string;
    uasg: string;
    nd: '33.90.30' | '33.90.39';
    
    // Status/Validation fields
    status: 'ok' | 'error' | 'warning';
    message: string;
}