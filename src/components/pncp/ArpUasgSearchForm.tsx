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
    uasg: z.string()
        .min(1, { message: "A UASG é obrigatória." })
        .regex(/^\d{1,6}$/, { message: "A UASG deve conter apenas números (máx. 6 dígitos)." }),
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    mode?: 'material' | 'servico';
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds,
    mode = 'material'
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<ArpItemResult[]>([]);
    const [searchedUasg, setSearchedUasg] = useState("");
    const [searchedOmName, setSearchedOmName] = useState("");

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
        },
    });

    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 6);
        form.setValue('uasg', limitedValue, { shouldValidate: true });
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setResults([]);
        try {
            toast.info(`Buscando Atas de Registro de Preços para a UASG ${values.uasg}...`);
            
            const arps = await fetchArpsByUasg({
                codigoUnidadeGerenciadora: values.uasg,
                pagina: 1,
                tamanhoPagina: 50
            });
            
            if (arps.length === 0) {
                toast.warning("Nenhuma Ata de Registro de Preços encontrada para esta UASG.");
            } else {
                toast.success(`${arps.length} Atas encontradas!`);
                setResults(arps);
                setSearchedUasg(values.uasg);
                setSearchedOmName(arps[0]?.omNome || `UASG ${values.uasg}`);
            }
        } catch (error: any) {
            console.error("Erro na busca PNCP por UASG:", error);
            toast.error(error.message || "Falha ao buscar ARPs. Verifique a UASG.");
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                    <FormField
                        control={form.control}
                        name="uasg"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Código da UASG (Unidade Gestora) *</FormLabel>
                                <div className="flex gap-2">
                                    <FormControl>
                                        <Input
                                            {...field}
                                            onChange={handleUasgChange}
                                            placeholder="Ex: 160397"
                                            maxLength={6}
                                            disabled={isSearching}
                                        />
                                    </FormControl>
                                    <Button type="submit" disabled={isSearching}>
                                        {isSearching ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Search className="h-4 w-4" />
                                        )}
                                        <span className="ml-2 hidden md:inline">Buscar ARPs</span>
                                    </Button>
                                </div>
                                <FormMessage />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Busque por Atas de Registro de Preços (ARP) vigentes de uma OM específica.
                                </p>
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
                    searchedOmName={searchedOmName}
                    selectedItemIds={selectedItemIds}
                />
            )}
        </div>
    );
};

export default ArpUasgSearchForm;