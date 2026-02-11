import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { DiretrizServicosTerceiros } from "@/types/diretrizesServicosTerceiros";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as ExcelJS from 'exceljs';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

            // Configuração das colunas
            worksheet.columns = [
                { header: 'Nr Subitem', key: 'nr_subitem', width: 15 },
                { header: 'Nome Subitem', key: 'nome_subitem', width: 30 },
                { header: 'Descrição Item', key: 'descricao_item', width: 40 },
                { header: 'CATMAT', key: 'codigo_catmat', width: 15 },
                { header: 'Pregão', key: 'numero_pregao', width: 15 },
                { header: 'UASG', key: 'uasg', width: 15 },
                { header: 'Valor Unitário', key: 'valor_unitario', width: 15 },
            ];

            // Estilização do cabeçalho
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Adição dos dados
            if (diretrizes.length > 0) {
                diretrizes.forEach(d => {
                    const itens = d.itens_aquisicao || [];
                    if (itens.length > 0) {
                        itens.forEach(item => {
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
                    } else {
                        // Adiciona apenas o subitem se não houver itens detalhados
                        worksheet.addRow({
                            nr_subitem: d.nr_subitem,
                            nome_subitem: d.nome_subitem,
                            descricao_item: '',
                            codigo_catmat: '',
                            numero_pregao: '',
                            uasg: '',
                            valor_unitario: 0,
                        });
                    }
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `diretrizes_servicos_terceiros_${selectedYear}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            toast.success("Exportação concluída com sucesso!");
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Erro ao exportar dados para Excel.");
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
            
            if (!worksheet) {
                throw new Error("Não foi possível encontrar a primeira aba da planilha.");
            }

            const subitemsMap = new Map<string, any>();

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Pula o cabeçalho

                const nrSubitem = row.getCell(1).text?.trim();
                const nomeSubitem = row.getCell(2).text?.trim();
                
                if (!nrSubitem || !nomeSubitem) return;

                const descricaoItem = row.getCell(3).text?.trim();
                const codigoCatmat = row.getCell(4).text?.trim();
                const numeroPregao = row.getCell(5).text?.trim();
                const uasg = row.getCell(6).text?.trim();
                const valorUnitario = Number(row.getCell(7).value) || 0;

                if (!subitemsMap.has(nrSubitem)) {
                    subitemsMap.set(nrSubitem, {
                        user_id: user.id,
                        ano_referencia: selectedYear,
                        nr_subitem: nrSubitem,
                        nome_subitem: nomeSubitem,
                        descricao_subitem: '',
                        itens_aquisicao: [],
                        ativo: true
                    });
                }

                if (descricaoItem) {
                    subitemsMap.get(nrSubitem).itens_aquisicao.push({
                        id: crypto.randomUUID(),
                        descricao_item: descricaoItem,
                        codigo_catmat: codigoCatmat,
                        numero_pregao: numeroPregao,
                        uasg: uasg,
                        valor_unitario: valorUnitario
                    });
                }
            });

            const dataToInsert = Array.from(subitemsMap.values());

            if (dataToInsert.length === 0) {
                toast.warning("Nenhum dado válido encontrado para importação.");
                return;
            }

            // Inserção no banco de dados
            const { error } = await supabase
                .from('diretrizes_servicos_terceiros')
                .insert(dataToInsert);

            if (error) throw error;

            toast.success(`${dataToInsert.length} subitens de serviços importados com sucesso!`);
            onImportSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Erro na importação:", error);
            toast.error(`Erro ao importar dados: ${error.message || "Verifique o formato do arquivo."}`);
        } finally {
            setLoading(false);
            // Limpa o input de arquivo
            if (e.target) e.target.value = '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        Exportar/Importar Serviços de Terceiros
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie as diretrizes de serviços de terceiros para o ano de {selectedYear} via Excel.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Exportar Dados Atuais</h4>
                        <p className="text-xs text-muted-foreground">
                            Baixe a lista atual de subitens e itens de serviços para edição ou backup.
                        </p>
                        <Button 
                            onClick={handleExport} 
                            disabled={loading} 
                            variant="outline" 
                            className="w-full"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Exportar para Excel (.xlsx)
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium">Importar Novos Dados</h4>
                        <p className="text-xs text-muted-foreground">
                            Selecione um arquivo Excel seguindo o modelo de colunas para importar novos subitens.
                        </p>
                        <div className="grid w-full items-center gap-1.5">
                            <Input 
                                id="excel-import" 
                                type="file" 
                                accept=".xlsx" 
                                onChange={handleImport} 
                                disabled={loading}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>

                    <Alert variant="default" className="bg-muted/50 border-none">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-xs font-semibold">Importante</AlertTitle>
                        <AlertDescription className="text-[11px] leading-relaxed">
                            A importação adicionará novos registros. Certifique-se de que as colunas estejam na ordem correta: 
                            Nr Subitem, Nome Subitem, Descrição Item, CATMAT, Pregão, UASG e Valor Unitário.
                        </AlertDescription>
                    </Alert>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosExportImportDialog;