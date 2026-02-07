import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug } from '@/lib/formatUtils';
import OmSelectorDialog from '@/components/OmSelectorDialog';
import { format, subDays } from 'date-fns';
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult, DetailedArpItem } from '@/types/pncp'; // Importando o tipo DetailedArpItem
import ArpSearchResultsList from './ArpSearchResultsList';
import { OMData } from '@/lib/omUtils';

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
    // Função para alternar a seleção de um item detalhado
    onItemPreSelect: (item: DetailedArpItem, pregaoFormatado: string, uasg: string) => void;
    // NOVO: Função para limpar a seleção
    onClearSelection: () => void;
    // Array de IDs selecionados
    selectedItemIds: string[];
    // NOVO: Ref do container de rolagem (DialogContent)
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

// Calcula as datas padrão
const today = new Date();
const oneYearAgo = subDays(today, 365);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const ArpUasgSearchForm: React.FC<ArpUasgSearchFormProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false);
    const [arpResults, setArpResults] = useState<ArpItemResult[]>([]); // CORRIGIDO: Usando ArpItemResult
    
    // NOVO ESTADO: Armazena o nome da OM para o cabeçalho
    const [searchedOmName, setSearchedOmName] = useState<string>(""); 
    
    // REF para o container de resultados
    const resultsRef = useRef<HTMLDivElement>(null);

    const form = useForm<ArpUasgFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            uasg: "",
            dataInicio: defaultDataInicio,
            dataFim: defaultDataFim,
        },
    });
    
    const handleUasgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const limitedValue = rawValue.slice(0, 6); 
        form.setValue('uasg', limitedValue, { shouldValidate: true });
        // Limpa o nome da OM se o usuário digitar manualmente
        setSearchedOmName(""); 
    };
    
    const handleOmSelect = (omData: OMData) => {
        form.setValue('uasg', omData.codug_om, { shouldValidate: true });
        setSearchedOmName(omData.nome_om); // Salva o nome da OM
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        // CORREÇÃO: Limpa a seleção global chamando a função dedicada
        onClearSelection(); 
        
        try {
            toast.info(`Buscando ARPs para UASG ${formatCodug(values.uasg)}...`);
            
            // Se o nome da OM não foi preenchido via seletor, usa a UASG como fallback
            if (!searchedOmName) {
                setSearchedOmName(`UASG ${values.uasg}`);
            }
            
            const params = {
                codigoUnidadeGerenciadora: values.uasg,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim,
            };
            
            const results = await fetchArpsByUasg(params);
            
            if (results.length === 0) {
                toast.warning("Nenhuma Ata de Registro de Preços encontrada para os critérios informados.");
            } else {
                toast.success(`${results.length} ARPs encontradas!`);
            }
            
            setArpResults(results);
            
            // Rola para o topo dos resultados após a busca ser concluída
            if (results.length > 0 && resultsRef.current) {
                // Usamos setTimeout para garantir que o DOM foi renderizado após a atualização do estado
                setTimeout(() => {
                    // Usa scrollIntoView no elemento de resultados, que deve rolar o container pai (DialogContent)
                    resultsRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start' // Posiciona o topo do elemento no topo do container
                    });
                }, 100); 
            }

        } catch (error: any) {
            console.error("Erro na busca PNCP:", error);
            toast.error(error.message || "Falha ao buscar ARPs. Verifique os parâmetros.");
        } finally {
            setIsSearching(false);
        }
    };
    
    // Removido handleConfirmImport, pois a lógica de importação agora está no ArpSearchResultsList

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4">
                    <div className="grid grid-cols-4 gap-4">
                        
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
            
            {/* Seção de Resultados - Adicionando a ref para rolagem */}
            {arpResults.length > 0 && (
                <div ref={resultsRef}>
                    <ArpSearchResultsList 
                        results={arpResults} 
                        onItemPreSelect={onItemPreSelect} 
                        searchedUasg={form.getValues('uasg')}
                        searchedOmName={searchedOmName}
                        selectedItemIds={selectedItemIds}
                    />
                </div>
            )}

            <OmSelectorDialog
                open={isOmSelectorOpen}
                onOpenChange={setIsOmSelectorOpen}
                onSelect={handleOmSelect}
            />
        </>
    );
};

export default ArpUasgSearchForm;