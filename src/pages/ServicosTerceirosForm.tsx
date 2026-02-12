import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
    ArrowLeft, 
    Loader2, 
    Save, 
    Sparkles, 
    AlertCircle, 
    Check, 
    Package, 
    Briefcase, 
    Plane, 
    Satellite, 
    Car, 
    HardHat, 
    Trash2, 
    FileText, 
    Printer, 
    Plus, 
    Minus, 
    RefreshCw, 
    XCircle, 
    Pencil,
    Toilet,
    Tractor,
    Shirt
} from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ItemAquisicaoServico, DetalhesPlanejamentoServico } from "@/types/diretrizesServicosTerceiros";
import ServicosTerceirosItemSelectorDialog from "@/components/ServicosTerceirosItemSelectorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateServicoTotals, ServicoTerceiroRegistro } from "@/lib/servicosTerceirosUtils";
import ServicosTerceirosMemoria from "@/components/ServicosTerceirosMemoria";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type CategoriaServico = 
    | "fretamento-aereo" 
    | "servico-satelital" 
    | "locacao-veiculos" 
    | "locacao-engenharia" 
    | "locacao-banheiro" 
    | "locacao-estruturas" 
    | "servico-lavanderia" 
    | "servico-grafico";

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

const ServicosTerceirosForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const initialTab = (searchParams.get('tab') as CategoriaServico) || "fretamento-aereo";
    
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();

    // --- ESTADOS DO FORMULÁRIO ---
    const [activeTab, setActiveTab] = useState<CategoriaServico>(initialTab);
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");
    const [efetivo, setEfetivo] = useState<number>(0);
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });

    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoServico[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    // Estados de Memória
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ServicoTerceiroRegistro[]>({
        queryKey: ['servicosTerceirosRegistros', ptrabId],
        queryFn: () => fetchPTrabRecords('servicos_terceiros_registros' as any, ptrabId!),
        enabled: !!ptrabId,
    });

    // --- MUTATIONS ---
    const saveMutation = useMutation({
        mutationFn: async () => {
            const { totalND30, totalND39, totalGeral } = calculateServicoTotals(selectedItems);
            const payload = {
                p_trab_id: ptrabId,
                organizacao: omFavorecida.nome,
                ug: omFavorecida.ug,
                om_detentora: omDestino.nome,
                ug_detentora: omDestino.ug,
                dias_operacao: diasOperacao,
                efetivo: efetivo,
                fase_atividade: faseAtividade,
                categoria: activeTab,
                detalhes_planejamento: { itens_selecionados: selectedItems } as any,
                valor_total: totalGeral,
                valor_nd_30: totalND30,
                valor_nd_39: totalND39,
            };

            const { error } = await supabase.from('servicos_terceiros_registros').insert([payload]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Planejamento salvo com sucesso!");
            setSelectedItems([]);
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('servicos_terceiros_registros').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        }
    });

    // --- HANDLERS ---
    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setOmFavorecida({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            if (!omDestino.id) setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else setOmFavorecida({ nome: "", ug: "", id: "" });
    };

    const handleItemsSelected = (items: ItemAquisicaoServico[]) => {
        const newItems = items.map(item => {
            const existing = selectedItems.find(i => i.id === item.id);
            return existing ? existing : { ...item, quantidade: 1, valor_total: item.valor_unitario };
        });
        setSelectedItems(newItems);
    };

    const handleQuantityChange = (id: string, qty: number) => {
        setSelectedItems(prev => prev.map(item => 
            item.id === id ? { ...item, quantidade: qty, valor_total: qty * item.valor_unitario } : item
        ));
    };

    const totalLote = useMemo(() => selectedItems.reduce((acc, item) => acc + (item.valor_total || 0), 0), [selectedItems]);

    // Handlers de Memória
    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('servicos_terceiros_registros').update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else {
            toast.success("Memória atualizada.");
            setEditingMemoriaId(null);
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
        }
    };

    const handleRestoreMemoria = async (id: string) => {
        const { error } = await supabase.from('servicos_terceiros_registros').update({ detalhamento_customizado: null }).eq('id', id);
        if (error) toast.error("Erro ao restaurar.");
        else {
            toast.success("Memória automática restaurada.");
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
        }
    };

    // --- RENDERIZAÇÃO ---
    const isGlobalLoading = isLoadingPTrab || isLoadingOms || isLoadingRegistros;
    if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isBaseFormReady = omFavorecida.nome !== "" && faseAtividade !== "";

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle>Serviços e Locações</CardTitle>
                        <CardDescription>Planejamento de necessidades de serviços de terceiros e locações.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={omFavorecida.id || undefined} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM Favorecida" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={faseAtividade} onChange={setFaseAtividade} disabled={!isPTrabEditable} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR PLANEJAMENTO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                    
                                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as CategoriaServico); setSelectedItems([]); }} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto gap-1 bg-muted p-1 mb-6">
                                            <TabsTrigger value="fretamento-aereo" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Plane className="h-4 w-4" /> Fretamento</TabsTrigger>
                                            <TabsTrigger value="servico-satelital" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Satellite className="h-4 w-4" /> Satelital</TabsTrigger>
                                            <TabsTrigger value="locacao-veiculos" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Car className="h-4 w-4" /> Veículos</TabsTrigger>
                                            <TabsTrigger value="locacao-engenharia" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Tractor className="h-4 w-4" /> Eqp ENGENHARIA</TabsTrigger>
                                            <TabsTrigger value="locacao-banheiro" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Toilet className="h-4 w-4" /> Banheiros</TabsTrigger>
                                            <TabsTrigger value="locacao-estruturas" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><HardHat className="h-4 w-4" /> Estruturas</TabsTrigger>
                                            <TabsTrigger value="servico-lavanderia" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Shirt className="h-4 w-4" /> Lavanderia</TabsTrigger>
                                            <TabsTrigger value="servico-grafico" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Printer className="h-4 w-4" /> Gráfico</TabsTrigger>
                                        </TabsList>

                                        <Card className="bg-muted/50 rounded-lg p-4">
                                            {/* Dados da Solicitação */}
                                            <Card className="rounded-lg mb-4">
                                                <CardHeader className="py-3">
                                                    <CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle>
                                                </CardHeader>
                                                <CardContent className="pt-2">
                                                    <div className="p-4 bg-background rounded-lg border">
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Período (Nr Dias) *</Label>
                                                                <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} className="max-w-[150px]" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Efetivo *</Label>
                                                                <Input type="number" value={efetivo || ""} onChange={(e) => setEfetivo(Number(e.target.value))} placeholder="Ex: 50" disabled={!isPTrabEditable} className="max-w-[150px]" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>OM Destino do Recurso *</Label>
                                                                <OmSelector selectedOmId={omDestino.id || undefined} onChange={(om) => om && setOmDestino({nome: om.nome_om, ug: om.codug_om, id: om.id})} placeholder="Selecione a OM Destino" disabled={!isPTrabEditable} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UG Destino</Label>
                                                                <Input value={formatCodug(omDestino.ug)} disabled className="bg-muted/50" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* Seleção de Itens */}
                                            {efetivo > 0 && diasOperacao > 0 && (
                                                <Card className="mt-4 rounded-lg p-4 bg-background">
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <h4 className="text-base font-semibold">Itens de {activeTab.replace('-', ' ')} ({selectedItems.length})</h4>
                                                            <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
                                                        </div>

                                                        {selectedItems.length > 0 ? (
                                                            <div className="border rounded-md overflow-hidden">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead className="w-[100px] text-center">Qtd</TableHead>
                                                                            <TableHead>Descrição do Serviço</TableHead>
                                                                            <TableHead className="text-right w-[120px]">Vlr Unitário</TableHead>
                                                                            <TableHead className="text-right w-[120px]">Total</TableHead>
                                                                            <TableHead className="w-[50px]"></TableHead>
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {selectedItems.map(item => (
                                                                            <TableRow key={item.id}>
                                                                                <TableCell><Input type="number" value={item.quantidade} onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))} className="h-8 text-center" /></TableCell>
                                                                                <TableCell className="text-xs font-medium">{item.descricao_reduzida || item.descricao_item}</TableCell>
                                                                                <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(item.valor_unitario)}</TableCell>
                                                                                <TableCell className="text-right text-sm font-bold">{formatCurrency(item.valor_total)}</TableCell>
                                                                                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        ) : (
                                                            <Alert variant="default" className="border border-gray-300">
                                                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                                                <AlertTitle>Nenhum Item Selecionado</AlertTitle>
                                                                <AlertDescription>Importe itens da diretriz para iniciar o planejamento desta categoria.</AlertDescription>
                                                            </Alert>
                                                        )}
                                                    </div>

                                                    <div className="flex justify-between items-center p-3 mt-4 border-t pt-4">
                                                        <span className="font-bold text-sm uppercase">VALOR TOTAL DO LOTE:</span>
                                                        <span className="font-extrabold text-lg text-primary">{formatCurrency(totalLote)}</span>
                                                    </div>
                                                </Card>
                                            )}

                                            <div className="flex justify-end gap-3 pt-4">
                                                <Button size="lg" className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={selectedItems.length === 0 || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                                                    {saveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Planejamento
                                                </Button>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÃO 3: REGISTROS SALVOS */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-accent" />
                                        Serviços Cadastrados ({registros.length})
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {registros.map(reg => (
                                            <Card key={reg.id} className="p-4 bg-primary/5 border-primary/20">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-lg text-primary capitalize">{reg.categoria.replace('-', ' ')}</h4>
                                                            <Badge variant="outline" className="text-xs">{reg.fase_atividade}</Badge>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{reg.organizacao} | {reg.efetivo} militares | {reg.dias_operacao} dias</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-extrabold text-xl text-primary">{formatCurrency(Number(reg.valor_total))}</span>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteMutation.mutate(reg.id)} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* SEÇÃO 4: MEMÓRIAS DE CÁLCULO */}
                            {registros && registros.length > 0 && (
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {registros.map(reg => (
                                        <ServicosTerceirosMemoria 
                                            key={`mem-${reg.id}`}
                                            registro={reg}
                                            isPTrabEditable={isPTrabEditable}
                                            isSaving={false}
                                            editingMemoriaId={editingMemoriaId}
                                            memoriaEdit={memoriaEdit}
                                            setMemoriaEdit={setMemoriaEdit}
                                            onStartEdit={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }}
                                            onCancelEdit={() => setEditingMemoriaId(null)}
                                            onSave={handleSaveMemoria}
                                            onRestore={handleRestoreMemoria}
                                        />
                                    ))}
                                </section>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ServicosTerceirosItemSelectorDialog 
                open={isSelectorOpen} 
                onOpenChange={setIsSelectorOpen} 
                selectedYear={new Date().getFullYear()} 
                initialItems={selectedItems} 
                onSelect={handleItemsSelected} 
                onAddDiretriz={() => navigate('/config/custos-operacionais')} 
                categoria={activeTab}
            />
        </div>
    );
};

export default ServicosTerceirosForm;