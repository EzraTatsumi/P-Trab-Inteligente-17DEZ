import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Sparkles, AlertCircle, Check, Package, Briefcase, Plane, Satellite, Car, HardHat, Trash2, FileText, Printer, Plus, Minus } from "lucide-react";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCodug, formatCurrency } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData } from "@/lib/ptrabUtils";
import { Badge } from "@/components/ui/badge";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import ServicosTerceirosItemSelectorDialog from "@/components/ServicosTerceirosItemSelectorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

    // Itens selecionados para a aba atual
    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoServico[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);

    // --- DATA FETCHING ---
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
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

    // --- RENDERIZAÇÃO ---
    const isGlobalLoading = isLoadingPTrab || isLoadingOms;
    if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isBaseFormReady = omFavorecida.nome !== "" && faseAtividade !== "";

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao P Trab
                </Button>

                <Card className="shadow-md">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary" /> Planejamento de Serviços e Locações</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        
                        {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                        <section className="space-y-4 border-b pb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs">1</span> Dados da Organização</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>OM Favorecida *</Label>
                                    <OmSelector selectedOmId={omFavorecida.id || undefined} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM" disabled={!isPTrabEditable} />
                                </div>
                                <div className="space-y-2"><Label>UG Favorecida</Label><Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" /></div>
                                <div className="space-y-2">
                                    <Label>Fase da Atividade *</Label>
                                    <FaseAtividadeSelect value={faseAtividade} onChange={setFaseAtividade} disabled={!isPTrabEditable} />
                                </div>
                            </div>
                        </section>

                        {/* SEÇÃO 2A: PARÂMETROS BÁSICOS */}
                        {isBaseFormReady && (
                            <section className="space-y-4 border-b pb-6 animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-lg font-semibold flex items-center gap-2"><span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs">2</span> Parâmetros da Solicitação</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                                    <div className="space-y-2"><Label>Efetivo *</Label><Input type="number" value={efetivo || ""} onChange={(e) => setEfetivo(Number(e.target.value))} placeholder="Ex: 50" disabled={!isPTrabEditable} /></div>
                                    <div className="space-y-2"><Label>Período (Dias) *</Label><Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} /></div>
                                    <div className="space-y-2">
                                        <Label>OM Destino do Recurso *</Label>
                                        <OmSelector selectedOmId={omDestino.id || undefined} onChange={(om) => om && setOmDestino({nome: om.nome_om, ug: om.codug_om, id: om.id})} placeholder="Selecione a OM Destino" disabled={!isPTrabEditable} />
                                    </div>
                                    <div className="space-y-2"><Label>UG Destino</Label><Input value={formatCodug(omDestino.ug)} disabled className="bg-muted/50" /></div>
                                </div>
                            </section>
                        )}

                        {/* SEÇÃO 2B: SELEÇÃO DE ITENS (DINÂMICO) */}
                        {isBaseFormReady && efetivo > 0 && diasOperacao > 0 && (
                            <section className="space-y-6 animate-in fade-in zoom-in-95">
                                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as CategoriaServico); setSelectedItems([]); }} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto gap-1 bg-muted p-1">
                                        <TabsTrigger value="fretamento-aereo" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Plane className="h-4 w-4" /> Fretamento</TabsTrigger>
                                        <TabsTrigger value="servico-satelital" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Satellite className="h-4 w-4" /> Satelital</TabsTrigger>
                                        <TabsTrigger value="locacao-veiculos" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Car className="h-4 w-4" /> Veículos</TabsTrigger>
                                        <TabsTrigger value="locacao-engenharia" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><HardHat className="h-4 w-4" /> Engenharia</TabsTrigger>
                                        <TabsTrigger value="locacao-banheiro" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Trash2 className="h-4 w-4" /> Banheiros</TabsTrigger>
                                        <TabsTrigger value="locacao-estruturas" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Package className="h-4 w-4" /> Estruturas</TabsTrigger>
                                        <TabsTrigger value="servico-lavanderia" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><RefreshCw className="h-4 w-4" /> Lavanderia</TabsTrigger>
                                        <TabsTrigger value="servico-grafico" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold"><Printer className="h-4 w-4" /> Gráfico</TabsTrigger>
                                    </TabsList>

                                    <div className="mt-6 p-4 border rounded-xl bg-background shadow-inner min-h-[200px]">
                                        <div className="flex justify-between items-center mb-4">
                                            <h4 className="font-bold text-primary">Itens de {activeTab.replace('-', ' ')}</h4>
                                            <Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button>
                                        </div>

                                        {selectedItems.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[80px]">Qtd</TableHead>
                                                        <TableHead>Descrição do Serviço</TableHead>
                                                        <TableHead className="text-right">Vlr Unitário</TableHead>
                                                        <TableHead className="text-right">Total</TableHead>
                                                        <TableHead className="w-[50px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedItems.map(item => (
                                                        <TableRow key={item.id}>
                                                            <TableCell><Input type="number" value={item.quantidade} onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))} className="h-8" /></TableCell>
                                                            <TableCell className="text-xs font-medium">{item.descricao_reduzida || item.descricao_item}</TableCell>
                                                            <TableCell className="text-right text-xs">{formatCurrency(item.valor_unitario)}</TableCell>
                                                            <TableCell className="text-right font-bold">{formatCurrency(item.valor_total)}</TableCell>
                                                            <TableCell><Button variant="ghost" size="icon" onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <div className="text-center py-12 text-muted-foreground italic">Nenhum item selecionado para esta categoria.</div>
                                        )}
                                    </div>
                                </Tabs>

                                {/* SEÇÃO 3: RESUMO E SALVAMENTO */}
                                <div className="flex flex-col md:row justify-between items-center gap-4 p-6 bg-primary/5 rounded-xl border-2 border-primary/20">
                                    <div className="text-center md:text-left">
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Estimado do Lote</p>
                                        <p className="text-3xl font-black text-primary">{formatCurrency(totalLote)}</p>
                                    </div>
                                    <Button size="lg" className="px-8" disabled={selectedItems.length === 0}><Save className="mr-2 h-5 w-5" /> Salvar Planejamento</Button>
                                </div>
                            </section>
                        )}
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