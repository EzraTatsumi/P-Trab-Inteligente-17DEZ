import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Import, Loader2, Upload, XCircle } from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { parseInputToNumber } from '@/lib/formatUtils';

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<ItemAquisicao[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                setError(null);
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
        setData([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Converte a planilha para JSON, mantendo os cabeçalhos
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length === 0) {
                    throw new Error("O arquivo Excel está vazio.");
                }

                const headers = json[0] as string[];
                
                // NOVOS CABEÇALHOS SEM CARACTERES ESPECIAIS
                const expectedHeaders = [
                    'Descricao do Item', 
                    'Valor Unitario (R$)', 
                    'Numero do Pregao/Ref. Preco', 
                    'UASG', 
                    'Codigo CATMAT'
                ];
                
                // Verifica se os cabeçalhos obrigatórios existem
                const requiredHeaders = ['Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG'];
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
                }
                
                const importedItems: ItemAquisicao[] = [];
                
                // Mapeamento de índices de coluna
                const headerMap: Record<string, number> = {};
                headers.forEach((h, index) => {
                    headerMap[h.trim()] = index;
                });

                // Processa as linhas de dados (a partir da segunda linha)
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    
                    // Pula linhas vazias
                    if (!row || row.every((cell: any) => cell === null || cell === undefined || String(cell).trim() === '')) {
                        continue;
                    }

                    // CORREÇÃO: Usando os novos nomes de cabeçalho
                    const descricao_item = String(row[headerMap['Descricao do Item']] || '').trim();
                    const valor_unitario_raw = String(row[headerMap['Valor Unitario (R$)']] || '0').trim();
                    const numero_pregao = String(row[headerMap['Numero do Pregao/Ref. Preco']] || '').trim();
                    const uasg = String(row[headerMap['UASG']] || '').trim();
                    const codigo_catmat = String(row[headerMap['Codigo CATMAT']] || '').trim();

                    if (!descricao_item) {
                        setError(`Linha ${i + 1}: Descricao do Item não pode ser vazia.`);
                        setLoading(false);
                        return;
                    }
                    
                    if (!numero_pregao) {
                        setError(`Linha ${i + 1}: Numero do Pregao/Ref. Preco não pode ser vazio.`);
                        setLoading(false);
                        return;
                    }

                    if (!uasg) {
                        setError(`Linha ${i + 1}: UASG não pode ser vazia.`);
                        setLoading(false);
                        return;
                    }
                    
                    const valor_unitario = parseInputToNumber(valor_unitario_raw);

                    if (valor_unitario <= 0) {
                        setError(`Linha ${i + 1}: Valor Unitario inválido ou zero.`);
                        setLoading(false);
                        return;
                    }

                    importedItems.push({
                        id: Math.random().toString(36).substring(2, 9), // ID temporário
                        descricao_item,
                        valor_unitario,
                        numero_pregao,
                        uasg,
                        codigo_catmat,
                    });
                }

                if (importedItems.length === 0) {
                    throw new Error("Nenhum item válido encontrado no arquivo.");
                }

                setData(importedItems);
                toast.success(`${importedItems.length} itens prontos para importação.`);

            } catch (e: any) {
                setError(e.message || "Erro desconhecido ao processar o arquivo.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = () => {
        if (data.length > 0) {
            onImport(data);
            handleClose();
        }
    };
    
    const handleClose = () => {
        setFile(null);
        setData([]);
        setError(null);
        setLoading(false);
        onOpenChange(false);
    };

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
                                onClick={() => {
                                    // Lógica para download de template (simulada)
                                    toast.info("Download do template em desenvolvimento.");
                                }}
                            >
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
                                <AlertTitle>Erro no Processamento</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </Card>

                    {/* Passo 2: Pré-visualização e Confirmação */}
                    {data.length > 0 && (
                        <Card className="p-4 space-y-4">
                            <h4 className="text-base font-semibold">Passo 2: Pré-visualização ({data.length} itens)</h4>
                            
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
                                        {data.map((item, index) => (
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
                            
                            <DialogFooter className="mt-4">
                                <Button 
                                    type="button" 
                                    onClick={handleConfirmImport}
                                    disabled={loading || data.length === 0}
                                >
                                    <Import className="mr-2 h-4 w-4" />
                                    Confirmar Importação de {data.length} Itens
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