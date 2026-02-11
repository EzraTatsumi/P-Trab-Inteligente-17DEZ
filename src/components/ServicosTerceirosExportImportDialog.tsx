import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, AlertCircle, Loader2, CheckCircle2, X, ListFilter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { DiretrizServicoTerceiro, ItemServico } from "@/types/diretrizesServicosTerceiros";
import ExcelJS from "exceljs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/formatUtils";

interface ServicosTerceirosExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizServicoTerceiro[];
    onImportSuccess: () => void;
}

const ServicosTerceirosExportImportDialog = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizes,
    onImportSuccess
}: ServicosTerceirosExportImportDialogProps) => {
    const { user } = useSession();
    const [isImporting, setIsImporting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [previewData, setPreviewData] = useState<any[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const columns = [
        "NR_SUBITEM", "NOME_SUBITEM", "DESCRICAO_SUBITEM", "CODIGO_CATSER", 
        "DESCRICAO_ITEM", "NOME_REDUZIDO", "UNIDADE_MEDIDA", "VALOR_UNITARIO", 
        "NUMERO_PREGAO", "UASG"
    ];

    const handleExport = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet(`Serviços ${selectedYear}`);

            worksheet.columns = columns.map(col => ({ header: col, key: col, width: 20 }));

            diretrizes.forEach(diretriz => {
                diretriz.itens_aquisicao.forEach(item => {
                    worksheet.addRow({
                        NR_SUBITEM: diretriz.nr_subitem,
                        NOME_SUBITEM: diretriz.nome_subitem,
                        DESCRICAO_SUBITEM: diretriz.descricao_subitem || "",
                        CODIGO_CATSER: item.codigo_catser,
                        DESCRICAO_ITEM: item.descricao_item,
                        NOME_REDUZIDO: item.nome_reduzido,
                        UNIDADE_MEDIDA: item.unidade_medida,
                        VALOR_UNITARIO: item.valor_unitario,
                        NUMERO_PREGAO: item.numero_pregao,
                        UASG: item.uasg
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `diretrizes_servicos_${selectedYear}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success("Diretrizes exportadas com sucesso!");
        } catch (error) {
            toast.error("Erro ao exportar para Excel.");
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(file);
            const worksheet = workbook.getWorksheet(1);
            
            if (!worksheet) throw new Error("Planilha não encontrada.");

            const data: any[] = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                const rowData: any = {};
                row.eachCell((cell, colNumber) => {
                    const header = worksheet.getRow(1).getCell(colNumber).value as string;
                    rowData[header] = cell.value;
                });
                data.push(rowData);
            });

            setPreviewData(data);
            toast.success("Arquivo analisado com sucesso! Verifique a pré-visualização.");
        } catch (error: any) {
            toast.error(`Erro ao analisar arquivo: ${error.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!previewData || !user) return;

        setIsImporting(true);
        try {
            // Agrupar por subitem
            const groupedData: Record<string, any> = {};
            previewData.forEach(row => {
                const key = row.NR_SUBITEM;
                if (!groupedData[key]) {
                    groupedData[key] = {
                        nr_subitem: String(row.NR_SUBITEM),
                        nome_subitem: row.NOME_SUBITEM,
                        descricao_subitem: row.DESCRICAO_SUBITEM,
                        itens_aquisicao: []
                    };
                }
                groupedData[key].itens_aquisicao.push({
                    id: crypto.randomUUID(),
                    codigo_catser: String(row.CODIGO_CATSER || ""),
                    descricao_item: row.DESCRICAO_ITEM,
                    nome_reduzido: row.NOME_REDUZIDO,
                    unidade_medida: row.UNIDADE_MEDIDA,
                    valor_unitario: Number(row.VALOR_UNITARIO) || 0,
                    numero_pregao: String(row.NUMERO_PREGAO || ""),
                    uasg: String(row.UASG || "")
                });
            });

            // Deletar existentes
            await supabase
                .from("diretrizes_servicos_terceiros")
                .delete()
                .eq("user_id", user.id)
                .eq("ano_referencia", selectedYear);

            // Inserir novos
            const toInsert = Object.values(groupedData).map(d => ({
                ...d,
                user_id: user.id,
                ano_referencia: selectedYear,
                ativo: true
            }));

            const { error } = await supabase.from("diretrizes_servicos_terceiros").insert(toInsert);
            if (error) throw error;

            toast.success("Importação concluída com sucesso!");
            onImportSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(`Erro na importação: ${error.message}`);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) setPreviewData(null);
            onOpenChange(val);
        }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        <DialogTitle>Exportar/Importar Serviços de Terceiros</DialogTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Gerencie as diretrizes de Serviços de Terceiros (Subitens da ND 33.90.39) para o ano {selectedYear}.
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-6">
                    {/* SEÇÃO EXPORTAR */}
                    <div className="bg-muted/40 p-6 rounded-xl border border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-background p-2 rounded-lg border shadow-sm">
                                <Download className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="font-semibold text-lg">Exportar Dados</h3>
                        </div>
                        <Button 
                            onClick={handleExport} 
                            disabled={diretrizes.length === 0}
                            className="bg-[#1e293b] hover:bg-[#0f172a] text-white px-8"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Exportar ({diretrizes.length} Subitens)
                        </Button>
                    </div>

                    {/* SEÇÃO IMPORTAR */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-xl">Importação de Diretrizes</h3>
                        
                        <div className="bg-muted/40 p-6 rounded-xl border border-border/50 space-y-4">
                            <div className="flex items-center gap-2 text-primary font-semibold">
                                <Upload className="h-5 w-5" />
                                <span>1. Selecionar Arquivo</span>
                            </div>
                            
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Carregue um arquivo Excel (.xlsx) contendo as colunas: <span className="font-mono text-[10px] bg-background px-1 rounded border">{columns.join(", ")}</span>.
                            </p>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    ref={fileInputRef}
                                    disabled={isAnalyzing || isImporting}
                                />
                                <Button 
                                    variant="outline" 
                                    className="w-full h-12 border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isAnalyzing || isImporting}
                                >
                                    {isAnalyzing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <FileSpreadsheet className="mr-2 h-4 w-4 text-primary" />
                                    )}
                                    Selecionar Arquivo (.xlsx)
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* PRÉ-VISUALIZAÇÃO */}
                    {previewData && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2">
                                    <ListFilter className="h-4 w-4 text-primary" />
                                    Pré-visualização dos Dados ({previewData.length} itens)
                                </h4>
                                <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="h-8 text-destructive">
                                    <X className="h-4 w-4 mr-1" /> Limpar
                                </Button>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <ScrollArea className="h-[250px]">
                                    <Table>
                                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                            <TableRow>
                                                <TableHead className="text-[10px]">SUBITEM</TableHead>
                                                <TableHead className="text-[10px]">NOME REDUZIDO</TableHead>
                                                <TableHead className="text-[10px]">UNIDADE</TableHead>
                                                <TableHead className="text-[10px] text-right">VALOR</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {previewData.map((row, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-[11px] font-medium">{row.NR_SUBITEM}</TableCell>
                                                    <TableCell className="text-[11px]">{row.NOME_REDUZIDO}</TableCell>
                                                    <TableCell className="text-[11px]">{row.UNIDADE_MEDIDA}</TableCell>
                                                    <TableCell className="text-[11px] text-right font-semibold text-primary">
                                                        {formatCurrency(Number(row.VALOR_UNITARIO))}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="border-t pt-4 flex items-center justify-between sm:justify-between">
                    <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground max-w-[60%]">
                        <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                        <span>A importação substituirá todos os dados de serviços do ano {selectedYear}.</span>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            className="bg-[#94a3b8] hover:bg-[#64748b] text-white"
                            disabled={!previewData || isImporting}
                            onClick={handleConfirmImport}
                        >
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Confirmar Importação
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Fechar
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ServicosTerceirosExportImportDialog;