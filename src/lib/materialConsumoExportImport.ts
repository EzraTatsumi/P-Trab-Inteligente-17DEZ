import { DiretrizMaterialConsumo, ItemAquisicao, ItemAquisicaoTemplate, StagingRow } from "@/types/diretrizesMaterialConsumo";
import { supabase } from "@/integrations/supabase/client";
import { TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { parseInputToNumber } from "./formatUtils";
import { toast } from "sonner";

// =================================================================
// EXPORTAÇÃO
// =================================================================

/**
 * Gera o conteúdo CSV/TSV para exportação das diretrizes de Material de Consumo.
 * @param diretrizes A lista de diretrizes a serem exportadas.
 * @returns O conteúdo do arquivo como string.
 */
export function generateMaterialConsumoExport(diretrizes: DiretrizMaterialConsumo[]): string {
    const separator = '\t'; // Usando TSV para evitar problemas com vírgulas em descrições
    
    const headers = [
        "nr_subitem",
        "nome_subitem",
        "descricao_subitem",
        "codigo_catmat",
        "descricao_item",
        "descricao_reduzida",
        "valor_unitario",
        "numero_pregao",
        "uasg",
        "nd",
    ];
    
    let content = headers.join(separator) + '\n';
    
    diretrizes.forEach(diretriz => {
        // A diretriz armazena ItemAquisicaoTemplate[]
        (diretriz.itens_aquisicao || []).forEach(item => {
            const row = [
                diretriz.nr_subitem,
                diretriz.nome_subitem,
                diretriz.descricao_subitem || '',
                item.codigo_catmat,
                item.descricao_item.replace(/"/g, '""'), // Escape quotes
                item.descricao_reduzida.replace(/"/g, '""'), // Escape quotes
                item.valor_unitario.toFixed(2).replace('.', ','), // Formato brasileiro para importação
                item.numero_pregao || '',
                item.uasg || '',
                item.nd,
            ];
            content += row.join(separator) + '\n';
        });
    });
    
    return content;
}

// =================================================================
// IMPORTAÇÃO (VALIDAÇÃO E AGRUPAMENTO)
// =================================================================

/**
 * Valida e agrupa as linhas de staging em objetos DiretrizMaterialConsumo.
 * @param fileContent O conteúdo do arquivo CSV/TSV.
 * @param year O ano de referência.
 * @param userId O ID do usuário.
 * @param existingItems Todos os ItemAquisicao existentes do usuário para o ano (para checagem de duplicidade).
 * @returns Um objeto contendo as diretrizes agrupadas, as linhas de staging (com erros) e um erro de validação geral.
 */
export async function validateAndGroupStagingRows(
    fileContent: string, 
    year: number, 
    userId: string, 
    existingItems: ItemAquisicao[]
): Promise<{ groupedDiretrizes: DiretrizMaterialConsumo[], stagingRows: StagingRow[], validationError: string | null }> {
    
    const lines = fileContent.trim().split('\n');
    if (lines.length <= 1) {
        return { groupedDiretrizes: [], stagingRows: [], validationError: "O arquivo está vazio ou contém apenas o cabeçalho." };
    }
    
    const headers = lines[0].toLowerCase().split(/[\t,]/);
    const dataLines = lines.slice(1);
    
    const requiredHeaders = [
        "nr_subitem", "nome_subitem", "codigo_catmat", "descricao_item", 
        "descricao_reduzida", "valor_unitario", "numero_pregao", "uasg", "nd"
    ];
    
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
        return { groupedDiretrizes: [], stagingRows: [], validationError: `Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}` };
    }
    
    const headerMap = headers.reduce((acc, h, i) => ({ ...acc, [h]: i }), {} as Record<string, number>);
    
    const stagingRows: StagingRow[] = [];
    const itemKeys = new Set<string>(); // Para checar duplicidade interna (CATMAT + Pregão + UASG)
    const subitemKeys = new Set<string>(); // Para checar duplicidade de subitem (Nr + Nome)
    
    // 1. Processamento e Validação Linha por Linha
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        // Tenta detectar o separador (vírgula ou tab)
        const separator = line.includes('\t') ? '\t' : ',';
        const values = line.split(separator);
        
        const row: Partial<StagingRow> = {
            originalRowIndex: i + 2, // Linha 2 do arquivo
            isValid: true,
            errors: [],
            isDuplicateInternal: false,
            isDuplicateExternal: false,
        };
        
        const getVal = (header: string) => values[headerMap[header]]?.trim() || '';
        
        // Campos do Subitem ND
        row.nr_subitem = getVal("nr_subitem");
        row.nome_subitem = getVal("nome_subitem");
        row.descricao_subitem = getVal("descricao_subitem") || null;
        
        // Campos do Item de Aquisição (Template)
        row.codigo_catmat = getVal("codigo_catmat").replace(/\D/g, '').padStart(9, '0');
        row.descricao_item = getVal("descricao_item");
        row.descricao_reduzida = getVal("descricao_reduzida");
        row.numero_pregao = getVal("numero_pregao");
        row.uasg = getVal("uasg").replace(/\D/g, '');
        row.nd = getVal("nd") as '33.90.30' | '33.90.39';
        
        const valorUnitarioStr = getVal("valor_unitario");
        row.valor_unitario = parseInputToNumber(valorUnitarioStr);

        // --- Validação ---
        if (!row.nr_subitem || row.nr_subitem.length > 5) row.errors.push("Nr Subitem inválido.");
        if (!row.nome_subitem || row.nome_subitem.length > 100) row.errors.push("Nome Subitem inválido.");
        if (!row.codigo_catmat || row.codigo_catmat.length !== 9) row.errors.push("CATMAT inválido (deve ter 9 dígitos).");
        if (!row.descricao_item || row.descricao_item.length < 5) row.errors.push("Descrição Item muito curta.");
        if (!row.descricao_reduzida || row.descricao_reduzida.length < 5) row.errors.push("Descrição Reduzida muito curta.");
        if (row.valor_unitario <= 0) row.errors.push("Valor Unitário deve ser positivo.");
        if (row.nd !== '33.90.30' && row.nd !== '33.90.39') row.errors.push("ND inválida (deve ser 33.90.30 ou 33.90.39).");
        
        if (row.errors.length > 0) {
            row.isValid = false;
        }
        
        // Checagem de Duplicidade Interna (Item de Aquisição)
        const itemKey = `${row.codigo_catmat}-${row.numero_pregao}-${row.uasg}`;
        if (itemKeys.has(itemKey)) {
            row.isDuplicateInternal = true;
            row.isValid = false;
        } else {
            itemKeys.add(itemKey);
        }
        
        // Checagem de Duplicidade Externa (Subitem ND) - Apenas para o primeiro item de cada grupo
        const subitemKey = `${row.nr_subitem}-${row.nome_subitem}`;
        if (!subitemKeys.has(subitemKey)) {
            // Verifica se o subitem já existe no DB
            const isExistingSubitem = existingItems.some(item => 
                item.nr_subitem === row.nr_subitem && item.nome_subitem === row.nome_subitem
            );
            if (isExistingSubitem) {
                row.isDuplicateExternal = true;
                row.isValid = false;
            }
            subitemKeys.add(subitemKey);
        }

        stagingRows.push(row as StagingRow);
    }
    
    const hasAnyError = stagingRows.some(row => !row.isValid);
    if (hasAnyError) {
        return { groupedDiretrizes: [], stagingRows, validationError: "Pelo menos uma linha contém erros de validação ou duplicidade." };
    }
    
    // 2. Agrupamento em Diretrizes
    const groupedMap = new Map<string, DiretrizMaterialConsumo>();
    
    stagingRows.forEach(row => {
        const key = `${row.nr_subitem}-${row.nome_subitem}`;
        
        if (!groupedMap.has(key)) {
            groupedMap.set(key, {
                id: crypto.randomUUID(),
                user_id: userId,
                ano_referencia: year,
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                itens_aquisicao: [], // ItemAquisicaoTemplate[]
                ativo: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
        
        const diretriz = groupedMap.get(key)!;
        
        // Cria o ItemAquisicaoTemplate
        const itemTemplate: ItemAquisicaoTemplate = {
            id: crypto.randomUUID(),
            codigo_catmat: row.codigo_catmat,
            descricao_item: row.descricao_item,
            descricao_reduzida: row.descricao_reduzida,
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            nd: row.nd,
        };
        
        diretriz.itens_aquisicao.push(itemTemplate);
    });
    
    return {
        groupedDiretrizes: Array.from(groupedMap.values()),
        stagingRows,
        validationError: null,
    };
}

// =================================================================
// IMPORTAÇÃO (SALVAMENTO)
// =================================================================

/**
 * Salva as diretrizes agrupadas no banco de dados (UPSERT).
 * @param groupedDiretrizes As diretrizes prontas para salvar.
 * @param userId O ID do usuário.
 * @returns Contagem de sucesso e erro.
 */
export async function saveGroupedDiretrizes(groupedDiretrizes: DiretrizMaterialConsumo[], userId: string): Promise<{ successCount: number, errorCount: number }> {
    let successCount = 0;
    let errorCount = 0;
    
    for (const diretriz of groupedDiretrizes) {
        try {
            // 1. Tenta encontrar uma diretriz existente pelo nr_subitem, nome_subitem e ano
            const { data: existing, error: fetchError } = await supabase
                .from('diretrizes_material_consumo')
                .select('id')
                .eq('user_id', userId)
                .eq('ano_referencia', diretriz.ano_referencia)
                .eq('nr_subitem', diretriz.nr_subitem)
                .eq('nome_subitem', diretriz.nome_subitem)
                .maybeSingle();
                
            if (fetchError) throw fetchError;
            
            // 2. Prepara os dados para UPSERT
            const dbData: TablesInsert<'diretrizes_material_consumo'> = {
                user_id: userId,
                ano_referencia: diretriz.ano_referencia,
                nr_subitem: diretriz.nr_subitem,
                nome_subitem: diretriz.nome_subitem,
                descricao_subitem: diretriz.descricao_subitem,
                // Salva ItemAquisicaoTemplate[] como Json
                itens_aquisicao: diretriz.itens_aquisicao as unknown as Json, 
                ativo: diretriz.ativo,
            };
            
            if (existing) {
                // UPDATE: Atualiza a diretriz existente
                const { error: updateError } = await supabase
                    .from('diretrizes_material_consumo')
                    .update(dbData as TablesUpdate<'diretrizes_material_consumo'>)
                    .eq('id', existing.id);
                if (updateError) throw updateError;
            } else {
                // INSERT: Insere uma nova diretriz
                const { error: insertError } = await supabase
                    .from('diretrizes_material_consumo')
                    .insert([dbData]);
                if (insertError) throw insertError;
            }
            
            successCount++;
            
        } catch (error) {
            console.error(`Falha ao salvar diretriz ${diretriz.nr_subitem} - ${diretriz.nome_subitem}:`, error);
            errorCount++;
        }
    }
    
    return { successCount, errorCount };
}