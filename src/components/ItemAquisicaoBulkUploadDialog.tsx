import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, AlertCircle, Check, XCircle, FileSpreadsheet, Package, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useSession } from '@/components/SessionContextProvider';
import { DiretrizMaterialConsumo, ItemAquisicaoTemplate, StagingRow } from "@/types/diretrizesMaterialConsumo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from '@/lib/utils';
import { validateAndGroupStagingRows, saveGroupedDiretrizes } from '@/lib/materialConsumoExportImport';
import { fetchAllExistingAcquisitionItems } from '@/integrations/supabase/api';

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onImportSuccess: () => void;
}

// Estado inicial para o formulário de upload
const initialUploadState = {
    file: null as File | null,
    fileName: '',
    isProcessing: false,
    stage: 0, // 0: Upload, 1: Review, 2: Saving
    stagingRows: [] as StagingRow[],
    groupedDiretrizes: [] as DiretrizMaterialConsumo[],
    validationError: null as string | null,
};

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onImportSuccess,
}) => {
    const { user } = useSession();
    const queryClient = useQueryClient();
    const [state, setState] = useState(initialUploadState);
    
    // Query para buscar todos os itens existentes (para checagem de duplicidade)
    const { data: existingItemsData, isLoading: isLoadingExistingItems } = useQuery({
        queryKey: ['allExistingAcquisitionItems', selectedYear, user?.id],
        queryFn: () => fetchAllExistingAcquisitionItems(selectedYear, user!.id),
        enabled: !!user?.id && selectedYear > 0 && open,
        initialData: [],
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setState(prev => ({ ...prev, file, fileName: file.name }));
        }
    };

    const handleUpload = async () => {
        if (!state.file || !user?.id) {
            toast.error("Selecione um arquivo e certifique-se de estar logado.");
            return;
        }
        
        setState(prev => ({ ...prev, isProcessing: true, validationError: null }));

        try {
            const fileContent = await state.file.text();
            
            // 1. Validação e Agrupamento
            const { groupedDiretrizes, stagingRows, validationError } = await validateAndGroupStagingRows(
                fileContent, 
                selectedYear, 
                user.id, 
                existingItemsData || []
            );

            if (validationError) {
                setState(prev => ({ 
                    ...prev, 
                    isProcessing: false, 
                    validationError,
                    stagingRows: stagingRows, // Mantém as linhas para revisão de erros
                    stage: 1,
                }));
                toast.error("Erros de validação encontrados. Revise os dados.");
                return;
            }

            setState(prev => ({
                ...prev,
                isProcessing: false,
                stagingRows: stagingRows,
                groupedDiretrizes: groupedDiretrizes,
                stage: 1, // Move para a fase de Revisão
            }));
            toast.success(`Arquivo processado! ${groupedDiretrizes.length} diretrizes prontas para importação.`);

        } catch (error) {
            console.error("Erro no processamento do arquivo:", error);
            toast.error("Falha ao processar o arquivo. Verifique o formato.");
            setState(prev => ({ ...prev, isProcessing: false, validationError: "Falha interna ao processar o arquivo." }));
        }
    };
    
    const handleSaveImport = async () => {
        if (state.groupedDiretrizes.length === 0 || !user?.id) return;
        
        setState(prev => ({ ...prev, isProcessing: true, stage: 2 }));
        
        try {
            const { successCount, errorCount } = await saveGroupedDiretrizes(state.groupedDiretrizes, user.id);
            
            if (errorCount > 0) {
                toast.error(`Importação concluída com ${errorCount} falhas. Verifique o console.`);
            } else {
                toast.success(`Importação concluída! ${successCount} diretrizes salvas/atualizadas.`);
            }
            
            // Limpa o estado e notifica o sucesso
            setState(initialUploadState);
            onImportSuccess();
            onOpenChange(false);
            
        } catch (error) {
            console.error("Erro ao salvar diretrizes:", error);
            toast.error("Falha crítica ao salvar as diretrizes no banco de dados.");
            setState(prev => ({ ...prev, isProcessing: false, stage: 1 })); // Volta para revisão
        }
    };
    
    const handleReset = () => {
        setState(initialUploadState);
    };
    
    const handleClose = () => {
        setState(initialUploadState);
        onOpenChange(false);
    };

    // --- Renderização de Estágios ---
    
    const renderUploadStage = () => (
        <div className="space-y-4">
            <Alert variant="default" className="border-l-4 border-primary">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <AlertTitle>Instruções de Importação</AlertTitle>
                <AlertDescription className="text-sm">
                    <p>1. Use o modelo de planilha fornecido (CSV ou TSV).</p>
                    <p>2. O arquivo deve conter as colunas: `nr_subitem`, `nome_subitem`, `codigo_catmat`, `descricao_item`, `descricao_reduzida`, `valor_unitario`, `numero_pregao`, `uasg`, `nd`.</p>
                    <p>3. O sistema agrupará os itens pelo `nr_subitem` e `nome_subitem`.</p>
                </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
                <Label htmlFor="file-upload">Selecione o Arquivo (.csv ou .tsv)</Label>
                <Input 
                    id="file-upload" 
                    type="file" 
                    accept=".csv,.tsv" 
                    onChange={handleFileChange} 
                    disabled={state.isProcessing}
                />
                {state.fileName && <p className="text-sm text-muted-foreground">Arquivo selecionado: {state.fileName}</p>}
            </div>
        </div>
    );
    
    const renderReviewStage = () => {
        const hasErrors = state.validationError || state.stagingRows.some(row => !row.isValid);
        
        return (
            <div className="space-y-4">
                <Alert variant={hasErrors ? "destructive" : "default"} className={cn("border-l-4", hasErrors ? "border-red-500" : "border-green-500")}>
                    {hasErrors ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    <AlertTitle>{hasErrors ? "Erros Encontrados" : "Revisão Concluída"}</AlertTitle>
                    <AlertDescription>
                        {hasErrors ? (
                            <>
                                <p className="font-medium mb-2">O arquivo contém erros. Corrija-os na planilha e tente novamente.</p>
                                {state.validationError && <p className="text-xs font-mono text-red-600">{state.validationError}</p>}
                            </>
                        ) : (
                            <p>Pronto para importar {state.groupedDiretrizes.length} diretrizes para o ano {selectedYear}.</p>
                        )}
                    </AlertDescription>
                </Alert>
                
                <h4 className="text-lg font-semibold mt-4">Detalhes da Validação ({state.stagingRows.length} linhas)</h4>
                
                <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[50px]">Linha</TableHead>
                                <TableHead className="w-[100px]">Subitem</TableHead>
                                <TableHead>Item / CATMAT</TableHead>
                                <TableHead className="w-[100px] text-right">Valor</TableHead>
                                <TableHead className="w-[150px]">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.stagingRows.map((row, index) => (
                                <TableRow key={index} className={cn(!row.isValid && "bg-red-50/50")}>
                                    <TableCell className="font-medium">{row.originalRowIndex}</TableCell>
                                    <TableCell className="text-xs">
                                        {row.nr_subitem} - {row.nome_subitem}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {row.descricao_reduzida}
                                        <p className="text-[10px] text-muted-foreground">CATMAT: {row.codigo_catmat}</p>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                        {formatCurrency(row.valor_unitario)}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {row.isValid ? (
                                            <Badge variant="default" className="bg-green-500 hover:bg-green-500">Válido</Badge>
                                        ) : (
                                            <div className="space-y-1">
                                                <Badge variant="destructive">Erro</Badge>
                                                {row.errors.map((err, i) => (
                                                    <p key={i} className="text-red-600 text-[10px]">{err}</p>
                                                ))}
                                            </div>
                                        )}
                                        {row.isDuplicateInternal && <Badge variant="destructive" className="mt-1">Duplicado (Arquivo)</Badge>}
                                        {row.isDuplicateExternal && <Badge variant="destructive" className="mt-1">Subitem Duplicado (DB)</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar Itens de Aquisição (Material de Consumo)</DialogTitle>
                </DialogHeader>
                
                {state.stage === 0 && renderUploadStage()}
                {state.stage === 1 && renderReviewStage()}
                
                <DialogFooter className="mt-4">
                    {state.stage === 0 && (
                        <>
                            <Button onClick={handleClose} variant="outline" disabled={state.isProcessing}>
                                Cancelar
                            </Button>
                            <Button onClick={handleUpload} disabled={!state.file || state.isProcessing || isLoadingExistingItems}>
                                {state.isProcessing || isLoadingExistingItems ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {isLoadingExistingItems ? "Carregando dados..." : "Processar Arquivo"}
                            </Button>
                        </>
                    )}
                    
                    {state.stage === 1 && (
                        <>
                            <Button onClick={handleReset} variant="outline" disabled={state.isProcessing}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Novo Upload
                            </Button>
                            <Button 
                                onClick={handleSaveImport} 
                                disabled={state.isProcessing || state.validationError !== null || state.stagingRows.some(row => !row.isValid)}
                            >
                                {state.isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar {state.groupedDiretrizes.length} Diretrizes
                            </Button>
                        </>
                    )}
                    
                    {state.stage === 2 && (
                        <div className="flex items-center text-primary font-medium">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando no banco de dados...
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoBulkUploadDialog;