import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, CheckCircle, AlertTriangle, Upload, Download, XCircle, Import, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ExcelJS from 'exceljs';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, parseInputToNumber } from "@/lib/formatUtils";
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Importando Alert

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

interface ValidationResult {
    success: boolean;
    message: string;
    rowNumber: number;
}

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [processedItems, setProcessedItems] = useState<ItemAquisicao[]>([]);
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
    const [isProcessed, setIsProcessed] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
                toast.error("Formato de arquivo inválido. Por favor, use um arquivo .xlsx.");
                setFile(null);
                setProcessedItems([]);
                setValidationResults([]);
                setIsProcessed(false);
                return;
            }
            setFile(selectedFile);
            setProcessedItems([]);
            setValidationResults([]);
            setIsProcessed(false);
        }
    };

    const processExcel = useCallback(async () => {
        if (!file) {
            toast.error("Selecione um arquivo Excel (.xlsx) para importar.");
            return;
        }

        setLoading(true);
        setProcessedItems([]);
        setValidationResults([]);
        setIsProcessed(false);

        try {
            const workbook = new ExcelJS.Workbook();
            const buffer = await file.arrayBuffer();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.worksheets[0];
            if (!worksheet) {
                throw new Error("O arquivo Excel não contém nenhuma planilha.");
            }

            const newItems: ItemAquisicao[] = [];
            const results: ValidationResult[] = [];
            let hasErrors = false;

            // Iterar sobre as linhas, começando da segunda linha (índice 2) para ignorar o cabeçalho
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Ignorar cabeçalho

                const rawData = {
                    descricao_item: row.getCell(1).value?.toString()?.trim() || '', // Coluna A
                    valor_unitario_raw: row.getCell(2).value, // Coluna B (Pode ser número ou string formatada)
                    numero_pregao: row.getCell(3).value?.toString()?.trim() || '', // Coluna C
                    uasg: row.getCell(4).value?.toString()?.trim() || '', // Coluna D
                    codigo_catmat: row.getCell(5).value?.toString()?.trim() || '', // Coluna E
                };
                
                // Se todas as colunas estiverem vazias, ignora a linha
                if (!rawData.descricao_item && !rawData.valor_unitario_raw && !rawData.numero_pregao && !rawData.uasg && !rawData.codigo_catmat) {
                    return;
                }
                
                let valorUnitario = 0;
                let rowHasError = false;
                
                // 1. Validação de Descrição
                if (!rawData.descricao_item) {
                    results.push({ success: false, message: "Descrição do Item (Coluna A) é obrigatória.", rowNumber });
                    rowHasError = true;
                }
                
                // 2. Validação de Valor Unitário
                if (rawData.valor_unitario_raw === null || rawData.valor_unitario_raw === undefined || rawData.valor_unitario_raw === '') {
                    results.push({ success: false, message: "Valor Unitário (Coluna B) é obrigatório.", rowNumber });
                    rowHasError = true;
                } else {
                    // Tenta parsear o valor. Se for string, usa parseInputToNumber (que lida com R$ e vírgulas)
                    if (typeof rawData.valor_unitario_raw === 'string') {
                        valorUnitario = parseInputToNumber(rawData.valor_unitario_raw);
                    } else if (typeof rawData.valor_unitario_raw === 'number') {
                        valorUnitario = rawData.valor_unitario_raw;
                    }
                    
                    if (isNaN(valorUnitario) || valorUnitario <= 0) {
                        results.push({ success: false, message: "Valor Unitário (Coluna B) deve ser um número positivo.", rowNumber });
                        rowHasError = true;
                    }
                }
                
                if (rowHasError) {
                    hasErrors = true;
                } else {
                    // Se não houver erros, adiciona o item processado
                    newItems.push({
                        id: Math.random().toString(36).substring(2, 9), // ID temporário para o React
                        descricao_item: rawData.descricao_item,
                        valor_unitario: valorUnitario,
                        numero_pregao: rawData.numero_pregao,
                        uasg: rawData.uasg,
                        codigo_catmat: rawData.codigo_catmat,
                    });
                    results.push({ success: true, message: "Item validado com sucesso.", rowNumber });
                }
            });

            setProcessedItems(newItems);
            setValidationResults(results);
            setIsProcessed(true);

            if (hasErrors) {
                toast.warning("Importação concluída com erros. Verifique a tabela de validação.");
            } else if (newItems.length > 0) {
                toast.success(`Processamento concluído! ${newItems.length} itens prontos para importação.`);
            } else {
                toast.info("Nenhuma linha de dados válida encontrada no arquivo.");
            }

        } catch (error: any) {
            console.error("Erro ao processar Excel:", error);
            toast.error(error.message || "Erro desconhecido ao processar o arquivo.");
            setValidationResults([{ success: false, message: error.message || "Erro desconhecido.", rowNumber: 0 }]);
        } finally {
            setLoading(false);
        }
    }, [file]);

    const handleConfirmImport = () => {
        if (processedItems.length === 0) {
            toast.error("Nenhum item válido para importar.");
            return;
        }
        onImport(processedItems);
        onOpenChange(false);
        // Reset state after successful import
        setFile(null);
        setProcessedItems([]);
        setValidationResults([]);
        setIsProcessed(false);
    };
    
    const handleDownloadTemplate = () => {
        // Cria um link temporário para download do template CSV
        const templateContent = "Descrição do Item (Obrigatório);Valor Unitário (R$ - Obrigatório);Número do Pregão/Ref. Preço;UASG;Código CATMAT\n";
        const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'template_material_consumo.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.info("Baixando template CSV. Use o formato XLSX para importação.");
    };

    const totalErrors = validationResults.filter(r => !r.success && r.rowNumber > 0).length;
    const totalSuccess = processedItems.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Import className="h-5 w-5 text-primary" />
                        Importação em Massa de Itens de Aquisição
                    </DialogTitle>
                    <DialogDescription>
                        Carregue uma planilha (.xlsx) para adicionar itens de aquisição ao subitem da ND.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    
                    <Alert variant="warning">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Formato Obrigatório</AlertTitle>
                        <AlertDescription>
                            O arquivo deve ser **.xlsx** e conter as colunas exatas na primeira linha:
                            <span className="font-mono text-sm block mt-1">
                                'Descrição do Item', 'Valor Unitário (R$)', 'Número do Pregão/Ref. Preço', 'UASG', 'Código CATMAT'
                            </span>
                            <span className="text-xs mt-2 block">
                                Atenção: Apenas as colunas 'Descrição do Item' e 'Valor Unitário (R$)' são obrigatórias.
                            </span>
                        </AlertDescription>
                    </Alert>
                    
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold">Passo 1: Carregar Arquivo</h4>
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleDownloadTemplate}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Baixar Template
                            </Button>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                            <Input
                                id="excel-file"
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                className="flex-grow"
                                disabled={loading}
                            />
                            <Button 
                                onClick={processExcel} 
                                disabled={!file || loading}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                Processar
                            </Button>
                        </div>
                        {file && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Arquivo selecionado: <span className="font-medium">{file.name}</span>
                            </p>
                        )}
                    </Card>

                    {isProcessed && (
                        <Card className="p-4">
                            <h4 className="text-base font-semibold mb-4">Passo 2: Resultados da Validação</h4>
                            
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center text-green-600 font-medium">
                                        <CheckCircle className="h-4 w-4 mr-1" />
                                        Sucesso: {totalSuccess} itens
                                    </div>
                                    <div className="flex items-center text-red-600 font-medium">
                                        <XCircle className="h-4 w-4 mr-1" />
                                        Erros: {totalErrors} linhas
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Total de linhas processadas: {validationResults.length}
                                </p>
                            </div>

                            <div className="max-h-60 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="w-[10%] text-center">Linha</TableHead>
                                            <TableHead className="w-[10%] text-center">Status</TableHead>
                                            <TableHead className="w-[80%]">Mensagem / Item</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {validationResults.map((result, index) => (
                                            <TableRow key={index} className={result.success ? "bg-green-500/5" : "bg-red-500/5"}>
                                                <TableCell className="text-center font-mono text-xs">{result.rowNumber}</TableCell>
                                                <TableCell className="text-center">
                                                    {result.success ? (
                                                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                                                    ) : (
                                                        <AlertTriangle className="h-4 w-4 text-red-600 mx-auto" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {result.success ? (
                                                        <span className="text-muted-foreground">
                                                            {/* Encontra o item correspondente para exibir a descrição */}
                                                            {processedItems.find(item => 
                                                                // A lógica de indexação é complexa devido aos erros, mas podemos tentar mapear pelo índice de sucesso
                                                                validationResults.slice(0, index + 1).filter(r => r.success).length - 1 === processedItems.findIndex(p => p.id === processedItems[validationResults.slice(0, index + 1).filter(r => r.success).length - 1]?.id)
                                                            )?.descricao_item || "Item validado."}
                                                        </span>
                                                    ) : (
                                                        <span className="text-red-600 font-medium">{result.message}</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <Button 
                        type="button" 
                        onClick={handleConfirmImport}
                        disabled={loading || processedItems.length === 0}
                    >
                        <Import className="h-4 w-4 mr-2" />
                        Importar {processedItems.length} Itens
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoBulkUploadDialog;