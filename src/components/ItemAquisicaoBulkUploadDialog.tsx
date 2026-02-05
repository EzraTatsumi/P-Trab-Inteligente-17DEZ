import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Import, AlertCircle, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { parseInputToNumber } from "@/lib/formatUtils";
import { cn } from '@/lib/utils';

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: ItemAquisicao[]) => void;
}

// Cabeçalhos simplificados para o template CSV/Excel
const TEMPLATE_HEADERS = [
    "Descricao do Item (Obrigatorio)",
    "Valor Unitario (R$ - Obrigatorio)",
    "Numero do Pregao/Ref. Preco",
    "UASG",
    "Codigo CATMAT",
];

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [parsedItems, setParsedItems] = useState<ItemAquisicao[]>([]);
    const [errorDetails, setErrorDetails] = useState<string | null>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
        setParsedItems([]);
        setErrorDetails(null);
    };

    const handleDownloadTemplate = () => {
        const templateContent = TEMPLATE_HEADERS.join('\t'); // Usando tab para CSV simples
        
        const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'template_itens_aquisicao.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.info("Template de importação baixado. Use-o para preencher os dados.");
    };

    const parseExcel = (file: File) => {
        return new Promise<ItemAquisicao[]>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Converte para JSON, usando a primeira linha como cabeçalho
                    const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (json.length < 2) {
                        return reject("O arquivo está vazio ou contém apenas o cabeçalho.");
                    }
                    
                    // Mapeia os cabeçalhos da planilha para os nomes esperados
                    const headers = json[0] as string[];
                    const dataRows = json.slice(1);
                    
                    const expectedHeadersMap: Record<string, string> = {
                        "Descricao do Item (Obrigatorio)": "descricao_item",
                        "Valor Unitario (R$ - Obrigatorio)": "valor_unitario",
                        "Numero do Pregao/Ref. Preco": "numero_pregao",
                        "UASG": "uasg",
                        "Codigo CATMAT": "codigo_catmat",
                    };
                    
                    const headerIndices: Record<string, number> = {};
                    
                    // Encontra os índices dos cabeçalhos esperados
                    TEMPLATE_HEADERS.forEach(expectedHeader => {
                        const index = headers.findIndex(h => h.trim() === expectedHeader);
                        if (index !== -1) {
                            headerIndices[expectedHeader] = index;
                        }
                    });
                    
                    // Verifica se os cabeçalhos obrigatórios estão presentes
                    const missingHeaders = TEMPLATE_HEADERS.filter(h => h.includes('(Obrigatorio)') && headerIndices[h] === undefined);
                    if (missingHeaders.length > 0) {
                        return reject(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
                    }

                    const items: ItemAquisicao[] = [];
                    
                    dataRows.forEach((row: any[], index: number) => {
                        const rowNumber = index + 2; // Linha 2 é a primeira linha de dados
                        
                        const rawDescricao = row[headerIndices[TEMPLATE_HEADERS[0]]] || '';
                        const rawValor = row[headerIndices[TEMPLATE_HEADERS[1]]] || '';
                        const rawPregao = row[headerIndices[TEMPLATE_HEADERS[2]]] || '';
                        const rawUASG = row[headerIndices[TEMPLATE_HEADERS[3]]] || '';
                        const rawCatmat = row[headerIndices[TEMPLATE_HEADERS[4]]] || '';

                        const descricao_item = String(rawDescricao).trim();
                        
                        // O valor pode vir como número (se formatado como moeda no Excel) ou string
                        let valor_unitario = 0;
                        if (typeof rawValor === 'number') {
                            valor_unitario = rawValor;
                        } else {
                            valor_unitario = parseInputToNumber(String(rawValor));
                        }
                        
                        if (!descricao_item) {
                            throw new Error(`Linha ${rowNumber}: Descrição do Item é obrigatória.`);
                        }
                        if (valor_unitario <= 0) {
                            throw new Error(`Linha ${rowNumber}: Valor Unitário deve ser maior que zero.`);
                        }

                        items.push({
                            id: Math.random().toString(36).substring(2, 9), // ID temporário
                            descricao_item: descricao_item,
                            valor_unitario: valor_unitario,
                            numero_pregao: String(rawPregao).trim(),
                            uasg: String(rawUASG).trim(),
                            codigo_catmat: String(rawCatmat).trim(),
                        });
                    });

                    resolve(items);
                } catch (error: any) {
                    reject(error.message || "Erro ao processar o arquivo Excel.");
                }
            };
            reader.onerror = (error) => reject("Falha ao ler o arquivo.");
            reader.readAsBinaryString(file);
        });
    };

    const handleProcessFile = async () => {
        if (!file) {
            toast.error("Selecione um arquivo Excel (.xlsx) para importar.");
            return;
        }

        setLoading(true);
        setParsedItems([]);
        setErrorDetails(null);

        try {
            const items = await parseExcel(file);
            setParsedItems(items);
            toast.success(`Arquivo processado! ${items.length} itens prontos para importação.`);
        } catch (error: any) {
            setErrorDetails(error);
            toast.error("Erro ao processar o arquivo.", { description: error });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = () => {
        if (parsedItems.length === 0) {
            toast.error("Nenhum item válido para importar.");
            return;
        }
        onImport(parsedItems);
        onOpenChange(false);
        setFile(null);
        setParsedItems([]);
        setErrorDetails(null);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Import className="h-5 w-5 text-primary" />
                        Importação em Massa de Itens de Aquisição
                    </DialogTitle>
                    <DialogDescription>
                        Importe itens de aquisição a partir de uma planilha Excel (.xlsx).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    
                    {/* Seção de Template e Formato */}
                    <Alert variant="secondary">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Formato Obrigatório</AlertTitle>
                        <AlertDescription>
                            <p className="mb-2">
                                O arquivo deve ser um Excel (.xlsx) e conter exatamente os seguintes cabeçalhos na primeira linha:
                            </p>
                            <div className="bg-background p-2 rounded-md border text-sm font-mono overflow-x-auto">
                                {TEMPLATE_HEADERS.join(' | ')}
                            </div>
                            <Button 
                                variant="link" 
                                size="sm" 
                                onClick={handleDownloadTemplate}
                                className="p-0 h-auto mt-2 text-primary"
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Baixar Template de Exemplo
                            </Button>
                        </AlertDescription>
                    </Alert>

                    {/* Seção de Upload */}
                    <div className="flex items-center space-x-4 border p-4 rounded-lg bg-muted/50">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="excel-file" className="text-base font-medium">
                                Selecione o Arquivo (.xlsx)
                            </Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    id="excel-file"
                                    type="file"
                                    accept=".xlsx"
                                    onChange={handleFileChange}
                                    className={cn(
                                        "flex-1 cursor-pointer file:bg-blue-600 file:text-white file:font-semibold file:border-blue-600 file:hover:bg-blue-700 file:transition-colors",
                                        "border-blue-500 focus-visible:ring-blue-500"
                                    )}
                                />
                                <Button 
                                    type="button" 
                                    onClick={handleProcessFile}
                                    disabled={!file || loading}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                                    Processar Arquivo
                                </Button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Detalhes do Processamento */}
                    {errorDetails && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Erro de Processamento</AlertTitle>
                            <AlertDescription>
                                {errorDetails}
                            </AlertDescription>
                        </Alert>
                    )}

                    {parsedItems.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="font-semibold text-sm">Pré-visualização ({parsedItems.length} itens)</h4>
                            <div className="max-h-60 overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40%]">Descrição</TableHead>
                                            <TableHead className="w-[20%] text-right">Valor Unitário</TableHead>
                                            <TableHead className="w-[15%] text-center">Pregão</TableHead>
                                            <TableHead className="w-[15%] text-center">CATMAT</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedItems.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="text-sm">{item.descricao_item}</TableCell>
                                                <TableCell className="text-right font-mono">{item.valor_unitario.toFixed(2).replace('.', ',')}</TableCell>
                                                <TableCell className="text-center text-xs">{item.numero_pregao || 'N/A'}</TableCell>
                                                <TableCell className="text-center text-xs">{item.codigo_catmat || 'N/A'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button 
                        type="button" 
                        onClick={handleConfirmImport}
                        disabled={parsedItems.length === 0 || loading}
                    >
                        <Import className="h-4 w-4 mr-2" />
                        Importar {parsedItems.length} Itens
                    </Button>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setFile(null); setParsedItems([]); setErrorDetails(null); }}>
                            Cancelar
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoBulkUploadDialog;