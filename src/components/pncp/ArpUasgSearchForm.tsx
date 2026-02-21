import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import { isGhostMode, GHOST_DATA } from '@/lib/ghostStore';

const formSchema = z.object({
    uasg: z.string().min(6, { message: "A UASG deve ter 6 dígitos." }).max(6, { message: "A UASG deve ter 6 dígitos." }).regex(/^\d+$/, { message: "A UASG deve conter apenas números." }),
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [arpResults, setArpResults] = useState<ArpItemResult[]>([]);
    const [searchedUasg, setSearchedUasg] = useState("");
    const [searchedOmName, setSearchedOmName] = useState("");

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { uasg: "" },
    });

    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        form.setValue('uasg', value, { shouldValidate: true });
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        onClearSelection();
        
        try {
            if (isGhostMode() && values.uasg === '160222') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const mockResults = GHOST_DATA.missao_02.arp_search_results;
                setArpResults(mockResults);
                setSearchedUasg(values.uasg);
                setSearchedOmName(mockResults[0].omNome);
                toast.success("Resultados simulados carregados!");
            } else {
                const results = await fetchArpsByUasg({ uasg: values.uasg });
                if (results.length === 0) toast.warning("Nenhuma ARP encontrada para esta UASG.");
                else toast.success(`${results.length} ARPs encontradas!`);
                setArpResults(results);
                setSearchedUasg(values.uasg);
                setSearchedOmName(results.length > 0 ? results[0].omNome : "");
            }
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar ARPs.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6 p-4 form-busca-uasg-tour">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="uasg" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Código UASG da OM *</FormLabel>
                            <div className="flex gap-2">
                                <FormControl>
                                    <Input {...field} onChange={handleUasgChange} placeholder="Ex: 160222" maxLength={6} disabled={isSearching} />
                                </FormControl>
                                <Button type="submit" disabled={isSearching}>
                                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )} />
                </form>
            </Form>
            {arpResults.length > 0 && (
                <ArpSearchResultsList 
                    results={arpResults} 
                    onItemPreSelect={onItemPreSelect} 
                    searchedUasg={searchedUasg} 
                    searchedOmName={searchedOmName}
                    selectedItemIds={selectedItemIds}
                />
            )}
        </div>
    );
};

export default ArpUasgSearchForm;