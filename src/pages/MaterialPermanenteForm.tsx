"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Save, 
    Loader2, 
    Calculator, 
    ClipboardList,
    FileText
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ItemAquisicaoMaterial } from "@/types/diretrizesMaterialPermanente";
import { formatCurrency } from "@/lib/formatUtils";
import MaterialPermanenteItemSelectorDialog from "@/components/MaterialPermanenteItemSelectorDialog";
import MaterialPermanenteJustificativaDialog from "@/components/MaterialPermanenteJustificativaDialog";
import MaterialPermanenteBulkJustificativaDialog from "@/components/MaterialPermanenteBulkJustificativaDialog";
import PageMetadata from "@/components/PageMetadata";
import { useSession } from "@/components/SessionContextProvider";

interface ConsolidatedPermanenteRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: any[];
    totalGeral: number;
}

const MaterialPermanenteForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const { user } = useSession();
    const queryClient = useQueryClient();

    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoMaterial[]>([]);
    const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
    const [organizacao, setOrganizacao] = useState("");
    const [ug, setUg] = useState("");
    const [faseAtividade, setFaseAtividade] = useState("");
    const [diasOperacao, setDiasOperacao] = useState(1);
    
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [isBulkJustificativaOpen, setIsBulkJustificativaOpen] = useState(false);
    const [justificativaDialogOpen, setJustificativaDialogOpen] = useState(false);
    const [itemForJustificativa, setItemForJustificativa] = useState<ItemAquisicaoMaterial | null>(null);
    const [expandedJustifications, setExpandedJustifications] = useState<Record<string, boolean>>({});

    const { data: ptrab } = useQuery({
        queryKey: ['ptrab', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase.from('p_trab').select('*').eq('id', ptrabId).single();
            if (error) throw error;
            return data;
        },
        enabled: !!ptrabId
    });

    const selectedYear = ptrab ? new Date(ptrab.periodo_inicio).getFullYear() : new Date().getFullYear();

    const { data: registros, isLoading: isLoadingRegistros } = useQuery({
        queryKey: ['materialPermanenteRegistros', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase.from('material_permanente_registros' as any).select('*').eq('p_trab_id', ptrabId);
            if (error) throw error;
            return data as any[];
        },
        enabled: !!ptrabId
    });

    const consolidatedRegistros = useMemo<ConsolidatedPermanenteRecord[]>(() => {
        if (!registros) return [];
        const groups: Record<string, ConsolidatedPermanenteRecord> = {};
        
        registros.forEach(reg => {
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
            const total = selectedItems.reduce((acc, item) => acc + (item.valor_unitario * (itemQuantities[item.id] || 1)), 0);
            const payload = {
                p_trab_id: ptrabId,
                organizacao,
                ug,
                fase_atividade: faseAtividade,
                dias_operacao: diasOperacao,
                categoria: "Material Permanente",
                detalhes_planejamento: {
                    items: selectedItems.map(item => ({
                        ...item,
                        quantidade: itemQuantities[item.id] || 1
                    }))
                },
                valor_total: total,
                valor_nd_52: total
            };

            const { error } = await supabase.from('material_permanente_registros' as any).insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
            toast.success("Registro salvo com sucesso!");
            resetForm();
        },
        onError: (error: any) => {
            toast.error("Erro ao salvar: " + error.message);
        }
    });

    const resetForm = () => {
        setSelectedItems([]);
        setItemQuantities({});
        setOrganizacao("");
        setUg("");
        setFaseAtividade("");
    };

    const handleSaveJustificativa = (data: Record<string, string>) => {
        if (!itemForJustificativa) return;
        setSelectedItems(prev => prev.map(item => 
            item.id === itemForJustificativa.id ? { ...item, justificativa: data } : item
        ));
    };

    const handleSaveBulkJustificativas = (items: ItemAquisicaoMaterial[]) => {
        setSelectedItems(items);
    };

    if (isLoadingRegistros) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata 
                title="Material Permanente" 
                description="Gerenciamento de aquisições de material permanente." 
                canonicalPath={`/ptrab/material-permanente?ptrabId=${ptrabId}`}
            />
            
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                    </Button>
                    <h1 className="text-2xl font-bold">Aquisição de Material Permanente (GND 4)</h1>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" /> Novo Registro
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Organização Solicitante</Label>
                                <Input value={organizacao} onChange={(e) => setOrganizacao(e.target.value)} placeholder="Ex: 1º Batalhão" />
                            </div>
                            <div className="space-y-2">
                                <Label>UG</Label>
                                <Input value={ug} onChange={(e) => setUg(e.target.value)} placeholder="Ex: 160001" />
                            </div>
                        </div>

                        <div className="border rounded-lg p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Calculator className="h-4 w-4" /> Itens Selecionados
                                </h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsBulkJustificativaOpen(true)} disabled={selectedItems.length === 0}>
                                        <ClipboardList className="h-4 w-4 mr-2" /> Justificativa em Lote
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)}>
                                        <Plus className="h-4 w-4 mr-2" /> Selecionar Itens
                                    </Button>
                                </div>
                            </div>

                            {selectedItems.length === 0 ? (
                                <p className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                                    Nenhum item selecionado.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {selectedItems.map(item => {
                                        const isJustified = !!(item.justificativa && Object.values(item.justificativa).some(v => v && v.toString().trim() !== ""));
                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-md bg-background">
                                                <div className="flex-1 min-w-0 mr-4">
                                                    <p className="font-medium text-sm truncate">{item.descricao_reduzida || item.descricao_item}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Button 
                                                            variant="link" 
                                                            className={`p-0 h-auto text-xs ${isJustified ? 'text-green-600' : 'text-destructive'}`}
                                                            onClick={() => { setItemForJustificativa(item); setJustificativaDialogOpen(true); }}
                                                        >
                                                            {isJustified ? "Justificativa OK" : "Falta Justificativa"}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Input 
                                                        type="number" 
                                                        className="w-20 h-8" 
                                                        value={itemQuantities[item.id] || 1}
                                                        onChange={(e) => setItemQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 1 }))}
                                                    />
                                                    <span className="text-sm font-bold w-24 text-right">
                                                        {formatCurrency(item.valor_unitario * (itemQuantities[item.id] || 1))}
                                                    </span>
                                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <Button 
                                onClick={() => saveMutation.mutate()} 
                                disabled={saveMutation.isPending || selectedItems.length === 0 || !organizacao || !ug}
                            >
                                {saveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                Salvar Registro
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {consolidatedRegistros.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="h-5 w-5" /> Registros Salvos
                        </h2>
                        {consolidatedRegistros.map(group => (
                            <Card key={group.groupKey}>
                                <CardHeader className="py-3 bg-muted/30">
                                    <div className="flex justify-between items-center">
                                        <CardTitle className="text-sm font-bold">{group.organizacao} ({group.ug})</CardTitle>
                                        <span className="text-sm font-bold text-primary">{formatCurrency(group.totalGeral)}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableBody>
                                            {group.records.map(reg => (
                                                <TableRow key={reg.id}>
                                                    <TableCell className="text-xs">
                                                        {reg.detalhes_planejamento?.items?.map((i: any) => i.descricao_reduzida).join(', ')}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-xs">
                                                        {formatCurrency(reg.valor_total)}
                                                    </TableCell>
                                                    <TableCell className="text-right w-10">
                                                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={async () => {
                                                            if (confirm("Excluir registro?")) {
                                                                await supabase.from('material_permanente_registros' as any).delete().eq('id', reg.id);
                                                                queryClient.invalidateQueries({ queryKey: ['materialPermanenteRegistros', ptrabId] });
                                                            }
                                                        }}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <MaterialPermanenteItemSelectorDialog 
                open={isSelectorOpen} 
                onOpenChange={setIsSelectorOpen} 
                selectedYear={selectedYear} 
                initialItems={selectedItems} 
                onSelect={(items) => setSelectedItems(items as ItemAquisicaoMaterial[])} 
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

export default MaterialPermanenteForm;