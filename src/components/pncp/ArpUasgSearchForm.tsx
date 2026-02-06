import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug } from '@/lib/formatUtils';
import OmSelectorDialog from '@/components/OmSelectorDialog'; // Importa o novo diálogo

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
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false); // Novo estado para o diálogo

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
            dataInicio: "",
            dataFim: "",
        },
    });
    
    // Função para formatar a UASG no input (XXX.XXX) e garantir apenas 6 dígitos
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        // Limita a 6 dígitos
        const limitedValue = rawValue.slice(0, 6); 
        form.setValue('uasg', limitedValue, { shouldValidate: true });
    };
    
    // Função para importar a UASG selecionada do diálogo
    const handleOmSelect = (uasg: string) => {
        form.setValue('uasg', uasg, { shouldValidate: true });
    };

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
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Campo UASG (Revertido para Input + Botão) */}
                        <FormField
                            control={form.control}
                            name="uasg"
                            render={({ field }) => (
                                <FormItem className="col-span-3">
                                    <FormLabel>UASG (Unidade Gestora) *</FormLabel>
                                    <div className="flex gap-2">
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
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => setIsOmSelectorOpen(true)}
                                            disabled={isSearching}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground">
                                        Insira o CODUG da OM ou use o botão para selecionar no catálogo.
                                    </p>
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
            
            {/* Diálogo de Seleção de OM */}
            <OmSelectorDialog
                open={isOmSelectorOpen}
                onOpenChange={setIsOmSelectorOpen}
                onSelect={handleOmSelect}
            />
        </>
    );
};

export default ArpUasgSearchForm;