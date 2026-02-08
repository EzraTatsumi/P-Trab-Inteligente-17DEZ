import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { format, subDays } from 'date-fns';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStatsSearchParams } from '@/types/pncp';
import DetailedPriceItemsTable from './DetailedPriceItemsTable'; // Importar o novo componente

// 1. Esquema de Validação
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código CATMAT/CATSER é obrigatório." })
        .regex(/^\d{1,9}$/, { message: "O código deve conter apenas números (máx. 9 dígitos)." }),
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

// Calcula as datas padrão (últimos 12 meses)
const today = new Date();
const oneYearAgo = subDays(today, 365);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [priceStatsResult, setPriceStatsResult] = useState<PriceStatsResult | null>(null);
    
    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setPriceStatsResult(null);
        
        try {
            toast.info(`Buscando estatísticas de preço para CATMAT ${values.codigoItem}...`);
            
            const params: PriceStatsSearchParams = {
                codigoItem: values.codigoItem,
                dataInicio: values.dataInicio || null,
                dataFim: values.dataFim || null,
            };
            
            const result = await fetchPriceStats(params);
            
            if (!result.stats || result.totalRegistros === 0) {
                toast.warning(`Nenhum registro de preço encontrado para o CATMAT ${values.codigoItem} no período.`);
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

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-4 gap-4">
                        
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel>Código CATMAT/CATSER *</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={(e) => {
                                                    // Permite apenas dígitos e limita a 9 caracteres
                                                    const rawValue = e.target.value.replace(/\D/g, '');
                                                    field.onChange(rawValue.slice(0, 9));
                                                }}
                                                value={field.value}
                                                placeholder="Ex: 123456789"
                                                maxLength={9}
                                                disabled={isSearching}
                                            />
                                        </FormControl>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código do item para buscar o preço médio.
                                    </p>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
                                    <FormLabel className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Data de Início
                                    </FormLabel>
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
                                <FormItem className="col-span-1">
                                    <FormLabel className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        Data de Fim
                                    </FormLabel>
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
                                Buscando Preços Médios...
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
            
            {/* Seção de Resultados Detalhados */}
            {priceStatsResult && priceStatsResult.stats && priceStatsResult.detailedItems.length > 0 && (
                <div className="p-4">
                    <DetailedPriceItemsTable 
                        initialItems={priceStatsResult.detailedItems}
                        initialStats={priceStatsResult.stats}
                        catmatCode={priceStatsResult.codigoItem}
                        catmatDescription={priceStatsResult.descricaoItem}
                        totalRegistros={priceStatsResult.totalRegistros}
                        onImport={onPriceSelect}
                    />
                </div>
            )}
            
            {priceStatsResult && priceStatsResult.totalRegistros === 0 && (
                <div className="p-4 text-center text-muted-foreground">
                    Nenhum registro de preço encontrado para o CATMAT {priceStatsResult.codigoItem} no período.
                </div>
            )}
        </>
    );
};

export default PriceSearchForm;