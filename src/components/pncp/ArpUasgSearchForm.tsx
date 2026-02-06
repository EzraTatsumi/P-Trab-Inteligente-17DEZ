import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
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

// 1. Esquema de Validação
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
    
    // Função para formatar a UASG no input (XXX.XXX)
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        form.setValue('uasg', rawValue, { shouldValidate: true });
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        toast.info(`Buscando ARPs para UASG ${formatCodug(values.uasg)}...`);
        
        // TODO: Implementar a chamada à Edge Function aqui
        
        // Placeholder de simulação de busca
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Simulação de sucesso (apenas para teste inicial)
        // const simulatedItem: ItemAquisicao = {
        //     id: Math.random().toString(36).substring(2, 9),
        //     descricao_item: "Simulação: Item de ARP encontrado",
        //     descricao_reduzida: "Simulação ARP",
        //     valor_unitario: 150.75,
        //     numero_pregao: "ARP-PNCP/2024",
        //     uasg: values.uasg,
        //     codigo_catmat: "99999999",
        // };
        // onSelect(simulatedItem);
        
        toast.warning("A busca PNCP ainda não está conectada à API real.");
        setIsSearching(false);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Campo UASG */}
                    <FormField
                        control={form.control}
                        name="uasg"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>UASG *</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        onChange={handleUasgChange}
                                        value={field.value}
                                        placeholder="Ex: 160001"
                                        maxLength={6}
                                        disabled={isSearching}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    
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