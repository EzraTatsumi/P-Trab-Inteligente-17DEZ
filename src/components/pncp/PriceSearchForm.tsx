import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Search, Loader2, BookOpen, ChevronDown, ChevronUp, Import, DollarSign } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatCurrency, formatNumber, capitalizeFirstLetter } from '@/lib/formatUtils';
import { format, subDays } from 'date-fns';
import { fetchPriceStats, fetchPriceStatsDetails } from '@/integrations/supabase/api';
import { PriceStatsSearchParams, PriceStatsResult, PriceItemDetail, PriceStats } from '@/types/pncp';
import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PriceItemDetailsList from './PriceItemDetailsList';
import CatmatCatalogDialog from '../CatmatCatalogDialog'; // RESTAURADO

// 1. Esquema de Validação (RESTAURADO)
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código CATMAT/CATSER é obrigatório." })
        .regex(/^\d{1,9}$/, { message: "O código deve conter apenas números (máx. 9 dígitos)." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    ignoreDates: z.boolean().default(false),
}).refine(data => {
    // Se não ignorar datas, ambas devem ser preenchidas e a dataFim deve ser >= dataInicio
    if (!data.ignoreDates) {
        if (!data.dataInicio || !data.dataFim) return false;
        
        const startDate = new Date(data.dataInicio);
        const endDate = new Date(data.dataFim);
        
        // Verifica se a Data de Fim é posterior ou igual à Data de Início
        if (endDate < startDate) return false;
        
        // Verifica se o intervalo é maior que 365 dias (86400000 ms * 365)
        const maxDurationMs = 86400000 * 365;
        const durationMs = endDate.getTime() - startDate.getTime();
        
        // Se a duração for estritamente maior que 365 dias, falha.
        if (durationMs > maxDurationMs) {
             return false;
        }
    }
    return true;
}, {
    message: "O período de busca não pode exceder 365 dias.",
    path: ["dataFim"],
});

type PriceSearchFormValues = z.infer<typeof formSchema>;

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
}

// Calcula as datas padrão
const today = new Date();
// Ajuste: Usar 364 dias para garantir que o intervalo seja aceito pela API (365 dias é o limite)
const oneYearAgo = subDays(today, 364); 

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [searchParams, setSearchParams] = useState<PriceStatsSearchParams | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false); // RESTAURADO
    const [isDetailsOpen, setIsDetailsOpen] = useState(false); 
    
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
            ignoreDates: false, // RESTAURADO
        },
    });
    
    const ignoreDates = form.watch('ignoreDates'); // RESTAURADO
    
    const handleItemCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };
    
    // RESTAURADO: Função para selecionar item do catálogo CATMAT
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        form.setValue('codigoItem', catmatItem.code, { shouldValidate: true });
        setIsCatmatCatalogOpen(false);
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setIsDetailsOpen(false); // Fecha os detalhes ao iniciar nova busca
        
        const catmatCode = values.codigoItem;
        
        const params: PriceStatsSearchParams = {
            codigoItem: catmatCode,
            // RESTAURADO: Lógica de ignorar datas
            dataInicio: values.ignoreDates ? null : values.dataInicio || null,
            dataFim: values.ignoreDates ? null : values.dataFim || null,
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
    
    // RESTAURADO: Função para renderizar os botões de preço
    const renderPriceButtons = (stats: PriceStats) => {
        const buttonClass = "flex flex-col items-center justify-center h-24 w-full text-center transition-all";
        const priceStyle = "text-xl font-bold mt-1";
        
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Preço Médio */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handleSelectPrice(stats.avgPrice, searchResult!.descricaoItem || `Item CATMAT ${searchResult!.codigoItem} (Preço Médio)`)}
                >
                    <span className="text-sm text-muted-foreground">Preço Médio</span>
                    <span className={priceStyle}>{formatCurrency(stats.avgPrice)}</span>
                </Button>
                
                {/* Mediana */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handleSelectPrice(stats.medianPrice, searchResult!.descricaoItem || `Item CATMAT ${searchResult!.codigoItem} (Preço Mediana)`)}
                >
                    <span className="text-sm text-muted-foreground">Mediana</span>
                    <span className={priceStyle}>{formatCurrency(stats.medianPrice)}</span>
                </Button>
                
                {/* Preço Mínimo */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handleSelectPrice(stats.minPrice, searchResult!.descricaoItem || `Item CATMAT ${searchResult!.codigoItem} (Preço Mínimo)`)}
                >
                    <span className="text-sm text-muted-foreground">Preço Mínimo</span>
                    <span className={priceStyle}>{formatCurrency(stats.minPrice)}</span>
                </Button>
                
                {/* Preço Máximo */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handleSelectPrice(stats.maxPrice, searchResult!.descricaoItem || `Item CATMAT ${searchResult!.codigoItem} (Preço Máximo)`)}
                >
                    <span className="text-sm text-muted-foreground">Preço Máximo</span>
                    <span className={priceStyle}>{formatCurrency(stats.maxPrice)}</span>
                </Button>
            </div>
        );
    };


    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-4 md:col-span-2">
                                    <FormLabel>Cód. CATMAT/CATSER *</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={handleItemCodeChange}
                                                value={field.value}
                                                placeholder="Ex: 604269"
                                                maxLength={9}
                                                disabled={isSearchingStats || isSearching}
                                            />
                                        </FormControl>
                                        {/* RESTAURADO: Botão Catálogo CATMAT */}
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => setIsCatmatCatalogOpen(true)}
                                            disabled={isSearchingStats || isSearching}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código do item de material ou serviço (máx. 9 dígitos).
                                    </p>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-2 md:col-span-1">
                                    <FormLabel>Data de Início</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearchingStats || isSearching || ignoreDates}
                                            value={ignoreDates ? '' : field.value}
                                            onChange={field.onChange}
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
                                <FormItem className="col-span-2 md:col-span-1">
                                    <FormLabel>Data de Fim</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearchingStats || isSearching || ignoreDates}
                                            value={ignoreDates ? '' : field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        {/* RESTAURADO: Checkbox para ignorar datas */}
                        <FormField
                            control={form.control}
                            name="ignoreDates"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isSearchingStats || isSearching}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            Pesquisar sem restrição de data
                                        </FormLabel>
                                        <FormDescription>
                                            Busca todos os registros de preço disponíveis para o item, ignorando o período acima.
                                        </FormDescription>
                                    </div>
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
                                Buscar Estatísticas de Preço
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
                    {/* INTEGRAÇÃO DA NOVA FUNCIONALIDADE DE EXPANSÃO */}
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
                        <div className="space-y-1 col-span-4">
                            <p className="text-sm text-muted-foreground">
                                Item: <span className="font-medium text-foreground">{capitalizeFirstLetter(searchResult.descricaoItem || 'N/A')}</span>
                            </p>
                        </div>
                        
                        {/* Botões de Seleção de Preço (RESTAURADOS) */}
                        {renderPriceButtons(searchResult.stats)}
                        
                        <p className="text-xs text-muted-foreground mt-4 col-span-4">
                            Selecione um dos valores acima para usá-lo como preço unitário de referência.
                        </p>
                    </CardContent>
                </Card>
            )}
            
            {searchResult && !searchResult.stats && (
                <Card className="p-4 text-center text-muted-foreground">
                    Nenhum registro de preço encontrado para o item {searchResult.codigoItem} no período.
                </Card>
            )}

            {/* Diálogo de Catálogo CATMAT (RESTAURADO) */}
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
        </>
    );
};

export default PriceSearchForm;