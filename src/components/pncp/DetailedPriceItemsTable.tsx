import React, { useState, useMemo, useCallback } from 'react';
import { DetailedArpItem, PriceStats } from '@/types/pncp';
import { formatCurrency, formatNumber, formatCodug, formatDate } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, RefreshCw, DollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { cn } from '@/lib/utils';

interface DetailedPriceItemsTableProps {
    initialItems: DetailedArpItem[];
    initialStats: PriceStats;
    onImport: (item: ItemAquisicao) => void;
}

// Função auxiliar para calcular a mediana
const calculateMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        return sorted[mid];
    }
};

// Função principal de recálculo
const calculateNewStats = (items: DetailedArpItem[], excludedIds: Set<string>): PriceStats => {
    const filteredItems = items.filter(item => !excludedIds.has(item.id));
    const values = filteredItems.map(item => item.valorUnitario);
    
    if (values.length === 0) {
        return { minPrice: 0, maxPrice: 0, avgPrice: 0, medianPrice: 0 };
    }
    
    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avgPrice = sum / values.length;
    const medianPrice = calculateMedian(values);
    
    return { minPrice, maxPrice, avgPrice, medianPrice };
};

const DetailedPriceItemsTable: React.FC<DetailedPriceItemsTableProps> = ({
    initialItems,
    initialStats,
    onImport,
}) => {
    // Estado para rastrear os IDs dos itens que o usuário MARCOU para exclusão
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    
    // Estado para armazenar as estatísticas ATUALMENTE EXIBIDAS
    const [currentStats, setCurrentStats] = useState<PriceStats>(initialStats);
    
    // Estado para rastrear se as estatísticas exibidas estão sincronizadas com os itens excluídos
    const [isRecalculated, setIsRecalculated] = useState(true);
    
    // Efeito para sincronizar as estatísticas iniciais
    React.useEffect(() => {
        setCurrentStats(initialStats);
        setExcludedIds(new Set());
        setIsRecalculated(true);
    }, [initialStats, initialItems]);

    // Lista de itens filtrada (apenas para exibição)
    const itemsForDisplay = useMemo(() => {
        return initialItems.map(item => ({
            ...item,
            isExcluded: excludedIds.has(item.id),
        }));
    }, [initialItems, excludedIds]);
    
    // Verifica se há itens marcados para exclusão que ainda não foram recalculados
    const needsRecalculation = useMemo(() => {
        return !isRecalculated || excludedIds.size > 0;
    }, [isRecalculated, excludedIds.size]);

    const handleToggleExclusion = (itemId: string) => {
        setExcludedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            setIsRecalculated(false); // Marca que o estado de exclusão mudou
            return newSet;
        });
    };
    
    const handleRecalculate = () => {
        const newStats = calculateNewStats(initialItems, excludedIds);
        setCurrentStats(newStats);
        setIsRecalculated(true);
        toast.success("Estatísticas recalculadas com sucesso!");
    };
    
    const handleImportRecalculated = () => {
        if (currentStats.avgPrice === 0) {
            toast.error("Não é possível importar o preço médio de um conjunto vazio.");
            return;
        }
        
        // Cria um ItemAquisicao simulado com o preço médio recalculado
        const itemToImport: ItemAquisicao = {
            id: `price-ref-${Date.now()}`,
            descricao_item: `Preço Médio Recalculado (CATMAT ${initialItems[0].codigoItem})`,
            descricao_reduzida: `Preço Médio Recalculado`,
            valor_unitario: currentStats.avgPrice,
            numero_pregao: 'REF. PNCP',
            uasg: '000000',
            codigo_catmat: initialItems[0].codigoItem,
        };
        
        onImport(itemToImport);
    };
    
    const handleImportIndividualItem = (item: DetailedArpItem) => {
        // Cria um ItemAquisicao a partir do item detalhado
        const itemToImport: ItemAquisicao = {
            id: item.id,
            descricao_item: item.descricaoItem,
            descricao_reduzida: '', // Será preenchida na inspeção
            valor_unitario: item.valorUnitario,
            numero_pregao: item.pregaoFormatado,
            uasg: item.uasg,
            codigo_catmat: item.codigoItem,
        };
        
        onImport(itemToImport);
    };

    const totalItems = initialItems.length;
    const itemsUsedInCalculation = totalItems - excludedIds.size;

    return (
        <div className="space-y-6">
            {/* 1. Resumo das Estatísticas */}
            <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Estatísticas de Preço (Itens Usados: {itemsUsedInCalculation}/{totalItems})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                    <div className="grid grid-cols-4 gap-4 text-center">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Preço Médio</p>
                            <p className="text-lg font-bold text-blue-600">{formatCurrency(currentStats.avgPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Mediana</p>
                            <p className="text-lg font-bold text-blue-600">{formatCurrency(currentStats.medianPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Mínimo</p>
                            <p className="text-lg font-bold text-green-600">{formatCurrency(currentStats.minPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Máximo</p>
                            <p className="text-lg font-bold text-red-600">{formatCurrency(currentStats.maxPrice)}</p>
                        </div>
                    </div>
                    
                    <div className="flex justify-end mt-4 gap-2">
                        <Button 
                            onClick={handleRecalculate}
                            disabled={isRecalculated || itemsUsedInCalculation === 0}
                            variant="secondary"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Recalcular Estatísticas ({excludedIds.size} excluído{excludedIds.size !== 1 ? 's' : ''})
                        </Button>
                        
                        <Button 
                            onClick={handleImportRecalculated}
                            disabled={itemsUsedInCalculation === 0}
                        >
                            <Import className="h-4 w-4 mr-2" />
                            Importar Preço Médio
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Tabela de Itens Detalhados */}
            <Card>
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base">
                        Itens Detalhados ({totalItems} registros)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Marque os itens que deseja excluir do cálculo estatístico e clique em "Recalcular".
                    </p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[40vh] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[5%] text-center">Excluir</TableHead>
                                    <TableHead className="w-[10%]">Valor Unitário</TableHead>
                                    <TableHead className="w-[40%]">Descrição Item</TableHead>
                                    <TableHead className="w-[15%]">Pregão/UASG</TableHead>
                                    <TableHead className="w-[15%]">Vigência</TableHead>
                                    <TableHead className="w-[15%] text-center">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsForDisplay.map(item => (
                                    <TableRow 
                                        key={item.id}
                                        className={cn(
                                            item.isExcluded ? "bg-red-50/50 opacity-70" : "hover:bg-muted/50",
                                            !item.isExcluded && needsRecalculation && "bg-yellow-50/50" // Destaca se o item não está excluído mas o cálculo está desatualizado
                                        )}
                                    >
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleToggleExclusion(item.id)}
                                                className={item.isExcluded ? "text-red-600 hover:bg-red-100" : "text-green-600 hover:bg-green-100"}
                                            >
                                                {item.isExcluded ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="font-bold text-sm whitespace-nowrap">
                                            {formatCurrency(item.valorUnitario)}
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs whitespace-normal">
                                            {item.descricaoItem}
                                            <p className="text-xs text-muted-foreground mt-1">{item.omNome}</p>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {formatPregao(item.pregaoFormatado)}
                                            <p className="text-muted-foreground">{formatCodug(item.uasg)}</p>
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">
                                            {formatDate(item.dataVigenciaInicial)} - {formatDate(item.dataVigenciaFinal)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleImportIndividualItem(item)}
                                                className="w-full"
                                            >
                                                <Import className="h-4 w-4 mr-1" />
                                                Importar Item
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DetailedPriceItemsTable;