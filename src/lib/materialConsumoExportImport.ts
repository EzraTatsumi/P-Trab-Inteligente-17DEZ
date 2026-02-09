import { TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { StagingRow, DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { sanitizeError } from "./errorUtils";
import { toast } from "sonner";

// =================================================================
// EXPORT FUNCTIONS
// =================================================================

/**
 * Exports the Material Consumo directives and their items to an Excel file.
 * @param diretrizes The list of directives to export.
 * @param year The reference year.
 */
export function exportMaterialConsumoToExcel(diretrizes: DiretrizMaterialConsumo[], year: number): void {
    if (diretrizes.length === 0) {
        toast.warning("Nenhuma diretriz para exportar.");
        return;
    }

    // Flatten the data into rows suitable for Excel
    const exportData = diretrizes.flatMap(diretriz => {
        if (diretriz.itens_aquisicao.length === 0) {
            // Include directives without items for completeness
            return [{
                'Nr Subitem': diretriz.nr_subitem,
                'Nome Subitem': diretriz.nome_subitem,
                'Descrição Subitem': diretriz.descricao_subitem || '',
                'ID Item (PNCP)': '',
                'Cód. CATMAT': '',
                'Descrição Item': '',
                'Descrição Reduzida': '',
                'Valor Unitário': 0,
                'Pregão': '',
                'UASG': '',
                'ND': '',
            }];
        }
        
        return diretriz.itens_aquisicao.map(item => ({
            'Nr Subitem': diretriz.nr_subitem,
            'Nome Subitem': diretriz.nome_subitem,
            'Descrição Subitem': diretriz.descricao_subitem || '',
            'ID Item (PNCP)': item.id,
            'Cód. CATMAT': item.codigo_catmat,
            'Descrição Item': item.descricao_item,
            'Descrição Reduzida': item.descricao_reduzida || '',
            'Valor Unitário': item.valor_unitario,
            'Pregão': item.numero_pregao,
            'UASG': item.uasg,
            'ND': item.nd,
        }));
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `MaterialConsumo_${year}`);
    
    XLSX.writeFile(workbook, `Diretrizes_Material_Consumo_${year}.xlsx`);
    toast.success("Diretrizes exportadas com sucesso!");
}

// =================================================================
// IMPORT FUNCTIONS
// =================================================================

/**
 * Processes the imported Excel file data into StagingRows for validation.
 * @param file The uploaded Excel file.
 * @returns A promise that resolves to an array of StagingRow.
 */
export async function processMaterialConsumoImport(file: File): Promise<StagingRow[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                if (!data) {
                    reject(new Error("Falha ao ler o arquivo."));
                    return;
                }
                
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Read data as JSON array
                const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonRows.length < 2) {
                    reject(new Error("O arquivo está vazio ou não contém dados."));
                    return;
                }
                
                // Assuming the first row is the header
                const headers = jsonRows[0] as string[];
                const dataRows = jsonRows.slice(1);
                
                const mapHeader = (header: string) => {
                    if (header.includes('Nr Subitem')) return 'nr_subitem';
                    if (header.includes('Nome Subitem')) return 'nome_subitem';
                    if (header.includes('Descrição Subitem')) return 'descricao_subitem';
                    if (header.includes('ID Item')) return 'item_id';
                    if (header.includes('Cód. CATMAT')) return 'codigo_catmat';
                    if (header.includes('Descrição Item')) return 'descricao_item';
                    if (header.includes('Descrição Reduzida')) return 'descricao_reduzida';
                    if (header.includes('Valor Unitário')) return 'valor_unitario';
                    if (header.includes('Pregão')) return 'numero_pregao';
                    if (header.includes('UASG')) return 'uasg';
                    if (header.includes('ND')) return 'nd';
                    return null;
                };
                
                const mappedHeaders = headers.map(mapHeader);
                
                const stagingRows: StagingRow[] = dataRows.map((row: any[], index: number) => {
                    const stagingRow: Partial<StagingRow> = {
                        status: 'ok',
                        message: 'Pronto para importação',
                    };
                    
                    mappedHeaders.forEach((key, i) => {
                        if (key && row[i] !== undefined && row[i] !== null) {
                            // Basic type conversion
                            if (key === 'valor_unitario') {
                                stagingRow[key] = Number(row[i]) || 0;
                            } else if (key === 'nd') {
                                const ndValue = String(row[i]).trim();
                                if (ndValue === '33.90.30' || ndValue === '33.90.39') {
                                    stagingRow[key] = ndValue;
                                } else {
                                    stagingRow[key] = '33.90.30'; // Default to 30 if invalid
                                }
                            } else {
                                stagingRow[key] = String(row[i]).trim();
                            }
                        }
                    });
                    
                    // Basic validation (can be expanded later)
                    if (!stagingRow.nr_subitem || !stagingRow.nome_subitem) {
                        stagingRow.status = 'error';
                        stagingRow.message = 'Subitem ND e Nome são obrigatórios.';
                    }
                    
                    // Ensure required item fields are present if item_id is present
                    if (stagingRow.item_id && (!stagingRow.codigo_catmat || !stagingRow.item_id || !stagingRow.descricao_item || !stagingRow.valor_unitario)) {
                        stagingRow.status = 'error';
                        stagingRow.message = 'Item de aquisição incompleto.';
                    }

                    return stagingRow as StagingRow;
                }).filter(row => row.nr_subitem); // Filter out empty rows

                resolve(stagingRows);

            } catch (error) {
                console.error("Erro ao processar arquivo Excel:", error);
                reject(new Error("Erro ao processar o arquivo Excel. Verifique o formato."));
            }
        };
        reader.onerror = (error) => reject(new Error("Erro de leitura do arquivo."));
        reader.readAsBinaryString(file);
    });
}

/**
 * Persists the validated StagingRows into the 'diretrizes_material_consumo' table.
 * This function performs an UPSERT operation based on nr_subitem and year.
 * @param stagingRows The validated rows to persist.
 * @param year The reference year.
 * @param userId The current user ID.
 * @returns A promise that resolves when persistence is complete.
 */
export async function persistMaterialConsumoImport(stagingRows: StagingRow[], year: number, userId: string): Promise<void> {
    if (stagingRows.length === 0) {
        toast.warning("Nenhum dado válido para importar.");
        return;
    }

    // 1. Group items by Subitem ND
    const groupedData = stagingRows.reduce((acc, row) => {
        const key = row.nr_subitem;
        if (!acc[key]) {
            acc[key] = {
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                items: [],
            };
        }
        
        // Only add items if they are complete
        if (row.item_id) {
            const item: ItemAquisicao = {
                id: row.item_id,
                codigo_catmat: row.codigo_catmat || '',
                descricao_item: row.descricao_item || '',
                descricao_reduzida: row.descricao_reduzida || null,
                valor_unitario: row.valor_unitario || 0,
                numero_pregao: row.numero_pregao || 'N/A',
                uasg: row.uasg || 'N/A',
                quantidade: 1, // Default quantity for import staging
                valor_total: row.valor_unitario || 0, // Default total for import staging
                nd: row.nd || '33.90.30',
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
            };
            acc[key].items.push(item);
        }
        
        return acc;
    }, {} as Record<string, { nr_subitem: string, nome_subitem: string, descricao_subitem: string | null, items: ItemAquisicao[] }>);

    const updates: TablesUpdate<'diretrizes_material_consumo'>[] = [];
    const inserts: TablesInsert<'diretrizes_material_consumo'>[] = [];
    
    // 2. Check existing directives to determine UPSERT strategy
    const { data: existingDiretrizes, error: fetchError } = await supabase
        .from('diretrizes_material_consumo')
        .select('id, nr_subitem')
        .eq('user_id', userId)
        .eq('ano_referencia', year);
        
    if (fetchError) throw fetchError;
    
    const existingMap = new Map(existingDiretrizes.map(d => [d.nr_subitem, d.id]));

    // 3. Prepare inserts and updates
    for (const key in groupedData) {
        const group = groupedData[key];
        const dbData: TablesInsert<'diretrizes_material_consumo'> = {
            user_id: userId,
            ano_referencia: year,
            nr_subitem: group.nr_subitem,
            nome_subitem: group.nome_subitem,
            descricao_subitem: group.descricao_subitem,
            itens_aquisicao: group.items as unknown as Json,
            ativo: true,
        };

        if (existingMap.has(group.nr_subitem)) {
            // Update existing directive
            updates.push({
                ...dbData,
                id: existingMap.get(group.nr_subitem)!,
            } as TablesUpdate<'diretrizes_material_consumo'>);
        } else {
            // Insert new directive
            inserts.push(dbData);
        }
    }
    
    // 4. Execute transactions
    let insertedCount = 0;
    let updatedCount = 0;

    try {
        if (inserts.length > 0) {
            const { error } = await supabase
                .from('diretrizes_material_consumo')
                .insert(inserts);
            if (error) throw error;
            insertedCount = inserts.length;
        }

        if (updates.length > 0) {
            // Execute updates individually or in batches if needed, but for simplicity, we'll use a loop
            for (const update of updates) {
                const { id, ...updatePayload } = update;
                const { error } = await supabase
                    .from('diretrizes_material_consumo')
                    .update(updatePayload)
                    .eq('id', id);
                if (error) {
                    console.error(`Erro ao atualizar diretriz ${id}:`, error);
                    // Continue loop but log error
                } else {
                    updatedCount++;
                }
            }
        }
        
        toast.success(`Importação concluída! Inseridos: ${insertedCount}, Atualizados: ${updatedCount}.`);

    } catch (error) {
        console.error("Erro fatal na persistência da importação:", error);
        throw new Error(sanitizeError(error) || "Erro desconhecido ao salvar dados importados.");
    }
}