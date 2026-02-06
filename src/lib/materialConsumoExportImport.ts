import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DiretrizMaterialConsumo, ItemAquisicao, StagingRow } from "@/types/diretrizesMaterialConsumo";
import { TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeError } from './errorUtils';

// =================================================================
// 1. EXPORTAÇÃO (Download)
// =================================================================

/**
 * Exporta as diretrizes de Material de Consumo para um arquivo Excel (XLSX).
 */
export async function exportMaterialConsumoToExcel(
    diretrizes: DiretrizMaterialConsumo[], 
    year: number
) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Itens de Aquisição');

    // 1. Definir Colunas
    worksheet.columns = [
        // Subitem ND (Chaves de Agrupamento)
        { header: 'NR_SUBITEM', key: 'nr_subitem', width: 15 },
        { header: 'NOME_SUBITEM', key: 'nome_subitem', width: 30 },
        { header: 'DESCRICAO_SUBITEM', key: 'descricao_subitem', width: 50 },
        
        // Item de Aquisição
        { header: 'CODIGO_CATMAT', key: 'codigo_catmat', width: 15 },
        { header: 'DESCRICAO_ITEM', key: 'descricao_item', width: 60 },
        { header: 'DESCRICAO_REDUZIDA', key: 'descricao_reduzida', width: 30 },
        { header: 'UNIDADE_MEDIDA', key: 'unidade_medida', width: 15 }, // NOVO CAMPO
        { header: 'VALOR_UNITARIO', key: 'valor_unitario', width: 15 },
        { header: 'NUMERO_PREGAO', key: 'numero_pregao', width: 20 },
        { header: 'UASG', key: 'uasg', width: 10 },
    ];

    // 2. Normalizar e Adicionar Linhas
    const flattenedData: any[] = [];
    
    diretrizes.forEach(diretriz => {
        const subitemData = {
            nr_subitem: diretriz.nr_subitem,
            nome_subitem: diretriz.nome_subitem,
            descricao_subitem: diretriz.descricao_subitem || '',
        };

        (diretriz.itens_aquisicao || []).forEach(item => {
            flattenedData.push({
                ...subitemData,
                codigo_catmat: item.codigo_catmat || '',
                descricao_item: item.descricao_item,
                descricao_reduzida: item.descricao_reduzida || '',
                unidade_medida: item.unidade_medida || '', // NOVO CAMPO
                valor_unitario: item.valor_unitario,
                numero_pregao: item.numero_pregao,
                uasg: item.uasg,
            });
        });
    });

    worksheet.addRows(flattenedData);

    // 3. Estilizar e Salvar
    worksheet.getRow(1).font = { bold: true };
    
    // Formatação de moeda para a coluna VALOR_UNITARIO
    worksheet.getColumn('valor_unitario').numFmt = 'R$ #,##0.00';

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Diretrizes_MaterialConsumo_${year}.xlsx`);
}

// =================================================================
// 2. IMPORTAÇÃO (Upload, Validação e Staging)
// =================================================================

// Estrutura plana esperada após a leitura do Excel
interface FlatImportRow {
    NR_SUBITEM: string;
    NOME_SUBITEM: string;
    DESCRICAO_SUBITEM?: string;
    CODIGO_CATMAT?: string;
    DESCRICAO_ITEM: string;
    DESCRICAO_REDUZIDA?: string;
    UNIDADE_MEDIDA: string; // NOVO CAMPO
    VALOR_UNITARIO: number;
    NUMERO_PREGAO: string;
    UASG: string;
}

/**
 * Função auxiliar para normalizar strings para comparação.
 */
const normalizeString = (str: string | undefined | null): string => {
    return (str || '').trim().toUpperCase().replace(/\s+/g, ' ');
};

/**
 * Valida uma linha de dados importada e retorna o objeto StagingRow.
 */
const validateRow = (row: FlatImportRow, rowIndex: number): StagingRow => {
    const errors: string[] = [];
    
    // Normalização e conversão de tipos
    const nrSubitem = normalizeString(row.NR_SUBITEM);
    const nomeSubitem = normalizeString(row.NOME_SUBITEM);
    const descricaoItem = normalizeString(row.DESCRICAO_ITEM);
    const numeroPregao = normalizeString(row.NUMERO_PREGAO);
    const uasgRaw = String(row.UASG || '').replace(/\D/g, '').trim();
    const unidadeMedida = normalizeString(row.UNIDADE_MEDIDA);
    
    // Tenta converter o valor unitário para número
    let valorUnitario = 0;
    try {
        // Tenta converter o valor, tratando vírgulas como separador decimal se necessário
        const rawValue = String(row.VALOR_UNITARIO || 0).replace(/\./g, '').replace(',', '.');
        valorUnitario = parseFloat(rawValue);
        if (isNaN(valorUnitario)) valorUnitario = 0;
    } catch {
        valorUnitario = 0;
    }

    // --- Validação de Campos Obrigatórios ---
    if (!nrSubitem) errors.push("NR_SUBITEM é obrigatório.");
    if (!nomeSubitem) errors.push("NOME_SUBITEM é obrigatório.");
    if (!descricaoItem) errors.push("DESCRICAO_ITEM é obrigatória.");
    if (!numeroPregao) errors.push("NUMERO_PREGAO é obrigatório.");
    if (!unidadeMedida) errors.push("UNIDADE_MEDIDA é obrigatória.");
    
    // --- Validação de Formato ---
    if (uasgRaw.length !== 6 || !/^\d+$/.test(uasgRaw)) {
        errors.push("UASG deve conter exatamente 6 dígitos numéricos.");
    }
    if (valorUnitario <= 0) {
        errors.push("VALOR_UNITARIO deve ser um número positivo.");
    }
    
    const isValid = errors.length === 0;

    return {
        nr_subitem: nrSubitem,
        nome_subitem: nomeSubitem,
        descricao_subitem: normalizeString(row.DESCRICAO_SUBITEM) || null,
        codigo_catmat: normalizeString(row.CODIGO_CATMAT),
        descricao_item: descricaoItem,
        descricao_reduzida: normalizeString(row.DESCRICAO_REDUZIDA),
        unidade_medida: unidadeMedida,
        valor_unitario: valorUnitario,
        numero_pregao: numeroPregao,
        uasg: uasgRaw,
        
        isValid: isValid,
        errors: errors,
        isDuplicateInternal: false, // Será preenchido na próxima etapa
        isDuplicateExternal: false, // Será preenchido na próxima etapa
        originalRowIndex: rowIndex,
    };
};

/**
 * Processa o arquivo Excel, realiza a validação e retorna os dados em staging.
 * @param file O arquivo XLSX.
 * @param year O ano de referência.
 * @param userId O ID do usuário.
 * @returns Um array de StagingRow.
 */
export async function processMaterialConsumoImport(
    file: File, 
    year: number, 
    userId: string
): Promise<{ stagedData: StagingRow[], totalValid: number, totalInvalid: number, totalDuplicates: number }> {
    
    const existingDiretrizes = await fetchExistingDiretrizes(year, userId);
    const existingSubitemKeys = new Set(existingDiretrizes.map(d => `${d.nr_subitem}|${d.nome_subitem}`));

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                if (!data) throw new Error("Falha ao ler o arquivo.");

                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Lê os dados, tratando a primeira linha como cabeçalho
                const rawJson: FlatImportRow[] = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1, 
                    raw: false, 
                }) as FlatImportRow[];

                if (rawJson.length < 2) {
                    throw new Error("O arquivo Excel deve conter pelo menos uma linha de cabeçalho e uma linha de dados.");
                }
                
                // Mapeamento de cabeçalhos (assumindo que a primeira linha é o cabeçalho)
                const headers = rawJson[0] as string[];
                const expectedHeaders = ['NR_SUBITEM', 'NOME_SUBITEM', 'DESCRICAO_ITEM', 'VALOR_UNITARIO', 'NUMERO_PREGAO', 'UASG'];
                
                if (!expectedHeaders.every(h => headers.includes(h))) {
                    throw new Error(`Cabeçalhos obrigatórios ausentes. Esperados: ${expectedHeaders.join(', ')}.`);
                }
                
                const dataRows = rawJson.slice(1).map(row => {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        // Mapeia o valor da coluna para o nome do cabeçalho
                        obj[header] = (row as any)[index];
                    });
                    return obj as FlatImportRow;
                });

                // 1. Validação de Linha e Staging Inicial
                let stagedData: StagingRow[] = [];
                dataRows.forEach((row, index) => {
                    stagedData.push(validateRow(row, index + 2)); // +2 para compensar o índice 0 e o cabeçalho
                });
                
                // 2. Validação de Duplicidade Interna (Item de Aquisição)
                const internalItemKeys = new Set<string>();
                let totalDuplicates = 0;
                
                stagedData = stagedData.map(row => {
                    if (!row.isValid) return row;
                    
                    // Chave de unicidade do Item de Aquisição (dentro do arquivo)
                    const itemKey = `${row.nr_subitem}|${row.nome_subitem}|${row.descricao_item}|${row.codigo_catmat}|${row.numero_pregao}|${row.uasg}`;
                    
                    if (internalItemKeys.has(itemKey)) {
                        row.isDuplicateInternal = true;
                        row.isValid = false;
                        row.errors.push("Duplicata interna: Este item de aquisição já aparece em outra linha do arquivo para o mesmo Subitem ND.");
                        totalDuplicates++;
                    } else {
                        internalItemKeys.add(itemKey);
                    }
                    return row;
                });
                
                // 3. Validação de Duplicidade Externa (Subitem ND)
                // Esta validação é apenas informativa, pois a importação fará a substituição completa.
                stagedData = stagedData.map(row => {
                    if (!row.isValid) return row;
                    
                    const subitemKey = `${row.nr_subitem}|${row.nome_subitem}`;
                    if (existingSubitemKeys.has(subitemKey)) {
                        row.isDuplicateExternal = true;
                    }
                    return row;
                });
                
                const totalValid = stagedData.filter(r => r.isValid).length;
                const totalInvalid = stagedData.length - totalValid;

                resolve({ stagedData, totalValid, totalInvalid, totalDuplicates });

            } catch (error) {
                console.error("Erro durante o processamento do arquivo:", error);
                reject(sanitizeError(error) || "Erro desconhecido durante o processamento do arquivo.");
            }
        };

        reader.onerror = (error) => {
            reject("Erro ao ler o arquivo: " + error);
        };

        reader.readAsBinaryString(file);
    });
}

/**
 * Agrupa os dados validados e persiste no Supabase (substituição completa).
 * @param stagedData Os dados validados e prontos para persistência.
 * @param year O ano de referência.
 * @param userId O ID do usuário.
 */
export async function persistMaterialConsumoImport(
    stagedData: StagingRow[], 
    year: number, 
    userId: string
): Promise<void> {
    
    const validRows = stagedData.filter(r => r.isValid);
    if (validRows.length === 0) {
        throw new Error("Nenhuma linha válida para importação.");
    }
    
    // 1. Agrupamento Final
    const groupedDiretrizes = new Map<string, DiretrizMaterialConsumo>();

    validRows.forEach((row) => {
        const diretrizKey = `${row.nr_subitem}|${row.nome_subitem}`;

        if (!groupedDiretrizes.has(diretrizKey)) {
            groupedDiretrizes.set(diretrizKey, {
                id: Math.random().toString(36).substring(2, 9), // ID temporário
                user_id: userId,
                ano_referencia: year,
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                itens_aquisicao: [],
                ativo: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }

        const diretriz = groupedDiretrizes.get(diretrizKey)!;
        
        const newItem: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9), // ID local
            codigo_catmat: row.codigo_catmat,
            descricao_item: row.descricao_item,
            descricao_reduzida: row.descricao_reduzida,
            unidade_medida: row.unidade_medida, // NOVO CAMPO
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
        };
        
        diretriz.itens_aquisicao.push(newItem);
    });
    
    const finalDiretrizes = Array.from(groupedDiretrizes.values());

    // 2. Persistência no Supabase (Transação de Substituição)
    
    // A. Excluir todas as diretrizes existentes para o ano e usuário
    const { error: deleteError } = await supabase
        .from('diretrizes_material_consumo')
        .delete()
        .eq('user_id', userId)
        .eq('ano_referencia', year);
        
    if (deleteError) throw deleteError;
    
    // B. Inserir as novas diretrizes agrupadas
    const insertData: TablesInsert<'diretrizes_material_consumo'>[] = finalDiretrizes.map(d => ({
        user_id: userId,
        ano_referencia: year,
        nr_subitem: d.nr_subitem,
        nome_subitem: d.nome_subitem,
        descricao_subitem: d.descricao_subitem,
        itens_aquisicao: d.itens_aquisicao as any, // Cast para Json
        ativo: true,
    }));
    
    const { error: insertError } = await supabase
        .from('diretrizes_material_consumo')
        .insert(insertData);
        
    if (insertError) throw insertError;
}

/**
 * Busca as diretrizes existentes para o ano e usuário.
 */
async function fetchExistingDiretrizes(year: number, userId: string): Promise<DiretrizMaterialConsumo[]> {
    const { data, error } = await supabase
        .from('diretrizes_material_consumo')
        .select('nr_subitem, nome_subitem, itens_aquisicao')
        .eq('user_id', userId)
        .eq('ano_referencia', year);
        
    if (error) {
        console.error("Erro ao buscar diretrizes existentes:", error);
        return [];
    }
    
    return (data || []) as DiretrizMaterialConsumo[];
}