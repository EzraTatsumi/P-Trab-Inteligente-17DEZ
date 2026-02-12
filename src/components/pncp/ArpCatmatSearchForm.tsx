import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchArpItemsByCatmat } from '@/integrations/supabase/api';
import { DetailedArpItem } from '@/types/pncp';
import ArpCatmatSearchResultsList from './ArpCatmatSearchResultsList';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import CatserCatalogDialog from '../CatserCatalogDialog';

const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código do Item é obrigatório." })
        .regex(/^\d{1,9}$/, { message: "O código deve conter apenas números (máx. 9 dígitos)." }),
    dataInicio: z.string().min(1, { message: "Data de Início é obrigatória." }),
    dataFim: z.string().min(1, { message: "Data de Fim é obrigatória." }),
}).refine(data => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type ArpCatmatFormValues = z.infer<typeof formSchema>;

interface ArpCatmatSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    onClearSelection: () => void;
    selectedItemIds: string[];
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico'; // NOVO
}

const today = new Date();
const oneYearAgo = subDays(today, 365);
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

const ArpCatmatSearchForm: React.FC<ArpCatmatSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    scrollContainerRef,
    mode = 'material'
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const [arpResults, setArpResults] = useState<DetailedArpItem[]>([]);
    const resultsRef = useRef<HTMLDivElement>(null);

    const catalogLabel = mode === 'material' ? 'CATMAT' : 'CATSER';

    const form = useForm<ArpCatmatFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });
    
    const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };
    
    const handleCatalogSelect = (item: { code: string }) => {
        form.setValue('codigoItem', item.code, { shouldValidate: true });
        setIsCatalogOpen(false);
    };

    const onSubmit = async (values: ArpCatmatFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        onClearSelection(); 
        
        try {
            toast.info(`Buscando itens para o código ${values.codigoItem}...`);
            const params = {
                codigoItem: values.codigoItem,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim,
            };
            
            const results = await fetchArpItemsByCatmat(params);
            if (results.length === 0) {
                toast.warning(`Nenhum item encontrado para o código ${values.codigoItem} no período.`);
            } else {
                toast.success(`${results.length} itens encontrados em ARPs!`);
            }
            setArpResults(results);
            
            if (results.length > 0 && resultsRef.current) {
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100); 
            }
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar itens.");
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
                                    <FormLabel>Código do Item ({catalogLabel}) *</FormLabel>
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
                                <FormItem className="col-span-1">
                                    <FormLabel>Data de Início *</FormLabel>
                                    <FormControl><Input type="date" {...field} disabled={isSearching} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dataFim"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
                                    <FormLabel>Data de Fim *</FormLabel>
                                    <FormControl><Input type="date" {...field} disabled={isSearching} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando itens...</> : <><Search className="h-4 w-4 mr-2" />Buscar Itens por Código</>}
                    </Button>
                </form>
            </Form>
            
            {arpResults.length > 0 && (
                <div ref={resultsRef}>
                    <ArpCatmatSearchResultsList 
                        results={arpResults} 
                        onItemPreSelect={onItemPreSelect} 
                        searchedCatmat={form.getValues('codigoItem')}
                        selectedItemIds={selectedItemIds}
                        mode={mode} // REPASSANDO O MODO
                    />
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

export default ArpCatmatSearchForm;