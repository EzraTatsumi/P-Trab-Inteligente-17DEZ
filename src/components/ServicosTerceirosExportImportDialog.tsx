import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
import { DiretrizServicosTerceiros } from "@/types/diretrizesServicosTerceiros";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as ExcelJS from 'exceljs';

interface ServicosTerceirosExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizServicosTerceiros[];
    onImportSuccess: () => void;
}

const ServicosTerceirosExportImportDialog: React.FC<ServicosTerceirosExportImportDialogProps> = ({
    open, onOpenChange, selectedYear, diretrizes, onImportSuccess
}) => {
    const [loading, setLoading] = React.useState(false);

    const handleExport = async () => {
        try {
            setLoading(true);
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Serviços de Terceiros');

            worksheet.columns = [
                { header: 'Nr Subitem', key: 'nr_subitem', width: 15 },
                { header: 'Nome Subitem', key: 'nome_subitem', width: 30 },
                { header: 'Descrição Item', key: 'descricao_item', width: 40 },
                { header: 'CATMAT', key: 'codigo_catmat', width: 15 },
                { header: 'Pregão', key: 'numero_pregao', width: 15 },
                { header: 'UASG', key: 'uasg', width: 15 },
                { header: 'Valor Unitário', key: 'valor_unitario', width: 15 },
            ];

            diretrizes.forEach(d => {
                d.itens_aquisicao.forEach(item => {
                    worksheet.addRow({
                        nr_subitem: d.nr_subitem,
                        nome_subitem: d.nome_subitem,
                        descricao_item: item.descricao_item,
                        codigo_catmat: item.codigo_catmat,
                        numero_pregao: item.numero_pregao,
                        uasg: item.uasg,
                        valor_unitario: item.valor_unitario,
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diretrizes_servicos_${selectedYear}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success("Exportação concluída!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao exportar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(file);
            const worksheet = workbook.getWorksheet(1);
            if (!worksheet) throw new Error("Planilha não encontrada");

            const subitemsMap = new Map<string, Partial<DiretrizServicosTerceiros>>();

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const nrSubitem = row.getCell(1).text;
                const nomeSubitem = row.getCell(2).text;
                const item = {
                    id: crypto.randomUUID(),
                    descricao_item: row.getCell(3).text,
                    codigo_catmat: row.getCell(4).text,
                    numero_pregao: row.getCell(5).text,
                    uasg: row.getCell(6).text,
                    valor_unitario: Number(row.getCell(7).value) || 0,
                };

                if (!subitemsMap.has(nrSubitem)) {
                    subitemsMap.set(nrSubitem, {
                        nr_subitem: nrSubitem,
                        nome_subitem: nomeSubitem,
                        itens_aquisicao: [],
                        ativo: true,
                        ano_referencia: selectedYear,
                        user_id: user.id
                    });
                }
                subitemsMap.get(nrSubitem)!.itens_aquisicao!.push(item);
            });

            for (const data of subitemsMap.values()) {
                const { error } = await supabase
                    .from('diretrizes_servicos_terceiros')
                    .insert([data as any]);
                if (error) throw error;
            }

            toast.success("Importação concluída!");
            onImportSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao importar dados.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Exportar/Importar Serviços de Terceiros</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                    <Button onClick={handleExport} disabled={loading} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Exportar para Excel
                    </Button>
                    <div className="relative">
                        <Input type="file" accept=".xlsx" onChange={handleImport} disabled={loading} className="cursor-pointer" />
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosExportImportDialog;