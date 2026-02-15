import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2, Edit2, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from '@/lib/formatUtils';
import MaterialPermanenteForm from '@/components/MaterialPermanenteForm';
import PageMetadata from '@/components/PageMetadata';

const MaterialPermanente = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);

    const { data: records, isLoading } = useQuery({
        queryKey: ['materialPermanenteRecords', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('material_permanente_registros')
                .select('*')
                .eq('p_trab_id', ptrabId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!ptrabId,
    });

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este registro?")) return;
        const { error } = await supabase.from('material_permanente_registros').delete().eq('id', id);
        if (error) toast.error("Erro ao excluir: " + error.message);
        else {
            toast.success("Registro excluído!");
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRecords', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        }
    };

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container max-w-5xl mx-auto py-6 px-4">
            <PageMetadata title="Material Permanente" description="Gerenciamento de aquisições de material permanente para o P Trab." />
            
            <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="h-6 w-6 text-primary" /> Material Permanente
                </h1>
                {!isAdding && !editingRecord && (
                    <Button onClick={() => setIsAdding(true)}><Plus className="mr-2 h-4 w-4" /> Novo Registro</Button>
                )}
            </div>

            {(isAdding || editingRecord) ? (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>{editingRecord ? 'Editar Registro' : 'Novo Registro'}</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setEditingRecord(null); }}>Cancelar</Button>
                    </CardHeader>
                    <CardContent>
                        <MaterialPermanenteForm 
                            pTrabId={ptrabId!} 
                            selectedYear={new Date().getFullYear()} 
                            initialData={editingRecord}
                            onSuccess={() => {
                                setIsAdding(false);
                                setEditingRecord(null);
                                queryClient.invalidateQueries({ queryKey: ['materialPermanenteRecords', ptrabId] });
                                queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
                            }}
                        />
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {records?.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                            Nenhum registro de material permanente encontrado.
                        </div>
                    ) : (
                        records?.map((record: any) => (
                            <Card key={record.id}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-bold">{record.organizacao} ({record.ug})</p>
                                        <p className="text-sm text-muted-foreground">
                                            {record.detalhes_planejamento?.items?.length || 0} itens planejados
                                        </p>
                                        <p className="text-lg font-bold text-primary mt-1">{formatCurrency(record.valor_total)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="icon" onClick={() => setEditingRecord(record)}><Edit2 className="h-4 w-4" /></Button>
                                        <Button variant="outline" size="icon" className="text-destructive" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MaterialPermanente;