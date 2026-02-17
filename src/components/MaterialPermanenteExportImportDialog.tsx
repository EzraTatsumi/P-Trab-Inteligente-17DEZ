import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle, List, XCircle, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { DiretrizMaterialPermanente, StagingRowPermanente } from "@/types/diretrizesMaterialPermanente";
import { exportMaterialPermanenteToExcel, processMaterialPermanenteImport, persistMaterialPermanenteImport } from '@/lib/materialPermanenteExportImport';
import { useSession } from '@/components/SessionContextProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MaterialPermanenteExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizMaterialPermanente[];
    onImportSuccess: (newItems?: DiretrizMaterialPermanente[]) => void;
}

type ImportStep = 'select_file' | 'processing' | 'review';

const MaterialPermanenteExportImportDialog: React.FC<MaterialPermanenteExportImportDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    diretrizes,
    onImportSuccess,
}) => {
    const { user } = useSession();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [step, setStep] = useState<ImportStep>('select_file');
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [stagedData, setStagedData] = useState<StagingRowPermanente[]>([]);
    const [importSummary, setImportSummary] = useState({
        totalRows: 0,
        totalValid: 0,
        totalInvalid: 0,
        totalDuplicates: 0,
        totalExisting: 0,
    });

    const handleOpenChangeWrapper = (newOpen: boolean) => {
        if (!newOpen) {
            setStep('select_file');
            setSelectedFile(null);
            setStagedData([]);
        }
        onOpenChange(newOpen);
    };

    const handleExport = useCallback(async () => {
        if (diretrizes.length === 0) {
            toast.warning("Não há dados para exportar no ano selecionado.");
            return;
        }
        setIsProcessing(true);
        try {
            await exportMaterialPermanenteToExcel(diretrizes, selectedYear);
            toast.success("Exportação concluída!");
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Falha ao exportar dados para Excel.");
        } finally {
            setIsProcessing(false);
        }
    }, [diretrizes, selectedYear]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            setSelectedFile(file);
        } else if (file) {
            toast.error("Formato de arquivo inválido. Use .xlsx.");
        }
    };
    
    const handleProcessFile = useCallback(async () => {
        if (!selectedFile || !user?.id) return;
        setStep('processing');
        setIsProcessing(true);
        try {
            const result = await processMaterialPermanenteImport(selectedFile, selectedYear, user.id);
            setStagedData(result.stagedData);
            setImportSummary({
                totalRows: result.stagedData.length,
                totalValid: result.totalValid,
                totalInvalid: result.totalInvalid,
                totalDuplicates: result.totalDuplicates,
                totalExisting: result.totalExisting,
            });
            setStep('review');
        } catch (error: any) {
            toast.error("Falha ao processar o arquivo.");
            setStep('select_file');
        } finally {
            setIsProcessing(false);
        }
    }, [selectedFile, selectedYear, user?.id]);

    const handleConfirmImport = useCallback(async () => {
        if (importSummary.totalValid === 0 || !user?.id) return;
        setIsProcessing(true);
        try {
            const newItems = await persistMaterialPermanenteImport(stagedData, selectedYear, user.id);
            onImportSuccess(newItems); 
            toast.success("Importação concluída!");
            handleOpenChangeWrapper(false);
        } catch (error: any) {
            toast.error("Falha ao salvar as diretrizes.");
        } finally {
            setIsProcessing(false);
        }
    }, [stagedData, selectedYear, user?.id, importSummary, onImportSuccess]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Exportar/Importar Material Permanente (GND 4)
                    </DialogTitle>
                    <DialogDescription>Gerencie as diretrizes de Material Permanente para o ano {selectedYear}.</DialogDescription>
                </DialogHeader>

                <div className="p-4 border rounded-lg bg-muted/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" /> 
                        <h3 className="text-lg font-semibold">Exportar Dados</h3>
                    </div>
                    <Button onClick={handleExport} disabled={isProcessing || diretrizes.length === 0}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Exportar ({diretrizes.length} Subitens)
                    </Button>
                </div>
                
                <div className="border-t pt-4">
                    <h2 className="text-xl font-bold mb-4">Importação de Diretrizes</h2>
                    {step === 'select_file' && (
                        <div className="space-y-4">
                            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                                <h3 className="text-lg font-semibold flex items-center gap-2"><Download className="h-5 w-5 text-primary" />1. Selecionar Arquivo</h3>
                                <p className="text-sm text-muted-foreground">Carregue um arquivo Excel (.xlsx) com as colunas: NR_SUBITEM, NOME_SUBITEM, DESCRICAO_SUBITEM, CODIGO_CATMAT, DESCRICAO_ITEM, DESCRICAO_REDUZIDA, VALOR_UNITARIO, NUMERO_PREGAO, UASG.</p>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx" className="hidden" />
                                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="w-full" disabled={isProcessing}>
                                    {selectedFile ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
                                    {selectedFile ? selectedFile.name : "Selecionar Arquivo (.xlsx)"}
                                </Button>
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={handleProcessFile} disabled={isProcessing || !selectedFile}>
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                                    Analisar e Pré-visualizar
                                </Button>
                            </div>
                        </div>
                    )}
                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            <p className="text-muted-foreground mt-2">Analisando dados do Excel...</p>
                        </div>
                    )}
                    {step === 'review' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-5 gap-4 text-center">
                                <div className="p-3 border rounded-lg bg-muted/50"><p className="text-2xl font-bold">{importSummary.totalRows}</p><p className="text-sm text-muted-foreground">Linhas</p></div>
                                <div className="p-3 border rounded-lg bg-green-50/50 border-green-200"><p className="text-2xl font-bold text-green-600">{importSummary.totalValid}</p><p className="text-sm text-muted-foreground">Válidos</p></div>
                                <div className="p-3 border rounded-lg bg-red-50/50 border-red-200"><p className="text-2xl font-bold text-red-600">{importSummary.totalInvalid}</p><p className="text-sm text-muted-foreground">Erros</p></div>
                                <div className="p-3 border rounded-lg bg-yellow-50/50 border-yellow-200"><p className="text-2xl font-bold text-yellow-600">{importSummary.totalDuplicates}</p><p className="text-sm text-muted-foreground">Duplicados</p></div>
                                <div className="p-3 border rounded-lg bg-orange-50/50 border-orange-200"><p className="text-2xl font-bold text-orange-600">{importSummary.totalExisting}</p><p className="text-sm text-muted-foreground">Existentes</p></div>
                            </div>
                            
                            {importSummary.totalInvalid > 0 && (
                                <div className="flex items-center p-3 bg-red-100 border border-red-300 rounded-md text-red-800">
                                    <FileWarning className="h-5 w-5 mr-2 flex-shrink-0" />
                                    <p className="text-sm font-medium">
                                        {importSummary.totalInvalid} linhas possuem erros, são duplicatas internas ou já estão cadastradas e serão ignoradas na importação.
                                    </p>
                                </div>
                            )}

                            <ScrollArea className="h-[300px] border rounded-lg">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[5%] text-center">Linha</TableHead>
                                            <TableHead className="w-[20%]">Subitem ND</TableHead>
                                            <TableHead className="w-[30%]">Item</TableHead>
                                            <TableHead className="w-[10%] text-center">Pregão</TableHead>
                                            <TableHead className="w-[10%] text-right">Valor</TableHead>
                                            <TableHead className="w-[15%]">Status/Erros</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stagedData.map((row, index) => (
                                            <TableRow key={index} className={cn(
                                                !row.isValid && "bg-red-50/50",
                                                row.isDuplicateInternal && "bg-yellow-50/50",
                                                row.isDuplicateExternal && "bg-orange-50/50"
                                            )}>
                                                <TableCell className="text-center text-xs p-2">{row.originalRowIndex}</TableCell>
                                                <TableCell className="text-xs font-medium p-2">{row.nr_subitem} - {row.nome_subitem}</TableCell>
                                                <TableCell className="text-xs p-2">{row.descricao_item}</TableCell>
                                                <TableCell className="text-center text-xs p-2">{row.numero_pregao}</TableCell>
                                                <TableCell className="text-right font-bold text-xs p-2">{formatCurrency(row.valor_unitario)}</TableCell>
                                                <TableCell className="p-2">
                                                    {row.isValid ? (
                                                        <Badge variant="ptrab-aprovado" className="text-xs">Válido</Badge>
                                                    ) : (
                                                        <div className="space-y-1">
                                                            <Badge variant="destructive" className="text-xs flex items-center justify-center">
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Inválido
                                                            </Badge>
                                                            {row.errors.map((err, i) => (
                                                                <p key={i} className="text-[10px] text-red-600">
                                                                    - {err}
                                                                </p>
                                                            ))}
                                                            {row.isDuplicateInternal && (
                                                                <p className="text-[10px] text-yellow-700">
                                                                    - Duplicata no arquivo
                                                                </p>
                                                            )}
                                                            {row.isDuplicateExternal && (
                                                                <p className="text-[10px] text-orange-700">
                                                                    - Já cadastrado no DB
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                            <DialogFooter className="mt-4">
                                <Button onClick={handleConfirmImport} disabled={isProcessing || importSummary.totalValid === 0} className="bg-green-600 hover:bg-green-700">
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Confirmar Importação ({importSummary.totalValid} Itens)
                                </Button>
                                <Button variant="outline" onClick={() => setStep('select_file')} disabled={isProcessing}>Voltar</Button>
                            </DialogFooter>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteExportImportDialog;