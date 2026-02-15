import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { supabase } from "@/integrations/supabase/client";
import { DiretrizMaterialPermanente, StagingRowPermanente } from "@/types/diretrizesMaterialPermanente";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { parseInputToNumber } from './formatUtils';

/**
 * Exporta as diretrizes de Material Permanente para Excel.
 */
export async function exportMaterialPermanenteToExcel(diretrizes: DiretrizMaterialPermanente[], year: number) {
    const rows = diretrizes.flatMap(diretriz => 
        diretriz.itens_aquisicao.map(item => ({
            NR_SUBITEM: diretriz.nr_subitem,
            NOME_SUBITEM: diretriz.nome_subitem,
            DESCRICAO_SUBITEM: diretriz.descricao_subitem || '',
            CODIGO_CATMAT: item.codigo_catmat,
            DESCRICAO_ITEM: item.descricao_item,
            DESCRICAO_REDUZIDA: item.descricao_reduzida,
            VALOR_UNITARIO: item.valor_unitario,
            NUMERO_PREGAO: item.numero_pregao,
            UASG: item.uasg
        }))
    );

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Material Permanente");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(data, `Diretrizes_MaterialPermanente_${year}.xlsx`);
}

/**
 * Processa o arquivo Excel para importação de Material Permanente.
 */
export async function processMaterialPermanenteImport(file: File, year: number, userId: string): Promise<{
    stagedData: StagingRowPermanente[],
    totalValid: number,
    totalInvalid: number,
    totalDuplicates: number,
    totalExisting: number
}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) throw new Error("O arquivo está vazio.");

                // Buscar itens existentes para verificar duplicatas - Usando cast para evitar erro de inferência
                const { data: existingData } = await supabase
                    .from('diretrizes_material_permanente' as any)
                    .select('itens_aquisicao')
                    .eq('user_id', userId)
                    .eq('ano_referencia', year);

                const existingKeys = new Set<string>();
                (existingData || []).forEach((d: any) => {
                    (d.itens_aquisicao as any[] || []).forEach(item => {
                        existingKeys.add(`${item.codigo_catmat}|${item.numero_pregao}|${item.uasg}`);
                    });
                });

                const stagedData: StagingRowPermanente[] = [];
                const encounteredKeys = new Set<string>();
                let totalValid = 0;
                let totalInvalid = 0;
                let totalDuplicates = 0;
                let totalExisting = 0;

                json.forEach((row, index) => {
                    const errors: string[] = [];
                    const nr_subitem = String(row.NR_SUBITEM || '').trim();
                    const nome_subitem = String(row.NOME_SUBITEM || '').trim();
                    const codigo_catmat = String(row.CODIGO_CATMAT || '').trim();
                    const valor_unitario = parseInputToNumber(String(row.VALOR_UNITARIO || '0'));
                    const numero_pregao = String(row.NUMERO_PREGAO || '').trim();
                    const uasg = String(row.UASG || '').trim().replace(/\D/g, '');

                    if (!nr_subitem) errors.push("Nr Subitem obrigatório");
                    if (!nome_subitem) errors.push("Nome Subitem obrigatório");
                    if (!codigo_catmat) errors.push("Código CATMAT obrigatório");
                    if (valor_unitario <= 0) errors.push("Valor unitário deve ser maior que zero");
                    if (!numero_pregao) errors.push("Número do pregão obrigatório");
                    if (uasg.length !== 6) errors.push("UASG deve ter 6 dígitos");

                    const key = `${codigo_catmat}|${numero_pregao}|${uasg}`;
                    const isDuplicateInternal = encounteredKeys.has(key);
                    const isDuplicateExternal = existingKeys.has(key);

                    if (isDuplicateInternal) totalDuplicates++;
                    if (isDuplicateExternal) totalExisting++;

                    const isValid = errors.length === 0 && !isDuplicateInternal && !isDuplicateExternal;
                    if (isValid) {
                        totalValid++;
                        encounteredKeys.add(key);
                    } else {
                        totalInvalid++;
                    }

                    stagedData.push({
                        originalRowIndex: index + 2,
                        nr_subitem,
                        nome_subitem,
                        descricao_subitem: String(row.DESCRICAO_SUBITEM || ''),
                        codigo_catmat,
                        descricao_item: String(row.DESCRICAO_ITEM || ''),
                        descricao_reduzida: String(row.DESCRICAO_REDUZIDA || ''),
                        valor_unitario,
                        numero_pregao,
                        uasg,
                        isValid,
                        errors,
                        isDuplicateInternal,
                        isDuplicateExternal
                    });
                });

                resolve({ stagedData, totalValid, totalInvalid, totalDuplicates, totalExisting });
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsBinaryString(file);
    });
}

/**
 * Persiste os dados importados no banco de dados.
 */
export async function persistMaterialPermanenteImport(stagedData: StagingRowPermanente[], year: number, userId: string) {
    const validRows = stagedData.filter(r => r.isValid);
    
    // Agrupar por subitem
    const groupedBySubitem: Record<string, { nome: string, descricao: string, itens: ItemAquisicao[] }> = {};
    
    validRows.forEach(row => {
        if (!groupedBySubitem[row.nr_subitem]) {
            groupedBySubitem[row.nr_subitem] = {
                nome: row.nome_subitem,
                descricao: row.descricao_subitem,
                itens: []
            };
        }
        
        groupedBySubitem[row.nr_subitem].itens.push({
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: row.descricao_item,
            descricao_reduzida: row.descricao_reduzida,
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            codigo_catmat: row.codigo_catmat,
            quantidade: 0,
            valor_total: 0,
            nd: '449052',
            nr_subitem: row.nr_subitem,
            nome_subitem: row.nome_subitem
        });
    });

    for (const nr_subitem in groupedBySubitem) {
        const { nome, descricao, itens } = groupedBySubitem[nr_subitem];
        
        // Verificar se a diretriz já existe - Usando cast para evitar erro de inferência
        const { data: existingDiretriz } = await supabase
            .from('diretrizes_material_permanente' as any)
            .select('id, itens_aquisicao')
            .eq('user_id', userId)
            .eq('ano_referencia', year)
            .eq('nr_subitem', nr_subitem)
            .maybeSingle();

        if (existingDiretriz) {
            const typedExisting = existingDiretriz as any;
            const updatedItens = [...(typedExisting.itens_aquisicao as any[] || []), ...itens];
            await supabase
                .from('diretrizes_material_permanente' as any)
                .update({ itens_aquisicao: updatedItens })
                .eq('id', typedExisting.id);
        } else {
            await supabase
                .from('diretrizes_material_permanente' as any)
                .insert({
                    user_id: userId,
                    ano_referencia: year,
                    nr_subitem,
                    nome_subitem: nome,
                    descricao_subitem: descricao,
                    itens_aquisicao: itens,
                    ativo: true
                });
        }
    }
}