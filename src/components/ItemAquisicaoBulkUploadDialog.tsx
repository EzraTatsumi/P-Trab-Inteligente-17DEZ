import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Import, Loader2, Upload, XCircle, Download, CheckCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { parseInputToNumber, formatCurrencyInput, numberToRawDigits } from '@/lib/formatUtils';

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

// Tipos para o resumo da importação
interface ImportError {
    lineNumber: number;
    errorMessage: string;
}

interface ImportSummary {
    totalLines: number;
    validItems: ItemAquisicao[];
    errorItems: ImportError[];
}

// Cabeçalhos do template
const TEMPLATE_HEADERS = [
    'Descricao do Item', 
    'Valor Unitario (R$)', 
    'Numero do Pregao/Ref. Preco', 
    'UASG', 
    'Codigo CATMAT'
];

// Linha de exemplo
const EXAMPLE_ROW = [
    'SABÃO PÓ/ ASPECTO FÍSICO:PÓ/ COMPOSIÇÃO:ÁGUA/ ALQUIL BENZENO SULFATO DE SÓDIO/ CORANTE/ CA/ CARACTERÍSTICAS ADICIONAIS:AMACIANTE',
    '1,25', // Valor Unitário
    '90.001/25', // Número do Pregão
    '160.170', // UASG
    '419551' // CATMAT
];

// Larguras das colunas (em unidades de largura de caractere)
const COLUMN_WIDTHS = [
    { wch: 60 }, // Descricao do Item
    { wch: 20 }, // Valor Unitario (R$)
    { wch: 25 }, // Numero do Pregao/Ref. Preco
    { wch: 15 }, // UASG
    { wch: 20 }  // Codigo CATMAT
];

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [file, setFile] = useState<File | null>(null);
    // NOVO ESTADO: Armazena o resumo da importação
    const [summary, setSummary] = useState<ImportSummary>({ totalLines: 0, validItems: [], errorItems: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                setError(null);
                setSummary({ totalLines: 0, validItems: [], errorItems: [] }); // Limpa o resumo ao selecionar novo arquivo
            } else {
                setFile(null);
                setError("Formato de arquivo inválido. Por favor, use um arquivo .xlsx.");
            }
        }
    };

    const processFile = () => {
        if (!file) {
            setError("Selecione um arquivo para importar.");
            return;
        }

        setLoading(true);
        setError(null);
        setSummary({ totalLines: 0, validItems: [], errorItems: [] });

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Converte a planilha para JSON, mantendo os cabeçalhos
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length <= 1) { // Deve ter pelo menos cabeçalho e uma linha de dados
                    throw new Error("O arquivo Excel está vazio ou contém apenas o cabeçalho.");
                }

                const headers = json[0] as string[];
                
                const requiredHeaders = ['Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
                }
                
                const validItems: ItemAquisicao[] = [];
                const errorItems: ImportError[] = [];
                
                // Mapeamento de índices de coluna
                const headerMap: Record<string, number> = {};
                headers.forEach((h, index) => {
                    headerMap[h.trim()] = index;
                });
                
                let totalLines = 0;

                // Processa as linhas de dados (a partir da segunda linha)
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    const lineNumber = i + 1;
                    
                    // Pula linhas vazias
                    if (!row || row.every((cell: any) => cell === null || cell === undefined || String(cell).trim() === '')) {
                        continue;
                    }
                    
                    totalLines++;
                    
                    // 1. VERIFICAÇÃO DA LINHA DE EXEMPLO (Apenas para a primeira linha de dados)
                    if (i === 1) {
                        const isExampleRow = row.length === EXAMPLE_ROW.length && row.every((cell: any, idx: number) => {
                            // Compara o valor da célula com o valor de exemplo, ignorando diferenças de tipo (ex: número vs string)
                            return String(cell || '').trim() === String(EXAMPLE_ROW[idx] || '').trim();
                        });
                        
                        if (isExampleRow) {
                            // Se for a linha de exemplo exata, pula a importação desta linha
                            continue;
                        }
                    }

                    try {
                        const descricao_item = String(row[headerMap['Descricao do Item']] || '').trim();
                        const valor_unitario_raw = String(row[headerMap['Valor Unitario (R$)']] || '0').trim();
                        const numero_pregao = String(row[headerMap['Numero do Pregao/Ref. Preco']] || '').trim();
                        const uasg = String(row[headerMap['UASG']] || '').trim();
                        const codigo_catmat = String(row[headerMap['Codigo CATMAT']] || '').trim();
                        
                        if (!descricao_item) {
                            throw new Error("Descrição do Item não pode ser vazia.");
                        }
                        
                        if (!numero_pregao) {
                            throw new Error("Número do Pregão/Ref. Preço não pode ser vazio.");
                        }

                        if (!uasg) {
                            throw new Error("UASG não pode ser vazia.");
                        }
                        
                        const valor_unitario = parseInputToNumber(valor_unitario_raw);

                        if (valor_unitario <= 0) {
                            throw new Error("Valor Unitário inválido ou zero.");
                        }

                        validItems.push({
                            id: Math.random().toString(36).substring(2, 9), // ID temporário
                            descricao_item,
                            valor_unitario,
                            numero_pregao,
                            uasg,
                            codigo_catmat,
                        });
                        
                    } catch (e: any) {
                        errorItems.push({
                            lineNumber,
                            errorMessage: e.message,
                        });
                    }
                }

                if (totalLines === 0) {
                    throw new Error("Nenhum item válido encontrado no arquivo.");
                }
                
                setSummary({
                    totalLines,
                    validItems,
                    errorItems,
                });

                if (validItems.length > 0) {
                    toast.success(`${validItems.length} itens prontos para importação.`);
                } else {
                    toast.warning("Nenhum item válido encontrado. Verifique os erros abaixo.");
                }

            } catch (e: any) {
                setError(e.message || "Erro desconhecido ao processar o arquivo.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = () => {
        if (summary.validItems.length > 0) {
            onImport(summary.validItems);
            handleClose();
        }
    };
    
    const handleClose = () => {
        setFile(null);
        setSummary({ totalLines: 0, validItems: [], errorItems: [] });
        setError(null);
        setLoading(false);
        onOpenChange(false);
    };
    
    const handleDownloadTemplate = () => {
        try {
            const dataToExport = [
                TEMPLATE_HEADERS,
                EXAMPLE_ROW
            ];
            
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
            
            worksheet['!cols'] = COLUMN_WIDTHS;
            
            XLSX.utils.book_append_sheet(workbook, worksheet, "Itens de Aquisição");
            
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            
            const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(data, "template_itens_aquisicao.xlsx");
            
            toast.success("Template Excel baixado com sucesso!");
        } catch (e) {
            console.error("Erro ao gerar template:", e);
            toast.error("Falha ao gerar o template Excel.");
        }
    };

    const { validItems, errorItems, totalLines } = summary;
    const hasProcessedData = totalLines > 0;
    const hasErrors = errorItems.length > 0;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Import className="h-5 w-5 text-primary" />
                        Importação em Massa de Itens de Aquisição
                    </DialogTitle>
                    <DialogDescription>
                        Importe múltiplos itens de aquisição para o subitem da ND a partir de uma planilha Excel.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    
                    {/* Alert com estilo customizado para contraste suave */}
                    <Alert variant="default" className="bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300">
                        <AlertCircle className="h-4 w-4 text-blue-900 dark:text-blue-400" />
                        <AlertTitle>Formato Obrigatório</AlertTitle>
                        <AlertDescription>
                            O arquivo deve ser **.xlsx** e conter as colunas exatas na primeira linha:
                            <span className="font-mono text-sm block mt-1">
                                'Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG', 'Codigo CATMAT'
                            </span>
                            <span className="text-xs mt-2 block">
                                Atenção: As colunas 'Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco' e 'UASG' são obrigatórias.
                            </span>
                        </AlertDescription>
                    </Alert>
                    
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold">Passo 1: Carregar Arquivo</h4>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={handleDownloadTemplate} // Chamando a nova função
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Baixar Template (.xlsx)
                            </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="file-upload">Selecione o arquivo (.xlsx)</Label>
                                <Input
                                    id="file-upload"
                                    type="file"
                                    accept=".xlsx"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                    className="rounded-full border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer file:bg-primary file:text-primary-foreground file:font-medium file:rounded-full file:border-0 file:cursor-pointer file:hover:bg-primary/90"
                                />
                            </div>
                            <Button 
                                type="button" 
                                onClick={processFile}
                                disabled={!file || loading}
                                className="col-span-1"
                            >
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Processar Arquivo
                            </Button>
                        </div>
                        
                        {error && (
                            <Alert variant="destructive" className="mt-4">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>Erro Crítico</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </Card>

                    {/* Passo 2: Pré-visualização e Confirmação */}
                    {hasProcessedData && (
                        <Card className="p-4 space-y-4">
                            <h4 className="text-base font-semibold">Passo 2: Resumo e Pré-visualização</h4>
                            
                            {/* Resumo Estatístico */}
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div className="p-3 border rounded-lg bg-muted/50">
                                    <p className="text-2xl font-bold text-foreground">{totalLines}</p>
                                    <p className="text-sm text-muted-foreground">Linhas Processadas</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-green-50/50 border-green-200 dark:bg-green-950/50 dark:border-green-800">
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{validItems.length}</p>
                                    <p className="text-sm text-muted-foreground">Itens Válidos</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-red-50/50 border-red-200 dark:bg-red-950/50 dark:border-red-800">
                                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{errorItems.length}</p>
                                    <p className="text-sm text-muted-foreground">Itens com Erro</p>
                                </div>
                            </div>
                            
                            {/* Lista de Erros */}
                            {hasErrors && (
                                <Alert variant="destructive" className="mt-4">
                                    <XCircle className="h-4 w-4" />
                                    <AlertTitle>Erros de Validação ({errorItems.length})</AlertTitle>
                                    <AlertDescription className="max-h-32 overflow-y-auto text-sm">
                                        <ul className="list-disc list-inside space-y-1 mt-2">
                                            {errorItems.map((err, index) => (
                                                <li key={index}>
                                                    <span className="font-semibold">Linha {err.lineNumber}:</span> {err.errorMessage}
                                                </li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* Tabela de Itens Válidos */}
                            {validItems.length > 0 && (
                                <div className="max-h-60 overflow-y-auto border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-muted/80 border-b">
                                            <tr>
                                                {/* Ajuste de largura das colunas */}
                                                <th className="p-2 text-left font-medium w-[35%]">Descricao do Item</th>
                                                <th className="p-2 text-right font-medium w-[15%]">Valor Unitario (R$)</th>
                                                <th className="p-2 text-center font-medium w-[15%]">Numero do Pregao/Ref. Preco</th>
                                                <th className="p-2 text-center font-medium w-[15%]">UASG</th>
                                                <th className="p-2 text-center font-medium w-[20%]">Codigo CATMAT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validItems.map((item, index) => (
                                                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                                                    <td className="p-2">{item.descricao_item}</td>
                                                    <td className="p-2 text-right font-mono">{formatCurrencyInput(numberToRawDigits(item.valor_unitario)).formatted}</td>
                                                    <td className="p-2 text-center text-xs">{item.numero_pregao || 'N/A'}</td>
                                                    <td className="p-2 text-center text-xs">{item.uasg || 'N/A'}</td>
                                                    <td className="p-2 text-center text-xs">{item.codigo_catmat || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            <DialogFooter className="mt-4">
                                <Button 
                                    type="button" 
                                    onClick={handleConfirmImport}
                                    disabled={loading || validItems.length === 0}
                                >
                                    <Import className="mr-2 h-4 w-4" />
                                    Confirmar Importação de {validItems.length} Itens
                                </Button>
                            </DialogFooter>
                        </Card>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoBulkUploadDialog;