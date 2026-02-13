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
    Tractor, 
    TentTree, 
    Shirt, 
    ClipboardList, 
    Trash2, 
    FileText, 
    Printer, 
    Plus, 
    Minus, 
    RefreshCw, 
    XCircle, 
    Pencil,
    Info
} from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency, formatPregao } from "@/lib/formatUtils";
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
    | "outros" 
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

    // Novos campos para Fretamento Aéreo
    const [tipoAnv, setTipoAnv] = useState("");
    const [capacidade, setCapacidade] = useState("");
    const [velocidadeCruzeiro, setVelocidadeCruzeiro] = useState<number | "">("");
    const [distanciaPercorrer, setDistanciaPercorrer] = useState<number | "">("");

    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoServico[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    
    // Estados de Memória
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");

    // --- CÁLCULOS AUXILIARES ---
    const suggestedHV = useMemo(() => {
        if (activeTab === "fretamento-aereo" && velocidadeCruzeiro && distanciaPercorrer) {
            return Math.ceil(Number(distanciaPercorrer) / Number(velocidadeCruzeiro));
        }
        return null;
    }, [activeTab, velocidadeCruzeiro, distanciaPercorrer]);

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
                detalhes_planejamento: { 
                    itens_selecionados: selectedItems,
                    tipo_anv: tipoAnv,
                    capacidade: capacidade,
                    velocidade_cruzeiro: velocidadeCruzeiro,
                    distancia_percorrer: distanciaPercorrer
                } as any,
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
            setTipoAnv("");
            setCapacidade("");
            setVelocidadeCruzeiro("");
            setDistanciaPercorrer("");
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
            // Se for fretamento aéreo e tivermos sugestão, aplicamos a sugestão ao novo item
            const initialQty = (activeTab === "fretamento-aereo" && suggestedHV) ? suggestedHV : 1;
            return existing ? existing : { ...item, quantidade: initialQty, valor_total: initialQty * item.valor_unitario };
        });
        setSelectedItems(newItems);
    };

    const handleQuantityChange = (id: string, rawValue: string) => {
        const qty = parseInt(rawValue) || 0;
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
                        <CardTitle>Contratação de Serviços e Locações</CardTitle>
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
                                            <TabsTrigger value="locacao-engenharia" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Tractor className="h-4 w-4" /> Eqp Engenharia</TabsTrigger>
                                            <TabsTrigger value="locacao-estruturas" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><TentTree className="h-4 w-4" /> Estruturas</TabsTrigger>
                                            <TabsTrigger value="servico-lavanderia" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Shirt className="h-4 w-4" /> Lavanderia</TabsTrigger>
                                            <TabsTrigger value="servico-grafico" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Printer className="h-4 w-4" /> Gráfico</TabsTrigger>
                                            <TabsTrigger value="outros" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><ClipboardList className="h-4 w-4" /> Outros</TabsTrigger>
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
                                                                <Input 
                                                                    type="number" 
                                                                    value={diasOperacao || ""} 
                                                                    onChange={(e) => setDiasOperacao(Number(e.target.value))} 
                                                                    placeholder="Ex: 15" 
                                                                    disabled={!isPTrabEditable} 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                                                                        handleEnterToNextField(e);
                                                                    }}
                                                                    onWheel={(e) => e.currentTarget.blur()}
                                                                    className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Efetivo *</Label>
                                                                <Input 
                                                                    type="number" 
                                                                    value={efetivo || ""} 
                                                                    onChange={(e) => setEfetivo(Number(e.target.value))} 
                                                                    placeholder="Ex: 50" 
                                                                    disabled={!isPTrabEditable} 
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                                                                        handleEnterToNextField(e);
                                                                    }}
                                                                    onWheel={(e) => e.currentTarget.blur()}
                                                                    className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                                                />
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
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <div className="space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <h4 className="text-base font-semibold">Itens de Fretamento Aéreo</h4>
                                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
                                                    </div>

                                                    {/* Novos campos para Fretamento Aéreo */}
                                                    {activeTab === "fretamento-aereo" && (
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                                            <div className="space-y-2">
                                                                <Label>Tipo Anv</Label>
                                                                <Input 
                                                                    value={tipoAnv} 
                                                                    onChange={(e) => setTipoAnv(e.target.value)} 
                                                                    placeholder="Ex: Caravan" 
                                                                    disabled={!isPTrabEditable}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Capacidade</Label>
                                                                <Input 
                                                                    value={capacidade} 
                                                                    onChange={(e) => setCapacidade(e.target.value)} 
                                                                    placeholder="Ex: 9 Pax ou 450kg" 
                                                                    disabled={!isPTrabEditable}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Velocidade de Cruzeiro</Label>
                                                                <div className="relative">
                                                                    <Input 
                                                                        type="number" 
                                                                        value={velocidadeCruzeiro} 
                                                                        onChange={(e) => setVelocidadeCruzeiro(e.target.value === "" ? "" : Number(e.target.value))} 
                                                                        placeholder="Ex: 350" 
                                                                        disabled={!isPTrabEditable}
                                                                        onWheel={(e) => e.currentTarget.blur()}
                                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-14 text-right"
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                                                                        Km/h
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Distância a percorrer</Label>
                                                                <div className="relative">
                                                                    <Input 
                                                                        type="number" 
                                                                        value={distanciaPercorrer} 
                                                                        onChange={(e) => setDistanciaPercorrer(e.target.value === "" ? "" : Number(e.target.value))} 
                                                                        placeholder="Ex: 1500" 
                                                                        disabled={!isPTrabEditable}
                                                                        onWheel={(e) => e.currentTarget.blur()}
                                                                        className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none pr-10 text-right"
                                                                    />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">
                                                                        Km
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

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
                                                                    {selectedItems.map(item => {
                                                                        const isCharter = activeTab === "fretamento-aereo";
                                                                        const showHvWarning = isCharter && suggestedHV !== null && item.quantidade !== suggestedHV;

                                                                        return (
                                                                            <TableRow key={item.id}>
                                                                                <TableCell className="align-top pt-4">
                                                                                    <div className="space-y-1">
                                                                                        <Input 
                                                                                            type="number" 
                                                                                            min={0}
                                                                                            value={item.quantidade === 0 ? "" : item.quantidade} 
                                                                                            onChange={(e) => handleQuantityChange(item.id, e.target.value)} 
                                                                                            onWheel={(e) => e.currentTarget.blur()}
                                                                                            className={cn(
                                                                                                "h-8 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                                                                                showHvWarning && "border-orange-500 focus-visible:ring-orange-500"
                                                                                            )} 
                                                                                        />
                                                                                        {showHvWarning && (
                                                                                            <div className="flex flex-col items-center gap-1 px-1">
                                                                                                <span className="text-[9px] text-orange-600 font-bold leading-tight text-center">
                                                                                                    Sugerido: {suggestedHV} HV
                                                                                                </span>
                                                                                                <Button 
                                                                                                    variant="ghost" 
                                                                                                    size="sm" 
                                                                                                    className="h-5 text-[8px] px-1 text-orange-700 hover:text-orange-800 hover:bg-orange-50"
                                                                                                    onClick={() => handleQuantityChange(item.id, suggestedHV.toString())}
                                                                                                >
                                                                                                    Aplicar Sugestão
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-xs">
                                                                                    <p className="font-medium">
                                                                                        {item.descricao_reduzida || item.descricao_item}
                                                                                    </p>
                                                                                    <p className="text-muted-foreground text-[10px]">
                                                                                        Cód. CATSER: {item.codigo_catser || item.codigo_catmat || 'N/A'}
                                                                                    </p>
                                                                                    <p className="text-muted-foreground text-[10px]">
                                                                                        Pregão: {formatPregao(item.numero_pregao)} | UASG: {formatCodug(item.uasg) || 'N/A'}
                                                                                    </p>
                                                                                    {isCharter && suggestedHV !== null && (
                                                                                        <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded flex items-start gap-2">
                                                                                            <Info className="h-3 w-3 text-blue-600 mt-0.5" />
                                                                                            <p className="text-[10px] text-blue-700 leading-tight">
                                                                                                Cálculo: {distanciaPercorrer}km / {velocidadeCruzeiro}km/h = {(Number(distanciaPercorrer) / Number(velocidadeCruzeiro)).toFixed(2)}h. 
                                                                                                <br />
                                                                                                <strong>Valor arredondado para cima: {suggestedHV} HV.</strong>
                                                                                            </p>
                                                                                        </div>
                                                                                    )}
                                                                                </TableCell>
                                                                                <TableCell className="text-right text-xs text-muted-foreground align-top pt-4">{formatCurrency(item.valor_unitario)}</TableCell>
                                                                                <TableCell className="text-right text-sm font-bold align-top pt-4">{formatCurrency(item.valor_total)}</TableCell>
                                                                                <TableCell className="align-top pt-3"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                                                            </TableRow>
                                                                        );
                                                                    })}
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

                                            <div className="flex justify-end gap-3 pt-4">
                                                <Button className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={selectedItems.length === 0 || saveMutation.isPending || efetivo <= 0 || diasOperacao <= 0} onClick={() => saveMutation.mutate()}>
                                                    {saveMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                                    Salvar Item na Lista
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