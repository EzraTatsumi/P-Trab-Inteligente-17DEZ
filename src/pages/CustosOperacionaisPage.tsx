"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Loader2, FileSpreadsheet, Package, Briefcase, HardDrive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSession } from '@/components/SessionContextProvider';
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";
import { DiretrizMaterialPermanente } from "@/types/diretrizesMaterialPermanente";
import MaterialConsumoDiretrizRow from '@/components/MaterialConsumoDiretrizRow';
import MaterialConsumoDiretrizFormDialog from '@/components/MaterialConsumoDiretrizFormDialog';
import MaterialConsumoExportImportDialog from '@/components/MaterialConsumoExportImportDialog';
import MaterialPermanenteDiretrizRow from '@/components/MaterialPermanenteDiretrizRow';
import MaterialPermanenteDiretrizFormDialog from '@/components/MaterialPermanenteDiretrizFormDialog';
import MaterialPermanenteExportImportDialog from '@/components/MaterialPermanenteExportImportDialog';
import PageMetadata from "@/components/PageMetadata";

const CustosOperacionaisPage = () => {
    const navigate = useNavigate();
    const { user } = useSession();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState("material-consumo");
    
    // Estados para Material de Consumo
    const [diretrizesConsumo, setDiretrizesConsumo] = useState<DiretrizMaterialConsumo[]>([]);
    const [loadingConsumo, setLoadingConsumo] = useState(true);
    const [isConsumoFormOpen, setIsConsumoFormOpen] = useState(false);
    const [isConsumoExportImportOpen, setIsConsumoExportImportOpen] = useState(false);
    const [diretrizConsumoToEdit, setDiretrizConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);
    const [expandedConsumoId, setExpandedConsumoId] = useState<string | null>(null);

    // Estados para Material Permanente
    const [diretrizesPermanente, setDiretrizesPermanente] = useState<DiretrizMaterialPermanente[]>([]);
    const [loadingPermanente, setLoadingPermanente] = useState(true);
    const [isPermanenteFormOpen, setIsPermanenteFormOpen] = useState(false);
    const [isPermanenteExportImportOpen, setIsPermanenteExportImportOpen] = useState(false);
    const [diretrizPermanenteToEdit, setDiretrizPermanenteToEdit] = useState<DiretrizMaterialPermanente | null>(null);
    const [expandedPermanenteId, setExpandedPermanenteId] = useState<string | null>(null);

    const loadDiretrizesConsumo = useCallback(async () => {
        if (!user?.id) return;
        setLoadingConsumo(true);
        try {
            const { data, error } = await supabase
                .from('diretrizes_material_consumo')
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', selectedYear)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            setDiretrizesConsumo(data as DiretrizMaterialConsumo[]);
        } catch (error) {
            console.error("Erro ao carregar diretrizes de consumo:", error);
            toast.error("Falha ao carregar diretrizes de consumo.");
        } finally {
            setLoadingConsumo(false);
        }
    }, [user?.id, selectedYear]);

    const loadDiretrizesPermanente = useCallback(async () => {
        if (!user?.id) return;
        setLoadingPermanente(true);
        try {
            const { data, error } = await supabase
                .from('diretrizes_material_permanente' as any)
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', selectedYear)
                .order('nr_subitem', { ascending: true });

            if (error) throw error;
            setDiretrizesPermanente(data as DiretrizMaterialPermanente[]);
        } catch (error) {
            console.error("Erro ao carregar diretrizes de permanente:", error);
            toast.error("Falha ao carregar diretrizes de permanente.");
        } finally {
            setLoadingPermanente(false);
        }
    }, [user?.id, selectedYear]);

    useEffect(() => {
        loadDiretrizesConsumo();
        loadDiretrizesPermanente();
    }, [loadDiretrizesConsumo, loadDiretrizesPermanente]);

    const handleSaveConsumo = async (data: any) => {
        if (!user?.id) return;
        try {
            if (data.id) {
                const { error } = await supabase.from('diretrizes_material_consumo').update(data).eq('id', data.id);
                if (error) throw error;
                toast.success("Diretriz de consumo atualizada!");
            } else {
                const { error } = await supabase.from('diretrizes_material_consumo').insert([{ ...data, user_id: user.id }]);
                if (error) throw error;
                toast.success("Diretriz de consumo cadastrada!");
            }
            loadDiretrizesConsumo();
        } catch (error) {
            console.error("Erro ao salvar diretriz de consumo:", error);
            toast.error("Falha ao salvar diretriz.");
        }
    };

    const handleSavePermanente = async (data: any) => {
        if (!user?.id) return;
        try {
            if (data.id) {
                const { error } = await supabase.from('diretrizes_material_permanente' as any).update(data).eq('id', data.id);
                if (error) throw error;
                toast.success("Diretriz de material permanente atualizada!");
            } else {
                const { error } = await supabase.from('diretrizes_material_permanente' as any).insert([{ ...data, user_id: user.id }]);
                if (error) throw error;
                toast.success("Diretriz de material permanente cadastrada!");
            }
            loadDiretrizesPermanente();
        } catch (error) {
            console.error("Erro ao salvar diretriz de permanente:", error);
            toast.error("Falha ao salvar diretriz.");
        }
    };

    const handleDeleteConsumo = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta diretriz?")) return;
        try {
            const { error } = await supabase.from('diretrizes_material_consumo').delete().eq('id', id);
            if (error) throw error;
            toast.success("Diretriz excluída!");
            loadDiretrizesConsumo();
        } catch (error) {
            toast.error("Erro ao excluir diretriz.");
        }
    };

    const handleDeletePermanente = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta diretriz?")) return;
        try {
            const { error } = await supabase.from('diretrizes_material_permanente' as any).delete().eq('id', id);
            if (error) throw error;
            toast.success("Diretriz excluída!");
            loadDiretrizesPermanente();
        } catch (error) {
            toast.error("Erro ao excluir diretriz.");
        }
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Custos Operacionais" description="Gerenciamento de diretrizes de custos operacionais." />
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/ptrab')}><ArrowLeft className="h-5 w-5" /></Button>
                        <div>
                            <h1 className="text-3xl font-bold">Custos Operacionais</h1>
                            <p className="text-muted-foreground">Diretrizes de Materiais e Serviços para o ano {selectedYear}</p>
                        </div>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="material-consumo" className="flex items-center gap-2"><Package className="h-4 w-4" />Material de Consumo (GND 3)</TabsTrigger>
                        <TabsTrigger value="material-permanente" className="flex items-center gap-2"><HardDrive className="h-4 w-4" />Material Permanente (GND 4)</TabsTrigger>
                        <TabsTrigger value="servicos-terceiros" className="flex items-center gap-2"><Briefcase className="h-4 w-4" />Serviços de Terceiros</TabsTrigger>
                    </TabsList>

                    <TabsContent value="material-consumo">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Diretrizes de Material de Consumo (ND 33.90.30)</CardTitle>
                                    <CardDescription>Subitens e itens de referência para o planejamento logístico.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setIsConsumoExportImportOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar/Importar</Button>
                                    <Button onClick={() => { setDiretrizConsumoToEdit(null); setIsConsumoFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo Subitem</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loadingConsumo ? (
                                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : diretrizesConsumo.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">Nenhuma diretriz cadastrada para {selectedYear}.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[40px]"></TableHead>
                                                <TableHead className="text-center w-[100px]">Subitem</TableHead>
                                                <TableHead>Nome do Subitem</TableHead>
                                                <TableHead className="text-center">Qtd. Itens</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {diretrizesConsumo.map(diretriz => (
                                                <MaterialConsumoDiretrizRow 
                                                    key={diretriz.id} 
                                                    diretriz={diretriz} 
                                                    isExpanded={expandedConsumoId === diretriz.id} 
                                                    onToggleExpand={() => setExpandedConsumoId(expandedConsumoId === diretriz.id ? null : diretriz.id)} 
                                                    onEdit={(d) => { setDiretrizConsumoToEdit(d); setIsConsumoFormOpen(true); }} 
                                                    onDelete={handleDeleteConsumo} 
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="material-permanente">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Diretrizes de Material Permanente (ND 44.90.52)</CardTitle>
                                    <CardDescription>Subitens e itens de referência para aquisição de bens permanentes.</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setIsPermanenteExportImportOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar/Importar</Button>
                                    <Button onClick={() => { setDiretrizPermanenteToEdit(null); setIsPermanenteFormOpen(true); }}><Plus className="mr-2 h-4 w-4" />Novo Subitem</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loadingPermanente ? (
                                    <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : diretrizesPermanente.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">Nenhuma diretriz cadastrada para {selectedYear}.</div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[40px]"></TableHead>
                                                <TableHead className="text-center w-[100px]">Subitem</TableHead>
                                                <TableHead>Nome do Subitem</TableHead>
                                                <TableHead className="text-center">Qtd. Itens</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {diretrizesPermanente.map(diretriz => (
                                                <MaterialPermanenteDiretrizRow 
                                                    key={diretriz.id} 
                                                    diretriz={diretriz} 
                                                    isExpanded={expandedPermanenteId === diretriz.id} 
                                                    onToggleExpand={() => setExpandedPermanenteId(expandedPermanenteId === diretriz.id ? null : diretriz.id)} 
                                                    onEdit={(d) => { setDiretrizPermanenteToEdit(d); setIsPermanenteFormOpen(true); }} 
                                                    onDelete={handleDeletePermanente} 
                                                />
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="servicos-terceiros">
                        <div className="text-center py-12 text-muted-foreground">Funcionalidade de Serviços de Terceiros já implementada.</div>
                    </TabsContent>
                </Tabs>
            </div>

            <MaterialConsumoDiretrizFormDialog open={isConsumoFormOpen} onOpenChange={setIsConsumoFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizConsumoToEdit} onSave={handleSaveConsumo} loading={false} />
            <MaterialConsumoExportImportDialog open={isConsumoExportImportOpen} onOpenChange={setIsConsumoExportImportOpen} selectedYear={selectedYear} diretrizes={diretrizesConsumo} onImportSuccess={loadDiretrizesConsumo} />
            
            <MaterialPermanenteDiretrizFormDialog open={isPermanenteFormOpen} onOpenChange={setIsPermanenteFormOpen} selectedYear={selectedYear} diretrizToEdit={diretrizPermanenteToEdit} onSave={handleSavePermanente} loading={false} />
            <MaterialPermanenteExportImportDialog open={isPermanenteExportImportOpen} onOpenChange={setIsPermanenteExportImportOpen} selectedYear={selectedYear} diretrizes={direrizesPermanente} onImportSuccess={loadDiretrizesPermanente} />
        </div>
    );
};

export default CustosOperacionaisPage;