import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Download, Upload, Loader2, AlertTriangle, CheckCircle, XCircle, List, Info, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { DiretrizMaterialConsumo, StagingRow } from "@/types/diretrizesMaterialConsumo";
import { exportMaterialConsumoToExcel, processMaterialConsumoImport, persistMaterialConsumoImport } from '@/lib/materialConsumoExportImport';
import { useSession } from '@/components/SessionContextProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MaterialConsumoExportImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    diretrizes: DiretrizMaterialConsumo[];
    onImportSuccess: () => void;
}

// Estados do fluxo de importação
type ImportStep = 'select_file' | 'processing' | 'review';

const MaterialConsumoExportImportDialog: React.FC<MaterialConsumoExportImportDialogProps> = ({
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
    
    // Dados de Staging
    const [stagedData, setStagedData] = useState<StagingRow[]>([]);
    const [importSummary, setImportSummary] = useState({
        totalRows: 0,
        totalValid: 0,
        totalInvalid: 0,
        totalDuplicates: 0,
    });

    // Limpa o estado ao fechar
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
            await exportMaterialConsumoToExcel(diretrizes, selectedYear);
            toast.success("Exportação concluída!", { description: `Arquivo Diretrzes_MaterialConsumo_${selectedYear}.xlsx baixado.` });
        } catch (error) {
            console.error("Erro na exportação:", error);
            toast.error("Falha ao exportar dados para Excel.");
        } finally {
            setIsProcessing(false);
        }
    }, [diretrizes, selectedYear]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && file.type !== 'application/vnd.ms-excel') {
                toast.error("Formato de arquivo inválido. Por favor, use um arquivo .xlsx.");
                setSelectedFile(null);
                return;
            }
            setSelectedFile(file);
        }
    };
    
    const handleProcessFile = useCallback(async () => {
        if (!selectedFile || !user?.id) {
            toast.error("Selecione um arquivo e certifique-se de estar logado.");
            return;
        }
        
        setStep('processing');
        setIsProcessing(true);
        setStagedData([]);
        
        try {
            const result = await processMaterialConsumoImport(selectedFile, selectedYear, user.id);
            
            setStagedData(result.stagedData);
            setImportSummary({
                totalRows: result.stagedData.length,
                totalValid: result.totalValid,
                totalInvalid: result.totalInvalid,
                totalDuplicates: result.totalDuplicates,
            });
            
            setStep('review');
            
        } catch (error: any) {
            console.error("Erro no processamento:", error);
            toast.error("Falha ao processar o arquivo.", { description: error.message || "Verifique o formato do arquivo e tente novamente." });
            setStep('select_file');
        } finally {
            setIsProcessing(false);
        }
    }, [selectedFile, selectedYear, user?.id]);

    const handleConfirmImport = useCallback(async () => {
        if (importSummary.totalValid === 0) {
            toast.error("Nenhuma linha válida para importação. Corrija os erros e tente novamente.");
            return;
        }
        
        if (!confirm(`Atenção: Você está prestes a substituir TODAS as diretrizes de Material de Consumo do ano ${selectedYear} por ${importSummary.totalValid} itens válidos. Deseja continuar?`)) {
            return;
        }

        setIsProcessing(true);
        try {
            await persistMaterialConsumoImport(stagedData, selectedYear, user!.id);
            
            onImportSuccess(); 
            
            toast.success("Importação concluída!", { description: `As diretrizes de Material de Consumo para o ano ${selectedYear} foram atualizadas com ${importSummary.totalValid} itens.` });
            
            handleOpenChangeWrapper(false);

        } catch (error: any) {
            console.error("Erro na persistência:", error);
            toast.error("Falha ao salvar as diretrizes.", { description: error.message || "Erro de banco de dados." });
        } finally {
            setIsProcessing(false);
        }
    }, [stagedData, selectedYear, user?.id, importSummary, onImportSuccess, handleOpenChangeWrapper]);
    
    const totalSubitensAgrupados = useMemo(() => {
        const subitemKeys = new Set<string>();
        stagedData.filter(r => r.isValid).forEach(r => {
            subitemKeys.add(`${r.nr_subitem}|${r.nome_subitem}`);
        });
        return subitemKeys.size;
    }, [stagedData]);

    const renderSelectFileStep = () => (
        <div className="space-y-4">
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Upload className="h-5 w-5 text-primary" />
                    1. Selecionar Arquivo
                </h3>
                <p className="text-sm text-muted-foreground">
                    Carregue um arquivo Excel (.xlsx) contendo as colunas: NR_SUBITEM, NOME_SUBITEM, DESCRICAO_SUBITEM, CODIGO_CATMAT, DESCRICAO_ITEM, DESCRICAO_REDUZIDA, VALOR_UNITARIO, NUMERO_PREGAO, UASG.
                </p>
                
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".xlsx"
                    className="hidden"
                />
                
                <Button 
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full"
                    disabled={isProcessing}
                >
                    {selectedFile ? (
                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                    ) : (
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                    )}
                    {selectedFile ? selectedFile.name : "Selecionar Arquivo (.xlsx)"}
                </Button>
            </div>
            
            <div className="flex justify-end">
                <Button 
                    onClick={handleProcessFile}
                    disabled={isProcessing || !selectedFile}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <List className="mr-2 h-4 w-4" />
                    )}
                    Analisar e Pré-visualizar
                </Button>
            </div>
        </div>
    );
    
    const renderReviewStep = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
                <div className="p-3 border rounded-lg bg-gray-50">
                    <p className="text-xs text-muted-foreground">Linhas Analisadas</p>
                    <p className="text-xl font-bold">{importSummary.totalRows}</p>
                </div>
                <div className="p-3 border rounded-lg bg-green-50">
                    <p className="text-xs text-muted-foreground">Linhas Válidas</p>
                    <p className="text-xl font-bold text-green-600">{importSummary.totalValid}</p>
                </div>
                <div className="p-3 border rounded-lg bg-red-50">
                    <p className="text-xs text-muted-foreground">Linhas com Erro</p>
                    <p className="text-xl font-bold text-red-600">{importSummary.totalInvalid}</p>
                </div>
                <div className="p-3 border rounded-lg bg-yellow-50">
                    <p className="text-xs text-muted-foreground">Subitens Agrupados</p>
                    <p className="text-xl font-bold text-yellow-700">{totalSubitensAgrupados}</p>
                </div>
            </div>
            
            {importSummary.totalInvalid > 0 && (
                <div className="flex items-center p-3 bg-red-100 border border-red-300 rounded-md text-red-800">
                    <FileWarning className="h-5 w-5 mr-2 flex-shrink-0" />
                    <p className="text-sm font-medium">
                        {importSummary.totalInvalid} linhas possuem erros e serão ignoradas na importação. Corrija o arquivo e tente novamente para incluir todos os dados.
                    </p>
                </div>
            )}
            
            {/* Tabela de Pré-visualização */}
            <h3 className="text-base font-semibold mt-4 flex items-center gap-2">
                <List className="h-4 w-4" />
                Pré-visualização dos Itens
            </h3>
            <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[5%] text-center">Linha</TableHead>
                            <TableHead className="w-[20%]">Subitem ND</TableHead>
                            <TableHead className="w-[30%]">Item de Aquisição</TableHead>
                            <TableHead className="w-[10%] text-center">Pregão</TableHead>
                            <TableHead className="w-[10%] text-center">UASG</TableHead>
                            <TableHead className="w-[10%] text-right">Valor</TableHead>
                            <TableHead className="w-[15%]">Status/Erros</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stagedData.map((row, index) => (
                            <TableRow key={index} className={cn(
                                !row.isValid && "bg-red-50/50",
                                row.isDuplicateInternal && "bg-yellow-50/50"
                            )}>
                                <TableCell className="text-center text-xs p-2">{row.originalRowIndex}</TableCell>
                                <TableCell className="text-xs font-medium p-2">
                                    {row.nr_subitem} - {row.nome_subitem}
                                    <p className="text-muted-foreground/70 text-[10px] whitespace-normal">
                                        {row.descricao_subitem}
                                    </p>
                                    {row.isDuplicateExternal && (
                                        <Badge variant="secondary" className="mt-1 bg-yellow-200 text-yellow-800">Existente no DB</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-xs p-2">
                                    {row.descricao_item}
                                    <p className="text-muted-foreground/70 text-[10px]">
                                        Reduzida: {row.descricao_reduzida || 'N/A'} | CATMAT: {row.codigo_catmat}
                                    </p>
                                </TableCell>
                                <TableCell className="text-center text-xs p-2">{row.numero_pregao}</TableCell>
                                <TableCell className="text-center text-xs p-2">{formatCodug(row.uasg)}</TableCell>
                                <TableCell className="text-right font-bold text-xs p-2">{formatCurrency(row.valor_unitario)}</TableCell>
                                <TableCell className="p-2">
                                    {row.isValid ? (
                                        <Badge variant="success" className="text-xs">Válido</Badge>
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
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
            
            <DialogFooter className="mt-4">
                <Button 
                    onClick={handleConfirmImport}
                    disabled={isProcessing || importSummary.totalValid === 0}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isProcessing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="mr-2 h-4 w-4" />
                    )}
                    Confirmar Importação ({importSummary.totalValid} Itens)
                </Button>
                <Button variant="outline" onClick={() => setStep('select_file')} disabled={isProcessing}>
                    Voltar e Corrigir Arquivo
                </Button>
            </DialogFooter>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5" />
                        Exportar/Importar Material de Consumo
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie as diretrizes de Material de Consumo (Subitens da ND) para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                {/* Seção de Exportação (Sempre visível) */}
                <div className="p-4 border rounded-lg bg-muted/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold">Exportar Dados</h3>
                    </div>
                    <Button 
                        onClick={handleExport} 
                        disabled={isProcessing || diretrizes.length === 0}
                    >
                        {isProcessing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Exportar ({diretrizes.length} Subitens)
                    </Button>
                </div>
                
                {/* Seção de Importação (Fluxo de 2 passos) */}
                <div className="border-t pt-4">
                    <h2 className="text-xl font-bold mb-4">Importação de Diretrizes</h2>
                    
                    {step === 'select_file' && renderSelectFileStep()}
                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            <p className="text-muted-foreground mt-2">Analisando e validando dados do Excel...</p>
                        </div>
                    )}
                    {step === 'review' && renderReviewStep()}
                </div>

                {step === 'select_file' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => handleOpenChangeWrapper(false)} disabled={isProcessing}>
                            Fechar
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoExportImportDialog;