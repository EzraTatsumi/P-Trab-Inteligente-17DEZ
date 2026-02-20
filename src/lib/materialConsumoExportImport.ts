import { supabase } from "@/integrations/supabase/client";
import { TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { StagingRow, DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import * as XLSX from 'xlsx';
import { toast } from "sonner";

// =================================================================
// CONFIGURAÇÃO DE COLUNAS ESPERADAS
// =================================================================

const REQUIRED_COLUMNS = [
    'NR_SUBITEM', 'NOME_SUBITEM', 'DESCRICAO_SUBITEM', 
    'CODIGO_CATMAT', 'DESCRICAO_ITEM', 'DESCRICAO_REDUZIDA', 
    'VALOR_UNITARIO', 'NUMERO_PREGAO', 'UASG'
];

// =================================================================
// FUNÇÕES DE EXPORTAÇÃO
// =================================================================

/**
 * Exporta as diretrizes de Material de Consumo para um arquivo Excel.
 */
export async function exportMaterialConsumoToExcel(diretrizes: DiretrizMaterialConsumo[], year: number) {
    console.log(`Exportando ${diretrizes.length} diretrizes para o ano ${year}`);
    
    const dataToExport: any[] = [];
    
    diretrizes.forEach(diretriz => {
        diretriz.itens_aquisicao.forEach(item => {
            dataToExport.push({
                NR_SUBITEM: diretriz.nr_subitem,
                NOME_SUBITEM: diretriz.nome_subitem,
                DESCRICAO_SUBITEM: diretriz.descricao_subitem,
                CODIGO_CATMAT: item.codigo_catmat,
                DESCRICAO_ITEM: item.descricao_item,
                DESCRICAO_REDUZIDA: item.descricao_reduzida,
                VALOR_UNITARIO: item.valor_unitario,
                NUMERO_PREGAO: item.numero_pregao,
                UASG: item.uasg,
            });
        });
    });

    if (dataToExport.length === 0) {
        toast.warning("Nenhum item para exportar.");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Diretrizes");
    XLSX.writeFile(workbook, `Diretrizes_MaterialConsumo_${year}.xlsx`);
    
    return true;
}

// =================================================================
// FUNÇÕES DE IMPORTAÇÃO
// =================================================================

/**
 * Lê o arquivo Excel como ArrayBuffer.
 */
const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
};

/**
 * Normaliza e limpa uma string.
 */
const normalizeString = (value: any): string => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
};

/**
 * Converte um valor para número, tratando strings formatadas (ex: 1.234,56).
 */
const parseNumericValue = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        // Remove separadores de milhar (ponto) e substitui vírgula por ponto decimal
        const cleaned = value.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

/**
 * Gera uma chave de unicidade para um Item de Aquisição.
 * Critério: Código, Descrição do Item, Pregão, UASG e Valor Unitário.
 */
const generateItemKey = (item: { descricao_item: string, codigo_catmat: string, numero_pregao: string, uasg: string, valor_unitario: number }): string => {
    return `${normalizeString(item.codigo_catmat)}|${normalizeString(item.descricao_item)}|${normalizeString(item.numero_pregao)}|${normalizeString(item.uasg)}|${Number(item.valor_unitario).toFixed(2)}`;
};

/**
 * Processa o arquivo Excel e valida os dados, retornando as linhas em staging.
 */
export async function processMaterialConsumoImport(file: File, year: number, userId: string): Promise<{
    stagedData: StagingRow[],
    totalValid: number,
    totalInvalid: number,
    totalDuplicates: number,
    totalExisting: number,
}> {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (rawData.length < 2) {
        throw new Error("O arquivo Excel está vazio ou não possui cabeçalhos.");
    }
    
    const headers = rawData[0].map((h: any) => normalizeString(h).toUpperCase());
    const dataRows = rawData.slice(1);
    
    // 1. Mapear índices das colunas
    const headerMap: Record<string, number> = {};
    REQUIRED_COLUMNS.forEach(col => {
        const index = headers.indexOf(col);
        if (index === -1) {
            throw new Error(`Coluna obrigatória não encontrada: ${col}. Verifique se os cabeçalhos estão corretos.`);
        }
        headerMap[col] = index;
    });
    
    let totalValid = 0;
    let totalInvalid = 0;
    let totalDuplicates = 0;
    let totalExisting = 0;
    const stagedData: StagingRow[] = [];
    const itemKeysInFile = new Set<string>(); // Para duplicidade interna
    
    // 2. Buscar diretrizes existentes para checar duplicidade externa
    const { data: existingDiretrizes, error: dbError } = await supabase
        .from('diretrizes_material_consumo')
        .select('nr_subitem, nome_subitem, itens_aquisicao')
        .eq('user_id', userId)
        .eq('ano_referencia', year);
        
    if (dbError) {
        console.error("Erro ao buscar diretrizes existentes:", dbError);
        throw new Error("Falha ao verificar dados existentes no banco de dados.");
    }
    
    const existingItemKeys = new Set<string>();
    (existingDiretrizes as unknown as DiretrizMaterialConsumo[] || []).forEach(diretriz => {
        const itens = diretriz.itens_aquisicao || [];
        itens.forEach(item => {
            existingItemKeys.add(generateItemKey(item));
        });
    });

    // 3. Processar linhas
    dataRows.forEach((row, index) => {
        const originalRowIndex = index + 2; // Linha 2 do Excel é o primeiro dado
        const errors: string[] = [];
        let isValid = true;
        let isDuplicateInternal = false;
        let isDuplicateExternal = false;

        // Extração e validação básica
        const nr_subitem = normalizeString(row[headerMap['NR_SUBITEM']]);
        const nome_subitem = normalizeString(row[headerMap['NOME_SUBITEM']]);
        const descricao_subitem = normalizeString(row[headerMap['DESCRICAO_SUBITEM']]) || null;
        
        const codigo_catmat = normalizeString(row[headerMap['CODIGO_CATMAT']]);
        const descricao_item = normalizeString(row[headerMap['DESCRICAO_ITEM']]);
        const descricao_reduzida = normalizeString(row[headerMap['DESCRICAO_REDUZIDA']]);
        const valor_unitario = parseNumericValue(row[headerMap['VALOR_UNITARIO']]);
        const numero_pregao = normalizeString(row[headerMap['NUMERO_PREGAO']]);
        const uasg = normalizeString(row[headerMap['UASG']]);
        
        // Validação de campos obrigatórios
        if (!nr_subitem) errors.push("NR_SUBITEM é obrigatório.");
        if (!nome_subitem) errors.push("NOME_SUBITEM é obrigatório.");
        if (!descricao_item) errors.push("DESCRICAO_ITEM é obrigatória.");
        if (valor_unitario <= 0) errors.push("VALOR_UNITARIO deve ser maior que zero.");
        if (!numero_pregao) errors.push("NUMERO_PREGAO é obrigatório.");
        if (uasg.length !== 6 || !/^\d+$/.test(uasg)) errors.push("UASG deve ter 6 dígitos numéricos.");
        if (!codigo_catmat) errors.push("CODIGO_CATMAT é obrigatório.");
        
        if (errors.length > 0) {
            isValid = false;
        }
        
        // Checagem de duplicidade interna (apenas se for válido até aqui)
        if (isValid) {
            const itemKey = generateItemKey({ descricao_item, codigo_catmat, numero_pregao, uasg, valor_unitario });
            if (itemKeysInFile.has(itemKey)) {
                isDuplicateInternal = true;
                totalDuplicates++;
                isValid = false; // Duplicatas internas são inválidas para inserção
            } else {
                itemKeysInFile.add(itemKey);
            }
            
            // Checagem de duplicidade externa (já existe no DB)
            if (existingItemKeys.has(itemKey)) {
                isDuplicateExternal = true;
                totalExisting++;
                isValid = false; // Itens existentes são inválidos para inserção (serão ignorados na mesclagem)
            }
        }

        if (isValid) {
            totalValid++;
        } else {
            totalInvalid++;
        }

        stagedData.push({
            nr_subitem,
            nome_subitem,
            descricao_subitem,
            codigo_catmat,
            descricao_item,
            descricao_reduzida,
            valor_unitario,
            numero_pregao,
            uasg,
            isValid,
            errors,
            isDuplicateInternal,
            isDuplicateExternal,
            originalRowIndex,
        });
    });

    return {
        stagedData,
        totalValid,
        totalInvalid,
        totalDuplicates,
        totalExisting,
    };
}

/**
 * Agrupa os dados válidos em staging por Subitem ND e realiza a mesclagem (upsert)
 * com as diretrizes existentes no banco de dados.
 */
export async function persistMaterialConsumoImport(stagedData: StagingRow[], year: number, userId: string) {
    // Filtra apenas os itens válidos que não são duplicatas internas ou externas
    const newValidRows = stagedData.filter(row => row.isValid); 

    if (newValidRows.length === 0) {
        return;
    }

    // 1. Buscar todas as diretrizes existentes para o ano
    const { data: existingDiretrizes, error: fetchError } = await supabase
        .from('diretrizes_material_consumo')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year);

    if (fetchError) {
        console.error("Erro ao buscar diretrizes existentes para mesclagem:", fetchError);
        throw new Error("Falha ao carregar diretrizes existentes.");
    }
    
    // Mapear diretrizes existentes por chave de subitem (nr_subitem|nome_subitem)
    const existingMap = new Map<string, DiretrizMaterialConsumo>();
    (existingDiretrizes as unknown as DiretrizMaterialConsumo[] || []).forEach(d => {
        const key = `${d.nr_subitem}|${d.nome_subitem}`;
        existingMap.set(key, d);
    });

    // 2. Agrupar novos itens válidos por Subitem ND
    const newGroupedItems = new Map<string, {
        nr_subitem: string;
        nome_subitem: string;
        descricao_subitem: string | null;
        itens: ItemAquisicao[];
    }>();

    newValidRows.forEach(row => {
        const key = `${row.nr_subitem}|${row.nome_subitem}`;
        
        if (!newGroupedItems.has(key)) {
            newGroupedItems.set(key, {
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                itens: [],
            });
        }

        const group = newGroupedItems.get(key)!;
        
        const newItem: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: row.descricao_item,
            descricao_reduzida: row.descricao_reduzida,
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            codigo_catmat: row.codigo_catmat,
        };
        
        group.itens.push(newItem);
    });

    const inserts: TablesInsert<'diretrizes_material_consumo'>[] = [];
    const updates: TablesUpdate<'diretrizes_material_consumo'>[] = [];

    // 3. Mesclar e preparar operações
    Array.from(newGroupedItems.values()).forEach(newGroup => {
        const key = `${newGroup.nr_subitem}|${newGroup.nome_subitem}`;
        const existingDiretriz = existingMap.get(key);
        
        if (existingDiretriz) {
            // A. Mesclar: Adicionar novos itens à lista existente
            const existingItems = existingDiretriz.itens_aquisicao || [];
            const updatedItems = [...existingItems, ...newGroup.itens];
            
            const updateData: TablesUpdate<'diretrizes_material_consumo'> = {
                id: existingDiretriz.id,
                // Atualiza a descrição do subitem se a nova for mais completa
                descricao_subitem: newGroup.descricao_subitem || existingDiretriz.descricao_subitem,
                // Mescla os itens
                itens_aquisicao: updatedItems as unknown as Json,
                updated_at: new Date().toISOString(),
            };
            updates.push(updateData);
            
        } else {
            // B. Inserir: Novo subitem ND
            const insertData: TablesInsert<'diretrizes_material_consumo'> = {
                user_id: userId,
                ano_referencia: year,
                nr_subitem: newGroup.nr_subitem,
                nome_subitem: newGroup.nome_subitem,
                descricao_subitem: newGroup.descricao_subitem,
                ativo: true,
                itens_aquisicao: newGroup.itens as unknown as Json, 
            };
            inserts.push(insertData);
        }
    });

    // 4. Executar as operações
    
    // Inserções
    if (inserts.length > 0) {
        const { error: insertError } = await supabase
            .from('diretrizes_material_consumo')
            .insert(inserts);

        if (insertError) {
            console.error("Erro ao inserir novas diretrizes:", insertError);
            throw new Error("Falha ao salvar as novas diretrizes no banco de dados.");
        }
    }
    
    // Atualizações
    if (updates.length > 0) {
        const updatePromises = updates.map(update => 
            supabase
                .from('diretrizes_material_consumo')
                .update(update)
                .eq('id', update.id!)
        );
        
        const results = await Promise.all(updatePromises);
        const updateError = results.find(r => r.error)?.error;
        
        if (updateError) {
            console.error("Erro ao atualizar diretrizes existentes:", updateError);
            throw new Error("Falha ao mesclar dados com diretrizes existentes.");
        }
    }
}