import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import { isGhostMode } from '@/lib/ghostStore';

const formSchema = z.object({
    uasg: z.string().length(6, { message: "A UASG deve ter exatamente 6 dígitos." }).regex(/^\d+$/, { message: "A UASG deve conter apenas números." }),
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: any, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ArpItemResult[]>([]);
    const resultsRef = useRef<HTMLDivElement>(null);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { uasg: "" },
    });

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setResults([]);
        onClearSelection();
        try {
            const data = await fetchArpsByUasg({ uasg: values.uasg });
            if (data.length === 0) toast.warning("Nenhuma ARP encontrada para esta UASG.");
            else toast.success(`${data.length} ARPs encontradas!`);
            setResults(data);
            
            if (isGhostMode()) {
                window.dispatchEvent(new CustomEvent('tour:avancar'));
            }

            if (data.length > 0 && resultsRef.current) {
                setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 form-busca-uasg-tour">
                    <FormField control={form.control} name="uasg" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Código UASG da Organização Militar *</FormLabel>
                            <FormControl><Input {...field} placeholder="Ex: 160222" maxLength={6} disabled={isSearching} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="h-4 w-4 mr-2" /> Buscar ARPs por UASG</>}
                    </Button>
                </form>
            </Form>
            {results.length > 0 && (
                <div ref={resultsRef}>
                    <ArpSearchResultsList results={results} onItemPreSelect={onItemPreSelect} searchedUasg={form.getValues('uasg')} selectedItemIds={selectedItemIds} />
                </div>
            )}
        </>
    );
};

export default ArpUasgSearchForm;