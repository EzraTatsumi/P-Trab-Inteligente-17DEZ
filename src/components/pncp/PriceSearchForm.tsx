import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Search, Loader2, BookOpen, DollarSign, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStats, RawPriceRecord } from '@/types/pncp';
import { capitalizeFirstLetter, formatCurrency, formatCodug } from '@/lib/formatUtils';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import CatserCatalogDialog from '../CatserCatalogDialog';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código do Item é obrigatório." })
        .regex(/^\d{1,9}$/, { message: "O código deve conter apenas números (máx. 9 dígitos)." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    ignoreDates: z.boolean().default(false),
}).refine(data => {
    if (!data.ignoreDates) {
        if (!data.dataInicio || !data.dataFim) return false;
        const startDate = new Date(data.dataInicio);
        const endDate = new Date(data.dataFim);
        if (endDate < startDate) return false;
        const maxDurationMs = 86400000 * 365;
        const durationMs = endDate.getTime() - startDate.getTime();
        if (durationMs > maxDurationMs) return false;
    }
    return true;
}, {
    message: "O período de busca não pode exceder 365 dias.",
    path: ["dataFim"],
});

type PriceSearchFormValues = z.infer<typeof formSchema>;

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
    isInspecting: boolean; 
    onClearPriceSelection: () => void;
    selectedItemForInspection: ItemAquisicao | null;
    mode?: 'material' | 'servico'; // NOVO
}

const today = new Date();
const oneYearAgo = subDays(today, 364); 
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

interface IndexedRawPriceRecord extends RawPriceRecord {
    id: number;
}

type PriceType = 'avg' | 'median' | 'min' | 'max';

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ 
    onPriceSelect, 
    isInspecting, 
    onClearPriceSelection, 
    selectedItemForInspection,
    mode = 'material'
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [searchResult, setSearchResult] = useState<PriceStatsResult | null>(null);
    const [excludedRecordIds, setExcludedRecordIds] = useState<Set<number>>(new Set());
    const [selectedPriceType, setSelectedPriceType] = useState<PriceType | null>(null);
    const [showRawData, setShowRawData] = useState(false);
    
    const catalogLabel = mode === 'material' ? 'CATMAT' : 'CATSER';

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
    
    const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };
    
    const handleCatalogSelect = (item: { code: string }) => {
        form.setValue('codigoItem', item.code, { shouldValidate: true });
        setIsCatalogOpen(false);
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setSearchResult(null);
        setShowRawData(false); 
        setExcludedRecordIds(new Set());
        setSelectedPriceType(null);
        onClearPriceSelection();
        
        try {
            toast.info(`Buscando estatísticas de preço para o item ${values.codigoItem}...`);
            const params = {
                codigoItem: values.codigoItem,
                dataInicio: values.ignoreDates ? null : values.dataInicio || null,
                dataFim: values.ignoreDates ? null : values.dataFim || null,
            };
            const result = await fetchPriceStats(params);
            if (!result.stats || result.totalRegistros === 0) {
                toast.warning(`Nenhum registro de preço encontrado.`);
            } else {
                toast.success(`${result.totalRegistros} registros encontrados!`);
            }
            setSearchResult(result);
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar estatísticas.");
        } finally {
            setIsSearching(false);
        }
    };
    
    const { currentStats, currentTotalRecords, indexedRecords } = useMemo(() => {
        if (!searchResult || searchResult.totalRegistros === 0) return { currentStats: null, currentTotalRecords: 0, indexedRecords: [] };
        const indexed = searchResult.rawRecords.map((record, index) => ({ ...record, id: index }));
        const activeRecords = indexed.filter(record => !excludedRecordIds.has(record.id));
        const activePrices = activeRecords.map(r => r.precoUnitario);
        const total = activePrices.length;
        if (total === 0) {
            setSelectedPriceType(null);
            onClearPriceSelection();
            return { currentStats: null, currentTotalRecords: 0, indexedRecords: indexed };
        }
        const minPrice = Math.min(...activePrices);
        const maxPrice = Math.max(...activePrices);
        const sumPrices = activePrices.reduce((sum, price) => sum + price, 0);
        const avgPrice = sumPrices / total;
        const sortedPrices = [...activePrices].sort((a, b) => a - b);
        const middle = Math.floor(sortedPrices.length / 2);
        const medianPrice = sortedPrices.length % 2 === 0 ? (sortedPrices[middle - 1] + sortedPrices[middle]) / 2 : sortedPrices[middle];
        const stats: PriceStats = { minPrice: parseFloat(minPrice.toFixed(2)), maxPrice: parseFloat(maxPrice.toFixed(2)), avgPrice: parseFloat(avgPrice.toFixed(2)), medianPrice: parseFloat(medianPrice.toFixed(2)) };
        const sortedIndexedRecords = [...indexed].sort((a, b) => b.precoUnitario - a.precoUnitario);
        return { currentStats: stats, currentTotalRecords: total, indexedRecords: sortedIndexedRecords };
    }, [searchResult, excludedRecordIds]);
    
    const toggleExclusion = (id: number) => {
        setExcludedRecordIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    
    const handlePriceSelection = (price: number, priceType: PriceType, priceLabel: string) => {
        if (!searchResult || !searchResult.descricaoItem) return;
        setSelectedPriceType(priceType);
        const item: ItemAquisicao = {
            id: Math.random().toString(36).substring(2, 9), 
            codigo_catmat: searchResult.codigoItem,
            descricao_item: searchResult.descricaoItem,
            descricao_reduzida: searchResult.descricaoItem.substring(0, 50) + (searchResult.descricaoItem.length > 50 ? '...' : ''),
            valor_unitario: price,
            numero_pregao: 'Em processo de abertura', 
            uasg: '', 
            quantidade: 0,
            valor_total: 0,
            nd: '',
            nr_subitem: '',
            nome_subitem: '',
        };
        onPriceSelect(item);
        toast.info(`Preço (${priceLabel}) selecionado.`);
    };

    const renderPriceButtons = (stats: PriceStats) => {
        const buttonClass = "flex flex-col items-center justify-center h-24 w-full text-center transition-all";
        const priceStyle = "text-xl font-bold mt-1";
        const selectedPrice = selectedItemForInspection?.valor_unitario;
        const isSelected = (price: number, type: PriceType) => selectedPrice !== undefined && Math.round(selectedPrice * 100) === Math.round(price * 100) && selectedPriceType === type;
        
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button type="button" variant={isSelected(stats.avgPrice, 'avg') ? 'default' : 'outline'} className={buttonClass} onClick={() => handlePriceSelection(stats.avgPrice, 'avg', 'Médio')} disabled={isInspecting}>
                    <span className="text-sm text-muted-foreground">Preço Médio</span>
                    <span className={priceStyle}>{formatCurrency(stats.avgPrice)}</span>
                </Button>
                <Button type="button" variant={isSelected(stats.medianPrice, 'median') ? 'default' : 'outline'} className={buttonClass} onClick={() => handlePriceSelection(stats.medianPrice, 'median', 'Mediana')} disabled={isInspecting}>
                    <span className="text-sm text-muted-foreground">Mediana</span>
                    <span className={priceStyle}>{formatCurrency(stats.medianPrice)}</span>
                </Button>
                <Button type="button" variant={isSelected(stats.minPrice, 'min') ? 'default' : 'outline'} className={buttonClass} onClick={() => handlePriceSelection(stats.minPrice, 'min', 'Mínimo')} disabled={isInspecting}>
                    <span className="text-sm text-muted-foreground">Preço Mínimo</span>
                    <span className={priceStyle}>{formatCurrency(stats.minPrice)}</span>
                </Button>
                <Button type="button" variant={isSelected(stats.maxPrice, 'max') ? 'default' : 'outline'} className={buttonClass} onClick={() => handlePriceSelection(stats.maxPrice, 'max', 'Máximo')} disabled={isInspecting}>
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
                                    <FormLabel>Cód. Item ({catalogLabel}) *</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={handleCodigoChange}
                                                value={field.value}
                                                placeholder={`Ex: ${mode === 'material' ? '604269' : '12345'}`}
                                                maxLength={9}
                                                disabled={isSearching}
                                            />
                                        </FormControl>
                                        <Button type="button" variant="outline" size="icon" onClick={() => setIsCatalogOpen(true)} disabled={isSearching}>
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-2 md:col-span-1">
                                    <FormLabel>Data de Início</FormLabel>
                                    <FormControl><Input type="date" {...field} disabled={isSearching || ignoreDates} value={ignoreDates ? '' : field.value} /></FormControl>
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
                                    <FormControl><Input type="date" {...field} disabled={isSearching || ignoreDates} value={ignoreDates ? '' : field.value} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="ignoreDates"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-4">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isSearching} /></FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Pesquisar sem restrição de data</FormLabel>
                                        <FormDescription>Busca todos os registros de preço disponíveis para o item.</FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando Preços...</> : <><Search className="h-4 w-4 mr-2" />Buscar Estatísticas de Preço</>}
                    </Button>
                </form>
            </Form>
            
            {searchResult && (
                <div className="p-4 space-y-4">
                    <Card className="p-4">
                        <CardTitle className="text-lg font-semibold mb-3">Estatísticas de Preço ({currentTotalRecords} Registros Ativos)</CardTitle>
                        {currentStats ? (
                            <>
                                <p className="text-sm text-muted-foreground mb-4">Item: <span className="font-medium text-foreground">{capitalizeFirstLetter(searchResult.descricaoItem || 'N/A')}</span></p>
                                {renderPriceButtons(currentStats)}
                                {indexedRecords.length > 0 && (
                                    <Collapsible open={showRawData} onOpenChange={setShowRawData} className="mt-4 border-t pt-4">
                                        <CollapsibleTrigger asChild>
                                            <Button variant="link" className="p-0 h-auto">
                                                {showRawData ? <><ChevronUp className="h-4 w-4 mr-2" />Ocultar Base de Cálculo</> : <><ChevronDown className="h-4 w-4 mr-2" />Mostrar Base de Cálculo ({currentTotalRecords} ativos / {indexedRecords.length} total)</>}
                                            </Button>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="max-h-60 overflow-y-auto mt-2 border rounded-md">
                                                <Table>
                                                    <TableHeader className="sticky top-0 bg-background z-10">
                                                        <TableRow>
                                                            <TableHead className="w-[5%] text-center"><Trash2 className="h-4 w-4 text-muted-foreground mx-auto" /></TableHead>
                                                            <TableHead className="w-[15%]">UASG</TableHead>
                                                            <TableHead className="w-[50%]">Nome da UASG</TableHead>
                                                            <TableHead className="w-[30%] text-right">Preço Unitário</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {indexedRecords.map((record) => (
                                                            <TableRow key={record.id} className={excludedRecordIds.has(record.id) ? 'bg-red-50/50 opacity-50' : 'hover:bg-muted/50'}>
                                                                <TableCell className="text-center py-2"><Checkbox checked={!excludedRecordIds.has(record.id)} onCheckedChange={() => toggleExclusion(record.id)} /></TableCell>
                                                                <TableCell className="text-sm font-medium py-2">{formatCodug(record.codigoUasg)}</TableCell>
                                                                <TableCell className="text-sm py-2">{record.nomeUasg}</TableCell>
                                                                <TableCell className="text-right text-sm font-bold text-primary py-2">{formatCurrency(record.precoUnitario)}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}
                            </>
                        ) : <p className="text-center text-muted-foreground">Nenhum registro de preço ativo encontrado.</p>}
                    </Card>
                </div>
            )}

            {mode === 'material' ? (
                <CatmatCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={handleCatalogSelect} />
            ) : (
                <CatserCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={handleCatalogSelect} />
            )}
        </>
    );
};

export default PriceSearchForm;