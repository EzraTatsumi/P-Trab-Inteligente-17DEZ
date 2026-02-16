"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
    ArrowLeft, Loader2, Plus, Trash2, Calculator, 
    Save, Info, Pencil, History, CheckCircle2, AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PageMetadata from "@/components/PageMetadata";
import { formatCurrency } from '@/lib/formatUtils';
import { useSession } from '@/components/SessionContextProvider';
import MaterialPermanenteItemSelectorDialog from '@/components/MaterialPermanenteItemSelectorDialog';
import MaterialPermanenteJustificativaDialog from '@/components/MaterialPermanenteJustificativaDialog';
import MaterialPermanenteBulkJustificativaDialog from '@/components/MaterialPermanenteBulkJustificativaDialog';
import { 
    ItemAquisicaoMaterial, 
    ConsolidatedPermanenteRecord 
} from '@/types/diretrizesMaterialPermanente';

const MaterialPermanenteFormPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const { user } = useSession();
    const queryClient = useQueryClient();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [organizacao, setOrganizacao] = useState("");
    const [ug, setUg] = useState("");
    const [faseAtividade, setFaseAtividade] = useState("");
    const [diasOperacao, setDiasOperacao] = useState(1);
    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoMaterial[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
    const [isBulkJustificativaOpen, setIsBulkJustificativaOpen] = useState(false);
    const [itemForJustificativa, setItemForJustificativa] = useState<ItemAquisicaoMaterial | null>(null);
    const [expandedJustifications, setExpandedJustifications] = useState<Record<string, boolean>>({});
    const [memoriaEdit, setMemoriaEdit] = useState("");

    const { data: ptrabData } = useQuery({
        queryKey: ['ptrab', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase.from('p_trab').select('*').eq('id', ptrabId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!ptrabId
    });

    useEffect(() => {
        if (ptrabData) {
            const start = new Date(ptrabData.periodo_inicio);
            const end = new Date(ptrabData.periodo_fim);
            const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
            setDiasOperacao(diff);
            setSelectedYear(start.getFullYear());
        }
    }, [ptrabData]);

    const { data: registros, isLoading } = useQuery({
        queryKey: ['materialPermanenteRegistros', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase.from('material_permanente_registros').select('*').eq('p_trab_id', ptrabId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!ptrabId
    });

    const consolidatedRegistros = useMemo<ConsolidatedPermanenteRecord[]>(() => {
        if (!registros) return [];
        const groups: Record<string, ConsolidatedPermanenteRecord> = {};
        
        registros.forEach((reg: any) => {
            const key = `${reg.organizacao}-${reg.ug}`;
            if (!groups[key]) {
                groups[key] = {
                    groupKey: key,
                    organizacao: reg.organizacao,
                    ug: reg.ug,
                    records: [],
                    totalGeral: 0
                };
            }
            groups[key].records.push(reg);
            groups[key].totalGeral += Number(reg.valor_total || 0);
        });

        return Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
    }, [registros]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (diasOperacao <= 0) { toast.warning("Informe o período da operação."); return; }
            const itemsWithoutJustification = selectedItems.filter(item => !item.justificativa || !Object.values(item.justificativa).some(v => v && v.toString().trim() !== ""));
            if (itemsWithoutJustification.length > 0) { toast.error("Todos os itens devem possuir uma justificativa preenchida."); return; }

            const payload = {
                p_trab_id: ptrabId,
                organizacao,
                ug,
                fase_atividade: faseAtividade,
                dias_operacao: diasOperacao,
                categoria: "Material Permanente",
                detalhes_planejamento: { items: selectedItems },
                valor_total: selectedItems.reduce((acc, i) => acc + (i.valor_unitario * (i.quantidade || 1)), 0),
                valor_nd_52: selectedItems.reduce((acc, i) => acc + (i.valor_unitario * (i.quantidade || 1)), 0),
            };

            const { error } = await supabase.from('material_permanente_registros').insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            toast.success("Registro salvo com sucesso!");
            setSelectedItems([]);
            setOrganizacao("");
            setUg("");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('material_permanente_registros').delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            toast.success("Registros excluídos.");
        }
    });

    const handleSaveJustificativa = (data: Record<string, any>) => {
        if (!itemForJustificativa) return;
        setSelectedItems(prev => prev.map(i => i.id === itemForJustificativa.id ? { ...i, justificativa: data } : i));
    };

    const handleSaveBulkJustificativas = (data: Record<string, any>) => {
        setSelectedItems(prev => prev.map(i => ({ ...i, justificativa: data })));
    };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('material_permanente_registros').update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        await supabase.from('material_permanente_registros').update({ detalhamento_customizado: null }).eq('id', id);
        toast.success("Memória restaurada.");
        queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata 
                title="Material Permanente" 
                description="Gerenciamento de aquisições de material permanente." 
                canonicalPath="/ptrab/material-permanente"
            />
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Novo Registro de Material Permanente</CardTitle>
                        <CardDescription>Selecione os itens e informe a organização responsável.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Organização</Label>
                                <Input value={organizacao} onChange={(e) => setOrganizacao(e.target.value)} placeholder="Ex: 1º Batalhão" />
                            </div>
                            <div className="space-y-2">
                                <Label>UG</Label>
                                <Input value={ug} onChange={(e) => setUg(e.target.value)} placeholder="Ex: 160001" />
                            </div>
                        </div>

                        <div className="border rounded-lg p-4 bg-muted/30">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold">Itens Selecionados</h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsBulkJustificativaOpen(true)} disabled={selectedItems.length === 0}>Justificar Todos</Button>
                                    <Button size="sm" onClick={() => setIsSelectorOpen(true)}><Plus className="h-4 w-4 mr-2" /> Adicionar Itens</Button>
                                </div>
                            </div>

                            {selectedItems.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground">Nenhum item selecionado.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-center">Qtd</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedItems.map((item) => {
                                            const isJustified = !!(item.justificativa && Object.values(item.justificativa).some(v => v && v.toString().trim() !== ""));
                                            return (
                                                <TableRow key={item.id}>
                                                    <TableCell className="text-sm font-medium">{item.descricao_reduzida}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Input 
                                                            type="number" 
                                                            className="w-16 h-8 mx-auto" 
                                                            value={item.quantidade || 1} 
                                                            onChange={(e) => setSelectedItems(prev => prev.map(i => i.id === item.id ? { ...i, quantidade: parseInt(e.target.value) || 1 } : i))}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">{formatCurrency(item.valor_unitario * (item.quantidade || 1))}</TableCell>
                                                    <TableCell className="text-center">
                                                        {isJustified ? <Badge variant="ptrab-aprovado">Justificado</Badge> : <Badge variant="destructive">Pendente</Badge>}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => { setItemForJustificativa(item); setJustificativaDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || selectedItems.length === 0}>
                            {saveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Registro
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Registros Consolidados</CardTitle></CardHeader>
                    <CardContent>
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : consolidatedRegistros.map(group => (
                            <div key={group.groupKey} className="mb-6 border rounded-lg overflow-hidden">
                                <div className="bg-muted p-3 flex justify-between items-center">
                                    <span className="font-bold">{group.organizacao} ({group.ug})</span>
                                    <span className="font-bold text-primary">{formatCurrency(group.totalGeral)}</span>
                                </div>
                                <Table>
                                    <TableBody>
                                        {group.records.map((reg: any) => (
                                            <TableRow key={reg.id}>
                                                <TableCell className="text-sm">
                                                    {reg.detalhes_planejamento?.items?.map((i: any) => i.descricao_reduzida).join(", ")}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate([reg.id])}><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <MaterialPermanenteItemSelectorDialog 
                open={isSelectorOpen} 
                onOpenChange={setIsSelectorOpen} 
                selectedYear={selectedYear} 
                initialItems={selectedItems} 
                onSelect={(items) => setSelectedItems(items.map(item => ({ ...item, quantidade: item.quantidade || 1 })))} 
                onAddDiretriz={() => navigate('/config/custos-operacionais')} 
                categoria="Material Permanente" 
            />
            <MaterialPermanenteJustificativaDialog 
                open={justificativaDialogOpen} 
                onOpenChange={setJustificativaDialogOpen} 
                itemName={itemForJustificativa?.descricao_reduzida || itemForJustificativa?.descricao_item || ""} 
                data={itemForJustificativa?.justificativa || {}} 
                diasOperacao={diasOperacao} 
                faseAtividade={faseAtividade} 
                onSave={handleSaveJustificativa} 
            />
            <MaterialPermanenteBulkJustificativaDialog 
                open={isBulkJustificativaOpen} 
                onOpenChange={setIsBulkJustificativaOpen} 
                items={selectedItems} 
                onSave={handleSaveBulkJustificativas} 
            />
        </div>
    );
};

export default MaterialPermanenteFormPage;