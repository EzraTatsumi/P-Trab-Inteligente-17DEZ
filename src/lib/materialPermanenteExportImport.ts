import { supabase } from "@/integrations/supabase/client";
import { DiretrizMaterialPermanente, StagingRowPermanente } from "@/types/diretrizesMaterialPermanente";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export async function exportMaterialPermanenteToExcel(diretrizes: DiretrizMaterialPermanente[], year: number) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Diretrizes_${year}`);

    worksheet.columns = [
        { header: 'NR_SUBITEM', key: 'nr_subitem', width: 15 },
        { header: 'NOME_SUBITEM', key: 'nome_subitem', width: 30 },
        { header: 'DESCRICAO_SUBITEM', key: 'descricao_subitem', width: 40 },
        { header: 'CODIGO_CATMAT', key: 'codigo_catmat', width: 20 },
        { header: 'DESCRICAO_ITEM', key: 'descricao_item', width: 50 },
        { header: 'DESCRICAO_REDUZIDA', key: 'descricao_reduzida', width: 30 },
        { header: 'VALOR_UNITARIO', key: 'valor_unitario', width: 20 },
        { header: 'NUMERO_PREGAO', key: 'numero_pregao', width: 20 },
        { header: 'UASG', key: 'uasg', width: 15 },
    ];

    diretrizes.forEach(d => {
        const itens = (d.itens_aquisicao || []) as any[];
        itens.forEach(item => {
            worksheet.addRow({
                nr_subitem: d.nr_subitem,
                nome_subitem: d.nome_subitem,
                descricao_subitem: d.descricao_subitem,
                codigo_catmat: item.codigo_catmat,
                descricao_item: item.descricao_item,
                descricao_reduzida: item.descricao_reduzida,
                valor_unitario: item.valor_unitario,
                numero_pregao: item.numero_pregao,
                uasg: item.uasg,
            });
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Diretrizes_MaterialPermanente_${year}.xlsx`);
}

export async function processMaterialPermanenteImport(file: File, year: number, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.getWorksheet(1);
    
    const stagedData: StagingRowPermanente[] = [];
    
    worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        
        const nr_subitem = String(row.getCell(1).value || '').trim();
        const nome_subitem = String(row.getCell(2).value || '').trim();
        const valor_unitario = Number(row.getCell(7).value) || 0;
        
        if (nr_subitem && nome_subitem && valor_unitario > 0) {
            stagedData.push({
                nr_subitem,
                nome_subitem,
                descricao_subitem: String(row.getCell(3).value || ''),
                codigo_catmat: String(row.getCell(4).value || ''),
                descricao_item: String(row.getCell(5).value || ''),
                descricao_reduzida: String(row.getCell(6).value || ''),
                valor_unitario,
                numero_pregao: String(row.getCell(8).value || ''),
                uasg: String(row.getCell(9).value || ''),
                isValid: true,
                errors: [],
                originalRowIndex: rowNumber
            });
        }
    });

    return {
        stagedData,
        totalValid: stagedData.length,
        totalInvalid: 0,
        totalDuplicates: 0,
        totalExisting: 0
    };
}

export async function persistMaterialPermanenteImport(stagedData: StagingRowPermanente[], year: number, userId: string) {
    // Agrupa por subitem
    const grouped = stagedData.reduce((acc, row) => {
        if (!acc[row.nr_subitem]) {
            acc[row.nr_subitem] = {
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                itens: []
            };
        }
        acc[row.nr_subitem].itens.push({
            id: Math.random().toString(36).substring(2, 9),
            codigo_catmat: row.codigo_catmat,
            descricao_item: row.descricao_item,
            descricao_reduzida: row.descricao_reduzida,
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            nd: '449052'
        });
        return acc;
    }, {} as Record<string, any>);

    const results: any[] = [];

    for (const nr in grouped) {
        const data = grouped[nr];
        const { data: inserted, error } = await supabase
            .from('diretrizes_material_permanente' as any)
            .upsert({
                user_id: userId,
                ano_referencia: year,
                nr_subitem: data.nr_subitem,
                nome_subitem: data.nome_subitem,
                descricao_subitem: data.descricao_subitem,
                itens_aquisicao: data.itens,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,ano_referencia,nr_subitem' })
            .select();

        if (error) throw error;
        if (inserted) results.push(...inserted);
    }

    return results;
}