"use client";

import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { formatCodug } from '@/lib/formatUtils';
import OmSelectorDialog from '@/components/OmSelectorDialog';
import { format, subDays } from 'date-fns';
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp'; 
import ArpSearchResultsList from './ArpSearchResultsList';
import { isGhostMode } from '@/lib/ghostStore';

const formSchema = z.object({
    uasg: z.string()
        .min(6, { message: "A UASG deve ter 6 dígitos." })
        .max(6, { message: "A UASG deve ter 6 dígitos." })
        .regex(/^\d{6}$/, { message: "A UASG deve conter apenas números." }),
    dataInicio: z.string().min(1, { message: "Data de Início é obrigatória." }),
    dataFim: z.string().min(1, { message: "Data de Fim é obrigatória." }),
}).refine(data => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    onClearSelection: () => void;
    selectedItemIds: string[];
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico';
}

const today = new Date();
const oneYearAgo = subDays(today, 365);
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    scrollContainerRef, 
    mode = 'material' 
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false);
    const [arpResults, setArpResults] = useState<ArpItemResult[]>([]); 
    const [searchedOmName, setSearchedOmName] = useState<string>(""); 
    const resultsRef = useRef<HTMLDivElement>(null);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { 
            uasg: "", 
            dataInicio: defaultDataInicio, 
            dataFim: defaultDataFim 
        },
    });
    
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        form.setValue('uasg', e.target.value.replace(/\D/g, '').slice(0, 6), { shouldValidate: true });
        setSearchedOmName(""); 
    };
    
    const handleOmSelect = (omData: any) => {
        if (omData && omData.codug_om) {
            form.setValue('uasg', omData.codug_om, { shouldValidate: true });
            setSearchedOmName(omData.nome_om);
        }
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        onClearSelection(); 
        try {
            toast.info(`Buscando ARPs para UASG ${formatCodug(values.uasg)}...`);
            if (!searchedOmName) setSearchedOmName(`UASG ${values.uasg}`);
            
            const results = await fetchArpsByUasg({ 
                ...( { codigoUnidadeGerenciadora: values.uasg } as any ), 
                dataVigenciaInicialMin: values.dataInicio, 
                dataVigenciaInicialMax: values.dataFim 
            });
            
            if (results.length === 0) {
                toast.warning("Nenhuma ARP encontrada.");
            } else {
                toast.success(`${results.length} ARPs encontradas!`);
            }
            
            setArpResults(results);

            if (isGhostMode() && values.uasg === '160222' && results.length > 0) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('tour:avancar'));
                }, 300);
            }

            if (results.length > 0 && resultsRef.current) {
                setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100); 
            }
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar ARPs.");
        } finally {
            setIsSearching(false);
        }
    };
    
    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-4 gap-4">
                        <FormField control={form.control} name="uasg" render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-2 form-busca-uasg-tour">
                                <FormLabel>UASG (Unidade Gestora) *</FormLabel>
                                <div className="flex gap-2 items-center">
                                    <FormControl>
                                        <Input {...field} onChange={handleUasgChange} placeholder="Ex: 160001" maxLength={6} disabled={isSearching} />
                                    </FormControl>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setIsOmSelectorOpen(true)} 
                                        disabled={isSearching}
                                        className="h-8 px-2 text-[10px]"
                                    >
                                        <BookOpen className="h-3 w-3 mr-1" /> CODUG
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="dataInicio" render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Início *</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} disabled={isSearching} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="dataFim" render={({ field }) => (
                            <FormItem className="col-span-2 md:col-span-1">
                                <FormLabel>Fim *</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} disabled={isSearching} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar ARPs por UASG
                    </Button>
                </form>
            </Form>
            
            {arpResults.length > 0 && (
                <div ref={resultsRef}>
                    <ArpSearchResultsList 
                        results={arpResults} 
                        onItemPreSelect={onItemPreSelect} 
                        searchedUasg={form.getValues('uasg')} 
                        searchedOmName={searchedOmName} 
                        selectedItemIds={selectedItemIds} 
                    />
                </div>
            )}
            
            <OmSelectorDialog 
                open={isOmSelectorOpen} 
                onOpenChange={setIsOmSelectorOpen} 
                onSelect={handleOmSelect} 
            />
        </>
    );
};

export default ArpUasgSearchForm;