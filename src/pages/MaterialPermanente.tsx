import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Package, Trash2, Edit, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
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

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('material_permanente_registros').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materialPermanenteRecords', ptrabId] });
            toast.success("Registro removido com sucesso");
        },
        onError: (error: any) => toast.error("Erro ao remover: " + error.message)
    });

    if (!ptrabId) return <div className="p-8 text-center">P Trab não identificado.</div>;

    return (
        <div className="min-h-screen bg-background py-6 px-4">
            <PageMetadata title="Material Permanente" description="Gerenciamento de aquisições de material permanente para o P Trab." />
            
            <div className="container max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao P Trab
                    </Button>
                    {!isAdding && !editingRecord && (
                        <Button onClick={() => setIsAdding(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Novo Registro
                        </Button>
                    )}
                </div>

                {(isAdding || editingRecord) ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>{editingRecord ? 'Editar Registro' : 'Novo Registro de Material Permanente'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MaterialPermanenteForm 
                                pTrabId={ptrabId}
                                selectedYear={new Date().getFullYear()} // Idealmente viria do perfil ou PTrab
                                initialData={editingRecord}
                                onSuccess={() => {
                                    setIsAdding(false);
                                    setEditingRecord(null);
                                    queryClient.invalidateQueries({ queryKey: ['materialPermanenteRecords', ptrabId] });
                                }}
                            />
                            <Button variant="ghost" className="mt-4 w-full" onClick={() => { setIsAdding(false); setEditingRecord(null); }}>
                                Cancelar
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Package className="h-6 w-6 text-primary" />
                            Registros de Material Permanente
                        </h2>
                        
                        {isLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : records?.length === 0 ? (
                            <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro encontrado. Clique em "Novo Registro" para começar.</CardContent></Card>
                        ) : (
                            <div className="grid gap-4">
                                {records?.map((record: any) => (
                                    <Card key={record.id}>
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-lg">{record.organizacao} ({record.ug})</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {record.detalhes_planejamento?.items?.length || 0} itens planejados
                                                </p>
                                                <p className="text-primary font-semibold mt-1">Total: {formatCurrency(record.valor_total)}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="icon" onClick={() => setEditingRecord(record)}><Edit className="h-4 w-4" /></Button>
                                                <Button variant="outline" size="icon" className="text-destructive" onClick={() => { if(confirm("Deseja remover este registro?")) deleteMutation.mutate(record.id); }}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaterialPermanente;