import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Loader2, BookOpen, Check, Import } from "lucide-react";
import { toast } from "sonner";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCodug, formatCurrency, formatDate } from '@/lib/formatUtils';
import OmSelectorDialog from '@/components/OmSelectorDialog';
import { format, subDays } from 'date-fns';
import { fetchArpsByUasg } from '@/integrations/supabase/api';
import { ArpItemResult } from '@/types/pncp';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    const [isOmSelectorOpen, setIsOmSelectorOpen] = useState(false);
    const [arpResults, setArpResults] = useState<ArpItemResult[]>([]);
    const [selectedArp, setSelectedArp] = useState<ArpItemResult | null>(null);

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
    };
    
    const handleOmSelect = (uasg: string) => {
        form.setValue('uasg', uasg, { shouldValidate: true });
    };

    const onSubmit = async (values: ArpUasgFormValues) => {
        setIsSearching(true);
        setArpResults([]);
        setSelectedArp(null);
        
        try {
            toast.info(`Buscando ARPs para UASG ${formatCodug(values.uasg)}...`);
            
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

        } catch (error: any) {
            console.error("Erro na busca PNCP:", error);
            toast.error(error.message || "Falha ao buscar ARPs. Verifique os parâmetros.");
        } finally {
            setIsSearching(false);
        }
    };
    
    const handlePreSelect = (item: ArpItemResult) => {
        setSelectedArp(item.id === selectedArp?.id ? null : item);
    };
    
    const handleConfirmImport = () => {
        if (!selectedArp) {
            toast.error("Selecione uma ARP para importar.");
            return;
        }
        
        // Mapeamento do ArpItemResult para ItemAquisicao
        // Nota: A API do PNCP retorna dados da ATA, não do item individual. 
        // Usamos o valor total da ARP como valor unitário para fins de referência inicial.
        // O usuário deverá ajustar o valor unitário e a descrição do item individualmente.
        const itemAquisicao: ItemAquisicao = {
            id: selectedArp.id, // Usar ID da ARP como ID temporário
            descricao_item: `ARP ${selectedArp.numeroAta} - ${selectedArp.objeto}`,
            descricao_reduzida: `ARP ${selectedArp.numeroAta}`,
            valor_unitario: selectedArp.valorTotalEstimado / (selectedArp.quantidadeItens || 1), // Valor médio por item
            numero_pregao: selectedArp.numeroAta,
            uasg: selectedArp.uasg,
            codigo_catmat: 'PNCP_REF', // Placeholder, pois a ARP não fornece o CATMAT do item
        };
        
        onSelect(itemAquisicao);
    };

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
            
            {/* Seção de Resultados */}
            {arpResults.length > 0 && (
                <div className="p-4 space-y-4">
                    <h3 className="text-lg font-semibold">Resultados da Busca ({arpResults.length})</h3>
                    
                    <div className="max-h-[300px] overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[150px]">Nº Ata</TableHead>
                                    <TableHead>Objeto</TableHead>
                                    <TableHead className="w-[150px] text-right">Valor Total Estimado</TableHead>
                                    <TableHead className="w-[100px] text-center">Itens</TableHead>
                                    <TableHead className="w-[150px] text-center">Vigência</TableHead>
                                    <TableHead className="w-[100px] text-center">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {arpResults.map(arp => {
                                    const isSelected = selectedArp?.id === arp.id;
                                    return (
                                        <TableRow 
                                            key={arp.id} 
                                            className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"}`}
                                            onClick={() => handlePreSelect(arp)}
                                        >
                                            <TableCell className="font-semibold">{arp.numeroAta}</TableCell>
                                            <TableCell className="text-sm max-w-xs truncate">{arp.objeto}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(arp.valorTotalEstimado)}</TableCell>
                                            <TableCell className="text-center">{arp.quantidadeItens}</TableCell>
                                            <TableCell className="text-center text-xs">
                                                {formatDate(arp.dataVigenciaInicial)} - {formatDate(arp.dataVigenciaFinal)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant={isSelected ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation(); 
                                                        handlePreSelect(arp);
                                                    }}
                                                >
                                                    {isSelected ? <Check className="h-4 w-4" /> : <Import className="h-4 w-4" />}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    
                    <div className="flex justify-end">
                        <Button 
                            onClick={handleConfirmImport} 
                            disabled={!selectedArp}
                        >
                            <Import className="h-4 w-4 mr-2" />
                            Importar ARP Selecionada
                        </Button>
                    </div>
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