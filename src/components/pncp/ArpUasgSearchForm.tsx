"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import { isGhostMode } from '@/lib/ghostStore';
import OmSelectorDialog from '../OmSelectorDialog';

// 1. Esquema de Validação integrado com datas
const formSchema = z.object({
    uasg: z.string()
        .min(6, { message: "A UASG deve ter 6 dígitos." })
        .max(6)
        .regex(/^\d+$/, { message: "A UASG deve conter apenas números." }),
    dataInicio: z.string().min(1, { message: "Data de Início é obrigatória." }),
    dataFim: z.string().min(1, { message: "Data de Fim é obrigatória." }),
}).refine(data => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

export interface ArpUasgSearchFormProps { 
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void; 
    selectedItemIds: string[]; 
    onClearSelection: () => void; 
    scrollContainerRef: React.RefObject<HTMLDivElement>; 
    mode?: 'material' | 'servico'; 
}

// Calcula as datas padrão (último ano)
const today = new Date();
const oneYearAgo = subDays(today, 365);
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    mode = 'material' 
}) => { 
    const [isSearching, setIsSearching] = useState(false); 
    const [results, setResults] = useState<ArpItemResult[]>([]);
    const [isOmDialogOpen, setIsOmDialogOpen] = useState(false);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { 
            uasg: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });

    const handleOmSelect = (om: any) => {
        form.setValue('uasg', om.codug_om, { shouldValidate: true });
        setIsOmDialogOpen(false);
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setResults([]);
        onClearSelection();
        try {
            // Chama a API passando os 3 parâmetros necessários
            const data = await fetchArpsByUasg({ 
                uasg: values.uasg,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim
            });
            
            setResults(data);
            
            if (data.length === 0) {
                toast.warning("Nenhuma ARP encontrada para esta UASG no período selecionado.");
            } else if (isGhostMode() && values.uasg === '160222') {
                // GATILHO AUTOMÁTICO PARA A MISSÃO 2 DO TOUR
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('tour:avancar'));
                }, 300);
            }
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar ARPs.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 form-busca-uasg-tour bg-muted/30 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <FormField
                            control={form.control}
                            name="uasg"
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Código UASG da Organização Militar</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input placeholder="Ex: 160222" maxLength={6} {...field} disabled={isSearching} />
                                        </FormControl>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => setIsOmDialogOpen(true)}
                                            title="Selecionar do Catálogo de OMs"
                                            disabled={isSearching}
                                        >
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
                                <FormItem>
                                    <FormLabel>Data Início *</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} disabled={isSearching} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="dataFim"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Data Fim *</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} disabled={isSearching} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                        Buscar ARPs por UASG
                    </Button>
                </form>
            </Form>

            {results.length > 0 && (
                <ArpSearchResultsList 
                    results={results} 
                    onItemPreSelect={onItemPreSelect} 
                    searchedUasg={form.getValues('uasg')} 
                    selectedItemIds={selectedItemIds}
                />
            )}

            <OmSelectorDialog 
                open={isOmDialogOpen} 
                onOpenChange={setIsOmDialogOpen} 
                onSelect={handleOmSelect} 
            />
        </div>
    );
};

export default ArpUasgSearchForm;