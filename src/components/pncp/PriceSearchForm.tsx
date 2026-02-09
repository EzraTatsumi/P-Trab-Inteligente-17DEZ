import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Calendar, AlertCircle, Check, XCircle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsSearchParams, PriceStatsResult } from '@/types/pncp';
import { formatCurrency, formatDate, getPreviousWeekRange } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ItemAquisicaoTemplate } from '@/types/diretrizesMaterialConsumo'; // Importar ItemAquisicaoTemplate

// Tipo para o item de preço selecionado
export interface SelectedPriceItem extends ItemAquisicaoTemplate {
    // Campos adicionais para rastreamento de preço
    isPriceRef: boolean; // Indica se é uma referência de preço (Mínimo, Médio, Mediana)
}

interface PriceSearchFormProps {
    onSelect: (item: SelectedPriceItem) => void;
    onClose: () => void;
}

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onSelect, onClose }) => {
    const [codigoItem, setCodigoItem] = useState('');
    const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('week');
    const [selectedItem, setSelectedItem] = useState<SelectedPriceItem | null>(null);
    
    const { start: defaultStart, end: defaultEnd } = getPreviousWeekRange();
    
    const searchParams = useMemo<PriceStatsSearchParams>(() => {
        let dataInicial: string | undefined;
        let dataFinal: string | undefined;
        
        // Por enquanto, usamos apenas a última semana como padrão
        if (dateRange === 'week') {
            dataInicial = defaultStart.split('T')[0];
            dataFinal = defaultEnd.split('T')[0];
        }
        
        return {
            codigoItem: codigoItem.replace(/\D/g, ''),
            dataInicial,
            dataFinal,
        };
    }, [codigoItem, dateRange, defaultStart, defaultEnd]);

    const { data: priceStats, isLoading, isError, error, refetch } = useQuery<PriceStatsResult>({
        queryKey: ['priceStats', searchParams],
        queryFn: () => fetchPriceStats(searchParams),
        enabled: false, // Desabilitado por padrão, só roda no clique
        retry: 1,
    });
    
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchParams.codigoItem.length !== 9) {
            toast.error("O Código CATMAT/CATSER deve ter 9 dígitos.");
            return;
        }
        setSelectedItem(null);
        refetch();
    };
    
    const handleSelectPrice = (price: number, type: 'min' | 'avg' | 'median', description: string) => {
        if (!priceStats) return;
        
        const item: SelectedPriceItem = {
            id: crypto.randomUUID(),
            codigo_catmat: priceStats.codigoItem,
            descricao_item: priceStats.descricaoItem || `Referência de Preço - ${description}`,
            descricao_reduzida: priceStats.descricaoItem || `Ref. Preço ${description}`,
            valor_unitario: price,
            numero_pregao: `Ref. Preço ${description}`,
            uasg: '000000',
            nd: '33.90.30', // ND padrão para referência de preço (pode ser ajustado se necessário)
            isPriceRef: true,
        };
        
        setSelectedItem(item);
    };
    
    const handleConfirmSelection = () => {
        if (selectedItem) {
            onSelect(selectedItem);
            onClose();
        }
    };

    const hasResults = priceStats && priceStats.quantidadeResultados > 0;
    const hasError = isError || (priceStats && priceStats.quantidadeResultados === 0 && priceStats.codigoItem.length === 9);

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="space-y-4 border-b pb-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="codigoItem">Código CATMAT/CATSER (9 dígitos) *</Label>
                        <Input
                            id="codigoItem"
                            value={codigoItem}
                            onChange={(e) => setCodigoItem(e.target.value)}
                            placeholder="Ex: 301000000"
                            maxLength={9}
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="dateRange">Período de Busca</Label>
                        <Input
                            id="dateRange"
                            value="Última Semana"
                            disabled
                            className="bg-muted/50"
                        />
                    </div>
                </div>
                <Button type="submit" disabled={isLoading || codigoItem.length !== 9} className="w-full">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Buscar Estatísticas de Preço
                </Button>
            </form>

            {isLoading && (
                <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Consultando PNCP...</p>
                </div>
            )}

            {hasError && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Nenhum Resultado Encontrado</AlertTitle>
                    <AlertDescription>
                        {error instanceof Error ? error.message : "Não foi possível encontrar estatísticas de preço para este código no período selecionado."}
                    </AlertDescription>
                </Alert>
            )}

            {hasResults && priceStats && (
                <Card className="border-l-4 border-primary">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold">
                            {priceStats.descricaoItem || `Estatísticas para CATMAT ${priceStats.codigoItem}`}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Período: {formatDate(searchParams.dataInicial!)} a {formatDate(searchParams.dataFinal!)} ({priceStats.quantidadeResultados} resultados)
                        </p>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="grid grid-cols-3 gap-4">
                            {/* Mínimo */}
                            <div 
                                className={cn("p-3 border rounded-lg cursor-pointer transition-colors", selectedItem?.numero_pregao.includes('Mínimo') ? 'bg-primary/10 border-primary' : 'hover:bg-muted')}
                                onClick={() => handleSelectPrice(priceStats.valorMinimo, 'min', 'Mínimo')}
                            >
                                <p className="text-xs text-muted-foreground">Valor Mínimo</p>
                                <p className="font-bold text-lg text-green-600">{formatCurrency(priceStats.valorMinimo)}</p>
                            </div>
                            {/* Médio */}
                            <div 
                                className={cn("p-3 border rounded-lg cursor-pointer transition-colors", selectedItem?.numero_pregao.includes('Médio') ? 'bg-primary/10 border-primary' : 'hover:bg-muted')}
                                onClick={() => handleSelectPrice(priceStats.valorMedio, 'avg', 'Médio')}
                            >
                                <p className="text-xs text-muted-foreground">Valor Médio</p>
                                <p className="font-bold text-lg text-blue-600">{formatCurrency(priceStats.valorMedio)}</p>
                            </div>
                            {/* Mediana */}
                            <div 
                                className={cn("p-3 border rounded-lg cursor-pointer transition-colors", selectedItem?.numero_pregao.includes('Mediana') ? 'bg-primary/10 border-primary' : 'hover:bg-muted')}
                                onClick={() => handleSelectPrice(priceStats.valorMediana, 'median', 'Mediana')}
                            >
                                <p className="text-xs text-muted-foreground">Valor Mediana</p>
                                <p className="font-bold text-lg text-orange-600">{formatCurrency(priceStats.valorMediana)}</p>
                            </div>
                        </div>
                        
                        {selectedItem && (
                            <div className="mt-4 flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="font-medium text-sm text-green-700">
                                    <Check className="h-4 w-4 inline mr-2" />
                                    Preço selecionado: {selectedItem.numero_pregao} ({formatCurrency(selectedItem.valor_unitario)})
                                </p>
                                <Button onClick={handleConfirmSelection} size="sm">
                                    Confirmar
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default PriceSearchForm;