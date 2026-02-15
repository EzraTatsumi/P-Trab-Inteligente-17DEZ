"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Pencil, 
    Save, 
    Loader2, 
    Package, 
    Calculator,
    FileText,
    AlertCircle,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from '@/components/SessionContextProvider';
import { formatCurrency, formatCodug, formatPregao } from '@/lib/formatUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MaterialPermanenteItemSelectorDialog from '@/components/MaterialPermanenteItemSelectorDialog';
import { ItemAquisicaoMaterial } from '@/types/diretrizesMaterialPermanente';
import PageMetadata from "@/components/PageMetadata";

const formSchema = z.object({
    organizacao: z.string().min(1, "Organização é obrigatória"),
    ug: z.string().min(1, "UG é obrigatória"),
    fase_atividade: z.string().optional(),
    categoria: z.string().min(1, "Categoria é obrigatória"),
    detalhamento_customizado: z.string().optional(),
});

const MaterialPermanenteFormPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const { user } = useSession();
    const queryClient = useQueryClient();

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoMaterial[]>([]);
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});

    // 1. Buscar dados do PTrab
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery({
        queryKey: ['ptrab', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase.from('p_trab').select('*').eq('id', ptrabId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!ptrabId
    });

    // 2. Buscar registros existentes
    const { data: registros, isLoading: isLoadingRegistros } = useQuery({
        queryKey: ['materialPermanenteRegistros', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('material_permanente_registros')
                .select('*')
                .eq('p_trab_id', ptrabId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!ptrabId
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            organizacao: '',
            ug: '',
            fase_atividade: '',
            categoria: 'Material Permanente',
            detalhamento_customizado: '',
        },
    });

    const handleOpenForm = (record: any = null) => {
        if (record) {
            setEditingRecord(record);
            form.reset({
                organizacao: record.organizacao,
                ug: record.ug,
                fase_atividade: record.fase_atividade || '',
                categoria: record.categoria,
                detalhamento_customizado: record.detalhamento_customizado || '',
            });
            const items = record.detalhes_planejamento?.items || [];
            setSelectedItems(items);
            const quantities: Record<string, number> = {};
            items.forEach((item: any) => {
                quantities[item.id] = item.quantidade || 1;
            });
            setItemQuantities(quantities);
        } else {
            setEditingRecord(null);
            form.reset({
                organizacao: ptrabData?.nome_om || '',
                ug: ptrabData?.codug_om || '',
                fase_atividade: '',
                categoria: 'Material Permanente',
                detalhamento_customizado: '',
            });
            setSelectedItems([]);
            setItemQuantities({});
        }
        setIsFormOpen(true);
    };

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

    const calculateCurrentTotal = () => {
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

        const total = calculateCurrentTotal();
        const payload = {
            p_trab_id: ptrabId,
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
            const { error } = editingRecord 
                ? await supabase.from('material_permanente_registros').update(payload).eq('id', editingRecord.id)
                : await supabase.from('material_permanente_registros').insert([payload]);

            if (error) throw error;
            toast.success(editingRecord ? "Registro atualizado!" : "Registro criado!");
            setIsFormOpen(false);
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        } catch (error: any) {
            toast.error("Erro ao salvar: " + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este registro?")) return;
        try {
            const { error } = await supabase.from('material_permanente_registros').delete().eq('id', id);
            if (error) throw error;
            toast.success("Registro excluído!");
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        } catch (error: any) {
            toast.error("Erro ao excluir: " + error.message);
        }
    };

    if (isLoadingPTrab || isLoadingRegistros) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata 
                title="Material Permanente - GND 4" 
                description="Gerenciamento de aquisições de material permanente para o Plano de Trabalho."
            />

            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold">Material Permanente (GND 4)</h1>
                        <p className="text-muted-foreground text-sm">{ptrabData?.numero_ptrab} - {ptrabData?.nome_operacao}</p>
                    </div>
                </div>

                {!isFormOpen ? (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Registros de Aquisição</CardTitle>
                                    <CardDescription>Lista de materiais permanentes planejados para esta operação.</CardDescription>
                                </div>
                                <Button onClick={() => handleOpenForm()}>
                                    <Plus className="mr-2 h-4 w-4" /> Novo Registro
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {registros && registros.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Organização / UG</TableHead>
                                                <TableHead>Itens</TableHead>
                                                <TableHead className="text-right">Valor Total</TableHead>
                                                <TableHead className="text-center">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {registros.map((reg: any) => (
                                                <TableRow key={reg.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{reg.organizacao}</div>
                                                        <div className="text-xs text-muted-foreground">UG: {formatCodug(reg.ug)}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            {reg.detalhes_planejamento?.items?.length || 0} item(ns) selecionado(s)
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {formatCurrency(reg.valor_total)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenForm(reg)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(reg.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-medium">Nenhum registro encontrado</h3>
                                        <p className="text-muted-foreground">Clique em "Novo Registro" para começar.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-primary" />
                                            {editingRecord ? "Editar Registro" : "Novo Registro de Material Permanente"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="organizacao"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Organização Solicitante</FormLabel>
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
                                        <FormField
                                            control={form.control}
                                            name="fase_atividade"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Fase/Atividade</FormLabel>
                                                    <FormControl><Input placeholder="Ex: Preparação" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="flex items-center gap-2">
                                            <Calculator className="h-5 w-5 text-primary" />
                                            Itens da Aquisição
                                        </CardTitle>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)}>
                                            <Plus className="h-4 w-4 mr-2" /> Selecionar do Catálogo
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        {selectedItems.length === 0 ? (
                                            <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                                                Selecione os itens que deseja adquirir para esta organização.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Material</TableHead>
                                                            <TableHead className="w-32 text-center">Quantidade</TableHead>
                                                            <TableHead className="text-right">Unitário</TableHead>
                                                            <TableHead className="text-right">Total</TableHead>
                                                            <TableHead className="w-10"></TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {selectedItems.map(item => (
                                                            <TableRow key={item.id}>
                                                                <TableCell>
                                                                    <div className="font-medium text-sm">{item.descricao_reduzida || item.descricao_item}</div>
                                                                    <div className="text-xs text-muted-foreground">CATMAT: {item.codigo_catmat} | Pregão: {formatPregao(item.numero_pregao)}</div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input 
                                                                        type="number" 
                                                                        min="1" 
                                                                        value={itemQuantities[item.id] || ''} 
                                                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                        className="h-8 text-center"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right text-sm">
                                                                    {formatCurrency(item.valor_unitario)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-sm">
                                                                    {formatCurrency(item.valor_unitario * (itemQuantities[item.id] || 0))}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                <div className="flex justify-end items-center gap-4 pt-4 border-t">
                                                    <span className="text-sm text-muted-foreground uppercase font-bold">Total do Registro (ND 52):</span>
                                                    <span className="text-2xl font-black text-primary">{formatCurrency(calculateCurrentTotal())}</span>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                <div className="flex justify-end gap-3">
                                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                                    <Button type="submit" className="px-8">
                                        <Save className="mr-2 h-4 w-4" /> {editingRecord ? "Salvar Alterações" : "Salvar Registro"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                )}
            </div>

            <MaterialPermanenteItemSelectorDialog 
                open={isSelectorOpen}
                onOpenChange={setIsSelectorOpen}
                selectedYear={new Date(ptrabData?.periodo_inicio || new Date()).getFullYear()}
                initialItems={selectedItems}
                onSelect={setSelectedItems}
                onAddDiretriz={() => navigate('/config/custos-operacionais', { state: { openMaterialPermanente: true } })}
                categoria="Material Permanente"
            />
        </div>
    );
};

export default MaterialPermanenteFormPage;