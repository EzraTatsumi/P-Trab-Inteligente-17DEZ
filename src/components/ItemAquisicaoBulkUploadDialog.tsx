import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Import, Loader2, Upload, XCircle, Download, CheckCircle, AlertTriangle, List } from "lucide-react";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { parseInputToNumber, formatCurrencyInput, numberToRawDigits } from '@/lib/formatUtils';

interface ItemAquisicaoBulkUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (items: any[]) => void;
    existingItemsInDiretriz: any[]; 
    mode?: 'material' | 'servico'; // NOVO: Define o comportamento do componente
}

// Tipos para o resumo da importação
interface ImportError {
    lineNumber: number;
    errorMessage: string;
}

interface ImportSummary {
    totalLines: number;
    validItems: any[];
    errorItems: ImportError[];
    duplicateItems: ImportError[]; 
    existingItems: ImportError[]; 
}

// Configurações por modo
const MODE_CONFIG = {
    material: {
        title: "Importação em Massa de Materiais",
        description: "Importe múltiplos itens de material para o subitem da ND.",
        codeLabel: "Codigo CATMAT",
        reducedLabel: "Descricao Reduzida",
        headers: [
            'Descricao do Item', 
            'Descricao Reduzida', 
            'Valor Unitario (R$)', 
            'Numero do Pregao/Ref. Preco', 
            'UASG', 
            'Codigo CATMAT'
        ],
        example: [
            'SABÃO PÓ/ ASPECTO FÍSICO:PÓ/ COMPOSIÇÃO:ÁGUA/ ALQUIL BENZENO SULFATO DE SÓDIO/ CORANTE/ CA/ CARACTERÍSTICAS ADICIONAIS:AMACIANTE',
            'SABÃO PÓ C/ AMACIANTE', 
            '1,25', 
            '90.001/25', 
            '160.170', 
            '419551'
        ],
        widths: [{ wch: 60 }, { wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }]
    },
    servico: {
        title: "Importação em Massa de Serviços/Locações",
        description: "Importe múltiplos itens de serviço ou locação para o subitem da ND.",
        codeLabel: "Codigo CATSER",
        reducedLabel: "Nome Reduzido",
        headers: [
            'Descricao do Item', 
            'Nome Reduzido', 
            'Unidade de Medida',
            'Valor Unitario (R$)', 
            'Numero do Pregao/Ref. Preco', 
            'UASG', 
            'Codigo CATSER'
        ],
        example: [
            'SERVIÇO DE MANUTENÇÃO PREVENTIVA E CORRETIVA EM APARELHOS DE AR CONDICIONADO',
            'MANUT. AR CONDICIONADO', 
            'UN',
            '450,00', 
            '01/2025', 
            '160.001', 
            '12345'
        ],
        widths: [{ wch: 60 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }]
    }
};

// Função auxiliar para gerar a chave de unicidade
const generateItemKey = (item: any): string => {
    const normalize = (str: string) => 
        (str || '').trim().toUpperCase().replace(/\s+/g, ' ');
        
    const desc = normalize(item.descricao_item);
    const code = normalize(item.codigo_catmat); // Usamos a mesma chave interna para CATMAT/CATSER
    const pregao = normalize(item.numero_pregao);
    const uasg = normalize(item.uasg);
    
    return `${desc}|${code}|${pregao}|${uasg}`;
};

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz,
    mode = 'material'
}) => {
    const config = MODE_CONFIG[mode];
    const [file, setFile] = useState<File | null>(null);
    const [summary, setSummary] = useState<ImportSummary>({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                setError(null);
                setSummary({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] });
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
        setSummary({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] });

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length <= 1) {
                    throw new Error("O arquivo Excel está vazio ou contém apenas o cabeçalho.");
                }

                const headers = (json[0] as string[]).map(h => String(h || '').trim());
                
                // Validação de cabeçalhos obrigatórios
                const requiredHeaders = ['Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG'];
                if (mode === 'servico') {
                    requiredHeaders.push('Nome Reduzido', 'Unidade de Medida');
                }
                
                const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                    throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(', ')}`);
                }
                
                const validItems: any[] = [];
                const errorItems: ImportError[] = [];
                const duplicateItems: ImportError[] = []; 
                const existingItems: ImportError[] = [];
                
                const encounteredKeys = new Set<string>(); 
                const existingKeysInDiretriz = new Set<string>(existingItemsInDiretriz.map(generateItemKey));
                
                const headerMap: Record<string, number> = {};
                headers.forEach((h, index) => {
                    headerMap[h] = index;
                });
                
                let totalLines = 0;

                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    const lineNumber = i + 1;
                    
                    if (!row || row.every((cell: any) => cell === null || cell === undefined || String(cell).trim() === '')) {
                        continue;
                    }
                    
                    totalLines++;
                    
                    // Pula linha de exemplo
                    if (i === 1) {
                        const isExampleRow = row.length >= config.example.length && config.example.every((cellEx, idx) => {
                            return String(row[idx] || '').trim() === String(cellEx || '').trim();
                        });
                        if (isExampleRow) continue;
                    }

                    try {
                        const descricao_item = String(row[headerMap['Descricao do Item']] || '').trim();
                        const valor_unitario_raw = String(row[headerMap['Valor Unitario (R$)']] || '0').trim();
                        const numero_pregao = String(row[headerMap['Numero do Pregao/Ref. Preco']] || '').trim();
                        const uasg = String(row[headerMap['UASG']] || '').trim().replace(/\D/g, ''); 
                        
                        if (!descricao_item) throw new Error("Descrição do Item não pode ser vazia.");
                        if (!numero_pregao) throw new Error("Número do Pregão/Ref. Preço não pode ser vazio.");
                        if (!uasg || uasg.length !== 6) throw new Error("UASG deve ter 6 dígitos.");
                        
                        const valor_unitario = parseInputToNumber(valor_unitario_raw);
                        if (valor_unitario <= 0) throw new Error("Valor Unitário inválido ou zero.");
                        
                        let newItemData: any = {
                            descricao_item,
                            valor_unitario,
                            numero_pregao,
                            uasg,
                        };

                        if (mode === 'material') {
                            newItemData.descricao_reduzida = String(row[headerMap['Descricao Reduzida']] || '').trim();
                            newItemData.codigo_catmat = String(row[headerMap[config.codeLabel]] || '').trim();
                        } else {
                            newItemData.nome_reduzido = String(row[headerMap['Nome Reduzido']] || '').trim();
                            newItemData.unidade_medida = String(row[headerMap['Unidade de Medida']] || '').trim();
                            newItemData.codigo_catmat = String(row[headerMap[config.codeLabel]] || '').trim(); // Internamente usamos codigo_catmat para simplificar
                        }
                        
                        const key = generateItemKey(newItemData);

                        if (encounteredKeys.has(key)) {
                            duplicateItems.push({ lineNumber, errorMessage: "Item duplicado no arquivo." });
                            continue;
                        }
                        
                        if (existingKeysInDiretriz.has(key)) {
                            existingItems.push({ lineNumber, errorMessage: "Item já cadastrado nesta diretriz." });
                            encounteredKeys.add(key); 
                            continue;
                        }

                        encounteredKeys.add(key);
                        validItems.push({
                            id: Math.random().toString(36).substring(2, 9),
                            ...newItemData,
                            quantidade: 0,
                            valor_total: 0,
                        });
                        
                    } catch (e: any) {
                        errorItems.push({ lineNumber, errorMessage: e.message });
                    }
                }

                if (totalLines === 0) throw new Error("Nenhum item válido encontrado no arquivo.");
                
                setSummary({ totalLines, validItems, errorItems, duplicateItems, existingItems });

                if (validItems.length > 0) {
                    toast.success(`${validItems.length} itens prontos para importação.`);
                } else {
                    toast.warning("Nenhum item válido encontrado.");
                }

            } catch (e: any) {
                setError(e.message || "Erro ao processar o arquivo.");
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleConfirmImport = () => {
        if (summary.validItems.length > 0) {
            onImport(summary.validItems);
        } else {
            toast.error("Nenhum item válido para importação.");
        }
    };
    
    const handleDownloadTemplate = () => {
        try {
            const dataToExport = [config.headers, config.example];
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(dataToExport);
            worksheet['!cols'] = config.widths;
            XLSX.utils.book_append_sheet(workbook, worksheet, "Itens");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(data, `template_importacao_${mode}.xlsx`);
            toast.success("Template Excel baixado com sucesso!");
        } catch (e) {
            toast.error("Falha ao gerar o template Excel.");
        }
    };

    const { validItems, errorItems, duplicateItems, existingItems, totalLines } = summary;
    const hasProcessedData = totalLines > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Import className="h-5 w-5 text-primary" />
                        {config.title}
                    </DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <Alert variant="default" className="bg-blue-50/50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-300">
                        <AlertCircle className="h-4 w-4 text-blue-900 dark:text-blue-400" />
                        <AlertTitle>Formato Obrigatório</AlertTitle>
                        <AlertDescription>
                            O arquivo deve ser **.xlsx** e conter as colunas exatas na primeira linha:
                            <span className="font-mono text-sm block mt-1">
                                {config.headers.map(h => `'${h}'`).join(', ')}
                            </span>
                        </AlertDescription>
                    </Alert>
                    
                    <Card className="p-4">
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="file-upload">Selecione o arquivo (.xlsx)</Label>
                                <Input
                                    id="file-upload"
                                    type="file"
                                    accept=".xlsx"
                                    onChange={handleFileChange}
                                    disabled={loading}
                                    className="rounded-full border-primary/50 bg-primary/5 hover:bg-primary/10 cursor-pointer file:bg-primary file:text-primary-foreground file:rounded-full file:border-0"
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Button type="button" variant="outline" onClick={handleDownloadTemplate} className="w-full">
                                    <Download className="mr-2 h-4 w-4" /> Template
                                </Button>
                                <Button type="button" onClick={processFile} disabled={!file || loading} className="w-full">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                                    Processar
                                </Button>
                            </div>
                        </div>
                        {error && (
                            <Alert variant="destructive" className="mt-4">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>Erro Crítico</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </Card>

                    {hasProcessedData && (
                        <Card className="p-4 space-y-4">
                            <h4 className="text-base font-semibold">Resumo e Pré-visualização</h4>
                            
                            <div className="grid grid-cols-5 gap-4 text-center">
                                <div className="p-3 border rounded-lg bg-muted/50">
                                    <p className="text-2xl font-bold">{totalLines}</p>
                                    <p className="text-xs text-muted-foreground">Linhas</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-green-50/50 border-green-200">
                                    <p className="text-2xl font-bold text-green-600">{validItems.length}</p>
                                    <p className="text-xs text-muted-foreground">Válidos</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-red-50/50 border-red-200">
                                    <p className="text-2xl font-bold text-red-600">{errorItems.length}</p>
                                    <p className="text-xs text-muted-foreground">Erros</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-yellow-50/50 border-yellow-200">
                                    <p className="text-2xl font-bold text-yellow-600">{duplicateItems.length}</p>
                                    <p className="text-xs text-muted-foreground">Duplicados</p>
                                </div>
                                <div className="p-3 border rounded-lg bg-orange-50/50 border-orange-200">
                                    <p className="text-2xl font-bold text-orange-600">{existingItems.length}</p>
                                    <p className="text-xs text-muted-foreground">Já Cadastrados</p>
                                </div>
                            </div>
                            
                            {validItems.length > 0 && (
                                <div className="max-h-60 overflow-y-auto border rounded-md">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 bg-muted/80 border-b">
                                            <tr>
                                                <th className="p-2 text-left font-medium">Descrição</th>
                                                <th className="p-2 text-left font-medium">{config.reducedLabel}</th>
                                                {mode === 'servico' && <th className="p-2 text-center font-medium">Unid.</th>}
                                                <th className="p-2 text-center font-medium">Valor Unit.</th>
                                                <th className="p-2 text-center font-medium">Pregão</th>
                                                <th className="p-2 text-center font-medium">UASG</th>
                                                <th className="p-2 text-center font-medium">{config.codeLabel}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validItems.map((item, index) => (
                                                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                                                    <td className="p-2 text-xs max-w-[200px] truncate">{item.descricao_item}</td>
                                                    <td className="p-2 text-xs">{mode === 'material' ? item.descricao_reduzida : item.nome_reduzido}</td>
                                                    {mode === 'servico' && <td className="p-2 text-center text-xs">{item.unidade_medida}</td>}
                                                    <td className="p-2 text-right font-mono text-xs">{formatCurrencyInput(numberToRawDigits(item.valor_unitario)).formatted}</td>
                                                    <td className="p-2 text-center text-xs">{item.numero_pregao}</td>
                                                    <td className="p-2 text-center text-xs">{item.uasg}</td>
                                                    <td className="p-2 text-center text-xs">{item.codigo_catmat}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            <DialogFooter>
                                <Button type="button" onClick={handleConfirmImport} disabled={loading || validItems.length === 0}>
                                    <Import className="mr-2 h-4 w-4" /> Confirmar Importação
                                </Button>
                            </DialogFooter>
                        </Card>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ItemAquisicaoBulkUploadDialog;