import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Search, Loader2, BookOpen, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStats, RawPriceRecord } from '@/types/pncp';
import { capitalizeFirstLetter, formatCurrency, formatCodug } from '@/lib/formatUtils';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import CatserCatalogDialog from '../CatserCatalogDialog';
import { Card, CardTitle } from '@/components/ui/card';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formSchema = z.object({
    codigoItem: z.string().min(1, { message: "O Código do Item é obrigatório." }).regex(/^\d{1,9}$/, { message: "O código deve conter apenas números." }),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    ignoreDates: z.boolean().default(false),
}).refine(data => {
    if (!data.ignoreDates) {
        if (!data.dataInicio || !data.dataFim) return false;
        const startDate = new Date(data.dataInicio);
        const endDate = new Date(data.dataFim);
        if (endDate < startDate) return false;
        if (endDate.getTime() - startDate.getTime() > 86400000 * 365) return false;
    }
    return true;
}, { message: "O período de busca não pode exceder 365 dias.", path: ["dataFim"] });

type PriceSearchFormValues = z.infer<typeof formSchema>;

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
    isInspecting: boolean; 
    onClearPriceSelection: () => void;
    selectedItemForInspection: ItemAquisicao | null;
    mode?: 'material' | 'servico';
}

const today = new Date();
const oneYearAgo = subDays(today, 364); 
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

interface IndexedRawPriceRecord extends RawPriceRecord { id: number; }
type PriceType = 'avg' | 'median' | 'min' | 'max';

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect, isInspecting, onClearPriceSelection, selectedItemForInspection, mode = 'material' }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false);
    const [isCatserCatalogOpen, setIsCatserCatalogOpen] = useState(false);
    const [searchResult, setSearchResult] = useState<PriceStatsResult | null>(null);
    const [excludedRecordIds, setExcludedRecordIds] = useState<Set<number>>(new Set());
    const [selectedPriceType, setSelectedPriceType] = useState<PriceType | null>(null);
    const [showRawData, setShowRawData] = useState(false);
    
    const form = useForm<PriceSearchFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { codigoItem: "", dataInicio: defaultDataInicio, dataFim: defaultDataFim, ignoreDates: false },
    });
    
    const ignoreDates = form.watch('ignoreDates');
    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => form.setValue('codigoItem', e.target.value.replace(/\D/g, '').slice(0, 9), { shouldValidate: true });
    
    const handleCatalogSelect = (item: { code: string }) => {
        form.setValue('codigoItem', item.code, { shouldValidate: true });
        setIsCatmatCatalogOpen(false);
        setIsCatserCatalogOpen(false);
    };

    const onSubmit = async (values: PriceSearchFormValues) => {
        setIsSearching(true);
        setSearchResult(null);
        setShowRawData(false); 
        setExcludedRecordIds(new Set());
        setSelectedPriceType(null);
        onClearPriceSelection();
        try {
            toast.info(`Buscando estatísticas para o item ${values.codigoItem}...`);
            const result = await fetchPriceStats({ codigoItem: values.codigoItem, dataInicio: values.ignoreDates ? null : values.dataInicio || null, dataFim: values.ignoreDates ? null : values.dataFim || null });
            if (!result.stats || result.totalRegistros === 0) toast.warning(`Nenhum registro encontrado.`);
            else toast.success(`${result.totalRegistros} registros encontrados!`);
            setSearchResult(result);
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar estatísticas.");
        } finally {
            setIsSearching(false);
        }
    };
    
    const { currentStats, currentTotalRecords, sortedRawRecords } = useMemo(() => {
        if (!searchResult || searchResult.totalRegistros === 0) return { currentStats: null, currentTotalRecords: 0, sortedRawRecords: [] };
        const indexed = searchResult.rawRecords.map((record, index) => ({ ...record, id: index }));
        const activeRecords = indexed.filter(record => !excludedRecordIds.has(record.id));
        const activePrices = activeRecords.map(r => r.precoUnitario);
        if (activePrices.length === 0) return { currentStats: null, currentTotalRecords: 0, sortedRawRecords: indexed.sort((a, b) => b.precoUnitario - a.precoUnitario) };
        const sortedPrices = [...activePrices].sort((a, b) => a - b);
        const middle = Math.floor(sortedPrices.length / 2);
        const stats: PriceStats = {
            minPrice: Math.min(...activePrices),
            maxPrice: Math.max(...activePrices),
            avgPrice: activePrices.reduce((a, b) => a + b, 0) / activePrices.length,
            medianPrice: sortedPrices.length % 2 === 0 ? (sortedPrices[middle - 1] + sortedPrices[middle]) / 2 : sortedPrices[middle],
        };
        return { currentStats: stats, currentTotalRecords: activePrices.length, sortedRawRecords: indexed.sort((a, b) => b.precoUnitario - a.precoUnitario) };
    }, [searchResult, excludedRecordIds]);
    
    const handlePriceSelection = (price: number, priceType: PriceType, label: string) => {
        if (!searchResult) return;
        setSelectedPriceType(priceType);
        onPriceSelect({
            id: Math.random().toString(36).substring(2, 9), 
            codigo_catmat: searchResult.codigoItem,
            descricao_item: searchResult.descricaoItem || '',
            descricao_reduzida: (searchResult.descricaoItem || '').substring(0, 50),
            valor_unitario: price,
            numero_pregao: 'Em processo de abertura', 
            uasg: '', 
            quantidade: 0, valor_total: 0, nd: '', nr_subitem: '', nome_subitem: '',
        });
        toast.info(`Preço (${label}) selecionado.`);
    };

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-4 gap-4">
                        <FormField control={form.control} name="codigoItem" render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-2">
                                <FormLabel>{mode === 'material' ? 'Cód. CATMAT *' : 'Cód. CATSER *'}</FormLabel>
                                <div className="flex gap-2 items-center">
                                    <FormControl>
                                        <Input {...field} onChange={handleCodeChange} placeholder={mode === 'material' ? "Ex: 604269" : "Ex: 17639"} maxLength={9} disabled={isSearching} />
                                    </FormControl>
                                    {mode === 'material' ? (
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setIsCatmatCatalogOpen(true)} 
                                            disabled={isSearching} 
                                            className="h-8 px-2 text-[10px]"
                                        >
                                            <BookOpen className="h-3 w-3 mr-1" /> CATMAT
                                        </Button>
                                    ) : (
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setIsCatserCatalogOpen(true)} 
                                            disabled={isSearching} 
                                            className="h-8 px-2 text-[10px]"
                                        >
                                            <BookOpen className="h-3 w-3 mr-1" /> CATSER
                                        </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="dataInicio" render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Início</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} disabled={isSearching || ignoreDates} />
                                </FormControl>
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="dataFim" render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Fim</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} disabled={isSearching || ignoreDates} />
                                </FormControl>
                            </FormItem>
                        )} />
                        
                        <FormField control={form.control} name="ignoreDates" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 col-span-4">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isSearching} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Pesquisar sem restrição de data</FormLabel>
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar Estatísticas
                    </Button>
                </form>
            </Form>
            
            {searchResult && currentStats && (
                <div className="p-4 space-y-4">
                    <Card className="p-4">
                        <CardTitle className="text-lg font-semibold mb-3">Estatísticas ({currentTotalRecords} Registros)</CardTitle>
                        <p className="text-sm text-muted-foreground mb-4">Item: <span className="font-medium text-foreground">{capitalizeFirstLetter(searchResult.descricaoItem || 'N/A')}</span></p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[ {t:'avg', l:'Médio', v:currentStats.avgPrice}, {t:'median', l:'Mediana', v:currentStats.medianPrice}, {t:'min', l:'Mínimo', v:currentStats.minPrice}, {t:'max', l:'Máximo', v:currentStats.maxPrice} ].map(p => (
                                <Button key={p.t} type="button" variant={selectedPriceType === p.t ? 'default' : 'outline'} className="flex flex-col h-24" onClick={() => handlePriceSelection(p.v, p.t as PriceType, p.l)} disabled={isInspecting}>
                                    <span className="text-xs text-muted-foreground">{p.l}</span>
                                    <span className="text-lg font-bold">{formatCurrency(p.v)}</span>
                                </Button>
                            ))}
                        </div>
                        {sortedRawRecords.length > 0 && (
                            <Collapsible open={showRawData} onOpenChange={setShowRawData} className="mt-4 border-t pt-4">
                                <CollapsibleTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto">
                                        {showRawData ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                        Base de Cálculo
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="max-h-60 overflow-y-auto mt-2 border rounded-md">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-background z-10">
                                                <TableRow>
                                                    <TableHead className="w-[5%]"></TableHead>
                                                    <TableHead className="w-[15%]">UASG</TableHead>
                                                    <TableHead className="w-[50%]">Nome</TableHead>
                                                    <TableHead className="w-[30%] text-right">Preço</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedRawRecords.map(r => (
                                                    <TableRow key={r.id} className={excludedRecordIds.has(r.id) ? 'opacity-50 bg-red-50' : ''}>
                                                        <TableCell className="text-center">
                                                            <Checkbox checked={!excludedRecordIds.has(r.id)} onCheckedChange={() => setExcludedRecordIds(prev => { const n = new Set(prev); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
                                                        </TableCell>
                                                        <TableCell className="text-xs">{formatCodug(r.codigoUasg)}</TableCell>
                                                        <TableCell className="text-xs">{r.nomeUasg}</TableCell>
                                                        <TableCell className="text-right text-xs font-bold">{formatCurrency(r.precoUnitario)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </Card>
                </div>
            )}
            <CatmatCatalogDialog open={isCatmatCatalogOpen} onOpenChange={setIsCatmatCatalogOpen} onSelect={handleCatalogSelect} />
            <CatserCatalogDialog open={isCatserCatalogOpen} onOpenChange={setIsCatserCatalogOpen} onSelect={handleCatalogSelect} />
        </>
    );
};

export default PriceSearchForm;