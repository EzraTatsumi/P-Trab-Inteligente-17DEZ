import React, { useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchArpItemsByCatmat, fetchCatmatFullDescription } from '@/integrations/supabase/api';
import { DetailedArpItem } from '@/types/pncp';
import { capitalizeFirstLetter, formatCodug, formatPregao, formatDate, formatCurrency } from '@/lib/formatUtils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import CatmatCatalogDialog from '../CatmatCatalogDialog'; // NOVO: Importar o diálogo

// 1. Esquema de Validação
const formSchema = z.object({
    codigoItem: z.string()
        .min(1, { message: "O Código CATMAT/CATSER é obrigatório." })
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
    onClearSelection: () => void;
    selectedItemIds: string[];
    scrollContainerRef: React.RefObject<HTMLDivElement>;
}

// Calcula as datas padrão
const today = new Date();
const oneYearAgo = subDays(today, 365);

// Formata as datas para o formato 'YYYY-MM-DD' exigido pelo input type="date"
const defaultDataFim = format(today, 'yyyy-MM-dd');
const defaultDataInicio = format(oneYearAgo, 'yyyy-MM-dd');


const ArpCatmatSearchForm: React.FC<ArpCatmatFormProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false); // Estado para o diálogo
    const [arpResults, setArpResults] = useState<DetailedArpItem[]>([]); 
    
    // NOVO ESTADO: Armazena a descrição do item para o cabeçalho
    const [searchedItemDescription, setSearchedItemDescription] = useState<string>(""); 
    
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
        setSearchedItemDescription(""); 
    };
    
    const onSubmit = async (values: ArpCatmatFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        onClearSelection(); 
        
        const catmatCode = values.codigoItem;
        
        try {
            toast.info(`Buscando ARPs para CATMAT ${catmatCode}...`);
            
            // 1. Busca a descrição completa do item no PNCP para usar no cabeçalho
            const pncpDetails = await fetchCatmatFullDescription(catmatCode);
            const description = pncpDetails.fullDescription || `Cód. ${catmatCode}`;
            setSearchedItemDescription(description);
            
            const params = {
                codigoItem: catmatCode,
                dataVigenciaInicialMin: values.dataInicio,
                dataVigenciaInicialMax: values.dataFim,
            };
            
            // 2. Busca os itens ARP
            const results = await fetchArpItemsByCatmat(params);
            
            if (results.length === 0) {
                toast.warning("Nenhuma Ata de Registro de Preços encontrada para os critérios informados.");
            } else {
                toast.success(`${results.length} itens de ARP encontrados!`);
            }
            
            setArpResults(results);
            
            // 3. Rola para o topo dos resultados
            if (results.length > 0 && resultsRef.current) {
                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start' 
                    });
                }, 100); 
            }

        } catch (error: any) {
            console.error("Erro na busca PNCP por CATMAT:", error);
            toast.error(error.message || "Falha ao buscar ARPs. Verifique os parâmetros.");
        } finally {
            setIsSearching(false);
        }
    };
    
    // Função para receber dados do catálogo CATMAT e atualizar o formulário
    const handleCatmatSelect = (catmatItem: { code: string, description: string, short_description: string | null }) => {
        form.setValue('codigoItem', catmatItem.code, { shouldValidate: true });
        setSearchedItemDescription(catmatItem.description);
        setIsCatmatCatalogOpen(false);
    };
    
    // 5. Renderização dos resultados (Componente interno para CATMAT)
    const CatmatSearchResultsList = ({ results, searchedDescription, searchedCode }: { results: DetailedArpItem[], searchedDescription: string, searchedCode: string }) => {
        
        // Agrupamento por Pregão
        const groupedByPregao = useMemo(() => {
            const groupsMap = new Map<string, DetailedArpItem[]>();
            results.forEach(item => {
                const pregaoKey = item.pregaoFormatado;
                if (!groupsMap.has(pregaoKey)) {
                    groupsMap.set(pregaoKey, []);
                }
                groupsMap.get(pregaoKey)!.push(item);
            });
            return Array.from(groupsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        }, [results]);
        
        const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
        const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
        
        const handleToggleGroup = (pregaoKey: string) => {
            const isCurrentlyOpen = openGroups[pregaoKey];
            
            if (isCurrentlyOpen) {
                setOpenGroups({});
            } else {
                setOpenGroups({ [pregaoKey]: true });
                setTimeout(() => {
                    const rowElement = rowRefs.current[pregaoKey];
                    if (rowElement) {
                        rowElement.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                        });
                    }
                }, 100); 
            }
        };
        
        // Componente interno para renderizar os itens detalhados (reutilizando a lógica do DetailedArpItems)
        const DetailedCatmatItems = ({ items, pregaoFormatado }: { items: DetailedArpItem[], pregaoFormatado: string }) => {
            
            const handlePreSelectDetailedItem = (item: DetailedArpItem) => {
                // Chama a função de alternância no componente pai
                onItemPreSelect(item, pregaoFormatado, item.uasg);
            };
            
            return (
                <div className="p-4 bg-muted/50 border-t border-border space-y-3">
                    <Table className="bg-background border rounded-md overflow-hidden">
                        <thead>
                            <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                <th className="px-4 py-2 text-left font-normal w-[10%]">ARP</th>
                                <th className="px-4 py-2 text-left font-normal w-[15%]">UASG</th>
                                <th className="px-4 py-2 text-left font-normal w-[45%]">Descrição Item</th>
                                <th className="px-4 py-2 text-center font-normal w-[15%]">Qtd. Homologada</th>
                                <th className="px-4 py-2 text-right font-normal w-[15%]">Valor Unitário</th>
                            </TableRow>
                        </thead>
                        <TableBody>
                            {items.map(item => {
                                const isSelected = selectedItemIds.includes(item.id);
                                return (
                                    <TableRow 
                                        key={item.id}
                                        className={`cursor-pointer transition-colors ${isSelected ? "bg-green-100/50 hover:bg-green-100/70" : "hover:bg-muted/50"}`}
                                        onClick={() => handlePreSelectDetailedItem(item)}
                                    >
                                        <TableCell className="text-xs font-medium py-2">{item.numeroAta}</TableCell>
                                        <TableCell className="text-xs font-medium py-2">{item.uasg}</TableCell>
                                        <TableCell className="text-[0.7rem] max-w-lg whitespace-normal py-2">
                                            {capitalizeFirstLetter(item.descricaoItem)}
                                        </TableCell>
                                        <TableCell className="text-center text-xs py-2">
                                            {item.quantidadeHomologada.toLocaleString('pt-BR')}
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-bold text-primary py-2">
                                            {formatCurrency(item.valorUnitario)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            );
        };
        
        return (
            <div className="p-4 space-y-4">
                {/* CABEÇALHO DA PESQUISA */}
                <div ref={resultsRef}>
                    <h3 className="text-lg font-semibold flex flex-col">
                        <span>
                            Resultado para {capitalizeFirstLetter(searchedDescription)} ({searchedCode})
                        </span>
                        <span className="text-sm font-normal text-muted-foreground mt-1">
                            {groupedByPregao.length} Pregões encontrados ({results.length} itens de ARP)
                        </span>
                    </h3>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background z-10">
                            <TableRow>
                                <TableHead className="w-[150px]">Pregão</TableHead>
                                <TableHead className="w-[250px]">OM Gerenciadora</TableHead>
                                <TableHead className="w-[250px] text-center">Vigência</TableHead>
                                <TableHead className="w-[50px]"></TableHead> 
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {groupedByPregao.map(([pregaoKey, items]) => {
                                const isGroupOpen = openGroups[pregaoKey];
                                const representativeItem = items[0];
                                
                                const displayPregao = pregaoKey === 'N/A' 
                                    ? <span className="text-red-500 font-bold">DADOS INCOMPLETOS</span> 
                                    : formatPregao(pregaoKey); 
                                    
                                return (
                                    <React.Fragment key={pregaoKey}>
                                        <TableRow 
                                            ref={el => rowRefs.current[pregaoKey] = el}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => handleToggleGroup(pregaoKey)}
                                        >
                                            <TableCell className="font-semibold">
                                                {displayPregao}
                                            </TableCell>
                                            <TableCell className="text-sm max-w-xs whitespace-normal">
                                                {representativeItem.nomeUnidadeGerenciadora} ({formatCodug(representativeItem.uasg)})
                                            </TableCell>
                                            <TableCell className="text-center text-sm whitespace-nowrap">
                                                {formatDate(representativeItem.dataVigenciaInicial)} - {formatDate(representativeItem.dataVigenciaFinal)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-4 w-4" />}
                                            </TableCell>
                                        </TableRow>
                                        
                                        <TableRow className="p-0">
                                            <TableCell colSpan={4} className="p-0">
                                                <Collapsible open={isGroupOpen}>
                                                    <CollapsibleContent>
                                                        <DetailedCatmatItems 
                                                            items={items}
                                                            pregaoFormatado={pregaoKey}
                                                        />
                                                    </CollapsibleContent>
                                                </Collapsible>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
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
                                <FormItem className="col-span-2">
                                    <FormLabel>Cód. CATMAT/CATSER *</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={handleCatmatChange}
                                                value={field.value}
                                                placeholder="Ex: 423465"
                                                maxLength={9}
                                                disabled={isSearching}
                                            />
                                        </FormControl>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="icon" 
                                            onClick={() => setIsCatmatCatalogOpen(true)} // ABRIR DIÁLOGO
                                            disabled={isSearching}
                                        >
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <FormMessage />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Insira o código do item de material ou serviço.
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
                                Buscar ARPs por CATMAT/CATSER
                            </>
                        )}
                    </Button>
                </form>
            </Form>
            
            {/* Seção de Resultados */}
            {arpResults.length > 0 && (
                <div ref={resultsRef}>
                    <CatmatSearchResultsList 
                        results={arpResults} 
                        searchedDescription={searchedItemDescription}
                        searchedCode={form.getValues('codigoItem')}
                    />
                </div>
            )}

            {/* Diálogo de Catálogo CATMAT */}
            <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={handleCatmatSelect}
            />
        </>
    );
};

export default ArpCatmatSearchForm;