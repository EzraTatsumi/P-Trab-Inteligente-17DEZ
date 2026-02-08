import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen, ChevronDown, ChevronUp, Import } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatCurrency, formatNumber } from '@/lib/formatUtils';
import OmSelectorDialog from '@/components/OmSelectorDialog';
import { format, subDays } from 'date-fns';
import { fetchPriceStats, fetchPriceStatsDetails } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem, PriceStatsSearchParams, PriceStatsResult, PriceItemDetail } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import { OMData } from '@/lib/omUtils';
import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PriceItemDetailsList from './PriceItemDetailsList';

// 1. Esquema de Validação
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código CATMAT/CATSER é obrigatório." })
        .regex(/^\d{9}$/, { message: "O Código deve ter 9 dígitos." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
}).refine(data => {
    if (data.dataInicio && data.dataFim) {
        return new Date(data.dataFim) >= new Date(data.dataInicio);
    }
    return true;
}, {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type PriceSearchFormValues = z.infer<typeof formSchema>;

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
}

// Calcula as datas padrão
const today = new Date();
const oneYearAgo = subDays(today, 365);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [searchParams, setSearchParams] = useState<PriceStatsSearchParams | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false); // NOVO: Estado para o Collapsible
    
    // Query para buscar estatísticas de preço
    const { data: searchResult, isLoading: isSearchingStats, error: searchError } = useQuery({
        queryKey: ['priceStats', searchParams],
        queryFn: () => fetchPriceStats(searchParams!),
        enabled: !!searchParams,
        staleTime: 1000 * 60 * 5,
    });
    
    // NOVO: Query para buscar detalhes dos itens (disparada apenas quando o Collapsible está aberto)
    const { data: detailedItems, isLoading: isLoadingDetails, error: detailsError } = useQuery<PriceItemDetail[]>({
        queryKey: ['priceStatsDetails', searchParams],
        queryFn: () => fetchPriceStatsDetails(searchParams!),
        enabled: isDetailsOpen && !!searchParams, // Habilita apenas se o Collapsible estiver aberto
        staleTime: 1000 * 60 * 5,
    });

    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });
    
    const handleItemCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setIsDetailsOpen(false); // Fecha os detalhes ao iniciar nova busca
        
        const params: PriceStatsSearchParams = {
            codigoItem: values.codigoItem,
            dataInicio: values.dataInicio || null,
            dataFim: values.dataFim || null,
        };
        
        setSearchParams(params);
        
        // A busca real é feita pelo useQuery, mas usamos o estado local para controlar o loading do formulário
        // até que o useQuery comece a carregar.
        
        // Se o useQuery estiver habilitado, ele fará a busca.
        // Usamos um pequeno timeout para garantir que o estado de loading do useQuery seja capturado.
        setTimeout(() => setIsSearching(false), 100); 
    };
    
    // Efeito para lidar com erros de busca de estatísticas
    useEffect(() => {
        if (searchError) {
            toast.error(searchError.message || "Erro desconhecido na busca de estatísticas de preço.");
            setSearchParams(null);
        }
    }, [searchError]);
    
    // Efeito para lidar com erros de busca de detalhes
    useEffect(() => {
        if (detailsError) {
            toast.error(detailsError.message || "Erro ao carregar detalhes dos itens.");
        }
    }, [detailsError]);

    const handleSelectPrice = (price: number, description: string) => {
        if (!searchResult) return;
        
        const item: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: description,
            descricao_reduzida: searchResult.descricaoItem || description.substring(0, 50),
            valor_unitario: price,
            numero_pregao: 'REF. PREÇO', // Marcador para referência de preço
            uasg: '000000', // UASG genérica para referência de preço
            codigo_catmat: searchResult.codigoItem,
        };
        
        onPriceSelect(item);
    };

    return (
        <div className="p-4 space-y-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel>Cód. CATMAT/CATSER *</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            onChange={handleItemCodeChange}
                                            value={field.value}
                                            placeholder="Ex: 123456789"
                                            maxLength={9}
                                            disabled={isSearchingStats || isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        9 dígitos. Deixe as datas vazias para buscar o histórico completo.
                                    </p>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
                                    <FormLabel>Data de Início</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearchingStats || isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataFim"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
                                    <FormLabel>Data de Fim</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearchingStats || isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <Button type="submit" disabled={isSearchingStats || isSearching} className="w-full">
                        {(isSearchingStats || isSearching) ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Buscando Estatísticas...
                            </>
                        ) : (
                            <>
                                <Search className="h-4 w-4 mr-2" />
                                Buscar Preço Médio
                            </>
                        )}
                    </Button>
                </form>
            </Form>
            
            {/* Seção de Resultados de Estatísticas */}
            {(isSearchingStats || isSearching) && searchParams && (
                <div className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    <p className="text-sm text-muted-foreground mt-2">Buscando estatísticas de preço...</p>
                </div>
            )}

            {searchResult && searchResult.stats && (
                <Card className="p-4 space-y-4">
                    <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                        <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-md transition-colors">
                                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                    Estatísticas de Preço ({searchResult.totalRegistros} Registros)
                                </CardTitle>
                                {isDetailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                            {/* NOVO COMPONENTE: Lista de Itens Detalhados */}
                            <PriceItemDetailsList 
                                items={detailedItems || []}
                                isLoading={isLoadingDetails}
                                isError={!!detailsError}
                            />
                        </CollapsibleContent>
                    </Collapsible>
                    
                    <CardContent className="p-0 pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-t">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Preço Mínimo</p>
                            <p className="text-xl font-bold text-green-600">
                                {formatCurrency(searchResult.stats.minPrice)}
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSelectPrice(searchResult.stats!.minPrice, searchResult.descricaoItem || `Item CATMAT ${searchResult.codigoItem} (Preço Mínimo)`)}
                                className="w-full mt-2"
                            >
                                <Import className="h-4 w-4 mr-1" />
                                Usar Mínimo
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Preço Médio</p>
                            <p className="text-xl font-bold text-primary">
                                {formatCurrency(searchResult.stats.avgPrice)}
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSelectPrice(searchResult.stats!.avgPrice, searchResult.descricaoItem || `Item CATMAT ${searchResult.codigoItem} (Preço Médio)`)}
                                className="w-full mt-2"
                            >
                                <Import className="h-4 w-4 mr-1" />
                                Usar Médio
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Preço Mediana</p>
                            <p className="text-xl font-bold text-blue-600">
                                {formatCurrency(searchResult.stats.medianPrice)}
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSelectPrice(searchResult.stats!.medianPrice, searchResult.descricaoItem || `Item CATMAT ${searchResult.codigoItem} (Preço Mediana)`)}
                                className="w-full mt-2"
                            >
                                <Import className="h-4 w-4 mr-1" />
                                Usar Mediana
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">Preço Máximo</p>
                            <p className="text-xl font-bold text-red-600">
                                {formatCurrency(searchResult.stats.maxPrice)}
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleSelectPrice(searchResult.stats!.maxPrice, searchResult.descricaoItem || `Item CATMAT ${searchResult.codigoItem} (Preço Máximo)`)}
                                className="w-full mt-2"
                            >
                                <Import className="h-4 w-4 mr-1" />
                                Usar Máximo
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {searchResult && !searchResult.stats && (
                <Card className="p-4 text-center text-muted-foreground">
                    Nenhuma estatística de preço encontrada para o item {searchResult.codigoItem} no período.
                </Card>
            )}

            <OmSelectorDialog
                open={false} // Mantido como false, pois este componente não usa o seletor de OM
                onOpenChange={() => {}}
                onSelect={() => {}}
            />
        </div>
    );
};

export default PriceSearchForm;