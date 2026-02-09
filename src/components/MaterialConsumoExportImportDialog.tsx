import React, { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileSpreadsheet, Upload, Download, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DiretrizMaterialConsumo, StagingRow } from "@/types/diretrizesMaterialConsumo";
import { exportMaterialConsumoToExcel, processMaterialConsumoImport, persistMaterialConsumoImport } from '@/lib/materialConsumoExportImport';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useSession } from '@/components/SessionContextProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/formatUtils';
import { Badge } from '@/components/ui/badge';

interface MaterialConsumoExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizMaterialConsumo[];
    onImportSuccess: () => void;
}

const MaterialConsumoExportImportDialog: React.FC<MaterialConsumoExportImportDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizes,
    onImportSuccess,
}) => {
    const { user } = useSession();
    const [isProcessing, setIsProcessing] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [stagingData, setStagingData] = useState<StagingRow[] | null>(null);
    const [importStep, setImportStep] = useState<'upload' | 'review'>('upload');

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleExport = () => {
        try {
            exportMaterialConsumoToExcel(diretrizes, selectedYear);
        } catch (e) {
            toast.error("Falha ao exportar para Excel.");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error("Por favor, selecione um arquivo Excel (.xlsx).");
                setFile(null);
                return;
            }
            setFile(selectedFile);
            setStagingData(null);
        }
    };

    const handleProcessFile = useCallback(async () => {
        if (!file) return;

        setIsProcessing(true);
        try {
            const rows = await processMaterialConsumoImport(file);
            setStagingData(rows);
            setImportStep('review');
            toast.info(`Arquivo processado. ${rows.length} linhas prontas para revisão.`);
        } catch (error: any) {
            toast.error(error.message || "Erro ao processar o arquivo.");
            setStagingData(null);
        } finally {
            setIsProcessing(false);
        }
    }, [file]);

    const handleCommitImport = useCallback(async () => {
        if (!stagingData || !user?.id) return;

        const rowsToImport = stagingData.filter(row => row.status === 'ok');
        if (rowsToImport.length === 0) {
            toast.error("Nenhum dado válido para importar.");
            return;
        }

        setIsProcessing(true);
        try {
            await persistMaterialConsumoImport(rowsToImport, selectedYear, user.id);
            onImportSuccess();
            handleClose();
        } catch (error: any) {
            toast.error(error.message || "Erro ao salvar dados no banco.");
        } finally {
            setIsProcessing(false);
        }
    }, [stagingData, selectedYear, user?.id, onImportSuccess]);

    const handleClose = () => {
        setFile(null);
        setStagingData(null);
        setImportStep('upload');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onOpenChange(false);
    };
    
    const totalErrors = useMemo(() => stagingData?.filter(r => r.status === 'error').length || 0, [stagingData]);
    const totalWarnings = useMemo(() => stagingData?.filter(r => r.status === 'warning').length || 0, [stagingData]);
    const totalOk = useMemo(() => stagingData?.filter(r => r.status === 'ok').length || 0, [stagingData]);

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Exportar/Importar Diretrizes de Material de Consumo (Ano {selectedYear})
                    </DialogTitle>
                </DialogHeader>

                {/* EXPORT SECTION */}
                <div className="border-b pb-4 mb-4">
                    <h3 className="text-lg font-semibold mb-2">Exportar Diretrizes Existentes</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                        Exporte as diretrizes cadastradas para o ano {selectedYear} para um arquivo Excel.
                    </p>
                    <Button 
                        onClick={handleExport} 
                        disabled={diretrizes.length === 0 || isProcessing}
                        variant="outline"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar ({diretrizes.length} diretrizes)
                    </Button>
                </div>

                {/* IMPORT SECTION */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Importar Novas Diretrizes (UPSERT)</h3>
                    
                    {importStep === 'upload' && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Selecione um arquivo Excel (.xlsx) contendo os dados dos subitens e itens de aquisição.
                            </p>
                            <Input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                ref={fileInputRef}
                                disabled={isProcessing}
                            />
                            <Button 
                                onClick={handleProcessFile} 
                                disabled={!file || isProcessing}
                                className="w-full"
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {isProcessing ? "Processando..." : "Processar Arquivo"}
                            </Button>
                            <Alert variant="default" className="border-l-4 border-blue-500">
                                <AlertCircle className="h-4 w-4 text-blue-500" />
                                <AlertTitle>Atenção ao Formato</AlertTitle>
                                <AlertDescription>
                                    O arquivo deve seguir o formato de exportação. A importação fará um UPSERT (cria ou atualiza) baseado no 'Nr Subitem'.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}

                    {importStep === 'review' && stagingData && (
                        <div className="space-y-4">
                            <Alert variant={totalErrors > 0 ? "destructive" : "default"} className={cn(totalErrors === 0 && "border-l-4 border-green-500")}>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Revisão de Dados</AlertTitle>
                                <AlertDescription>
                                    {totalErrors > 0 
                                        ? `Foram encontrados ${totalErrors} erro(s). Corrija o arquivo ou filtre os itens válidos para continuar.`
                                        : `Todos os ${stagingData.length} itens foram validados. Total de itens prontos para importação: ${totalOk}.`
                                    }
                                </AlertDescription>
                            </Alert>

                            <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[100px]">Status</TableHead>
                                            <TableHead className="w-[100px]">Subitem</TableHead>
                                            <TableHead>Item de Aquisição</TableHead>
                                            <TableHead className="w-[120px] text-right">Valor Unitário</TableHead>
                                            <TableHead className="w-[150px]">Mensagem</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stagingData.map((row, index) => (
                                            <TableRow key={index} className={cn(
                                                row.status === 'error' && 'bg-red-50/50',
                                                row.status === 'warning' && 'bg-yellow-50/50'
                                            )}>
                                                <TableCell>
                                                    <Badge variant={row.status === 'ok' ? 'ptrab-aprovado' : row.status === 'error' ? 'destructive' : 'secondary'}>
                                                        {row.status.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <p className="font-semibold">{row.nr_subitem}</p>
                                                    <p className="text-muted-foreground">{row.nome_subitem}</p>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {row.descricao_item || 'N/A'}
                                                    <p className="text-muted-foreground text-[10px]">
                                                        CATMAT: {row.codigo_catmat || 'N/A'} | Pregão: {row.numero_pregao || 'N/A'}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-medium">
                                                    {row.valor_unitario ? formatCurrency(row.valor_unitario) : 'R$ 0,00'}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                                    {row.message}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    {importStep === 'review' && (
                        <>
                            <Button 
                                onClick={() => setImportStep('upload')} 
                                variant="outline"
                                disabled={isProcessing}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Cancelar Revisão
                            </Button>
                            <Button 
                                onClick={handleCommitImport} 
                                disabled={totalErrors > 0 || totalOk === 0 || isProcessing}
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Confirmar Importação ({totalOk} itens)
                            </Button>
                        </>
                    )}
                    {importStep === 'upload' && (
                        <Button onClick={handleClose} variant="outline">
                            Fechar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoExportImportDialog;