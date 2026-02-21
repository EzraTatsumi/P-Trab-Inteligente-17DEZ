"use client";

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

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection,
    scrollContainerRef 
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ArpItemResult[]>([]);
    const [searchedUasg, setSearchedUasg] = useState("");

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
            setSearchedUasg(values.uasg);
        } catch (error: any) {
            toast.error(error.message || "Falha ao buscar ARPs.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/30 form-busca-uasg-tour">
                    <FormField
                        control={form.control}
                        name="uasg"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Código UASG da OM *</FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input {...field} placeholder="Ex: 160222" maxLength={6} disabled={isSearching} />
                                    </FormControl>
                                    <Button type="submit" disabled={isSearching}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </form>
            </Form>

            {results.length > 0 && (
                <ArpSearchResultsList 
                    results={results} 
                    onItemPreSelect={onItemPreSelect} 
                    searchedUasg={searchedUasg}
                    selectedItemIds={selectedItemIds}
                />
            )}
        </div>
    );
};

export default ArpUasgSearchForm;