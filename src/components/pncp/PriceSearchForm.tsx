import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fetchPriceStats } from '@/integrations/supabase/api';
import { PriceStatsResult, PriceStats, RawPriceRecord } from '@/types/pncp';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import CatserCatalogDialog from '../CatserCatalogDialog';
import { Card, CardTitle } from '@/components/ui/card';
import { ItemAquisicao } from '@/types/diretrizesMaterialConsumo';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PriceSearchFormProps {
    onPriceSelect: (item: ItemAquisicao) => void;
    isInspecting: boolean;
    onClearPriceSelection: () => void;
    selectedItemForInspection: ItemAquisicao | null;
    mode: 'material' | 'servico';
}

const formSchema = z.object({
    codigoItem: z.string().min(1, "O código é obrigatório"),
    dataInicio: z.string().optional(),
    dataFim: z.string().optional(),
    ignoreDates: z.boolean().default(false),
});

const PriceSearchForm: React.FC<PriceSearchFormProps> = ({ onPriceSelect, isInspecting, onClearPriceSelection, selectedItemForInspection, mode }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [searchResult, setSearchResult] = useState<PriceStatsResult | null>(null);
    const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
    const [showRawData, setShowRawData] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { codigoItem: "", ignoreDates: false },
    });

    const onSubmit = async (values: any) => {
        setIsSearching(true);
        try {
            const result = await fetchPriceStats({
                codigoItem: values.codigoItem,
                dataInicio: values.ignoreDates ? null : values.dataInicio,
                dataFim: values.ignoreDates ? null : values.dataFim,
            });
            setSearchResult(result);
            setExcludedIds(new Set());
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSearching(false);
        }
    };

    const stats = useMemo(() => {
        if (!searchResult) return null;
        const active = searchResult.rawRecords.filter((_, i) => !excludedIds.has(i));
        if (active.length === 0) return null;
        const prices = active.map(r => r.precoUnitario).sort((a, b) => a - b);
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const median = prices.length % 2 === 0 ? (prices[prices.length/2 - 1] + prices[prices.length/2]) / 2 : prices[Math.floor(prices.length/2)];
        return { avg, median, min: prices[0], max: prices[prices.length - 1], count: active.length };
    }, [searchResult, excludedIds]);

    const handleSelect = (price: number, label: string) => {
        if (!searchResult) return;
        onPriceSelect({
            id: Math.random().toString(36).substring(2, 9),
            codigo_catmat: searchResult.codigoItem,
            descricao_item: searchResult.descricaoItem,
            descricao_reduzida: searchResult.descricaoItem.substring(0, 50),
            valor_unitario: price,
            numero_pregao: 'Ref. Preço Médio',
            uasg: '',
            quantidade: 0,
            valor_total: 0,
            nd: '',
            nr_subitem: '',
            nome_subitem: '',
        });
        toast.info(`Preço ${label} selecionado.`);
    };

    return (
        <div className="space-y-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg">
                    <FormField
                        control={form.control}
                        name="codigoItem"
                        render={({ field }) => (
                            <FormItem className="md:col-span-2">
                                <FormLabel>Cód. {mode === 'material' ? 'CATMAT' : 'CATSER'}</FormLabel>
                                <div className="flex gap-2">
                                    <FormControl><Input {...field} /></FormControl>
                                    <Button type="button" variant="outline" onClick={() => setIsCatalogOpen(true)}><BookOpen className="h-4 w-4" /></Button>
                                </div>
                            </FormItem>
                        )}
                    />
                    <Button type="submit" className="md:mt-8" disabled={isSearching}>
                        {isSearching ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar Preços
                    </Button>
                </form>
            </Form>

            {stats && (
                <Card className="p-4">
                    <CardTitle className="text-lg mb-4">Estatísticas ({stats.count} registros)</CardTitle>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Button variant="outline" className="h-20 flex-col" onClick={() => handleSelect(stats.avg, 'Médio')}>
                            <span className="text-xs text-muted-foreground">Média</span>
                            <span className="text-lg font-bold">{formatCurrency(stats.avg)}</span>
                        </Button>
                        <Button variant="outline" className="h-20 flex-col" onClick={() => handleSelect(stats.median, 'Mediana')}>
                            <span className="text-xs text-muted-foreground">Mediana</span>
                            <span className="text-lg font-bold">{formatCurrency(stats.median)}</span>
                        </Button>
                    </div>
                    
                    <Collapsible open={showRawData} onOpenChange={setShowRawData} className="mt-4 border-t pt-4">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                                {showRawData ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                                Detalhar Base de Cálculo
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <Table className="mt-2">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>UASG</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {searchResult?.rawRecords.map((r, i) => (
                                        <TableRow key={i} className={excludedIds.has(i) ? "opacity-50 bg-red-50" : ""}>
                                            <TableCell>
                                                <Checkbox checked={!excludedIds.has(i)} onCheckedChange={() => {
                                                    const next = new Set(excludedIds);
                                                    next.has(i) ? next.delete(i) : next.add(i);
                                                    setExcludedIds(next);
                                                }} />
                                            </TableCell>
                                            <TableCell>{formatCodug(r.codigoUasg)}</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(r.precoUnitario)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CollapsibleContent>
                    </Collapsible>
                </Card>
            )}

            {mode === 'material' ? (
                <CatmatCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={i => form.setValue('codigoItem', i.code)} />
            ) : (
                <CatserCatalogDialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen} onSelect={i => form.setValue('codigoItem', i.code)} />
            )}
        </div>
    );
};

export default PriceSearchForm;