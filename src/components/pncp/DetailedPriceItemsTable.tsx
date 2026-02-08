import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { DetailedArpItem, PriceStats } from '@/types/pncp';
import { formatCurrency, formatNumber, formatDate, formatPregao } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, RefreshCw, Import, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';

interface DetailedPriceItemsTableProps {
    initialItems: DetailedArpItem[];
    initialStats: PriceStats;
    catmatCode: string;
    catmatDescription: string | null;
    totalRegistros: number;
    // Função para importar o item selecionado (pode ser o preço médio recalculado ou um item individual)
    onImport: (item: ItemAquisicao) => void;
}

// Função para calcular novas estatísticas (Mínimo, Máximo, Médio, Mediana)
const calculateNewStats = (items: DetailedArpItem[], excludedIds: Set<string>): PriceStats => {
    const validItems = items.filter(item => !excludedIds.has(item.id));
    const values = validItems.map(item => item.valorUnitario).sort((a, b) => a - b);

    if (values.length === 0) {
        return { minPrice: 0, maxPrice: 0, avgPrice: 0, medianPrice: 0 };
    }

    const minPrice = values[0];
    const maxPrice = values[values.length - 1];
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avgPrice = sum / values.length;

    let medianPrice;
    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 0) {
        medianPrice = (values[mid - 1] + values[mid]) / 2;
    } else {
        medianPrice = values[mid];
    }

    return { minPrice, maxPrice, avgPrice, medianPrice };
};

const DetailedPriceItemsTable: React.FC<DetailedPriceItemsTableProps> = ({
    initialItems,
    initialStats,
    catmatCode,
    catmatDescription,
    totalRegistros,
    onImport,
}) => {
    // Estado para rastrear os IDs dos itens excluídos
    const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
    // Estado para armazenar as estatísticas atualmente exibidas (iniciais ou recalculadas)
    const [currentStats, setCurrentStats] = useState<PriceStats>(initialStats);
    // Estado para rastrear o item individual selecionado para importação
    const [selectedIndividualItem, setSelectedIndividualItem] = useState<DetailedArpItem | null>(null);
    
    // Calcula as estatísticas recalculadas (sempre atualizadas com base nos excluídos)
    const recalculatedStats = useMemo(() => {
        return calculateNewStats(initialItems, excludedIds);
    }, [initialItems, excludedIds]);
    
    // Efeito para resetar as estatísticas exibidas para as iniciais quando a lista inicial muda
    useEffect(() => {
        setCurrentStats(initialStats);
        setExcludedIds(new Set());
        setSelectedIndividualItem(null);
    }, [initialStats, initialItems]);

    const handleToggleExclude = useCallback((itemId: string) => {
        setExcludedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) {
                newSet.delete(itemId);
            } else {
                newSet.add(itemId);
            }
            // Sempre que a exclusão muda, resetamos a seleção individual
            setSelectedIndividualItem(null); 
            return newSet;
        });
    }, []);
    
    const handleRecalculate = () => {
        setCurrentStats(recalculatedStats);
        setSelectedIndividualItem(null); // Resetar seleção individual ao recalcular
        toast.success("Estatísticas recalculadas com sucesso!");
    };
    
    const handleSelectIndividualItem = (item: DetailedArpItem) => {
        if (selectedIndividualItem?.id === item.id) {
            setSelectedIndividualItem(null);
        } else {
            setSelectedIndividualItem(item);
            // Ao selecionar um item individual, as estatísticas exibidas voltam a ser as iniciais/recalculadas
            setCurrentStats(recalculatedStats); 
        }
    };

    const handleImport = (type: 'average' | 'individual') => {
        let itemToImport: ItemAquisicao;
        
        if (type === 'individual' && selectedIndividualItem) {
            // Importar item individual
            itemToImport = {
                id: selectedIndividualItem.id,
                descricao_item: selectedIndividualItem.descricaoItem,
                descricao_reduzida: selectedIndividualItem.descricaoItem.substring(0, 50) + (selectedIndividualItem.descricaoItem.length > 50 ? '...' : ''),
                valor_unitario: selectedIndividualItem.valorUnitario,
                numero_pregao: selectedIndividualItem.pregaoFormatado,
                uasg: selectedIndividualItem.uasg,
                codigo_catmat: selectedIndividualItem.codigoItem,
            };
            // O toast de sucesso será disparado no ItemAquisicaoPNCPDialog após a inspeção
        } else if (type === 'average') {
            // Importar preço médio recalculado
            if (currentStats.avgPrice === 0) {
                toast.error("O preço médio é zero. Selecione um item individual ou verifique os dados.");
                return;
            }
            
            // Criar um ItemAquisicao representando o preço médio
            itemToImport = {
                id: `AVG-${catmatCode}-${Date.now()}`,
                descricao_item: catmatDescription || `Preço Médio para CATMAT ${catmatCode}`,
                descricao_reduzida: `Preço Médio ${catmatCode}`,
                valor_unitario: currentStats.avgPrice,
                // Usamos valores de referência para Pregão/UASG que serão revisados na inspeção
                numero_pregao: 'REF. PREÇO', 
                uasg: '000000', 
                codigo_catmat: catmatCode,
            };
            // O toast de sucesso será disparado no ItemAquisicaoPNCPDialog após a inspeção
        } else {
            toast.error("Nenhum item selecionado para importação.");
            return;
        }
        
        onImport(itemToImport);
    };
    
    const itemsCount = initialItems.length;
    const validItemsCount = itemsCount - excludedIds.size;
    
    const isRecalculated = currentStats.avgPrice !== initialStats.avgPrice || excludedIds.size > 0;

    return (
        <div className="space-y-6">
            <Card className="p-4">
                <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-lg font-bold">
                        {catmatCode} - {catmatDescription || 'Descrição não disponível'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        {totalRegistros} registros de preço encontrados. Exclua outliers e recalcule as estatísticas.
                    </p>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                    
                    {/* Resumo das Estatísticas */}
                    <div className="grid grid-cols-4 gap-4 border p-3 rounded-lg bg-background">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Preço Mínimo</p>
                            <p className="font-bold text-sm text-green-600">{formatCurrency(currentStats.minPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Preço Máximo</p>
                            <p className="font-bold text-sm text-red-600">{formatCurrency(currentStats.maxPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Preço Médio</p>
                            <p className="font-bold text-lg text-primary">{formatCurrency(currentStats.avgPrice)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Mediana</p>
                            <p className="font-bold text-sm text-gray-700">{formatCurrency(currentStats.medianPrice)}</p>
                        </div>
                    </div>
                    
                    {/* Ações de Recálculo e Importação */}
                    <div className="flex justify-between items-center pt-2">
                        <div className="flex items-center gap-2">
                            <Button 
                                type="button" 
                                onClick={handleRecalculate}
                                disabled={excludedIds.size === 0 || validItemsCount === 0}
                                variant="secondary"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Recalcular Estatísticas ({validItemsCount} itens)
                            </Button>
                            {isRecalculated && (
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            {selectedIndividualItem && (
                                <Button 
                                    type="button" 
                                    onClick={() => handleImport('individual')}
                                    variant="outline"
                                >
                                    <Import className="h-4 w-4 mr-2" />
                                    Importar Item Selecionado
                                </Button>
                            )}
                            <Button 
                                type="button" 
                                onClick={() => handleImport('average')}
                                disabled={validItemsCount === 0}
                            >
                                <Import className="h-4 w-4 mr-2" />
                                Importar Preço Médio
                            </Button>
                        </div>
                    </div>

                    {/* Tabela de Itens Detalhados */}
                    <div className="max-h-[40vh] overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[50px] text-center">Excluir</TableHead>
                                    <TableHead className="w-[15%]">ARP/Pregão</TableHead>
                                    <TableHead className="w-[40%]">Descrição Item</TableHead>
                                    <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                                    <TableHead className="w-[15%] text-center">Vigência Fim</TableHead>
                                    <TableHead className="w-[10%] text-center">Selecionar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialItems.map(item => {
                                    const isExcluded = excludedIds.has(item.id);
                                    const isSelected = selectedIndividualItem?.id === item.id;
                                    
                                    return (
                                        <TableRow 
                                            key={item.id}
                                            className={isExcluded ? "bg-red-50/50 opacity-60 line-through" : isSelected ? "bg-green-100/50" : "hover:bg-muted/50"}
                                        >
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handleToggleExclude(item.id)}
                                                    className={isExcluded ? "text-green-600 hover:bg-green-100" : "text-red-600 hover:bg-red-100"}
                                                >
                                                    {isExcluded ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {item.numeroAta} ({formatPregao(item.pregaoFormatado)})
                                            </TableCell>
                                            <TableCell className="text-xs max-w-xs whitespace-normal">
                                                {item.descricaoItem}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-sm">
                                                {formatCurrency(item.valorUnitario)}
                                            </TableCell>
                                            <TableCell className="text-center text-xs">
                                                {formatDate(item.dataVigenciaFinal)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    variant={isSelected ? "default" : "outline"} 
                                                    size="sm" 
                                                    onClick={() => handleSelectIndividualItem(item)}
                                                    disabled={isExcluded}
                                                >
                                                    {isSelected ? <Check className="h-4 w-4" /> : "Selecionar"}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default DetailedPriceItemsTable;