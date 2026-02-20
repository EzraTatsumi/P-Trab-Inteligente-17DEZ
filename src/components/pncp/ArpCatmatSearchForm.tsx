import React, { useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchArpItemsByCatmat } from '@/integrations/supabase/api';
import { DetailedArpItem, ArpItemResult } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import CatmatCatalogDialog from '../CatmatCatalogDialog';
import CatserCatalogDialog from '../CatserCatalogDialog';

// 1. Esquema de Validação
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código do Item é obrigatório." })
        .regex(/^\d{1,9}$/, { message: "O código deve conter apenas números (máx. 9 dígitos)." }),
    dataInicio: z.string().min(1, { message: "Data de Início é obrigatória." }),
    dataFim: z.string().min(1, { message: "Data de Fim é obrigatória." }),
}).refine(data => new Date(data.dataFim) >= new Date(data.dataInicio), {
    message: "A Data de Fim deve ser posterior ou igual à Data de Início.",
    path: ["dataFim"],
});

type ArpCatmatFormValues = z.infer<typeof formSchema>;

interface ArpCatmatSearchFormProps {
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    selectedItemIds: string[];
    onClearSelection: () => void;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    mode?: 'material' | 'servico';
}

// Calcula as datas padrão
const today = new Date();
const oneYearAgo = subDays(today, 365);

const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const ArpCatmatSearchForm: React.FC<ArpCatmatSearchFormProps> = ({ 
    onItemPreSelect, 
    selectedItemIds, 
    onClearSelection, 
    scrollContainerRef,
    mode = 'material'
}) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    // Armazena os itens detalhados (DetailedArpItem)
    const [detailedItems, setDetailedItems] = useState<DetailedArpItem[]>([]); 
    
    // REF para o container de resultados
    const resultsRef = useRef<HTMLDivElement>(null);

    const form = useForm<ArpCatmatFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            codigoItem: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });
    
    const handleCatmatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 9); 
        form.setValue('codigoItem', limitedValue, { shouldValidate: true });
    };
    
    const handleCatalogSelect = (item: { code: string, description: string, short_description: string | null }) => {
        form.setValue('codigoItem', item.code, { shouldValidate: true });
        setIsCatalogOpen(false);
    };

    const onSubmit = async (values: ArpCatmatFormValues) => {
        setIsSearching(true);
        setDetailedItems([]);
        onClearSelection(); 
        
        try {
            toast.info(`Buscando itens de ARP para o item ${values.codigoItem}...`);
            
            const params = {
                codigoItem: values.codigoItem,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim,
            };
            
            const results = await fetchArpItemsByCatmat(params);
            
            if (results.length === 0) {
                toast.warning("Nenhum item de Ata de Registro de Preços encontrado para os critérios informados.");
            } else {
                toast.success(`${results.length} itens encontrados!`);
            }
            
            setDetailedItems(results);
            
            // Rola para o topo dos resultados após a busca ser concluída
            if (results.length > 0 && resultsRef.current) {
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }, 100); 
            }

        } catch (error: any) {
            console.error("Erro na busca PNCP por código:", error);
            toast.error(error.message || "Falha ao buscar itens de ARP. Verifique os parâmetros.");
        } finally {
            setIsSearching(false);
        }
    };
    
    // Mapeia os DetailedArpItem para o formato ArpItemResult para usar o ArpSearchResultsList
    const mappedResults: ArpItemResult[] = useMemo(() => {
        if (detailedItems.length === 0) return [];
        
        // Agrupa os itens detalhados pelo número de controle da ARP
        const groups = detailedItems.reduce((acc, item) => {
            const key = item.numeroControlePncpAta;
            if (!acc[key]) {
                acc[key] = {
                    id: key,
                    numeroAta: item.numeroAta,
                    objeto: item.descricaoItem, // Usamos a descrição do item como objeto representativo
                    uasg: item.uasg,
                    omNome: item.omNome,
                    dataVigenciaInicial: item.dataVigenciaInicial,
                    dataVigenciaFinal: item.dataVigenciaFinal,
                    valorTotalEstimado: 0, // Não calculamos o total aqui
                    quantidadeItens: 0,
                    pregaoFormatado: item.pregaoFormatado,
                    numeroControlePncpAta: key,
                };
            }
            // Atualiza o objeto com a descrição mais longa (heurística)
            if (item.descricaoItem.length > acc[key].objeto.length) {
                acc[key].objeto = item.descricaoItem;
            }
            return acc;
        }, {} as Record<string, ArpItemResult>);
        
        return Object.values(groups);
    }, [detailedItems]);
    
    // Função para lidar com a seleção de itens detalhados (passada para ArpSearchResultsList)
    const handleItemPreSelectWrapper = (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => {
        onItemPreSelect(item, pregaoFormatado, uasg);
    };


    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-4 gap-4">
                        
                        <FormField
                            control={form.control}
                            name="codigoItem"
                            render={({ field }) => (
                                <FormItem className="col-span-4 md:col-span-2">
                                    <FormLabel>{mode === 'material' ? 'Cód. CATMAT *' : 'Cód. CATSER *'}</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={handleCatmatChange}
                                                value={field.value}
                                                placeholder="Ex: 604269"
                                                maxLength={9}
                                                disabled={isSearching}
                                            />
                                        </FormControl>
                                        <div className="flex flex-col gap-1">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => setIsCatalogOpen(true)}
                                                disabled={isSearching}
                                                className="h-8 px-2 text-[10px]"
                                            >
                                                <BookOpen className="h-3 w-3 mr-1" /> {mode === 'material' ? 'CATMAT' : 'CATSER'}
                                            </Button>
                                        </div>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código do item de {mode === 'material' ? 'material' : 'serviço'}.
                                    </p>
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="dataInicio"
                            render={({ field }) => (
                                <FormItem className="col-span-2 md:col-span-1">
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
                        
                        <FormField
                            control={form.control}
                            name="dataFim"
                            render={({ field }) => (
                                <FormItem className="col-span-2 md:col-span-1">
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
                    
                    <Button type="submit" disabled={isSearching} className="w-full">
                        {isSearching ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Buscando Itens de ARP...
                            </>
                        ) : (
                            <>
                                <Search className="h-4 w-4 mr-2" />
                                Buscar Itens de ARP por Cód. Item
                            </>
                        )}
                    </Button>
                </form>
            </Form>
            
            {/* Seção de Resultados */}
            {mappedResults.length > 0 && (
                <div ref={resultsRef}>
                    <ArpSearchResultsList 
                        results={mappedResults} 
                        onItemPreSelect={handleItemPreSelectWrapper} 
                        searchedUasg={''} 
                        searchedOmName={mode === 'material' ? `Item CATMAT ${form.getValues('codigoItem')}` : `Item CATSER ${form.getValues('codigoItem')}`}
                        selectedItemIds={selectedItemIds}
                    />
                </div>
            )}

            {mode === 'material' ? (
                <CatmatCatalogDialog
                    open={isCatalogOpen}
                    onOpenChange={setIsCatalogOpen}
                    onSelect={handleCatalogSelect}
                />
            ) : (
                <CatserCatalogDialog
                    open={isCatalogOpen}
                    onOpenChange={setIsCatalogOpen}
                    onSelect={handleCatalogSelect}
                />
            )}
        </>
    );
};

export default ArpCatmatSearchForm;