import React, { useCallback } from 'react';
import { FileText, Download, Plane } from "lucide-react";
import ExcelJS from 'exceljs';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { PTrabData, GrupoOMOperacional, HorasVooRegistro } from "@/pages/PTrabReportManager";

// Definindo a interface de props para HorasDeVooReport
export interface HorasDeVooReportProps {
    ptrabData: PTrabData;
    omsOrdenadas: string[];
    gruposPorOM: Record<string, GrupoOMOperacional>;
    registrosHorasVoo: HorasVooRegistro[];
    fileSuffix: string;
    generateHorasVooMemoriaCalculo: (registro: HorasVooRegistro) => string;
}

const HorasDeVooReport: React.FC<HorasDeVooReportProps> = ({
    ptrabData,
    omsOrdenadas,
    gruposPorOM,
    registrosHorasVoo,
    fileSuffix,
    generateHorasVooMemoriaCalculo,
}) => {
    const reportName = "P Trab Hora de Voo";
    const fileName = `${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao} - ${fileSuffix}.xlsx`;

    const totalGeral = registrosHorasVoo.reduce((acc, r) => acc + r.valor_total, 0);
    const totalND30 = registrosHorasVoo.reduce((acc, r) => acc + r.valor_nd_30, 0);
    const totalND39 = registrosHorasVoo.reduce((acc, r) => acc + r.valor_nd_39, 0);
    const totalHV = registrosHorasVoo.reduce((acc, r) => acc + r.quantidade_hv, 0);

    const exportToExcel = useCallback(async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Horas de Voo');

        // 1. Cabeçalho do Relatório
        worksheet.mergeCells('A1:H1');
        worksheet.getCell('A1').value = `RELATÓRIO DE HORAS DE VOO (AvEx) - P TRAB: ${ptrabData.numero_ptrab} - ${ptrabData.nome_operacao}`;
        worksheet.getCell('A1').font = { bold: true, size: 14 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };

        worksheet.addRow([]); // Linha em branco

        // 2. Tabela de Resumo
        worksheet.addRow(['RESUMO GERAL']);
        worksheet.getCell('A3').font = { bold: true };
        worksheet.addRow(['Total de Horas de Voo (HV)', 'Total ND 33.90.30', 'Total ND 33.90.39', 'Total Geral']);
        worksheet.getRow(4).font = { bold: true };
        worksheet.addRow([
            formatNumber(totalHV, 2),
            formatCurrency(totalND30),
            formatCurrency(totalND39),
            formatCurrency(totalGeral),
        ]);
        worksheet.getRow(5).alignment = { horizontal: 'center' };

        worksheet.addRow([]); // Linha em branco
        worksheet.addRow([]); // Linha em branco

        // 3. Tabela Detalhada por OM
        let currentRow = 7;

        omsOrdenadas.forEach(omName => {
            const grupo = gruposPorOM[omName];
            const registrosOM = grupo.horasVoo;

            if (registrosOM.length === 0) return;

            // Título da OM
            worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `OM DETENTORA DO RECURSO: ${omName}`;
            worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
            worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E3F2' } }; // Light Blue
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left' };
            currentRow++;

            // Cabeçalho da Tabela
            worksheet.addRow([
                'OM Favorecida',
                'UG Favorecida',
                'Município/Destino',
                'Tipo ANV',
                'Horas de Voo (HV)',
                'ND 33.90.30',
                'ND 33.90.39',
                'Valor Total',
                'Amparo/Detalhamento',
            ]);
            worksheet.getRow(currentRow).font = { bold: true };
            worksheet.getRow(currentRow).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            currentRow++;

            // Linhas de Dados
            registrosOM.forEach(registro => {
                worksheet.addRow([
                    registro.organizacao,
                    registro.ug,
                    `${registro.municipio} (${registro.codug_destino})`,
                    registro.tipo_anv,
                    formatNumber(registro.quantidade_hv, 2),
                    formatCurrency(registro.valor_nd_30),
                    formatCurrency(registro.valor_nd_39),
                    formatCurrency(registro.valor_total),
                    registro.amparo || registro.detalhamento || 'N/I',
                ]);
                worksheet.getRow(currentRow).alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                currentRow++;
            });

            // Total da OM
            const totalOM = registrosOM.reduce((acc, r) => acc + r.valor_total, 0);
            const totalOM_HV = registrosOM.reduce((acc, r) => acc + r.quantidade_hv, 0);
            const totalOM_ND30 = registrosOM.reduce((acc, r) => acc + r.valor_nd_30, 0);
            const totalOM_ND39 = registrosOM.reduce((acc, r) => acc + r.valor_nd_39, 0);

            worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
            worksheet.getCell(`A${currentRow}`).value = `TOTAL ${omName}`;
            worksheet.getCell(`A${currentRow}`).font = { bold: true };
            worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'right' };
            
            worksheet.getCell(`E${currentRow}`).value = formatNumber(totalOM_HV, 2);
            worksheet.getCell(`E${currentRow}`).font = { bold: true };
            worksheet.getCell(`F${currentRow}`).value = formatCurrency(totalOM_ND30);
            worksheet.getCell(`F${currentRow}`).font = { bold: true };
            worksheet.getCell(`G${currentRow}`).value = formatCurrency(totalOM_ND39);
            worksheet.getCell(`G${currentRow}`).font = { bold: true };
            worksheet.getCell(`H${currentRow}`).value = formatCurrency(totalOM);
            worksheet.getCell(`H${currentRow}`).font = { bold: true };
            worksheet.getRow(currentRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; // Gray
            currentRow++;

            worksheet.addRow([]); // Linha em branco
            currentRow++;
        });

        // 4. Memória de Cálculo (Nova Aba)
        const memoriaWorksheet = workbook.addWorksheet('Memória de Cálculo');
        memoriaWorksheet.mergeCells('A1:B1');
        memoriaWorksheet.getCell('A1').value = `MEMÓRIA DE CÁLCULO DETALHADA - HORAS DE VOO`;
        memoriaWorksheet.getCell('A1').font = { bold: true, size: 14 };
        memoriaWorksheet.getCell('A1').alignment = { horizontal: 'center' };
        memoriaWorksheet.addRow([]);

        let memoriaRow = 3;
        registrosHorasVoo.forEach((registro, index) => {
            const memoria = generateHorasVooMemoriaCalculo(registro);
            
            memoriaWorksheet.mergeCells(`A${memoriaRow}:B${memoriaRow}`);
            memoriaWorksheet.getCell(`A${memoriaRow}`).value = `[${index + 1}] ${registro.organizacao} - ${registro.tipo_anv} (${registro.municipio})`;
            memoriaWorksheet.getCell(`A${memoriaRow}`).font = { bold: true };
            memoriaRow++;

            memoriaWorksheet.mergeCells(`A${memoriaRow}:B${memoriaRow}`);
            memoriaWorksheet.getCell(`A${memoriaRow}`).value = memoria;
            memoriaWorksheet.getCell(`A${memoriaRow}`).alignment = { wrapText: true, vertical: 'top' };
            memoriaRow++;
            
            memoriaWorksheet.addRow([]);
            memoriaRow++;
        });
        
        // Ajuste de Largura das Colunas
        worksheet.columns = [
            { key: 'om_favorecida', width: 20 },
            { key: 'ug_favorecida', width: 12 },
            { key: 'municipio', width: 25 },
            { key: 'tipo_anv', width: 15 },
            { key: 'hv', width: 15 },
            { key: 'nd30', width: 15 },
            { key: 'nd39', width: 15 },
            { key: 'total', width: 15 },
            { key: 'amparo', width: 40 },
        ];
        memoriaWorksheet.columns = [
            { key: 'memoria', width: 60 },
            { key: 'vazio', width: 10 },
        ];

        // Geração do arquivo
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        window.URL.revokeObjectURL(url);

    }, [ptrabData, omsOrdenadas, gruposPorOM, registrosHorasVoo, fileSuffix, generateHorasVooMemoriaCalculo, totalGeral, totalND30, totalND39, totalHV]);

    if (registrosHorasVoo.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-muted-foreground">Nenhum registro de Horas de Voo encontrado.</p>
            </div>
        );
    }

    return (
        <div className="p-4 print:p-0">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h2 className="text-xl font-bold">Relatório: {reportName}</h2>
                <Button onClick={exportToExcel} className="flex items-center">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar para Excel
                </Button>
            </div>

            {/* Resumo Geral */}
            <div className="mb-8 border rounded-lg p-4 bg-gray-50 print:border-none print:p-0 print:mb-4">
                <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <Plane className="w-5 h-5 mr-2 text-purple-600" />
                    Resumo Geral de Horas de Voo
                </h3>
                <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="p-2 bg-white rounded-md border">
                        <p className="text-muted-foreground">Total de Horas de Voo (HV)</p>
                        <p className="font-bold text-lg">{formatNumber(totalHV, 2)} HV</p>
                    </div>
                    <div className="p-2 bg-white rounded-md border">
                        <p className="text-muted-foreground">Total ND 33.90.30 (Custeio)</p>
                        <p className="font-bold text-lg text-green-600">{formatCurrency(totalND30)}</p>
                    </div>
                    <div className="p-2 bg-white rounded-md border">
                        <p className="text-muted-foreground">Total ND 33.90.39 (Serviços)</p>
                        <p className="font-bold text-lg text-blue-600">{formatCurrency(totalND39)}</p>
                    </div>
                    <div className="p-2 bg-white rounded-md border">
                        <p className="text-muted-foreground">Total Geral</p>
                        <p className="font-bold text-xl text-primary">{formatCurrency(totalGeral)}</p>
                    </div>
                </div>
            </div>

            {/* Detalhamento por OM */}
            <div className="space-y-8">
                {omsOrdenadas.map(omName => {
                    const grupo = gruposPorOM[omName];
                    const registrosOM = grupo.horasVoo;

                    if (registrosOM.length === 0) return null;

                    const totalOM = registrosOM.reduce((acc, r) => acc + r.valor_total, 0);
                    const totalOM_HV = registrosOM.reduce((acc, r) => acc + r.quantidade_hv, 0);
                    const totalOM_ND30 = registrosOM.reduce((acc, r) => acc + r.valor_nd_30, 0);
                    const totalOM_ND39 = registrosOM.reduce((acc, r) => acc + r.valor_nd_39, 0);

                    return (
                        <div key={omName} className="break-inside-avoid-page">
                            <h3 className="text-lg font-bold mb-2 p-2 bg-gray-100 border-l-4 border-purple-500 print:bg-gray-200 print:text-base">
                                OM DETENTORA DO RECURSO: {omName}
                            </h3>
                            <Table className="text-sm">
                                <TableHeader>
                                    <TableRow className="bg-gray-50 print:bg-gray-100">
                                        <TableHead className="w-[150px]">OM Favorecida</TableHead>
                                        <TableHead className="w-[80px]">UG</TableHead>
                                        <TableHead className="w-[150px]">Município/Destino</TableHead>
                                        <TableHead className="w-[80px]">Tipo ANV</TableHead>
                                        <TableHead className="w-[100px] text-right">HV</TableHead>
                                        <TableHead className="w-[120px] text-right">ND 33.90.30</TableHead>
                                        <TableHead className="w-[120px] text-right">ND 33.90.39</TableHead>
                                        <TableHead className="w-[120px] text-right">Total</TableHead>
                                        <TableHead>Amparo/Detalhamento</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {registrosOM.map((registro, index) => (
                                        <TableRow key={registro.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                                            <TableCell className="font-medium">{registro.organizacao}</TableCell>
                                            <TableCell>{registro.ug}</TableCell>
                                            <TableCell>{registro.municipio} ({registro.codug_destino})</TableCell>
                                            <TableCell>{registro.tipo_anv}</TableCell>
                                            <TableCell className="text-right">{formatNumber(registro.quantidade_hv, 2)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(registro.valor_nd_30)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(registro.valor_nd_39)}</TableCell>
                                            <TableCell className="text-right font-semibold">{formatCurrency(registro.valor_total)}</TableCell>
                                            <TableCell className="text-xs whitespace-pre-wrap">
                                                {registro.amparo || generateHorasVooMemoriaCalculo(registro)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Linha de Total da OM */}
                                    <TableRow className="bg-purple-100 font-bold print:bg-purple-100">
                                        <TableCell colSpan={4} className="text-right">TOTAL {omName}</TableCell>
                                        <TableCell className="text-right">{formatNumber(totalOM_HV, 2)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalOM_ND30)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalOM_ND39)}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(totalOM)}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    );
                })}
            </div>
            
            {/* Total Geral no final para impressão */}
            <div className="mt-8 pt-4 border-t border-gray-300 print:block hidden">
                <h3 className="text-xl font-bold mb-2">TOTAL GERAL DO RELATÓRIO</h3>
                <div className="flex justify-between text-lg font-semibold">
                    <p>Total de Horas de Voo (HV): <span className="text-primary">{formatNumber(totalHV, 2)} HV</span></p>
                    <p>Total ND 33.90.30: <span className="text-green-600">{formatCurrency(totalND30)}</span></p>
                    <p>Total ND 33.90.39: <span className="text-blue-600">{formatCurrency(totalND39)}</span></p>
                    <p>TOTAL GERAL: <span className="text-2xl text-primary">{formatCurrency(totalGeral)}</span></p>
                </div>
            </div>
        </div>
    );
};

export default HorasDeVooReport;