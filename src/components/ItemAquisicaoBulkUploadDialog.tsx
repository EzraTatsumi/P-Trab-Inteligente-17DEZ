import React, { useState } from 'react';
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
    onImport: (items: ItemAquisicao[]) => void;
    // NOVO: Lista de itens já existentes na diretriz atual
    existingItemsInDiretriz: ItemAquisicao[]; 
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
    duplicateItems: ImportError[]; // Duplicatas internas ao arquivo
    existingItems: ImportError[]; // NOVO: Itens já cadastrados na diretriz
}

// Cabeçalhos do template
const TEMPLATE_HEADERS = [
    'Descricao do Item', 
    'Descricao Reduzida', // NOVO: Adicionado
    'Valor Unitario (R$)', 
    'Numero do Pregao/Ref. Preco', 
    'UASG', 
    'Codigo CATMAT'
];

// Linha de exemplo
const EXAMPLE_ROW = [
    'SABÃO PÓ/ ASPECTO FÍSICO:PÓ/ COMPOSIÇÃO:ÁGUA/ ALQUIL BENZENO SULFATO DE SÓDIO/ CORANTE/ CA/ CARACTERÍSTICAS ADICIONAIS:AMACIANTE',
    'SABÃO PÓ C/ AMACIANTE', // NOVO: Adicionado
    '1,25', // Valor Unitário
    '90.001/25', // Número do Pregão
    '160.170', // UASG
    '419551' // CATMAT
];

// Larguras das colunas (em unidades de largura de caractere)
const COLUMN_WIDTHS = [
    { wch: 60 }, // Descricao do Item
    { wch: 30 }, // Descricao Reduzida (NOVO)
    { wch: 20 }, // Valor Unitario (R$)
    { wch: 25 }, // Numero do Pregao/Ref. Preco
    { wch: 15 }, // UASG
    { wch: 20 }  // Codigo CATMAT
];

// Função auxiliar para gerar a chave de unicidade de um item
const generateItemKey = (item: { descricao_item: string, codigo_catmat: string, numero_pregao: string, uasg: string }): string => {
    // Normaliza e remove espaços extras
    const normalize = (str: string) => 
        (str || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' '); // Substitui múltiplos espaços por um único espaço
        
    const desc = normalize(item.descricao_item);
    const catmat = normalize(item.codigo_catmat);
    const pregao = normalize(item.numero_pregao);
    const uasg = normalize(item.uasg);
    
    // A chave de unicidade NÃO inclui a descrição reduzida, pois ela é apenas um rótulo auxiliar.
    return `${desc}|${catmat}|${pregao}|${uasg}`;
};

const ItemAquisicaoBulkUploadDialog: React.FC<ItemAquisicaoBulkUploadDialogProps> = ({
    open,
    onOpenChange,
    onImport,
    existingItemsInDiretriz, // NOVO
}) => {
    const [file, setFile] = useState<File | null>(null);
    // NOVO ESTADO: Armazena o resumo da importação
    const [summary, setSummary] = useState<ImportSummary>({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                setError(null);
                setSummary({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] }); // Limpa o resumo ao selecionar novo arquivo
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
                
                // Converte a planilha para JSON, mantendo os cabeçalhos
                const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length <= 1) { // Deve ter pelo menos cabeçalho e uma linha de dados
                    throw new Error("O arquivo Excel está vazio ou contém apenas o cabeçalho.");
                }

                const headers = json[0] as string[];
                
                // 'Descricao Reduzida' não é obrigatória para a validação mínima, mas deve estar presente no arquivo.
                const requiredHeaders = ['Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG'];
                const expectedHeaders = [...requiredHeaders, 'Descricao Reduzida', 'Codigo CATMAT'];
                
                const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));

                if (missingHeaders.length > 0) {
                    // Se faltar apenas 'Descricao Reduzida' ou 'Codigo CATMAT', permite, mas avisa.
                    const criticalMissing = requiredHeaders.filter(h => !headers.includes(h));
                    if (criticalMissing.length > 0) {
                        throw new Error(`Cabeçalhos obrigatórios ausentes: ${criticalMissing.join(', ')}`);
                    }
                }
                
                const validItems: ItemAquisicao[] = [];
                const errorItems: ImportError[] = [];
                const duplicateItems: ImportError[] = []; 
                const existingItems: ImportError[] = []; // NOVO: Para itens já cadastrados
                
                const encounteredKeys = new Set<string>(); 
                
                // Pré-carrega as chaves dos itens já existentes na diretriz
                const existingKeysInDiretriz = new Set<string>(existingItemsInDiretriz.map(generateItemKey));
                
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
                        // Extração e normalização dos dados
                        const descricao_item = String(row[headerMap['Descricao do Item']] || '').trim();
                        // NOVO: Extração da Descrição Reduzida
                        const descricao_reduzida = String(row[headerMap['Descricao Reduzida']] || '').trim();
                        
                        const valor_unitario_raw = String(row[headerMap['Valor Unitario (R$)']] || '0').trim();
                        const numero_pregao = String(row[headerMap['Numero do Pregao/Ref. Preco']] || '').trim();
                        // Remove formatação de UASG (ex: 160.170 -> 160170)
                        const uasg = String(row[headerMap['UASG']] || '').trim().replace(/\D/g, ''); 
                        const codigo_catmat = String(row[headerMap['Codigo CATMAT']] || '').trim();
                        
                        if (!descricao_item) {
                            throw new Error("Descrição do Item não pode ser vazia.");
                        }
                        
                        if (!numero_pregao) {
                            throw new Error("Número do Pregão/Ref. Preço não pode ser vazio.");
                        }

                        if (!uasg || uasg.length !== 6) {
                            throw new Error("UASG deve ter 6 dígitos.");
                        }
                        
                        const valor_unitario = parseInputToNumber(valor_unitario_raw);

                        if (valor_unitario <= 0) {
                            throw new Error("Valor Unitário inválido ou zero.");
                        }
                        
                        const newItemData = {
                            descricao_item,
                            descricao_reduzida, // NOVO: Incluído
                            valor_unitario,
                            numero_pregao,
                            uasg,
                            codigo_catmat,
                        };
                        
                        // A chave de unicidade continua usando os campos principais
                        const key = generateItemKey(newItemData);

                        // 1. VERIFICAÇÃO DE DUPLICIDADE INTERNA (NO ARQUIVO)
                        if (encounteredKeys.has(key)) {
                            duplicateItems.push({
                                lineNumber,
                                errorMessage: "Item duplicado (Descrição, CATMAT, Pregão e UASG) encontrado no arquivo.",
                            });
                            continue;
                        }
                        
                        // 2. VERIFICAÇÃO DE DUPLICIDADE EXTERNA (JÁ CADASTRADO) - NOVO
                        if (existingKeysInDiretriz.has(key)) {
                            existingItems.push({
                                lineNumber,
                                errorMessage: "Item já cadastrado nesta diretriz.",
                            });
                            // Adiciona a chave ao encounteredKeys para evitar que seja listado como duplicata interna se aparecer novamente
                            encounteredKeys.add(key); 
                            continue;
                        }

                        // Se passou nas duas verificações de duplicidade
                        encounteredKeys.add(key);
                        validItems.push({
                            id: Math.random().toString(36).substring(2, 9), // ID temporário
                            ...newItemData,
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
                    duplicateItems, 
                    existingItems, // Inclui duplicatas externas no resumo
                });

                if (validItems.length > 0) {
                    toast.success(`${validItems.length} itens prontos para importação. ${duplicateItems.length > 0 ? `(${duplicateItems.length} duplicados ignorados)` : ''}`);
                } else {
                    toast.warning("Nenhum item válido encontrado. Verifique os erros e duplicatas abaixo.");
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
            // Não fechar aqui, o onImport do pai fará isso se for bem-sucedido
        } else {
            toast.error("Nenhum item válido para importação.");
        }
    };
    
    const handleClose = () => {
        setFile(null);
        setSummary({ totalLines: 0, validItems: [], errorItems: [], duplicateItems: [], existingItems: [] });
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

    const { validItems, errorItems, duplicateItems, existingItems, totalLines } = summary;
    const hasProcessedData = totalLines > 0;
    const hasErrors = errorItems.length > 0;
    const hasDuplicates = duplicateItems.length > 0;
    const hasExisting = existingItems.length > 0;

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
                                'Descricao do Item', 'Descricao Reduzida', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco', 'UASG', 'Codigo CATMAT'
                            </span>
                            <span className="text-xs mt-2 block">
                                Atenção: As colunas 'Descricao do Item', 'Valor Unitario (R$)', 'Numero do Pregao/Ref. Preco' e 'UASG' são obrigatórias.
                            </span>
                        </AlertDescription>
                    </Alert>
                    
                    <Card className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-base font-semibold">Passo 1: Carregar Arquivo</h4>
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
                            <div className="space-y-2 col-span-1">
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    onClick={handleDownloadTemplate}
                                    className="w-full"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar Template (.xlsx)
                                </Button>
                                <Button 
                                    type="button" 
                                    onClick={processFile}
                                    disabled={!file || loading}
                                    className="w-full"
                                >
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
                                    Processar Arquivo
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

                    {/* Passo 2: Pré-visualização e Confirmação */}
                    {hasProcessedData && (
                        <Card className="p-4 space-y-4">
                            <h4 className="text-base font-semibold">Passo 2: Resumo e Pré-visualização</h4>
                            
                            {/* Resumo Estatístico */}
                            <div className="grid grid-cols-5 gap-4 text-center">
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
                                {/* Itens Duplicados (Internos) */}
                                <div className="p-3 border rounded-lg bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-800">
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{duplicateItems.length}</p>
                                    <p className="text-sm text-muted-foreground">Duplicados (Arquivo)</p>
                                </div>
                                {/* NOVO: Itens Já Cadastrados (Externos) */}
                                <div className="p-3 border rounded-lg bg-orange-50/50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800">
                                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{existingItems.length}</p>
                                    <p className="text-sm text-muted-foreground">Já Cadastrados</p>
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
                            
                            {/* Lista de Duplicatas Internas */}
                            {hasDuplicates && (
                                <Alert variant="warning" className="mt-4 bg-yellow-50/50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/50 dark:border-yellow-800 dark:text-yellow-300">
                                    <AlertCircle className="h-4 w-4 text-yellow-900 dark:text-yellow-400" />
                                    <AlertTitle>Itens Duplicados (Interno ao Arquivo) ({duplicateItems.length})</AlertTitle>
                                    <AlertDescription className="max-h-32 overflow-y-auto text-sm">
                                        <p className="mb-2">Os itens abaixo foram ignorados, pois já existem no arquivo com a mesma chave de identificação (Descrição, CATMAT, Pregão e UASG).</p>
                                        <ul className="list-disc list-inside space-y-1 mt-2">
                                            {duplicateItems.map((err, index) => (
                                                <li key={index}>
                                                    <span className="font-semibold">Linha {err.lineNumber}:</span> {err.errorMessage}
                                                </li>
                                            ))}
                                        </ul>
                                    </AlertDescription>
                                </Alert>
                            )}
                            
                            {/* NOVO: Alerta de Itens Já Cadastrados (Externos) */}
                            {hasExisting && (
                                <Alert className="mt-4 bg-orange-50/50 border-orange-200 text-orange-900 dark:bg-orange-950/50 dark:border-orange-800 dark:text-orange-300">
                                    <AlertTriangle className="h-4 w-4 text-orange-900 dark:text-orange-400" />
                                    <AlertTitle>Itens Já Cadastrados ({existingItems.length})</AlertTitle>
                                    <AlertDescription className="max-h-32 overflow-y-auto text-sm">
                                        <p className="mb-2">Os itens abaixo foram ignorados, pois já estão cadastrados nesta diretriz. Eles não serão importados novamente.</p>
                                        <ul className="list-disc list-inside space-y-1 mt-2">
                                            {existingItems.map((err, index) => (
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
                                                <th className="p-2 text-left font-medium w-[25%]">Descricao do Item</th>
                                                <th className="p-2 text-left font-medium w-[15%]">Descricao Reduzida</th> {/* NOVO */}
                                                <th className="p-2 text-center font-medium w-[15%]">Valor Unitario (R$)</th>
                                                <th className="p-2 text-center font-medium w-[15%]">Numero do Pregao/Ref. Preco</th>
                                                <th className="p-2 text-center font-medium w-[10%]">UASG</th>
                                                <th className="p-2 text-center font-medium w-[20%]">Codigo CATMAT</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {validItems.map((item, index) => (
                                                <tr key={index} className="border-b last:border-b-0 hover:bg-muted/50">
                                                    <td className="p-2">{item.descricao_item}</td>
                                                    <td className="p-2 text-xs">{item.descricao_reduzida || 'N/A'}</td> {/* NOVO */}
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