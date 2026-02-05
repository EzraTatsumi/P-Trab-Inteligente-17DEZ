import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Plus, Trash2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sanitizeError } from "@/lib/errorUtils";
import { useDefaultDiretrizYear } from "@/hooks/useDefaultDiretrizYear";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import CurrencyInput from "@/components/CurrencyInput";
import { formatCurrencyInput, numberToRawDigits, formatCurrency } from "@/lib/formatUtils";
import PassagemDiretrizFormDialog, { DiretrizPassagem } from "@/components/PassagemDiretrizFormDialog";
import PassagemDiretrizRow from "@/components/PassagemDiretrizRow";
import ConcessionariaDiretrizFormDialog, { DiretrizConcessionaria } from "@/components/ConcessionariaDiretrizFormDialog";
import ConcessionariaDiretrizRow from "@/components/ConcessionariaDiretrizRow";
import MaterialConsumoDiretrizFormDialog from "@/components/MaterialConsumoDiretrizFormDialog";
import MaterialConsumoDiretrizRow from "@/components/MaterialConsumoDiretrizRow";
import { DiretrizMaterialConsumo } from "@/types/diretrizesMaterialConsumo";

// Tipos
type DiretrizOperacional = Tables<'diretrizes_operacionais'>;

const fetchDiretrizesOperacionais = async (year: number, userId: string): Promise<DiretrizOperacional | null> => {
    const { data, error } = await supabase
        .from('diretrizes_operacionais')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .maybeSingle();

    if (error) throw error;
    return data;
};

const fetchDiretrizesPassagens = async (year: number, userId: string): Promise<DiretrizPassagem[]> => {
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .order('om_referencia', { ascending: true });

    if (error) throw error;
    return data as DiretrizPassagem[];
};

const fetchDiretrizesConcessionaria = async (year: number, userId: string): Promise<DiretrizConcessionaria[]> => {
    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .order('nome_concessionaria', { ascending: true });

    if (error) throw error;
    return data as DiretrizConcessionaria[];
};

const fetchDiretrizesMaterialConsumo = async (year: number, userId: string): Promise<DiretrizMaterialConsumo[]> => {
    const { data, error } = await supabase
        .from('diretrizes_material_consumo')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .order('nr_subitem', { ascending: true });

    if (error) throw error;
    return data as DiretrizMaterialConsumo[];
};


const CustosOperacionaisPage = () => {
    const navigate = useNavigate();
    const { user } = useSession();
    const queryClient = useQueryClient();
    const { defaultYear, isLoadingDefaultYear, setDefaultYear } = useDefaultDiretrizYear('operacional');

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [fieldCollapseState, setFieldCollapseState] = useState<Record<string, boolean>>({
        diarias_detalhe: false,
        passagens_detalhe: false,
        concessionaria_detalhe: false,
        material_consumo_detalhe: false,
    });

    // Estados para Diálogos de Detalhe
    const [showPassagemDialog, setShowPassagemDialog] = useState(false);
    const [passagemToEdit, setPassagemToEdit] = useState<DiretrizPassagem | null>(null);
    
    const [showConcessionariaDialog, setShowConcessionariaDialog] = useState(false);
    const [concessionariaToEdit, setConcessionariaToEdit] = useState<DiretrizConcessionaria | null>(null);
    
    const [showMaterialConsumoDialog, setShowMaterialConsumoDialog] = useState(false);
    const [materialConsumoToEdit, setMaterialConsumoToEdit] = useState<DiretrizMaterialConsumo | null>(null);

    useEffect(() => {
        if (defaultYear && !isLoadingDefaultYear) {
            setSelectedYear(defaultYear);
        }
    }, [defaultYear, isLoadingDefaultYear]);

    // --- Queries ---
    const { data: diretrizesOp, refetch: refetchDiretrizesOp } = useQuery({
        queryKey: ['diretrizesOperacionais', selectedYear],
        queryFn: () => fetchDiretrizesOperacionais(selectedYear, user!.id),
        enabled: !!user?.id && !isLoadingDefaultYear,
        initialData: null,
    });

    const { data: diretrizesPassagens, refetch: refetchDiretrizesPassagens } = useQuery({
        queryKey: ['diretrizesPassagens', selectedYear],
        queryFn: () => fetchDiretrizesPassagens(selectedYear, user!.id),
        enabled: !!user?.id && !isLoadingDefaultYear,
        initialData: [],
    });
    
    const { data: diretrizesConcessionaria, refetch: refetchDiretrizesConcessionaria } = useQuery({
        queryKey: ['diretrizesConcessionaria', selectedYear],
        queryFn: () => fetchDiretrizesConcessionaria(selectedYear, user!.id),
        enabled: !!user?.id && !isLoadingDefaultYear,
        initialData: [],
    });
    
    const { data: diretrizesMaterialConsumo, refetch: refetchDiretrizesMaterialConsumo } = useQuery({
        queryKey: ['diretrizesMaterialConsumo', selectedYear],
        queryFn: () => fetchDiretrizesMaterialConsumo(selectedYear, user!.id),
        enabled: !!user?.id && !isLoadingDefaultYear,
        initialData: [],
    });

    // --- Lógica de Fatores e Valores Simples ---
    const [formState, setFormState] = useState<Partial<DiretrizOperacional>>({});
    const [rawValues, setRawValues] = useState({
        fator_passagens_aereas: numberToRawDigits(0),
        fator_servicos_terceiros: numberToRawDigits(0),
        valor_verba_operacional_dia: numberToRawDigits(0),
        valor_suprimentos_fundo_dia: numberToRawDigits(0),
        valor_complemento_alimentacao: numberToRawDigits(0),
        valor_fretamento_aereo_hora: numberToRawDigits(0),
        valor_locacao_estrutura_dia: numberToRawDigits(0),
        valor_locacao_viaturas_dia: numberToRawDigits(0),
        fator_material_consumo: numberToRawDigits(0),
        fator_concessionaria: numberToRawDigits(0),
        taxa_embarque: numberToRawDigits(0),
        
        // Diárias
        diaria_of_gen_bsb: numberToRawDigits(0),
        diaria_of_gen_capitais: numberToRawDigits(0),
        diaria_of_gen_demais: numberToRawDigits(0),
        diaria_of_sup_bsb: numberToRawDigits(0),
        diaria_of_sup_capitais: numberToRawDigits(0),
        diaria_of_sup_demais: numberToRawDigits(0),
        diaria_of_int_sgt_bsb: numberToRawDigits(0),
        diaria_of_int_sgt_capitais: numberToRawDigits(0),
        diaria_of_int_sgt_demais: numberToRawDigits(0),
        diaria_demais_pracas_bsb: numberToRawDigits(0),
        diaria_demais_pracas_capitais: numberToRawDigits(0),
        diaria_demais_pracas_demais: numberToRawDigits(0),
    });

    useEffect(() => {
        if (diretrizesOp) {
            setFormState(diretrizesOp);
            
            const newRawValues = { ...rawValues };
            
            // Mapeamento de valores numéricos para rawDigits
            (Object.keys(rawValues) as (keyof typeof rawValues)[]).forEach(key => {
                const dbKey = key as keyof DiretrizOperacional;
                const value = diretrizesOp[dbKey];
                if (typeof value === 'number' && value !== null) {
                    newRawValues[key] = numberToRawDigits(value);
                }
            });
            
            setRawValues(newRawValues);
        } else {
            // Resetar formulário se não houver diretriz para o ano
            setFormState({ ano_referencia: selectedYear });
            setRawValues(Object.fromEntries(Object.keys(rawValues).map(key => [key, numberToRawDigits(0)])) as typeof rawValues);
        }
    }, [diretrizesOp, selectedYear]);

    const handleCurrencyChange = (key: keyof typeof rawValues, rawValue: string) => {
        const { numericValue, digits } = formatCurrencyInput(rawValue);
        setRawValues(prev => ({ ...prev, [key]: digits }));
        setFormState(prev => ({ ...prev, [key]: numericValue }));
    };
    
    const handleInputChange = (key: keyof DiretrizOperacional, value: string) => {
        setFormState(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveDiretrizOp = async () => {
        if (!user?.id) {
            toast.error("Usuário não autenticado.");
            return;
        }
        
        setLoading(true);
        
        try {
            const dataToSave: TablesInsert<'diretrizes_operacionais'> | TablesUpdate<'diretrizes_operacionais'> = {
                ...formState,
                user_id: user.id,
                ano_referencia: selectedYear,
                // Garantir que todos os campos numéricos sejam salvos como number (mesmo que 0)
                fator_passagens_aereas: Number(formState.fator_passagens_aereas || 0),
                fator_servicos_terceiros: Number(formState.fator_servicos_terceiros || 0),
                valor_verba_operacional_dia: Number(formState.valor_verba_operacional_dia || 0),
                valor_suprimentos_fundo_dia: Number(formState.valor_suprimentos_fundo_dia || 0),
                valor_complemento_alimentacao: Number(formState.valor_complemento_alimentacao || 0),
                valor_fretamento_aereo_hora: Number(formState.valor_fretamento_aereo_hora || 0),
                valor_locacao_estrutura_dia: Number(formState.valor_locacao_estrutura_dia || 0),
                valor_locacao_viaturas_dia: Number(formState.valor_locacao_viaturas_dia || 0),
                fator_material_consumo: Number(formState.fator_material_consumo || 0),
                fator_concessionaria: Number(formState.fator_concessionaria || 0),
                taxa_embarque: Number(formState.taxa_embarque || 0),
                
                diaria_of_gen_bsb: Number(formState.diaria_of_gen_bsb || 0),
                diaria_of_gen_capitais: Number(formState.diaria_of_gen_capitais || 0),
                diaria_of_gen_demais: Number(formState.diaria_of_gen_demais || 0),
                diaria_of_sup_bsb: Number(formState.diaria_of_sup_bsb || 0),
                diaria_of_sup_capitais: Number(formState.diaria_of_sup_capitais || 0),
                diaria_of_sup_demais: Number(formState.diaria_of_sup_demais || 0),
                diaria_of_int_sgt_bsb: Number(formState.diaria_of_int_sgt_bsb || 0),
                diaria_of_int_sgt_capitais: Number(formState.diaria_of_int_sgt_capitais || 0),
                diaria_of_int_sgt_demais: Number(formState.diaria_of_int_sgt_demais || 0),
                diaria_demais_pracas_bsb: Number(formState.diaria_demais_pracas_bsb || 0),
                diaria_demais_pracas_capitais: Number(formState.diaria_demais_pracas_capitais || 0),
                diaria_demais_pracas_demais: Number(formState.diaria_demais_pracas_demais || 0),
            };

            if (diretrizesOp?.id) {
                // Update
                const { error } = await supabase
                    .from('diretrizes_operacionais')
                    .update(dataToSave as TablesUpdate<'diretrizes_operacionais'>)
                    .eq('id', diretrizesOp.id);
                if (error) throw error;
                toast.success("Diretrizes Operacionais atualizadas!");
            } else {
                // Insert
                const { error } = await supabase
                    .from('diretrizes_operacionais')
                    .insert(dataToSave as TablesInsert<'diretrizes_operacionais'>);
                if (error) throw error;
                toast.success("Diretrizes Operacionais cadastradas!");
            }
            
            refetchDiretrizesOp();
            
        } catch (error: any) {
            console.error("Erro ao salvar diretrizes operacionais:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    // --- Lógica de Passagens ---
    const handleOpenNewPassagem = () => {
        setPassagemToEdit(null);
        setShowPassagemDialog(true);
    };

    const handleStartEditPassagem = (diretriz: DiretrizPassagem) => {
        setPassagemToEdit(diretriz);
        setShowPassagemDialog(true);
    };

    const handleSavePassagem = async (data: Parameters<typeof PassagemDiretrizFormDialog>[0]['onSave'] extends (d: infer D) => any ? D : never) => {
        if (!user?.id) return;
        setLoading(true);
        
        try {
            const dataToSave = {
                ...data,
                user_id: user.id,
                ano_referencia: selectedYear,
                trechos: data.trechos, // Já é um array de objetos
                // Datas já estão formatadas como string 'yyyy-MM-dd'
            };

            if (data.id) {
                const { error } = await supabase
                    .from('diretrizes_passagens')
                    .update(dataToSave as TablesUpdate<'diretrizes_passagens'>)
                    .eq('id', data.id);
                if (error) throw error;
                toast.success("Contrato de Passagens atualizado!");
            } else {
                const { error } = await supabase
                    .from('diretrizes_passagens')
                    .insert(dataToSave as TablesInsert<'diretrizes_passagens'>);
                if (error) throw error;
                toast.success("Contrato de Passagens cadastrado!");
            }
            
            refetchDiretrizesPassagens();
            
        } catch (error: any) {
            console.error("Erro ao salvar contrato de passagens:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePassagem = async (id: string, nome: string) => {
        if (!confirm(`Tem certeza que deseja excluir o contrato de passagens da OM ${nome}?`)) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('diretrizes_passagens')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("Contrato de Passagens excluído!");
            refetchDiretrizesPassagens();
        } catch (error: any) {
            console.error("Erro ao excluir contrato de passagens:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };
    
    const renderPassagensSection = () => {
        return (
            <div className="space-y-4">
                {diretrizesPassagens.length > 0 ? (
                    <Card className="p-4">
                        <CardTitle className="text-base font-semibold mb-3">Contratos de Passagens Cadastrados</CardTitle>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>OM Referência</TableHead>
                                    <TableHead className="w-[40%]">Pregão/Vigência</TableHead>
                                    <TableHead className="text-center">Trechos</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diretrizesPassagens.map(d => (
                                    <PassagemDiretrizRow
                                        key={d.id}
                                        diretriz={d}
                                        onEdit={handleStartEditPassagem}
                                        onDelete={handleDeletePassagem}
                                        loading={loading}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <Card className="p-4 text-center text-muted-foreground">
                        Nenhum contrato de passagens cadastrado para o ano de referência.
                    </Card>
                )}
                
                <div className="flex justify-end">
                    <Button 
                        type="button" 
                        onClick={handleOpenNewPassagem}
                        disabled={loading}
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Novo Contrato de Passagens
                    </Button>
                </div>
            </div>
        );
    };
    
    // --- Lógica de Concessionária ---
    const handleOpenNewConcessionaria = () => {
        setConcessionariaToEdit(null);
        setShowConcessionariaDialog(true);
    };

    const handleStartEditConcessionaria = (diretriz: DiretrizConcessionaria) => {
        setConcessionariaToEdit(diretriz);
        setShowConcessionariaDialog(true);
    };

    const handleSaveConcessionaria = async (data: Parameters<typeof ConcessionariaDiretrizFormDialog>[0]['onSave'] extends (d: infer D) => any ? D : never) => {
        if (!user?.id) return;
        setLoading(true);
        
        try {
            const dataToSave = {
                ...data,
                user_id: user.id,
                ano_referencia: selectedYear,
                consumo_pessoa_dia: Number(data.consumo_pessoa_dia),
                custo_unitario: Number(data.custo_unitario),
            };

            if (data.id) {
                const { error } = await supabase
                    .from('diretrizes_concessionaria')
                    .update(dataToSave as TablesUpdate<'diretrizes_concessionaria'>)
                    .eq('id', data.id);
                if (error) throw error;
                toast.success("Diretriz de Concessionária atualizada!");
            } else {
                const { error } = await supabase
                    .from('diretrizes_concessionaria')
                    .insert(dataToSave as TablesInsert<'diretrizes_concessionaria'>);
                if (error) throw error;
                toast.success("Diretriz de Concessionária cadastrada!");
            }
            
            refetchDiretrizesConcessionaria();
            
        } catch (error: any) {
            console.error("Erro ao salvar diretriz de concessionária:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConcessionaria = async (id: string, nome: string) => {
        if (!confirm(`Tem certeza que deseja excluir a diretriz da concessionária ${nome}?`)) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('diretrizes_concessionaria')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("Diretriz de Concessionária excluída!");
            refetchDiretrizesConcessionaria();
        } catch (error: any) {
            console.error("Erro ao excluir diretriz de concessionária:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };
    
    const renderConcessionariaSection = () => {
        return (
            <div className="space-y-4">
                {diretrizesConcessionaria.length > 0 ? (
                    <Card className="p-4">
                        <CardTitle className="text-base font-semibold mb-3">Diretrizes de Concessionária Cadastradas</CardTitle>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Concessionária</TableHead>
                                    <TableHead className="w-[40%]">Consumo/Custo Unitário</TableHead>
                                    <TableHead className="w-[100px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diretrizesConcessionaria.map(d => (
                                    <ConcessionariaDiretrizRow
                                        key={d.id}
                                        diretriz={d}
                                        onEdit={handleStartEditConcessionaria}
                                        onDelete={handleDeleteConcessionaria}
                                        loading={loading}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <Card className="p-4 text-center text-muted-foreground">
                        Nenhuma diretriz de concessionária cadastrada para o ano de referência.
                    </Card>
                )}
                
                <div className="flex justify-end">
                    <Button 
                        type="button" 
                        onClick={handleOpenNewConcessionaria}
                        disabled={loading}
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Nova Diretriz de Concessionária
                    </Button>
                </div>
            </div>
        );
    };
    
    // --- LÓGICA DE MATERIAL DE CONSUMO (NOVO) ---
    const handleOpenNewMaterialConsumo = () => {
        setMaterialConsumoToEdit(null);
        setShowMaterialConsumoDialog(true);
    };

    const handleStartEditMaterialConsumo = (diretriz: DiretrizMaterialConsumo) => {
        setMaterialConsumoToEdit(diretriz);
        setShowMaterialConsumoDialog(true);
    };

    const handleSaveMaterialConsumo = async (data: Parameters<typeof MaterialConsumoDiretrizFormDialog>[0]['onSave'] extends (d: infer D) => any ? D : never) => {
        if (!user?.id) return;
        setLoading(true);
        
        try {
            const dataToSave = {
                ...data,
                user_id: user.id,
                ano_referencia: selectedYear,
                itens_aquisicao: data.itens_aquisicao,
            };

            if (data.id) {
                const { error } = await supabase
                    .from('diretrizes_material_consumo')
                    .update(dataToSave as TablesUpdate<'diretrizes_material_consumo'>)
                    .eq('id', data.id);
                if (error) throw error;
                toast.success("Subitem da ND atualizado!");
            } else {
                const { error } = await supabase
                    .from('diretrizes_material_consumo')
                    .insert(dataToSave as TablesInsert<'diretrizes_material_consumo'>);
                if (error) throw error;
                toast.success("Subitem da ND cadastrado!");
            }
            
            refetchDiretrizesMaterialConsumo();
            
        } catch (error: any) {
            console.error("Erro ao salvar subitem da ND:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteMaterialConsumo = async (id: string, nome: string) => {
        if (!confirm(`Tem certeza que deseja excluir o subitem da ND ${nome}?`)) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('diretrizes_material_consumo')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("Subitem da ND excluído!");
            refetchDiretrizesMaterialConsumo();
        } catch (error: any) {
            console.error("Erro ao excluir subitem da ND:", error);
            toast.error(sanitizeError(error));
        } finally {
            setLoading(false);
        }
    };
    
    const renderMaterialConsumoSection = () => {
        return (
            <div className="space-y-4">
                
                {/* Lista de Subitens Existentes */}
                {diretrizesMaterialConsumo.length > 0 ? (
                    <Card className="p-4">
                        <CardTitle className="text-base font-semibold mb-3">Subitens da ND Cadastrados</CardTitle>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nr Subitem</TableHead>
                                    <TableHead className="w-[40%]">Nome do Subitem</TableHead>
                                    <TableHead className="w-[100px] text-center">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diretrizesMaterialConsumo.map(d => (
                                    <MaterialConsumoDiretrizRow
                                        key={d.id}
                                        diretriz={d}
                                        onEdit={handleStartEditMaterialConsumo}
                                        onDelete={handleDeleteMaterialConsumo}
                                        loading={loading}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <Card className="p-4 text-center text-muted-foreground">
                        Nenhum subitem da ND cadastrado para o ano de referência.
                    </Card>
                )}
                
                <div className="flex justify-end">
                    <Button 
                        type="button" 
                        onClick={handleOpenNewMaterialConsumo}
                        disabled={loading}
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Novo Subitem da ND
                    </Button>
                </div>
            </div>
        );
    };
    // END LÓGICA DE MATERIAL DE CONSUMO

    // Adicionando a verificação de carregamento
    if (loading || isLoadingDefaultYear) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
            </div>
        );
    }

    // Gera a lista de anos (últimos 5 anos + próximo ano)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => navigate('/ptrab')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Gerenciamento
                    </Button>
                    <h1 className="text-2xl font-bold">Custos Operacionais</h1>
                </div>

                <Card className="p-4">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Diretrizes para o Custeio Operacional</CardTitle>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="year-select" className="text-sm">Ano de Referência:</Label>
                            <Select
                                value={String(selectedYear)}
                                onValueChange={(value) => {
                                    const newYear = parseInt(value);
                                    setSelectedYear(newYear);
                                    setDefaultYear(newYear);
                                }}
                                disabled={loading}
                            >
                                <SelectTrigger id="year-select" className="w-[120px]">
                                    <SelectValue placeholder="Ano" />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map(year => (
                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure os valores unitários e fatores de cálculo para o ano selecionado.
                    </p>
                </Card>

                <Card className="p-6 space-y-6">
                    <div className="flex justify-end">
                        <Button onClick={handleSaveDiretrizOp} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Diretrizes Operacionais
                        </Button>
                    </div>
                    
                    {/* SEÇÃO PRINCIPAL DE CUSTOS OPERACIONAIS (ITENS INDIVIDUAIS COLAPSÁVEIS) */}
                    <div className="border-t pt-4 mt-6">
                        <div className="space-y-4">
                            
                            {/* Pagamento de Diárias */}
                            <Collapsible 
                                open={fieldCollapseState['diarias_detalhe']} 
                                onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['diarias_detalhe']: open }))}
                                className="border-b pb-4 last:border-b-0 last:pb-0"
                            >
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer py-2">
                                        <h4 className="text-base font-medium flex items-center gap-2">
                                            Pagamento de Diárias (33.90.15 e 33.90.30)
                                        </h4>
                                        {fieldCollapseState['diarias_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="mt-4 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="diaria_referencia_legal">Referência Legal das Diárias</Label>
                                            <Input
                                                id="diaria_referencia_legal"
                                                value={formState.diaria_referencia_legal || ''}
                                                onChange={(e) => handleInputChange('diaria_referencia_legal', e.target.value)}
                                                placeholder="Ex: Lei 13.328/2016 e Portaria 1.000/2023"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="taxa_embarque">Taxa de Embarque (R$)</Label>
                                                <CurrencyInput
                                                    id="taxa_embarque"
                                                    rawDigits={rawValues.taxa_embarque}
                                                    onChange={(raw) => handleCurrencyChange('taxa_embarque', raw)}
                                                    placeholder="0,00"
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>
                                        
                                        <h5 className="text-sm font-semibold mt-4">Valores Unitários por Posto/Localidade</h5>
                                        
                                        <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div className="font-bold">Posto/Graduação</div>
                                            <div className="font-bold text-center">Brasília (R$)</div>
                                            <div className="font-bold text-center">Capitais (R$)</div>
                                            <div className="font-bold text-center">Demais (R$)</div>
                                            
                                            {/* Oficiais Generais */}
                                            <div className="text-muted-foreground">Oficiais Generais</div>
                                            <CurrencyInput rawDigits={rawValues.diaria_of_gen_bsb} onChange={(raw) => handleCurrencyChange('diaria_of_gen_bsb', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_gen_capitais} onChange={(raw) => handleCurrencyChange('diaria_of_gen_capitais', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_gen_demais} onChange={(raw) => handleCurrencyChange('diaria_of_gen_demais', raw)} placeholder="0,00" disabled={loading} />
                                            
                                            {/* Oficiais Superiores */}
                                            <div className="text-muted-foreground">Oficiais Superiores</div>
                                            <CurrencyInput rawDigits={rawValues.diaria_of_sup_bsb} onChange={(raw) => handleCurrencyChange('diaria_of_sup_bsb', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_sup_capitais} onChange={(raw) => handleCurrencyChange('diaria_of_sup_capitais', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_sup_demais} onChange={(raw) => handleCurrencyChange('diaria_of_sup_demais', raw)} placeholder="0,00" disabled={loading} />
                                            
                                            {/* Oficiais Intermediários e Sargentos */}
                                            <div className="text-muted-foreground">Of. Interm. e Sargentos</div>
                                            <CurrencyInput rawDigits={rawValues.diaria_of_int_sgt_bsb} onChange={(raw) => handleCurrencyChange('diaria_of_int_sgt_bsb', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_int_sgt_capitais} onChange={(raw) => handleCurrencyChange('diaria_of_int_sgt_capitais', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_of_int_sgt_demais} onChange={(raw) => handleCurrencyChange('diaria_of_int_sgt_demais', raw)} placeholder="0,00" disabled={loading} />
                                            
                                            {/* Demais Praças */}
                                            <div className="text-muted-foreground">Demais Praças</div>
                                            <CurrencyInput rawDigits={rawValues.diaria_demais_pracas_bsb} onChange={(raw) => handleCurrencyChange('diaria_demais_pracas_bsb', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_demais_pracas_capitais} onChange={(raw) => handleCurrencyChange('diaria_demais_pracas_capitais', raw)} placeholder="0,00" disabled={loading} />
                                            <CurrencyInput rawDigits={rawValues.diaria_demais_pracas_demais} onChange={(raw) => handleCurrencyChange('diaria_demais_pracas_demais', raw)} placeholder="0,00" disabled={loading} />
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                            
                            {/* Diretrizes de Passagens (Contratos/Trechos) */}
                            <Collapsible 
                                open={fieldCollapseState['passagens_detalhe']} 
                                onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['passagens_detalhe']: open }))}
                                className="border-b pb-4 last:border-b-0 last:pb-0"
                            >
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer py-2">
                                        <h4 className="text-base font-medium flex items-center gap-2">
                                            Contratos de Passagens (33.90.33)
                                        </h4>
                                        {fieldCollapseState['passagens_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="mt-2">
                                        {renderPassagensSection()}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                            
                            {/* Diretrizes de Concessionária */}
                            <Collapsible 
                                open={fieldCollapseState['concessionaria_detalhe']} 
                                onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['concessionaria_detalhe']: open }))}
                                className="border-b pb-4 last:border-b-0 last:pb-0"
                            >
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer py-2">
                                        <h4 className="text-base font-medium flex items-center gap-2">
                                            Concessionárias (33.90.39)
                                        </h4>
                                        {fieldCollapseState['concessionaria_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="mt-2">
                                        {renderConcessionariaSection()}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                            
                            {/* Diretrizes de Material de Consumo (NOVO) */}
                            <Collapsible 
                                open={fieldCollapseState['material_consumo_detalhe']} 
                                onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['material_consumo_detalhe']: open }))}
                                className="border-b pb-4 last:border-b-0 last:pb-0"
                            >
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer py-2">
                                        <h4 className="text-base font-medium flex items-center gap-2">
                                            Material de Consumo (33.90.30)
                                        </h4>
                                        {fieldCollapseState['material_consumo_detalhe'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="mt-2">
                                        {renderMaterialConsumoSection()}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                            
                            {/* OUTROS CAMPOS OPERACIONAIS (Fatores e Valores Simples) */}
                            <Collapsible 
                                open={fieldCollapseState['outros_fatores']} 
                                onOpenChange={(open) => setFieldCollapseState(prev => ({ ...prev, ['outros_fatores']: open }))}
                                className="border-b pb-4 last:border-b-0 last:pb-0"
                            >
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center justify-between cursor-pointer py-2">
                                        <h4 className="text-base font-medium flex items-center gap-2">
                                            Outros Fatores e Valores
                                        </h4>
                                        {fieldCollapseState['outros_fatores'] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        
                                        {/* Verba Operacional */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_verba_operacional_dia">Verba Operacional (R$/dia/equipe)</Label>
                                            <CurrencyInput
                                                id="valor_verba_operacional_dia"
                                                rawDigits={rawValues.valor_verba_operacional_dia}
                                                onChange={(raw) => handleCurrencyChange('valor_verba_operacional_dia', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        {/* Suprimento de Fundos */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_suprimentos_fundo_dia">Suprimento de Fundos (R$/dia/equipe)</Label>
                                            <CurrencyInput
                                                id="valor_suprimentos_fundo_dia"
                                                rawDigits={rawValues.valor_suprimentos_fundo_dia}
                                                onChange={(raw) => handleCurrencyChange('valor_suprimentos_fundo_dia', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        {/* Complemento de Alimentação */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_complemento_alimentacao">Complemento de Alimentação (R$/dia/militar)</Label>
                                            <CurrencyInput
                                                id="valor_complemento_alimentacao"
                                                rawDigits={rawValues.valor_complemento_alimentacao}
                                                onChange={(raw) => handleCurrencyChange('valor_complemento_alimentacao', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        {/* Fator Passagens Aéreas */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fator_passagens_aereas">Fator Passagens Aéreas (ND 33.90.33)</Label>
                                            <CurrencyInput
                                                id="fator_passagens_aereas"
                                                rawDigits={rawValues.fator_passagens_aereas}
                                                onChange={(raw) => handleCurrencyChange('fator_passagens_aereas', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Fator multiplicador aplicado ao valor da passagem (ex: 1.10 para 10% de taxa).
                                            </p>
                                        </div>
                                        
                                        {/* Fator Serviços de Terceiros */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fator_servicos_terceiros">Fator Serviços de Terceiros (ND 33.90.39)</Label>
                                            <CurrencyInput
                                                id="fator_servicos_terceiros"
                                                rawDigits={rawValues.fator_servicos_terceiros}
                                                onChange={(raw) => handleCurrencyChange('fator_servicos_terceiros', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Fator multiplicador para serviços diversos (ex: 1.10 para 10% de taxa).
                                            </p>
                                        </div>
                                        
                                        {/* Fator Material de Consumo */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fator_material_consumo">Fator Material de Consumo (ND 33.90.30)</Label>
                                            <CurrencyInput
                                                id="fator_material_consumo"
                                                rawDigits={rawValues.fator_material_consumo}
                                                onChange={(raw) => handleCurrencyChange('fator_material_consumo', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Fator multiplicador para material de consumo (ex: 1.10 para 10% de taxa).
                                            </p>
                                        </div>
                                        
                                        {/* Fator Concessionária */}
                                        <div className="space-y-2">
                                            <Label htmlFor="fator_concessionaria">Fator Concessionária (ND 33.90.39)</Label>
                                            <CurrencyInput
                                                id="fator_concessionaria"
                                                rawDigits={rawValues.fator_concessionaria}
                                                onChange={(raw) => handleCurrencyChange('fator_concessionaria', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Fator multiplicador para custos de concessionária (ex: 1.10 para 10% de taxa).
                                            </p>
                                        </div>
                                        
                                        {/* Fretamento Aéreo */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_fretamento_aereo_hora">Fretamento Aéreo (R$/hora)</Label>
                                            <CurrencyInput
                                                id="valor_fretamento_aereo_hora"
                                                rawDigits={rawValues.valor_fretamento_aereo_hora}
                                                onChange={(raw) => handleCurrencyChange('valor_fretamento_aereo_hora', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        {/* Locação de Estruturas */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_locacao_estrutura_dia">Locação de Estruturas (R$/dia)</Label>
                                            <CurrencyInput
                                                id="valor_locacao_estrutura_dia"
                                                rawDigits={rawValues.valor_locacao_estrutura_dia}
                                                onChange={(raw) => handleCurrencyChange('valor_locacao_estrutura_dia', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                        
                                        {/* Locação de Viaturas */}
                                        <div className="space-y-2">
                                            <Label htmlFor="valor_locacao_viaturas_dia">Locação de Viaturas (R$/dia)</Label>
                                            <CurrencyInput
                                                id="valor_locacao_viaturas_dia"
                                                rawDigits={rawValues.valor_locacao_viaturas_dia}
                                                onChange={(raw) => handleCurrencyChange('valor_locacao_viaturas_dia', raw)}
                                                placeholder="0,00"
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2 mt-6">
                                        <Label htmlFor="observacoes">Observações Gerais</Label>
                                        <Textarea
                                            id="observacoes"
                                            value={formState.observacoes || ''}
                                            onChange={(e) => handleInputChange('observacoes', e.target.value)}
                                            placeholder="Observações sobre as diretrizes operacionais..."
                                            disabled={loading}
                                            rows={3}
                                        />
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </div>
                </Card>
            </div>
            
            {/* Diálogos de Detalhe */}
            <PassagemDiretrizFormDialog
                open={showPassagemDialog}
                onOpenChange={setShowPassagemDialog}
                selectedYear={selectedYear}
                diretrizToEdit={passagemToEdit}
                onSave={handleSavePassagem}
                loading={loading}
            />
            
            <ConcessionariaDiretrizFormDialog
                open={showConcessionariaDialog}
                onOpenChange={setShowConcessionariaDialog}
                selectedYear={selectedYear}
                diretrizToEdit={concessionariaToEdit}
                onSave={handleSaveConcessionaria}
                loading={loading}
            />
            
            <MaterialConsumoDiretrizFormDialog
                open={showMaterialConsumoDialog}
                onOpenChange={setShowMaterialConsumoDialog}
                selectedYear={selectedYear}
                diretrizToEdit={materialConsumoToEdit}
                onSave={handleSaveMaterialConsumo}
                loading={loading}
            />
        </div>
    );
};

export default CustosOperacionaisPage;