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
import OmSelectorDialog from '@/components/OmSelectorDialog';
import { format, subDays } from 'date-fns'; // Importa as funções de data

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

// Calcula as datas padrão
const today = new Date();
const oneYearAgo = subDays(today, 365);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onSelect }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false); // Novo estado para o diálogo

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
            dataInicio: defaultDataInicio, // Define a data de início padrão
            dataFim: defaultDataFim,       // Define a data de fim padrão
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
                    {/* Grid principal com 4 colunas. Removido items-end para alinhar ao topo. */}
                    <div className="grid grid-cols-4 gap-4">
                        
                        {/* Campo UASG + Botão (Ocupa 2 colunas) */}
                        <FormField
                            control={form.control}
                            name="uasg"
                            render={({ field }) => (
                                <FormItem className="col-span-2">
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
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o CODUG da OM ou use o botão para selecionar no catálogo.
                                    </p>
                                </FormItem>
                            )}
                        />
                        
                        {/* Campo Data de Início (Ocupa 1 coluna) */}
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
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
                        
                        {/* Campo Data de Fim (Ocupa 1 coluna) */}
                        <FormField
                            control={form.control}
                            name="dataFim"
                            render={({ field }) => (
                                <FormItem className="col-span-1">
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
                    
                    {/* Botão de Busca (Ocupa a largura total) */}
                    <Button type="submit" disabled={isSearching} className="w-full">
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