"use client";

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Pencil, Loader2, Calculator, Info, ClipboardList } from "lucide-react";
import { OmSelector } from "@/components/OmSelector";
import { OMData } from "@/lib/omUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { formatCurrency, numberToRawDigits, formatCurrencyInput } from "@/lib/formatUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CurrencyInput from "@/components/CurrencyInput";
import PageMetadata from "@/components/PageMetadata";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/components/SessionContextProvider";
import { sanitizeError } from "@/lib/errorUtils";

interface VerbaOperacionalRegistro {
    id: string;
    p_trab_id: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    quantidade_equipes: number;
    valor_total_solicitado: number;
    fase_atividade: string;
    detalhamento: string;
    valor_nd_30: number;
    valor_nd_39: number;
}

const FASES_ATIVIDADE = ["Planejamento", "Execução", "Mobilização", "Desmobilização"];

const VerbaOperacionalForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const { user } = useSession();
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();

    // Estados do Formulário Superior (Seção 1)
    const [selectedOm, setSelectedOm] = useState<OMData | null>(null);
    const [faseAtividade, setFaseAtividade] = useState("Planejamento");

    // Estados da Seção 2 (Simplificada)
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [qtdEquipes, setQtdEquipes] = useState<number>(0);
    const [valorTotalSolicitado, setValorTotalSolicitado] = useState<number>(0);
    const [rawValorTotal, setRawValorTotal] = useState("");

    // Memória de Cálculo (Automática)
    const [detalhamento, setDetalhamento] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    // Busca registros existentes
    const { data: registros = [], isLoading: isLoadingRegistros } = useQuery({
        queryKey: ['verbaOperacionalRegistros', ptrabId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('verba_operacional_registros')
                .select('*')
                .eq('p_trab_id', ptrabId);
            if (error) throw error;
            return data as VerbaOperacionalRegistro[];
        },
        enabled: !!ptrabId
    });

    // Função para gerar memória de cálculo
    const generateMemoriaCalculo = (dias: number, equipes: number, valor: number, omName: string, fase: string) => {
        if (!omName || dias <= 0 || equipes <= 0 || valor <= 0) return "";
        
        return `33.90.30 / 33.90.39 - Solicitação de Verba Operacional para ${equipes} equipes do ${omName}, durante ${dias} dias de ${fase}, operando fora da sede (hospedagem, alimentação, combustível, aluguel de viatura, manutenção de viatura e serviços diversos).\n\nO recurso precisa ser solicitado na Gestão Tesouro 0001, na ação 2866 (ação de caráter sigiloso).\n\nTotal: ${formatCurrency(valor)}.`;
    };

    // Atualiza memória de cálculo sempre que os campos mudarem
    useEffect(() => {
        const memoria = generateMemoriaCalculo(
            diasOperacao, 
            qtdEquipes, 
            valorTotalSolicitado, 
            selectedOm?.nome_om || "[OM]", 
            faseAtividade
        );
        setDetalhamento(memoria);
    }, [diasOperacao, qtdEquipes, valorTotalSolicitado, selectedOm, faseAtividade]);

    const handleValorChange = (val: number, digits: string) => {
        setValorTotalSolicitado(val);
        setRawValorTotal(digits);
    };

    const handleAddToList = () => {
        if (!selectedOm || diasOperacao <= 0 || qtdEquipes <= 0 || valorTotalSolicitado <= 0) {
            toast.error("Preencha todos os campos obrigatórios.");
            return;
        }

        const newRecord: Partial<VerbaOperacionalRegistro> = {
            p_trab_id: ptrabId!,
            organizacao: selectedOm.nome_om,
            ug: selectedOm.codug_om,
            om_detentora: selectedOm.nome_om, // Simplificado
            ug_detentora: selectedOm.codug_om,
            dias_operacao: diasOperacao,
            quantidade_equipes: qtdEquipes,
            valor_total_solicitado: valorTotalSolicitado,
            valor_nd_30: valorTotalSolicitado / 2, // Divisão padrão sugerida para suprir ambas as NDs na memória
            valor_nd_39: valorTotalSolicitado / 2,
            fase_atividade: faseAtividade,
            detalhamento: detalhamento
        };

        saveMutation.mutate(newRecord);
    };

    const saveMutation = useMutation({
        mutationFn: async (record: Partial<VerbaOperacionalRegistro>) => {
            if (editingId) {
                const { error } = await supabase
                    .from('verba_operacional_registros')
                    .update(record)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('verba_operacional_registros')
                    .insert([record]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verbaOperacionalRegistros', ptrabId] });
            toast.success(editingId ? "Registro atualizado!" : "Registro adicionado!");
            resetForm();
        },
        onError: (error) => toast.error(sanitizeError(error))
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('verba_operacional_registros').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verbaOperacionalRegistros', ptrabId] });
            toast.success("Registro removido.");
        }
    });

    const resetForm = () => {
        setEditingId(null);
        setDiasOperacao(0);
        setQtdEquipes(0);
        setValorTotalSolicitado(0);
        setRawValorTotal("");
    };

    const handleEdit = (reg: VerbaOperacionalRegistro) => {
        setEditingId(reg.id);
        setDiasOperacao(reg.dias_operacao);
        setQtdEquipes(reg.quantidade_equipes);
        setValorTotalSolicitado(reg.valor_total_solicitado);
        setRawValorTotal(numberToRawDigits(reg.valor_total_solicitado));
        setFaseAtividade(reg.fase_atividade);
        // O om selector precisaria de um estado mais complexo para setar via objeto, 
        // mas aqui mantemos o fluxo simples.
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Verba Operacional" />
            
            <div className="max-w-5xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-6 w-6 text-primary" />
                            Detalhamento de Verba Operacional
                        </CardTitle>
                        <CardDescription>Solicitação de recursos para equipes em campo (Tesouro 0001 / Ação 2866).</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        
                        {/* Seção 1: Identificação */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                            <div className="space-y-2">
                                <Label>Organização Militar (Solicitante)</Label>
                                <OmSelector 
                                    selectedOmId={selectedOm?.id} 
                                    onChange={(om) => setSelectedOm(om || null)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Fase da Atividade</Label>
                                <select 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={faseAtividade}
                                    onChange={(e) => setFaseAtividade(e.target.value)}
                                >
                                    {FASES_ATIVIDADE.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Seção 2: Planejamento Simplificado */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" /> Planejamento da Demanda
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Dias de Operação</Label>
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        value={diasOperacao || ""} 
                                        onChange={(e) => setDiasOperacao(parseInt(e.target.value) || 0)}
                                        placeholder="Ex: 15"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Qtd de Equipes</Label>
                                    <Input 
                                        type="number" 
                                        min="0" 
                                        value={qtdEquipes || ""} 
                                        onChange={(e) => setQtdEquipes(parseInt(e.target.value) || 0)}
                                        placeholder="Ex: 10"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Valor Total Solicitado</Label>
                                    <CurrencyInput 
                                        rawDigits={rawValorTotal} 
                                        onChange={handleValorChange} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção 3: Memória de Cálculo Automática */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                Memória de Cálculo (Gerada Automaticamente)
                                <Info className="h-3 w-3 text-muted-foreground" />
                            </Label>
                            <Textarea 
                                value={detalhamento} 
                                onChange={(e) => setDetalhamento(e.target.value)}
                                rows={6}
                                className="bg-muted/20 font-mono text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            {editingId && <Button variant="outline" onClick={resetForm}>Cancelar Edição</Button>}
                            <Button 
                                onClick={handleAddToList} 
                                disabled={saveMutation.isPending}
                            >
                                {saveMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
                                {editingId ? "Salvar Alterações" : "Adicionar à Lista"}
                            </Button>
                        </div>

                        {/* Seção 5: Tabela de Registros */}
                        <div className="pt-6 border-t">
                            <h3 className="font-bold mb-4">OMs Cadastradas no Plano</h3>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Organização (OM)</TableHead>
                                            <TableHead>Fase (Atividade)</TableHead>
                                            <TableHead className="text-center">Planejamento</TableHead>
                                            <TableHead className="text-right">Valor Total</TableHead>
                                            <TableHead className="text-center w-[100px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registros.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    Nenhum registro de verba operacional adicionado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            registros.map((reg) => (
                                                <TableRow key={reg.id}>
                                                    <TableCell className="font-medium">{reg.organizacao}</TableCell>
                                                    <TableCell>{reg.fase_atividade}</TableCell>
                                                    <TableCell className="text-center">
                                                        {reg.quantidade_equipes} Equipes / {reg.dias_operacao} Dias
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {formatCurrency(reg.valor_total_solicitado)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center gap-2">
                                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(reg)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(reg.id)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default VerbaOperacionalForm;