import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from '@/components/SessionContextProvider';
import { formatCurrency } from '@/lib/formatUtils';
import MaterialPermanenteItemSelectorDialog from './MaterialPermanenteItemSelectorDialog';
import { ItemAquisicaoPermanente } from '@/types/diretrizesMaterialPermanente';

const formSchema = z.object({
    organizacao: z.string().min(1, "Organização é obrigatória"),
    ug: z.string().min(1, "UG é obrigatória"),
    fase_atividade: z.string().optional(),
    categoria: z.string().min(1, "Categoria é obrigatória"),
    detalhamento_customizado: z.string().optional(),
});

interface MaterialPermanenteFormProps {
    pTrabId: string;
    selectedYear: number;
    onSuccess?: () => void;
    initialData?: any;
}

const MaterialPermanenteForm: React.FC<MaterialPermanenteFormProps> = ({
    pTrabId,
    selectedYear,
    onSuccess,
    initialData
}) => {
    const { user } = useSession();
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoPermanente[]>([]);
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            organizacao: initialData?.organizacao || '',
            ug: initialData?.ug || '',
            fase_atividade: initialData?.fase_atividade || '',
            categoria: initialData?.categoria || 'Material Permanente',
            detalhamento_customizado: initialData?.detalhamento_customizado || '',
        },
    });

    useEffect(() => {
        if (initialData?.detalhes_planejamento?.items) {
            setSelectedItems(initialData.detalhes_planejamento.items);
            const quantities: Record<string, number> = {};
            initialData.detalhes_planejamento.items.forEach((item: any) => {
                quantities[item.id] = item.quantidade || 1;
            });
            setItemQuantities(quantities);
        }
    }, [initialData]);

    const handleQuantityChange = (id: string, value: string) => {
        const qty = parseInt(value) || 0;
        setItemQuantities(prev => ({ ...prev, [id]: qty }));
    };

    const handleRemoveItem = (id: string) => {
        setSelectedItems(prev => prev.filter(item => item.id !== id));
        setItemQuantities(prev => {
            const newQty = { ...prev };
            delete newQty[id];
            return newQty;
        });
    };

    const calculateTotal = () => {
        return selectedItems.reduce((acc, item) => {
            const qty = itemQuantities[item.id] || 0;
            return acc + (item.valor_unitario * qty);
        }, 0);
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (selectedItems.length === 0) {
            toast.error("Selecione ao menos um item para aquisição");
            return;
        }

        const total = calculateTotal();
        const payload = {
            p_trab_id: pTrabId,
            ...values,
            detalhes_planejamento: {
                items: selectedItems.map(item => ({
                    ...item,
                    quantidade: itemQuantities[item.id] || 1
                }))
            },
            valor_total: total,
            valor_nd_52: total,
        };

        try {
            const { error } = initialData?.id 
                ? await (supabase.from('material_permanente_registros' as any).update(payload).eq('id', initialData.id))
                : await (supabase.from('material_permanente_registros' as any).insert([payload]));

            if (error) throw error;
            toast.success("Registro de Material Permanente salvo com sucesso!");
            onSuccess?.();
        } catch (error: any) {
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                Dados da Aquisição
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="organizacao"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Organização</FormLabel>
                                        <FormControl><Input placeholder="Ex: 1º Batalhão" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ug"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>UG</FormLabel>
                                        <FormControl><Input placeholder="Ex: 160001" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-primary" />
                                Itens Planejados
                            </CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> Selecionar Itens
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {selectedItems.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                                    Nenhum item selecionado. Clique em "Selecionar Itens" para começar.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedItems.map(item => (
                                        <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                                            <div className="flex-1 min-w-0 mr-4">
                                                <p className="font-medium text-sm truncate">{item.descricao_reduzida}</p>
                                                <p className="text-xs text-muted-foreground">CATMAT: {item.codigo_catmat} | Unit: {formatCurrency(item.valor_unitario)}</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-24">
                                                    <Input 
                                                        type="number" 
                                                        min="1" 
                                                        value={itemQuantities[item.id] || ''} 
                                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div className="text-right w-28">
                                                    <p className="text-sm font-bold">{formatCurrency(item.valor_unitario * (itemQuantities[item.id] || 0))}</p>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="pt-4 border-t flex justify-between items-center">
                                        <span className="font-semibold">Total Geral (ND 52):</span>
                                        <span className="text-xl font-bold text-primary">{formatCurrency(calculateTotal())}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Button type="submit" className="w-full md:w-auto">Salvar Registro</Button>
                    </div>
                </form>
            </Form>

            <MaterialPermanenteItemSelectorDialog 
                open={isSelectorOpen}
                onOpenChange={setIsSelectorOpen}
                selectedYear={selectedYear}
                initialItems={selectedItems}
                onSelect={(items) => setSelectedItems(items as ItemAquisicaoPermanente[])}
                onAddDiretriz={() => {}}
                categoria="Material Permanente"
            />
        </div>
    );
};

export default MaterialPermanenteForm;