import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug } from '@/lib/formatUtils';
import { OmSelector, OMData } from '@/components/OmSelector'; // Importa OmSelector e OMData

// 1. Esquema de Validação
const formSchema = z.object({
    uasg: z.string()
        .min(6, { message: "Selecione uma OM válida (UASG deve ter 6 dígitos)." })
        .max(6, { message: "Selecione uma OM válida (UASG deve ter 6 dígitos)." })
        .regex(/^\d{6}$/, { message: "Selecione uma OM válida (UASG deve conter apenas números)." }),
    dataInicio: z.string().min(1, { message: "Data de Início é obrigatória." }),
    dataFim: z.string().min(1, { message: "Data de Fim é obrigatória." }),
}).refine(data => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type ArpUasgFormValues = z.infer<typeof formSchema>;

interface ArpUasgSearchFormProps {
    onSelect: (item: ItemAquisicao) => void;
}

const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onSelect }) => {
    const [isSearching, setIsSearching] = useState(false);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
            dataInicio: "",
            dataFim: "",
        },
    });
    
    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        toast.info(`Buscando ARPs para UASG ${formatCodug(values.uasg)}...`);
        
        // TODO: Implementar a chamada à Edge Function aqui
        
        // Placeholder de simulação de busca
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast.warning("A busca PNCP ainda não está conectada à API real.");
        setIsSearching(false);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Campo UASG (Substituído pelo OmSelector) */}
                    <div className="space-y-2 col-span-3">
                        <FormLabel>UASG (Unidade Gestora) *</FormLabel>
                        <Controller
                            name="uasg"
                            control={form.control}
                            render={({ field }) => (
                                <OmSelector
                                    // O valor inicial é o CODUG/UASG atual do campo
                                    initialOmCodug={field.value} 
                                    onChange={(omData: OMData | undefined) => {
                                        // Quando uma OM é selecionada, atualiza o valor do campo 'uasg' com o CODUG
                                        field.onChange(omData?.codug_om || ''); 
                                    }}
                                    placeholder="Buscar OM pela sigla ou nome..."
                                    disabled={isSearching}
                                />
                            )}
                        />
                        <FormMessage>{form.formState.errors.uasg?.message}</FormMessage>
                        <p className="text-xs text-muted-foreground">
                            Selecione a OM para preencher a UASG (CODUG) automaticamente.
                        </p>
                    </div>
                    
                    {/* Campo Data de Início */}
                    <FormField
                        control={form.control}
                        name="dataInicio"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data de Início *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        {...field}
                                        disabled={isSearching}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    {/* Campo Data de Fim */}
                    <FormField
                        control={form.control}
                        name="dataFim"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Data de Fim *</FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        {...field}
                                        disabled={isSearching}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                <Button type="submit" disabled={isSearching}>
                    {isSearching ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Buscando ARPs...
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