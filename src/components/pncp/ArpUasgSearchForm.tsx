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

const formSchema = z.object({
    uasg: z.string().min(6, { message: "A UASG deve ter 6 dígitos." }).max(6).regex(/^\d+$/, { message: "A UASG deve conter apenas números." }),
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

export interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico';
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection,
    mode = 'material' 
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ArpItemResult[]>([]);

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
            setResults(data);
            if (data.length === 0) toast.warning("Nenhuma ARP encontrada para esta UASG.");
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar ARPs.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-4 items-end p-4 form-busca-uasg-tour">
                    <FormField
                        control={form.control}
                        name="uasg"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Código UASG da Organização Militar</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ex: 160222" maxLength={6} {...field} disabled={isSearching} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={isSearching}>
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
        </div>
    );
};

export default ArpUasgSearchForm;