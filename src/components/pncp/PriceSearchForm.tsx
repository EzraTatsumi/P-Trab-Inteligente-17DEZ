import React, { useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, DollarSign, AlertTriangle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatCurrency, getPreviousWeekRange } from '@/lib/formatUtils';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStats, DetailedArpItem } from '@/types/pncp';
import { useQuery } from '@tanstack/react-query';
import OmSelectorDialog from '@/components/OmSelectorDialog';
import DetailedPriceItemsTable from './DetailedPriceItemsTable'; // NOVO IMPORT

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

// Datas padrão: Última semana completa
const { start: defaultDataInicio, end: defaultDataFim } = getPreviousWeekRange();

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false);
    
    // Estado para armazenar o resultado completo da busca
    const [priceStatsResult, setPriceStatsResult] = useState<PriceStatsResult | null>(null);
    
    // Estado para controlar a expansão da tabela de detalhes
    const [showDetails, setShowDetails] = useState(false);

    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio.split('T')[0], // Apenas a data
            dataFim: defaultDataFim.split('T')[0], // Apenas a data
        },
    });
    
    const handleCatmatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setPriceStatsResult(null);
        setShowDetails(false);
        
        try {
            toast.info(`Buscando estatísticas de preço para CATMAT ${values.codigoItem}...`);
            
            const params = {
                codigoItem: values.codigoItem,
                dataInicio: values.dataInicio || null,
                dataFim: values.dataFim || null,
            };
            
            const result = await fetchPriceStats(params);
            
            if (result.totalRegistros === 0) {
                toast.warning("Nenhum registro de preço encontrado para os critérios informados.");
            } else {
                toast.success(`${result.totalRegistros} registros encontrados!`);
            }
            
            setPriceStatsResult(result);
            
        } catch (error: any) {
            console.error("Erro na busca de preço médio:", error);
            toast.error(error.message || "Falha ao buscar estatísticas de preço.");
        } finally {
            setIsSearching(false);
        }
    };
    
    // Função de importação chamada pelo DetailedPriceItemsTable
    const handleImportItem = (item: ItemAquisicao) => {
        // 1. Chama a função de seleção do componente pai (ItemAquisicaoPNCPDialog)
        onPriceSelect(item);
        
        // 2. Limpa o estado local para resetar a visualização
        setPriceStatsResult(null);
        setShowDetails(false);
    };

    const currentStats = priceStatsResult?.stats;
    const totalRegistros = priceStatsResult?.totalRegistros || 0;
    const detailedItems = priceStatsResult?.detailedItems || [];

    return (
        <div className="space-y-6 p-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-4 gap-4">
                        
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-4 md:col-span-2">
                                    <FormLabel>Código CATMAT/CATSER *</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            onChange={handleCatmatChange}
                                            value={field.value}
                                            placeholder="Ex: 123456789"
                                            maxLength={9}
                                            disabled={isSearching}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código de 9 dígitos do item.
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
                                <FormItem className="col-span-2 md:col-span-1">
                                    <FormLabel>Data de Fim</FormLabel>
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
                                <DollarSign className="h-4 w-4 mr-2" />
                                Consultar Preço Médio PNCP
                            </>
                        )}
                    </Button>
                </form>
            </Form>
            
            {/* Seção de Resultados */}
            {priceStatsResult && totalRegistros > 0 && (
                <div className="space-y-4">
                    <Card className="p-4">
                        <CardTitle className="text-lg font-semibold mb-2">
                            {priceStatsResult.descricaoItem || `CATMAT ${priceStatsResult.codigoItem}`}
                        </CardTitle>
                        
                        <div className="grid grid-cols-4 gap-4 text-center border-b pb-3 mb-3">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Preço Médio</p>
                                <p className="text-lg font-bold text-blue-600">{formatCurrency(currentStats?.avgPrice)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Mediana</p>
                                <p className="text-lg font-bold text-blue-600">{formatCurrency(currentStats?.medianPrice)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Mínimo</p>
                                <p className="text-lg font-bold text-green-600">{formatCurrency(currentStats?.minPrice)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Máximo</p>
                                <p className="text-lg font-bold text-red-600">{formatCurrency(currentStats?.maxPrice)}</p>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">
                                {totalRegistros} registros de preço encontrados.
                            </p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => setShowDetails(!showDetails)}
                            >
                                {showDetails ? "Ocultar Detalhes" : "Ver Detalhes e Excluir Outliers"}
                            </Button>
                        </div>
                    </Card>
                    
                    {/* Tabela de Detalhes (Novo Componente) */}
                    {showDetails && detailedItems.length > 0 && currentStats && (
                        <DetailedPriceItemsTable
                            initialItems={detailedItems}
                            initialStats={currentStats}
                            onImport={handleImportItem}
                        />
                    )}
                </div>
            )}
            
            {priceStatsResult && totalRegistros === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                    Nenhum registro de preço encontrado.
                </div>
            )}
        </div>
    );
};

export default PriceSearchForm;