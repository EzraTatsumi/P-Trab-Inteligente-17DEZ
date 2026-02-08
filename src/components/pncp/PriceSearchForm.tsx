import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, DollarSign, ChevronDown, ChevronUp, RefreshCw, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatCurrency, formatNumber } from '@/lib/formatUtils';
import { format, subDays, addYears } from 'date-fns';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceRawRecord, PriceStats } from '@/types/pncp';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PriceRecordList from './PriceRecordList';
import { Switch } from '@/components/ui/switch';
import CatmatCatalogDialog from '../CatmatCatalogDialog'; // Importar o diálogo CATMAT

// 1. Esquema de Validação (Removida a obrigatoriedade de 9 dígitos)
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O código CATMAT/CATSER é obrigatório." })
        .regex(/^\d+$/, { message: "O código deve conter apenas números." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    // NOVO CAMPO: Pesquisa irrestrita
    unrestrictedSearch: z.boolean().default(false),
}).refine(data => {
    // Validação de datas só se a pesquisa não for irrestrita
    if (!data.unrestrictedSearch && data.dataInicio && data.dataFim) {
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

// Calcula as datas padrão (1 ano a partir de hoje)
const today = new Date();
const oneYearFromNow = addYears(today, 1);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(oneYearFromNow, 'yyyy-MM-dd');
const defaultDataInicio = format(today, 'yyyy-MM-dd');

// Função auxiliar para calcular estatísticas (Mínimo, Máximo, Médio, Mediana)
const calculateStats = (records: PriceRawRecord[]): PriceStats => {
    if (records.length === 0) {
        return { minPrice: 0, maxPrice: 0, avgPrice: 0, medianPrice: 0 };
    }

    const values = records.map(r => r.valorUnitario).sort((a, b) => a - b);
    const count = values.length;
    
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avgPrice = sum / count;

    let medianPrice;
    if (count % 2 === 0) {
        const mid1 = values[count / 2 - 1];
        const mid2 = values[count / 2];
        medianPrice = (mid1 + mid2) / 2;
    } else {
        medianPrice = values[Math.floor(count / 2)];
    }

    return {
        minPrice: values[0],
        maxPrice: values[count - 1],
        avgPrice: avgPrice,
        medianPrice: medianPrice,
    };
};


const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<PriceStatsResult | null>(null);
    const [isListOpen, setIsListOpen] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    
    // NOVO ESTADO: IDs dos registros excluídos
    const [excludedRecordIds, setExcludedRecordIds] = useState<string[]>([]);
    
    // NOVO ESTADO: Flag para indicar se o recálculo foi acionado
    const [recalculationNeeded, setRecalculationNeeded] = useState(false);

    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
            unrestrictedSearch: false, // Padrão: pesquisa restrita
        },
    });
    
    const unrestrictedSearch = form.watch('unrestrictedSearch');
    
    // --- Lógica de Recálculo no Cliente (useMemo) ---
    const { recalculatedStats, activeRecords, totalActiveRecords } = useMemo(() => {
        if (!searchResult || !searchResult.records) {
            return { 
                recalculatedStats: null, 
                activeRecords: [], 
                totalActiveRecords: 0 
            };
        }
        
        // 1. Filtra os registros excluídos
        const filteredRecords = searchResult.records.filter(
            record => !excludedRecordIds.includes(record.id)
        );
        
        // 2. Recalcula as estatísticas
        const stats = calculateStats(filteredRecords);
        
        // 3. Reseta a flag de recálculo se a lista de exclusão estiver vazia
        if (excludedRecordIds.length === 0) {
            setRecalculationNeeded(false);
        }

        return {
            recalculatedStats: stats,
            activeRecords: filteredRecords,
            totalActiveRecords: filteredRecords.length,
        };
    }, [searchResult, excludedRecordIds]);
    
    // --- Handlers de Estado ---
    
    const handleToggleExclusion = useCallback((id: string) => {
        setExcludedRecordIds(prev => {
            const isExcluded = prev.includes(id);
            let newExcludedIds;
            
            if (isExcluded) {
                // Remove da lista
                newExcludedIds = prev.filter(excludedId => excludedId !== id);
            } else {
                // Adiciona à lista
                newExcludedIds = [...prev, id];
            }
            
            // Marca que o recálculo é necessário se a lista não estiver vazia
            setRecalculationNeeded(newExcludedIds.length > 0);
            return newExcludedIds;
        });
    }, []);
    
    const handleApplyRecalculation = () => {
        // Ao aplicar, o useMemo já fez o trabalho. Apenas remove a flag de necessidade de recálculo.
        setRecalculationNeeded(false);
        toast.success("Estatísticas recalculadas com sucesso!");
    };
    
    // Função para receber dados do catálogo CATMAT e atualizar o formulário de item
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        form.setValue('codigoItem', catmatItem.code, { shouldValidate: true });
        setIsCatmatCatalogOpen(false);
    };
    
    // --- Lógica de Busca ---

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setSearchResult(null);
        setExcludedRecordIds([]); // Limpa exclusões anteriores
        setRecalculationNeeded(false);
        setIsListOpen(false);
        
        try {
            toast.info(`Buscando estatísticas de preço para CATMAT ${values.codigoItem}...`);
            
            const params = {
                codigoItem: values.codigoItem,
                // Se a pesquisa for irrestrita, passa null para as datas
                dataInicio: unrestrictedSearch ? null : values.dataInicio || null,
                dataFim: unrestrictedSearch ? null : values.dataFim || null,
            };
            
            const result = await fetchPriceStats(params);
            
            if (result.totalRegistros === 0) {
                toast.warning("Nenhum registro de preço encontrado para os critérios informados.");
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
    
    // --- Lógica de Seleção de Preço ---
    
    const handleSelectPrice = (price: number, type: 'Mínimo' | 'Médio' | 'Mediana' | 'Máximo') => {
        if (!searchResult) return;
        
        // 1. Cria o ItemAquisicao de referência
        const item: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9),
            descricao_item: searchResult.descricaoItem || `Item CATMAT ${searchResult.codigoItem}`,
            descricao_reduzida: searchResult.descricaoItem?.substring(0, 50) || `Ref. Preço ${searchResult.codigoItem}`,
            valor_unitario: price,
            // Campos de contrato/UASG são placeholders para o fluxo de revisão
            numero_pregao: `REF. PREÇO (${type})`, 
            uasg: '000000', 
            codigo_catmat: searchResult.codigoItem,
        };
        
        // 2. Chama a função de seleção no componente pai (ItemAquisicaoPNCPDialog)
        onPriceSelect(item);
        
        // O ItemAquisicaoPNCPDialog irá fechar este formulário e iniciar o fluxo de inspeção/revisão.
    };

    // --- Renderização ---

    const stats = recalculatedStats;
    const totalRecords = searchResult?.totalRegistros || 0;
    
    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        
                        {/* Coluna 1: Código CATMAT/CATSER e Botão Catálogo */}
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <FormField
                                control={form.control}
                                name="codigoItem"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cód. CATMAT/CATSER *</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    onChange={(e) => {
                                                        const rawValue = e.target.value.replace(/\D/g, '');
                                                        form.setValue('codigoItem', rawValue, { shouldValidate: true });
                                                    }}
                                                    value={field.value}
                                                    placeholder="Ex: 604269"
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
                                        <p className="text-xs text-muted-foreground">
                                            Insira o código do item de material ou serviço.
                                        </p>
                                    </FormItem>
                                )}
                            />
                        </div>
                        
                        {/* Coluna 2: Data de Início */}
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
                                            disabled={isSearching || unrestrictedSearch}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        {/* Coluna 3: Data de Fim */}
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
                                            disabled={isSearching || unrestrictedSearch}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    {/* Opção de Pesquisa Irrestrita */}
                    <FormField
                        control={form.control}
                        name="unrestrictedSearch"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <FormLabel className="text-base flex items-center gap-2">
                                        Pesquisar sem restrição de data
                                    </FormLabel>
                                    <FormDescription>
                                        Busca todos os registros de preço disponíveis para o item, ignorando o período acima.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isSearching}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    
                    <Button type="submit" disabled={isSearching || !form.formState.isValid} className="w-full">
                        {isSearching ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Buscando Estatísticas de Preço...
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
            {searchResult && stats && (
                <Card className="p-4 space-y-4">
                    <Collapsible open={isListOpen} onOpenChange={setIsListOpen}>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold">
                                Estatísticas de Preço ({totalActiveRecords} Registros Ativos)
                            </CardTitle>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    {isListOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                        
                        <CardDescription className="text-sm">
                            {searchResult.descricaoItem || 'Descrição não disponível.'}
                        </CardDescription>

                        {/* Botões de Preço (Sempre visíveis) */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            {[
                                { label: 'Preço Médio', value: stats.avgPrice, type: 'Médio' as const },
                                { label: 'Mediana', value: stats.medianPrice, type: 'Mediana' as const },
                                { label: 'Mínimo', value: stats.minPrice, type: 'Mínimo' as const },
                                { label: 'Máximo', value: stats.maxPrice, type: 'Máximo' as const },
                            ].map(({ label, value, type }) => (
                                <Button
                                    key={label}
                                    variant="outline"
                                    className="h-auto py-3 flex flex-col items-start"
                                    onClick={() => handleSelectPrice(value, type)}
                                >
                                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                    <span className="text-base font-bold text-primary">
                                        {formatCurrency(value)}
                                    </span>
                                </Button>
                            ))}
                        </div>
                        
                        {/* Conteúdo Colapsável (Lista de Registros) */}
                        <CollapsibleContent className="mt-4 space-y-3">
                            <div className="flex justify-between items-center border-b pb-2">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Lista de Registros ({totalRecords} total, {excludedRecordIds.length} excluídos)
                                </p>
                                {recalculationNeeded && (
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        onClick={handleApplyRecalculation}
                                        className="bg-yellow-600 hover:bg-yellow-700"
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Aplicar Filtro
                                    </Button>
                                )}
                            </div>
                            
                            {searchResult.records.length > 0 ? (
                                <PriceRecordList 
                                    records={searchResult.records}
                                    excludedIds={excludedRecordIds}
                                    onToggleExclusion={handleToggleExclusion}
                                />
                            ) : (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                    Nenhum registro de preço detalhado disponível.
                                </div>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            )}
            
            {/* Diálogo do Catálogo CATMAT */}
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
        </div>
    );
};

export default PriceSearchForm;