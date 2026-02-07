import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from 'date-fns';
import { fetchArpItemsByCatmat, fetchCatmatFullDescription } from '@/integrations/supabase/api';
import { DetailedArpItem } from '@/types/pncp';
import ArpSearchResultsList from './ArpSearchResultsList';
import { capitalizeFirstLetter } from '@/lib/formatUtils';

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


const ArpCatmatSearchForm: React.FC<ArpCatmatSearchFormProps> = ({ onItemPreSelect, selectedItemIds, onClearSelection, scrollContainerRef }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [isCatmatCatalogOpen, setIsCatmatCatalogOpen] = useState(false); // Para futuro catálogo local
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
    
    // 4. Agrupamento dos resultados por Pregão (para reutilizar ArpSearchResultsList)
    const groupedResults = useMemo(() => {
        const groupsMap = new Map<string, DetailedArpItem[]>();

        arpResults.forEach(item => {
            // A chave de agrupamento é o pregaoFormatado
            const pregaoKey = item.pregaoFormatado;
            
            if (!groupsMap.has(pregaoKey)) {
                groupsMap.set(pregaoKey, []);
            }
            groupsMap.get(pregaoKey)!.push(item);
        });

        // Mapeia os grupos para o formato esperado pelo ArpSearchResultsList
        // Nota: O ArpSearchResultsList espera ArpItemResult[], mas vamos passar DetailedArpItem[]
        // e adaptar o componente para lidar com isso no próximo passo.
        return Array.from(groupsMap.entries()).map(([pregao, items]) => {
            // Usamos o primeiro item do grupo para obter os metadados do Pregão/OM
            const representativeItem = items[0]; 
            
            // Mapeamos para o tipo ArpItemResult (que é o que o ArpSearchResultsList espera)
            // Isso é um hack temporário, mas necessário para reutilizar o componente.
            // A solução ideal seria refatorar ArpSearchResultsList para aceitar DetailedArpItem[]
            // e agrupar internamente, mas vamos manter a estrutura atual por enquanto.
            
            // CORREÇÃO: Vamos criar um tipo intermediário que simula o ArpItemResult
            // para que o ArpSearchResultsList possa agrupar.
            return {
                id: representativeItem.numeroControlePncpAta, // ID da ARP
                numeroAta: representativeItem.numeroAta,
                objeto: representativeItem.descricaoItem, // Usamos a descrição do item como objeto representativo
                uasg: representativeItem.uasg,
                omNome: representativeItem.nomeUnidadeGerenciadora || `UASG ${representativeItem.uasg}`, 
                dataVigenciaInicial: representativeItem.dataVigenciaInicial,
                dataVigenciaFinal: representativeItem.dataVigenciaFinal,
                valorTotalEstimado: 0, // Não é relevante aqui
                quantidadeItens: items.length,
                pregaoFormatado: pregao,
                numeroControlePncpAta: representativeItem.numeroControlePncpAta,
            } as any; // Cast temporário
        });
    }, [arpResults]);
    
    // 5. Renderização dos resultados (Reutilizando ArpSearchResultsList)
    // NOTA: O ArpSearchResultsList foi projetado para agrupar ARPs por Pregão.
    // Aqui, a API já retorna itens detalhados, então precisamos simular o agrupamento
    // para que o ArpSearchResultsList funcione como um acordeão de Pregões.
    
    // Vamos criar um novo componente de lista de resultados para CATMAT para simplificar o agrupamento.
    // No entanto, para cumprir o requisito de "aproveitar ao máximo", vamos adaptar o ArpSearchResultsList.
    
    // O ArpSearchResultsList espera ArpItemResult[] e agrupa por pregaoFormatado.
    // A API de CATMAT retorna DetailedArpRawResult[], que contém todos os dados necessários.
    
    // Vamos criar um novo componente de lista de resultados para CATMAT para simplificar o agrupamento.
    
    // NOVO: Componente de lista de resultados para CATMAT
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
                                                {isGroupOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
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
                                            onClick={() => setIsCatmatCatalogOpen(true)}
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

            {/* Diálogo de Catálogo CATMAT (Para futura implementação) */}
            {/* <CatmatCatalogDialog
                open={isCatmatCatalogOpen}
                onOpenChange={setIsCatmatCatalogOpen}
                onSelect={(item) => {
                    form.setValue('codigoItem', item.code);
                    setSearchedItemDescription(item.description);
                }}
            /> */}
        </>
    );
};

export default ArpCatmatSearchForm;