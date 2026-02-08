import React, { useState, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, DollarSign, Check, X, AlertTriangle, Import } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { fetchPriceStats, fetchPriceStatsDetails } from '@/integrations/supabase/api';
import { PriceStatsSearchParams, PriceStatsResult, PriceItemDetail, PriceStats } from '@/types/pncp';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import PriceStatsCard from './PriceStatsCard';
import PriceItemDetailsList from './PriceItemDetailsList';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// 1. Esquema de Validação
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código CATMAT/CATSER é obrigatório." })
        .regex(/^\d{9}$/, { message: "O Código deve ter 9 dígitos." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
});

type PriceSearchFormValues = z.infer<typeof formSchema>;

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
}

// Calcula as datas padrão (últimos 12 meses)
const today = new Date();
const oneYearAgo = subDays(today, 365);

const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [searchParams, setSearchParams] = useState<PriceStatsSearchParams | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    
    // NOVO ESTADO: Armazena a lista detalhada de preços
    const [priceDetails, setPriceDetails] = useState<PriceItemDetail[]>([]);
    
    // NOVO ESTADO: Armazena o item selecionado para importação
    const [selectedItem, setSelectedItem] = useState<PriceItemDetail | null>(null);

    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });

    // --- Lógica de Busca de Estatísticas (useQuery) ---
    // Esta query é usada apenas para obter o nome do item e o total de registros
    const { data: statsResult, isLoading: isLoadingStats, error: statsError } = useQuery({
        queryKey: ['priceStats', searchParams],
        queryFn: () => fetchPriceStats(searchParams!),
        enabled: !!searchParams,
        initialData: { codigoItem: '', descricaoItem: null, stats: null, totalRegistros: 0 } as PriceStatsResult,
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
    
    // --- Lógica de Busca de Detalhes (useQuery) ---
    // Esta query é usada para buscar a lista completa de detalhes
    const { data: rawDetails, isLoading: isLoadingDetails, error: detailsError, refetch: refetchDetails } = useQuery({
        queryKey: ['priceDetails', searchParams],
        queryFn: () => fetchPriceStatsDetails(searchParams!),
        enabled: false, // Desabilitado por padrão, só é ativado manualmente
        initialData: [],
        staleTime: 1000 * 60 * 5, // 5 minutos de cache
    });
    
    // Efeito para sincronizar rawDetails com priceDetails (estado local)
    React.useEffect(() => {
        if (rawDetails && rawDetails.length > 0) {
            setPriceDetails(rawDetails);
        } else if (searchParams) {
            // Se a busca retornar vazia, limpa o estado
            setPriceDetails([]);
        }
    }, [rawDetails, searchParams]);


    // --- CÁLCULO DE ESTATÍSTICAS DERIVADAS (useMemo) ---
    const calculatedStats: PriceStats | null = useMemo(() => {
        if (priceDetails.length === 0) return null;

        const valores = priceDetails.map(i => i.valorUnitario).sort((a, b) => a - b);

        const avgPrice = valores.reduce((a, b) => a + b, 0) / valores.length;

        const mid = Math.floor(valores.length / 2);
        const medianPrice = valores.length % 2 === 0
            ? (valores[mid - 1] + valores[mid]) / 2
            : valores[mid];

        return {
            avgPrice,
            medianPrice,
            minPrice: valores[0],
            maxPrice: valores[valores.length - 1]
        };
    }, [priceDetails]);
    
    // --- Handlers ---

    const handleItemCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setSelectedItem(null);
        setPriceDetails([]);
        setIsDetailsOpen(false);
        
        const params: PriceStatsSearchParams = {
            codigoItem: values.codigoItem,
            dataInicio: values.dataInicio || null,
            dataFim: values.dataFim || null,
        };
        
        setSearchParams(params);
        
        // A busca de estatísticas é disparada automaticamente pelo useQuery.
        // A busca de detalhes será disparada manualmente se o usuário expandir.
    };
    
    const handleToggleDetails = async (open: boolean) => {
        setIsDetailsOpen(open);
        
        if (open && priceDetails.length === 0 && searchParams) {
            // Se for abrir e os detalhes ainda não foram carregados, força o fetch
            const { data } = await refetchDetails();
            if (data && data.length > 0) {
                setPriceDetails(data);
            } else {
                toast.warning("Nenhum registro detalhado encontrado para este item.");
            }
        }
    };
    
    const handleItemSelect = (item: PriceItemDetail) => {
        // Se o item já estiver selecionado, deseleciona
        if (selectedItem?.id === item.id) {
            setSelectedItem(null);
        } else {
            // Seleciona o novo item
            setSelectedItem(item);
        }
    };
    
    const handleImport = () => {
        if (!selectedItem) {
            toast.error("Selecione um item de preço médio para importar.");
            return;
        }
        
        // Mapeia o item selecionado para o formato ItemAquisicao
        const itemToImport: ItemAquisicao = {
            // ID temporário para o formulário
            id: Math.random().toString(36).substring(2, 9), 
            descricao_item: selectedItem.descricaoItem,
            // Usa o preço médio como descrição reduzida inicial
            descricao_reduzida: `Ref. Preço Médio: ${formatCurrency(calculatedStats?.avgPrice || selectedItem.valorUnitario)}`, 
            valor_unitario: selectedItem.valorUnitario,
            // Campos de contrato são preenchidos com referências para indicar a origem
            numero_pregao: `REF. PREÇO`, 
            uasg: selectedItem.codigoUasg,
            codigo_catmat: selectedItem.codigoItem, 
        };
        
        // Chama a função de seleção no componente pai (ItemAquisicaoPNCPDialog)
        onPriceSelect(itemToImport);
        
        // O ItemAquisicaoPNCPDialog irá iniciar o fluxo de inspeção/revisão
    };

    // --- Renderização de Erros e Loading ---
    
    if (statsError || detailsError) {
        const error = statsError || detailsError;
        toast.error(error?.message || "Erro desconhecido na busca de preços.");
        setSearchParams(null); // Limpa os parâmetros para permitir nova busca
    }
    
    const isSearching = isLoadingStats || isLoadingDetails;
    const totalRegistros = statsResult?.totalRegistros || 0;
    const itemDescription = statsResult?.descricaoItem || 'Descrição não disponível';

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg">
                    <div className="grid grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-3 md:col-span-1">
                                    <FormLabel>Cód. CATMAT/CATSER *</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            onChange={handleItemCodeChange}
                                            value={field.value}
                                            placeholder="Ex: 123456789"
                                            maxLength={9}
                                            disabled={isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-3 md:col-span-1">
                                    <FormLabel>Data de Início (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearching}
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
                                <FormItem className="col-span-3 md:col-span-1">
                                    <FormLabel>Data de Fim (Opcional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="date"
                                            {...field}
                                            disabled={isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Buscando Preços...
                            </>
                        ) : (
                            <>
                                <Search className="h-4 w-4 mr-2" />
                                Buscar Preços Médios
                            </>
                        )}
                    </Button>
                </form>
            </Form>
            
            {/* Seção de Resultados */}
            {searchParams && (
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm font-medium">
                                Item Buscado: <span className="font-bold">{searchParams.codigoItem}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Descrição PNCP: {itemDescription}
                            </p>
                        </CardContent>
                    </Card>
                    
                    {/* Card de Estatísticas */}
                    <PriceStatsCard 
                        stats={calculatedStats} 
                        totalRegistros={totalRegistros} 
                        isLoading={isLoadingStats}
                    />
                    
                    {/* Lista Detalhada (Colapsável) */}
                    <Collapsible 
                        open={isDetailsOpen} 
                        onOpenChange={handleToggleDetails}
                        disabled={isSearching || totalRegistros === 0}
                    >
                        <CollapsibleTrigger asChild>
                            <Button 
                                variant="outline" 
                                className={cn("w-full justify-between", isSearching || totalRegistros === 0 ? "opacity-50 cursor-not-allowed" : "")}
                                disabled={isSearching || totalRegistros === 0}
                            >
                                <span>
                                    {isDetailsOpen ? "Ocultar" : "Visualizar"} {totalRegistros} Registros Detalhados
                                </span>
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isDetailsOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4">
                            {isLoadingDetails ? (
                                <div className="text-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                                    <p className="text-sm text-muted-foreground mt-2">Carregando detalhes...</p>
                                </div>
                            ) : (
                                <PriceItemDetailsList 
                                    items={priceDetails} 
                                    onItemSelect={handleItemSelect}
                                    selectedItemIds={selectedItem ? [selectedItem.id] : []}
                                />
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                    
                    {/* Botão de Importação do Item Selecionado */}
                    <div className="flex justify-end pt-2">
                        <Button 
                            onClick={handleImport}
                            disabled={!selectedItem || isSearching}
                        >
                            <Import className="h-4 w-4 mr-2" />
                            Importar Item Selecionado
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceSearchForm;