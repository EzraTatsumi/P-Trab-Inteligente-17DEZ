import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Search, Loader2, BookOpen, DollarSign } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchPriceStats, fetchCatmatFullDescription } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStats } from '@/types/pncp';
import { capitalizeFirstLetter, formatCurrency } from '@/lib/formatUtils';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';

// 1. Esquema de Validação
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
        // Adicionamos uma pequena margem de segurança (1ms) para evitar problemas de fuso horário.
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
    // Função de callback para enviar o item selecionado para inspeção
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
    const [isSearching, setIsSearching] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [searchResult, setSearchResult] = useState<PriceStatsResult | null>(null);
    
    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
            ignoreDates: false,
        },
    });
    
    const ignoreDates = form.watch('ignoreDates');
    
    const handleCatmatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };
    
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        form.setValue('codigoItem', catmatItem.code, { shouldValidate: true });
        setIsCatmatCatalogOpen(false);
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setSearchResult(null);
        
        const catmatCode = values.codigoItem;
        
        try {
            toast.info(`Buscando estatísticas de preço para CATMAT ${catmatCode}...`);
            
            const params = {
                codigoItem: catmatCode,
                dataInicio: values.ignoreDates ? null : values.dataInicio || null,
                dataFim: values.ignoreDates ? null : values.dataFim || null,
            };
            
            const result = await fetchPriceStats(params);
            
            if (!result.stats || result.totalRegistros === 0) {
                toast.warning(`Nenhum registro de preço encontrado para o CATMAT ${catmatCode} no período.`);
            } else {
                toast.success(`${result.totalRegistros} registros encontrados!`);
            }
            
            setSearchResult(result);

        } catch (error: any) {
            console.error("Erro na busca de preço médio:", error);
            toast.error(error.message || "Falha ao buscar estatísticas de preço.");
        } finally {
            setIsSearching(false);
        }
    };
    
    /**
     * Cria o ItemAquisicao temporário e o envia para o fluxo de inspeção.
     */
    const handlePriceSelection = (price: number, priceType: string) => {
        if (!searchResult || !searchResult.descricaoItem) {
            toast.error("Erro: Dados do item não carregados.");
            return;
        }
        
        // 1. Cria o ItemAquisicao
        const item: ItemAquisicao = {
            // ID temporário, será substituído na inspeção
            id: Math.random().toString(36).substring(2, 9), 
            
            // Dados preenchidos pela busca
            codigo_catmat: searchResult.codigoItem,
            descricao_item: searchResult.descricaoItem,
            
            // Descrição reduzida inicial (primeiras 50 letras)
            descricao_reduzida: searchResult.descricaoItem.substring(0, 50) + (searchResult.descricaoItem.length > 50 ? '...' : ''),
            
            // Valor selecionado
            valor_unitario: price,
            
            // Campos padrão para itens de preço médio (requerem preenchimento manual posterior)
            numero_pregao: 'Em processo de abertura', 
            uasg: '', // Vazio, pois não há UASG de referência
        };
        
        // 2. Envia para o fluxo de inspeção
        onPriceSelect(item);
        
        toast.info(`Preço (${priceType}) selecionado. Prossiga para a inspeção.`);
    };

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
                    onClick={() => handlePriceSelection(stats.avgPrice, 'Médio')}
                >
                    <span className="text-sm text-muted-foreground">Preço Médio</span>
                    <span className={priceStyle}>{formatCurrency(stats.avgPrice)}</span>
                </Button>
                
                {/* Mediana */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handlePriceSelection(stats.medianPrice, 'Mediana')}
                >
                    <span className="text-sm text-muted-foreground">Mediana</span>
                    <span className={priceStyle}>{formatCurrency(stats.medianPrice)}</span>
                </Button>
                
                {/* Preço Mínimo */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handlePriceSelection(stats.minPrice, 'Mínimo')}
                >
                    <span className="text-sm text-muted-foreground">Preço Mínimo</span>
                    <span className={priceStyle}>{formatCurrency(stats.minPrice)}</span>
                </Button>
                
                {/* Preço Máximo */}
                <Button 
                    type="button" 
                    variant="outline" 
                    className={buttonClass}
                    onClick={() => handlePriceSelection(stats.maxPrice, 'Máximo')}
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
                    <div className="grid grid-cols-4 gap-4">
                        
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
                                                onChange={handleCatmatChange}
                                                value={field.value}
                                                placeholder="Ex: 604269"
                                                maxLength={9}
                                                disabled={isSearching}
                                            />
                                        </FormControl>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => setIsCatmatCatalogOpen(true)}
                                            disabled={isSearching}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código do item de material ou serviço.
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
                                            disabled={isSearching || ignoreDates}
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
                                            disabled={isSearching || ignoreDates}
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
                            name="ignoreDates"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isSearching}
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
                    
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Buscando Preços...
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
            
            {/* Seção de Resultados */}
            {searchResult && (
                <div className="p-4 space-y-4">
                    <Card className="p-4">
                        <CardTitle className="text-lg font-semibold mb-3">
                            Estatísticas de Preço ({searchResult.totalRegistros} Registros)
                        </CardTitle>
                        
                        {searchResult.stats ? (
                            <>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Item: <span className="font-medium text-foreground">{capitalizeFirstLetter(searchResult.descricaoItem || 'N/A')}</span>
                                </p>
                                {renderPriceButtons(searchResult.stats)}
                                <p className="text-xs text-muted-foreground mt-4">
                                    Selecione um dos valores acima para usá-lo como preço unitário de referência.
                                </p>
                            </>
                        ) : (
                            <p className="text-center text-muted-foreground">
                                Nenhum registro de preço encontrado para o CATMAT {searchResult.codigoItem}.
                            </p>
                        )}
                    </Card>
                </div>
            )}

            {/* Diálogo de Catálogo CATMAT */}
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
        </>
    );
};

export default PriceSearchForm;