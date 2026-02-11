import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Loader2, DollarSign, Check, Trash2, AlertCircle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
    isInspecting: boolean;
    onClearPriceSelection: () => void;
    selectedItemForInspection: ItemAquisicao | null;
}

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ 
    onPriceSelect, 
    isInspecting, 
    onClearPriceSelection,
    selectedItemForInspection 
}) => {
    const [codigoItem, setCodigoItem] = useState('');
    const [isSearchTriggered, setIsSearchTriggered] = useState(false);

    const { data: stats, isLoading, isError, error } = useQuery({
        queryKey: ['priceStats', codigoItem],
        queryFn: () => fetchPriceStats({ codigoItem }),
        enabled: isSearchTriggered && !!codigoItem,
        staleTime: 1000 * 60 * 10, // 10 minutos de cache
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!codigoItem) {
            toast.error("Informe o código do item (CATMAT ou CATSER).");
            return;
        }
        setIsSearchTriggered(true);
    };

    const handleSelectPrice = (value: number, label: string) => {
        if (!stats) return;

        const item: ItemAquisicao = {
            id: `price-ref-${codigoItem}-${label.toLowerCase()}`,
            descricao_item: stats.descricaoItem || `Referência de Preço (${label}) - ${codigoItem}`,
            descricao_reduzida: '', // Será preenchido na inspeção
            valor_unitario: value,
            numero_pregao: `REF. PREÇO (${label})`,
            uasg: '000000', // UASG genérica para referência de preço
            codigo_catmat: codigoItem,
            quantidade: 0,
            valor_total: 0,
            nd: '',
            nr_subitem: '',
            nome_subitem: '',
        };

        onPriceSelect(item);
        toast.success(`Preço ${label} selecionado como referência.`);
    };

    return (
        <div className="space-y-6">
            <form onSubmit={handleSearch} className="bg-muted/30 p-4 rounded-lg border space-y-4">
                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="codigoItemPrice">Código do Item (CATMAT/CATSER) *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="codigoItemPrice"
                                placeholder="Ex: 123456"
                                value={codigoItem}
                                onChange={(e) => {
                                    setCodigoItem(e.target.value.replace(/\D/g, ''));
                                    setIsSearchTriggered(false);
                                }}
                            />
                            <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                                Consultar Preços
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            {isSearchTriggered && (
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                            <p className="text-muted-foreground mt-2">Calculando estatísticas no PNCP...</p>
                        </div>
                    ) : isError ? (
                        <div className="text-center py-12 text-red-500">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p>Erro ao buscar estatísticas: {(error as Error).message}</p>
                        </div>
                    ) : stats ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Estatísticas de Preço: {stats.descricaoItem}</h3>
                                {selectedItemForInspection && (
                                    <Button variant="outline" size="sm" onClick={onClearPriceSelection} className="text-red-600 border-red-200 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Limpar Referência
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Mínimo', value: stats.precoMinimo, color: 'text-blue-600' },
                                    { label: 'Médio', value: stats.precoMedio, color: 'text-primary' },
                                    { label: 'Mediana', value: stats.precoMediana, color: 'text-purple-600' },
                                    { label: 'Máximo', value: stats.precoMaximo, color: 'text-orange-600' },
                                ].map((price) => {
                                    const isSelected = selectedItemForInspection?.valor_unitario === price.value && 
                                                      selectedItemForInspection?.numero_pregao.includes(price.label);
                                    
                                    return (
                                        <Card 
                                            key={price.label} 
                                            className={cn(
                                                "cursor-pointer transition-all hover:shadow-md border-2",
                                                isSelected ? "border-primary bg-primary/5" : "border-transparent"
                                            )}
                                            onClick={() => handleSelectPrice(price.value, price.label)}
                                        >
                                            <CardHeader className="p-4 pb-2">
                                                <CardTitle className="text-sm font-medium text-muted-foreground">{price.label}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-4 pt-0">
                                                <div className={cn("text-xl font-bold", price.color)}>
                                                    {formatCurrency(price.value)}
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center text-xs text-primary mt-2 font-medium">
                                                        <Check className="h-3 w-3 mr-1" /> Selecionado
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>

                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold">Sobre a Pesquisa de Preço:</p>
                                    <p>Estes valores são calculados com base em todas as contratações homologadas no PNCP para este código de item nos últimos meses. Ao selecionar um valor, ele será usado como referência de preço médio para sua diretriz.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                            Nenhuma estatística de preço encontrada para este código.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PriceSearchForm;