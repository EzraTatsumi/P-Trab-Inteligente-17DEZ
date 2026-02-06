import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { TablesInsert } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from './errorUtils';

// =================================================================
// 1. EXPORTAÇÃO (Download)
// =================================================================

/**
 * Exporta as diretrizes de Material de Consumo para um arquivo Excel (XLSX).
 * A estrutura é 'achatada' para que cada linha represente um ItemAquisicao,
 * mas contendo os dados do Subitem pai.
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
// 2. IMPORTAÇÃO (Upload e Processamento)
// =================================================================

// Estrutura plana esperada após a leitura do Excel
interface FlatImportRow {
    NR_SUBITEM: string;
    NOME_SUBITEM: string;
    DESCRICAO_SUBITEM?: string;
    CODIGO_CATMAT?: string;
    DESCRICAO_ITEM: string;
    DESCRICAO_REDUZIDA?: string;
    VALOR_UNITARIO: number;
    NUMERO_PREGAO: string;
    UASG: string;
}

/**
 * Lê o arquivo Excel, agrupa os dados e persiste no Supabase.
 * @param file O arquivo XLSX.
 * @param year O ano de referência para a importação.
 * @param userId O ID do usuário.
 */
export async function importMaterialConsumoFromExcel(
    file: File, 
    year: number, 
    userId: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                if (!data) throw new Error("Falha ao ler o arquivo.");

                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Converte para JSON, garantindo que os cabeçalhos sejam tratados como strings
                const rawJson: FlatImportRow[] = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1, // Lê a primeira linha como cabeçalho
                    raw: false, // Mantém os valores formatados (útil para datas/moedas)
                }) as FlatImportRow[];

                // A primeira linha é o cabeçalho, precisamos mapear corretamente
                const headers = rawJson[0] as string[];
                const dataRows = rawJson.slice(1).map(row => {
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        // Mapeia o valor da coluna para o nome do cabeçalho
                        obj[header] = (row as any)[index];
                    });
                    return obj as FlatImportRow;
                });

                if (dataRows.length === 0) {
                    throw new Error("O arquivo Excel não contém dados válidos na primeira aba.");
                }
                
                // 1. Agrupamento e Validação
                const groupedDiretrizes = new Map<string, DiretrizMaterialConsumo>();
                const errors: string[] = [];
                let rowCount = 0;

                dataRows.forEach((row) => {
                    rowCount++;
                    
                    // Normalização e validação básica
                    const nrSubitem = String(row.NR_SUBITEM || '').trim();
                    const nomeSubitem = String(row.NOME_SUBITEM || '').trim();
                    const descricaoItem = String(row.DESCRICAO_ITEM || '').trim();
                    const numeroPregao = String(row.NUMERO_PREGAO || '').trim();
                    const uasg = String(row.UASG || '').replace(/\D/g, '').trim(); // Remove formatação
                    const valorUnitario = Number(String(row.VALOR_UNITARIO || 0).replace(',', '.')); // Tenta converter para número

                    if (!nrSubitem || !nomeSubitem) {
                        errors.push(`Linha ${rowCount}: Subitem ND (NR_SUBITEM ou NOME_SUBITEM) não preenchido.`);
                        return;
                    }
                    if (!descricaoItem || !numeroPregao || uasg.length !== 6 || valorUnitario <= 0 || isNaN(valorUnitario)) {
                        errors.push(`Linha ${rowCount}: Item de Aquisição inválido (Descrição, Pregão, UASG ou Valor Unitário).`);
                        return;
                    }
                    
                    // Chave de agrupamento
                    const diretrizKey = `${nrSubitem}|${nomeSubitem}`;

                    if (!groupedDiretrizes.has(diretrizKey)) {
                        groupedDiretrizes.set(diretrizKey, {
                            id: Math.random().toString(36).substring(2, 9), // ID temporário
                            user_id: userId,
                            ano_referencia: year,
                            nr_subitem: nrSubitem,
                            nome_subitem: nomeSubitem,
                            descricao_subitem: String(row.DESCRICAO_SUBITEM || '').trim() || null,
                            itens_aquisicao: [],
                            ativo: true,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        });
                    }

                    const diretriz = groupedDiretrizes.get(diretrizKey)!;
                    
                    const newItem: ItemAquisicao = {
                        id: Math.random().toString(36).substring(2, 9), // ID local
                        codigo_catmat: String(row.CODIGO_CATMAT || '').trim(),
                        descricao_item: descricaoItem,
                        descricao_reduzida: String(row.DESCRICAO_REDUZIDA || '').trim(),
                        valor_unitario: valorUnitario,
                        numero_pregao: numeroPregao,
                        uasg: uasg,
                    };
                    
                    // Verifica duplicidade de item dentro da mesma diretriz (opcional, mas recomendado)
                    const itemKey = `${newItem.descricao_item}|${newItem.codigo_catmat}|${newItem.numero_pregao}|${newItem.uasg}`;
                    const isDuplicate = diretriz.itens_aquisicao.some(existingItem => 
                        `${existingItem.descricao_item}|${existingItem.codigo_catmat}|${existingItem.numero_pregao}|${existingItem.uasg}` === itemKey
                    );

                    if (!isDuplicate) {
                        diretriz.itens_aquisicao.push(newItem);
                    } else {
                        errors.push(`Linha ${rowCount}: Item de aquisição duplicado dentro do subitem ${nrSubitem}.`);
                    }
                });
                
                if (errors.length > 0) {
                    throw new Error(`Erros de validação encontrados (${errors.length}): ${errors.slice(0, 5).join('; ')}...`);
                }
                
                const finalDiretrizes = Array.from(groupedDiretrizes.values());
                if (finalDiretrizes.length === 0) {
                    throw new Error("Nenhuma diretriz válida foi encontrada para importação.");
                }

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

                resolve();

            } catch (error) {
                console.error("Erro durante a importação:", error);
                reject(sanitizeError(error) || "Erro desconhecido durante o processamento do arquivo.");
            }
        };

        reader.onerror = (error) => {
            reject("Erro ao ler o arquivo: " + error);
        };

        reader.readAsBinaryString(file);
    });
}