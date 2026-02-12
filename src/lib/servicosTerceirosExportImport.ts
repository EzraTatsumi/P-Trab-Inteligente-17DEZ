import * as ExcelJS from 'exceljs';
import { supabase } from "@/integrations/supabase/client";
import { DiretrizServicosTerceiros } from "@/types/diretrizesServicosTerceiros";
import { StagingRow } from "@/types/diretrizesMaterialConsumo";

/**
 * Exporta as diretrizes de serviços para Excel com o modelo atualizado.
 */
export async function exportServicosTerceirosToExcel(diretrizes: DiretrizServicosTerceiros[], year: number) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Serviços_${year}`);

    worksheet.columns = [
        { header: 'NR_SUBITEM', key: 'nr_subitem', width: 15 },
        { header: 'NOME_SUBITEM', key: 'nome_subitem', width: 30 },
        { header: 'DESCRICAO_SUBITEM', key: 'descricao_subitem', width: 30 },
        { header: 'CODIGO_CATMAT', key: 'codigo_catmat', width: 15 },
        { header: 'DESCRICAO_ITEM', key: 'descricao_item', width: 40 },
        { header: 'NOME_REDUZIDO', key: 'nome_reduzido', width: 30 },
        { header: 'UNIDADE_MEDIDA', key: 'unidade_medida', width: 15 },
        { header: 'VALOR_UNITARIO', key: 'valor_unitario', width: 15 },
        { header: 'NUMERO_PREGAO', key: 'numero_pregao', width: 15 },
        { header: 'UASG', key: 'uasg', width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };

    diretrizes.forEach(d => {
        const itens = d.itens_aquisicao || [];
        if (itens.length > 0) {
            itens.forEach(item => {
                worksheet.addRow({
                    nr_subitem: d.nr_subitem,
                    nome_subitem: d.nome_subitem,
                    descricao_subitem: d.descricao_subitem || '',
                    codigo_catmat: item.codigo_catmat,
                    descricao_item: item.descricao_item,
                    nome_reduzido: (item as any).nome_reduzido || item.descricao_reduzida || '',
                    unidade_medida: (item as any).unidade_medida || '',
                    valor_unitario: item.valor_unitario,
                    numero_pregao: item.numero_pregao,
                    uasg: item.uasg,
                });
            });
        }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Diretrizes_ServicosTerceiros_${year}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Processa o arquivo Excel e retorna os dados para revisão (Staging).
 */
export async function processServicosTerceirosImport(file: File, year: number, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const worksheet = workbook.getWorksheet(1);
    
    if (!worksheet) throw new Error("Planilha inválida.");

    const stagedData: any[] = [];
    let totalValid = 0;
    let totalInvalid = 0;
    let totalDuplicates = 0;
    let totalExisting = 0;

    const { data: existingData } = await supabase
        .from('diretrizes_servicos_terceiros')
        .select('itens_aquisicao')
        .eq('user_id', userId)
        .eq('ano_referencia', year);

    const existingItems = (existingData || []).flatMap(d => (d.itens_aquisicao as any[]) || []);
    const existingKeys = new Set(existingItems.map(i => `${i.codigo_catmat}-${i.numero_pregao}-${i.uasg}`));
    const internalKeys = new Set<string>();

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const nr_subitem = row.getCell(1).text?.trim();
        const nome_subitem = row.getCell(2).text?.trim();
        const codigo_catmat = row.getCell(4).text?.trim();
        const descricao_item = row.getCell(5).text?.trim();
        const nome_reduzido = row.getCell(6).text?.trim();
        const unidade_medida = row.getCell(7).text?.trim();
        const valor_unitario = Number(row.getCell(8).value) || 0;
        const numero_pregao = row.getCell(9).text?.trim();
        const uasg = row.getCell(10).text?.trim();

        const errors: string[] = [];
        if (!nr_subitem) errors.push("Nr Subitem ausente");
        if (!nome_subitem) errors.push("Nome Subitem ausente");
        if (!descricao_item) errors.push("Descrição do item ausente");
        if (!nome_reduzido) errors.push("Nome reduzido ausente");
        if (!unidade_medida) errors.push("Unidade de medida ausente");
        if (valor_unitario <= 0) errors.push("Valor unitário inválido");

        const itemKey = `${codigo_catmat}-${numero_pregao}-${uasg}`;
        const isDuplicateInternal = internalKeys.has(itemKey);
        const isDuplicateExternal = existingKeys.has(itemKey);

        if (isDuplicateInternal) totalDuplicates++;
        if (isDuplicateExternal) totalExisting++;

        const isValid = errors.length === 0 && !isDuplicateInternal && !isDuplicateExternal;
        if (isValid) {
            totalValid++;
            internalKeys.add(itemKey);
        } else {
            totalInvalid++;
        }

        stagedData.push({
            originalRowIndex: rowNumber,
            nr_subitem,
            nome_subitem,
            descricao_subitem: row.getCell(3).text?.trim() || '',
            codigo_catmat,
            descricao_item,
            nome_reduzido,
            unidade_medida,
            valor_unitario,
            numero_pregao,
            uasg,
            isValid,
            errors,
            isDuplicateInternal,
            isDuplicateExternal
        });
    });

    return { stagedData, totalValid, totalInvalid, totalDuplicates, totalExisting };
}

/**
 * Persiste os dados validados no banco de dados.
 */
export async function persistServicosTerceirosImport(stagedData: any[], year: number, userId: string) {
    const validRows = stagedData.filter(r => r.isValid);
    const subitemsMap = new Map<string, any>();

    for (const row of validRows) {
        const key = `${row.nr_subitem}-${row.nome_subitem}`;
        if (!subitemsMap.has(key)) {
            const { data: existingSubitem } = await supabase
                .from('diretrizes_servicos_terceiros')
                .select('*')
                .eq('user_id', userId)
                .eq('ano_referencia', year)
                .eq('nr_subitem', row.nr_subitem)
                .maybeSingle();

            subitemsMap.set(key, {
                id: existingSubitem?.id,
                user_id: userId,
                ano_referencia: year,
                nr_subitem: row.nr_subitem,
                nome_subitem: row.nome_subitem,
                descricao_subitem: row.descricao_subitem || existingSubitem?.descricao_subitem || '',
                itens_aquisicao: existingSubitem?.itens_aquisicao || [],
                ativo: true
            });
        }

        const subitem = subitemsMap.get(key);
        subitem.itens_aquisicao.push({
            id: crypto.randomUUID(),
            descricao_item: row.descricao_item,
            nome_reduzido: row.nome_reduzido,
            unidade_medida: row.unidade_medida,
            codigo_catmat: row.codigo_catmat,
            numero_pregao: row.numero_pregao,
            uasg: row.uasg,
            valor_unitario: row.valor_unitario
        });
    }

    for (const subitem of subitemsMap.values()) {
        if (subitem.id) {
            await supabase.from('diretrizes_servicos_terceiros').update(subitem).eq('id', subitem.id);
        } else {
            await supabase.from('diretrizes_servicos_terceiros').insert([subitem]);
        }
    }
}