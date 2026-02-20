import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from "@/integrations/supabase/client";
import { DiretrizServicosTerceiros } from "@/types/diretrizesServicosTerceiros";
import { fetchAllExistingAcquisitionItems } from "@/integrations/supabase/api";

export async function exportServicosTerceirosToExcel(diretrizes: DiretrizServicosTerceiros[], year: number) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Serv Terceiros ${year}`);

    worksheet.columns = [
        { header: 'NR_SUBITEM', key: 'nr_subitem', width: 15 },
        { header: 'NOME_SUBITEM', key: 'nome_subitem', width: 30 },
        { header: 'DESCRICAO_SUBITEM', key: 'descricao_subitem', width: 40 },
        { header: 'CODIGO_CATSER', key: 'codigo_catmat', width: 15 },
        { header: 'DESCRICAO_ITEM', key: 'descricao_item', width: 50 },
        { header: 'NOME_REDUZIDO', key: 'nome_reduzido', width: 30 },
        { header: 'UNIDADE_MEDIDA', key: 'unidade_medida', width: 15 },
        { header: 'VALOR_UNITARIO', key: 'valor_unitario', width: 15 },
        { header: 'NUMERO_PREGAO', key: 'numero_pregao', width: 20 },
        { header: 'UASG', key: 'uasg', width: 10 },
    ];

    diretrizes.forEach(d => {
        d.itens_aquisicao.forEach(item => {
            worksheet.addRow({
                nr_subitem: d.nr_subitem,
                nome_subitem: d.nome_subitem,
                descricao_subitem: d.descricao_subitem || '',
                codigo_catmat: item.codigo_catmat,
                descricao_item: item.descricao_item,
                nome_reduzido: item.nome_reduzido || item.descricao_reduzida,
                unidade_medida: item.unidade_medida || 'UN',
                valor_unitario: item.valor_unitario,
                numero_pregao: item.numero_pregao,
                uasg: item.uasg,
            });
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Diretrizes_Servicos_Terceiros_${year}.xlsx`);
}

export async function processServicosTerceirosImport(file: File, year: number, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.getWorksheet(1);
    
    const stagedData: any[] = [];
    const existingItems = await fetchAllExistingAcquisitionItems(year, userId, 'servico');
    const internalKeys = new Set<string>();

    worksheet?.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const nr_subitem = String(row.getCell(1).value || '').trim();
        const nome_subitem = String(row.getCell(2).value || '').trim();
        const codigo_catmat = String(row.getCell(4).value || '').trim();
        const valor_unitario = Number(row.getCell(8).value || 0);
        const numero_pregao = String(row.getCell(9).value || '').trim();
        const uasg = String(row.getCell(10).value || '').trim();

        const errors: string[] = [];
        if (!nr_subitem) errors.push("Subitem ausente");
        if (!nome_subitem) errors.push("Nome do subitem ausente");
        if (valor_unitario <= 0) errors.push("Valor inválido");

        const key = `${codigo_catmat}-${numero_pregao}-${uasg}`;
        const isDuplicateInternal = internalKeys.has(key);
        const isDuplicateExternal = existingItems.some(ei => ei.codigo_catmat === codigo_catmat && ei.numero_pregao === numero_pregao && ei.uasg === uasg);

        if (!isDuplicateInternal) internalKeys.add(key);

        stagedData.push({
            originalRowIndex: rowNumber,
            nr_subitem,
            nome_subitem,
            descricao_subitem: String(row.getCell(3).value || ''),
            codigo_catmat,
            descricao_item: String(row.getCell(5).value || ''),
            nome_reduzido: String(row.getCell(6).value || ''),
            unidade_medida: String(row.getCell(7).value || 'UN'),
            valor_unitario,
            numero_pregao,
            uasg,
            isValid: errors.length === 0 && !isDuplicateInternal && !isDuplicateExternal,
            errors,
            isDuplicateInternal,
            isDuplicateExternal
        });
    });

    return {
        stagedData,
        totalValid: stagedData.filter(r => r.isValid).length,
        totalInvalid: stagedData.filter(r => !r.isValid && r.errors.length > 0).length,
        totalDuplicates: stagedData.filter(r => r.isDuplicateInternal).length,
        totalExisting: stagedData.filter(r => r.isDuplicateExternal).length,
    };
}

export async function persistServicosTerceirosImport(stagedData: any[], year: number, userId: string) {
    const validRows = stagedData.filter(r => r.isValid);
    const subitemsMap = new Map<string, any>();
    
    validRows.forEach(row => {
        const key = `${row.nr_subitem}|${row.nome_subitem}`;
        if (!subitemsMap.has(key)) {
            subitemsMap.set(key, {
                user_id: userId,
                ano_referencia: year,
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem,
                itens_aquisicao: [],
                ativo: true
            });
        }
        
        subitemsMap.get(key).itens_aquisicao.push({
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: row.descricao_item,
            descricao_reduzida: row.nome_reduzido,
            nome_reduzido: row.nome_reduzido,
            unidade_medida: row.unidade_medida,
            valor_unitario: row.valor_unitario,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            codigo_catmat: row.codigo_catmat,
            nd: '339039'
        });
    });

    const toUpsert = Array.from(subitemsMap.values());
    
    // Busca itens existentes para mesclar
    const { data: existingItems } = await supabase
        .from('diretrizes_servicos_terceiros' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year);

    const finalUpsert = toUpsert.map(newItem => {
        // Busca por número E nome para garantir a mesclagem correta
        const existing = (existingItems as any[])?.find(e => 
            e.nr_subitem === newItem.nr_subitem && 
            e.nome_subitem === newItem.nome_subitem
        );
        
        if (existing) {
            return {
                ...existing,
                itens_aquisicao: [...(existing.itens_aquisicao || []), ...newItem.itens_aquisicao]
            };
        }
        return newItem;
    });

    const { data, error } = await supabase
        .from('diretrizes_servicos_terceiros' as any)
        .upsert(finalUpsert, { onConflict: 'user_id,ano_referencia,nr_subitem,nome_subitem' })
        .select();

    if (error) throw error;
    return data as unknown as DiretrizServicosTerceiros[];
}