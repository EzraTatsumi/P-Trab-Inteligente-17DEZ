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
        form.setValue('uasg', value, { shouldValidate: true });
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        const cleanUasg = values.uasg.trim();
        setIsSearching(true);
        
        try {
            const results = await fetchArpsByUasg({ uasg: cleanUasg });
            
            if (results.length === 0) {
                toast.warning("Nenhuma ARP encontrada para esta UASG.");
            } else {
                // Notifica o componente pai sobre os resultados
                onResultsFound(results, cleanUasg);
                
                // CORREÇÃO MISSÃO 2: Avança o tour automaticamente
                if (isGhostMode() && cleanUasg === '160222') {
                    // Timeout pequeno para garantir que a lista de resultados foi renderizada no DOM
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('tour:avancar'));
                    }, 600);
                }
            }
        } catch (error: any) {
            console.error("Erro detalhado na busca:", error);
            
            // Se for modo treinamento, tentamos um fallback silencioso com os dados locais
            if (isGhostMode() && cleanUasg === '160222') {
                const { GHOST_DATA } = await import('@/lib/ghostStore');
                onResultsFound(GHOST_DATA.missao_02.arp_search_results, cleanUasg);
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('tour:avancar'));
                }, 600);
            } else {
                toast.error(error.message || "Falha ao consultar PNCP.");
            }
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
                                    className="text-lg font-mono tracking-widest"
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