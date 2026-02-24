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
import { ArpItemResult } from '@/types/pncp';
import { isGhostMode } from '@/lib/ghostStore';

const formSchema = z.object({
    uasg: z.string().min(6, { message: "UASG deve ter 6 dígitos." }).max(6),
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onResultsFound: (results: ArpItemResult[], uasg: string) => void;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onResultsFound }) => {
    const [isSearching, setIsSearching] = useState(false);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
        },
    });

    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '').slice(0, 6);
        form.setValue('uasg', value);
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        try {
            const results = await fetchArpsByUasg({ uasg: values.uasg });
            
            if (results.length === 0) {
                toast.warning("Nenhuma ARP encontrada para esta UASG.");
            } else {
                onResultsFound(results, values.uasg);
                
                // CORREÇÃO MISSÃO 2: Avança o tour automaticamente se estiver no modo Ghost e a UASG for a correta
                if (isGhostMode() && values.uasg === '160222') {
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('tour:avancar'));
                    }, 500);
                }
            }
        } catch (error: any) {
            console.error("Erro na busca:", error);
            toast.error(error.message || "Falha ao consultar PNCP.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 form-busca-uasg-tour">
                <FormField
                    control={form.control}
                    name="uasg"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Código da Unidade Gestora (UASG) *</FormLabel>
                            <FormControl>
                                <Input 
                                    {...field} 
                                    placeholder="Ex: 160222" 
                                    onChange={handleUasgChange}
                                    maxLength={6}
                                    disabled={isSearching}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                
                <Button type="submit" disabled={isSearching} className="w-full">
                    {isSearching ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Consultando PNCP...
                        </>
                    ) : (
                        <>
                            <Search className="h-4 w-4 mr-2" />
                            Buscar ARPs por UASG
                        </>
                    )}
                </Button>
            </form>
        </Form>
    );
};

export default ArpUasgSearchForm;