import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Sparkles, AlertCircle, Check, Package, Briefcase, Plane, Satellite, Car, HardHat, Trash2, FileText, Printer } from "lucide-react";
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

// Tipos para as categorias de serviços
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
    
    // Seção 1: Dados da Organização
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");

    // Seção 2A: Parâmetros Básicos
    const [efetivo, setEfetivo] = useState<number>(0);
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });

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
            // Por padrão, a OM Destino é a mesma da Favorecida
            if (!omDestino.id) {
                setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            }
        } else {
            setOmFavorecida({ nome: "", ug: "", id: "" });
        }
    };

    const handleOmDestinoChange = (omData: OMData | undefined) => {
        if (omData) {
            setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else {
            setOmDestino({ nome: "", ug: "", id: "" });
        }
    };

    // --- RENDERIZAÇÃO ---
    const isGlobalLoading = isLoadingPTrab || isLoadingOms;

    if (isGlobalLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Carregando formulário de serviços...</span>
            </div>
        );
    }

    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isBaseFormReady = omFavorecida.nome !== "" && faseAtividade !== "";

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar ao P Trab
                </Button>

                <Card className="shadow-md">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="flex items-center gap-2">
                            <Briefcase className="h-6 w-6 text-primary" />
                            Planejamento de Serviços e Locações
                        </CardTitle>
                        <CardDescription>
                            Detalhamento de contratações de serviços de terceiros e locações de equipamentos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        
                        {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO (FIXO) */}
                        <section className="space-y-4 border-b pb-6">
                            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs">1</span>
                                Dados da Organização
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>OM Favorecida *</Label>
                                    <OmSelector
                                        selectedOmId={omFavorecida.id || undefined}
                                        onChange={handleOmFavorecidaChange}
                                        placeholder="Selecione a OM"
                                        disabled={!isPTrabEditable}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>UG Favorecida</Label>
                                    <Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fase da Atividade *</Label>
                                    <FaseAtividadeSelect
                                        value={faseAtividade}
                                        onChange={setFaseAtividade}
                                        disabled={!isPTrabEditable}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* SEÇÃO 2A: PARÂMETROS BÁSICOS (FIXO) */}
                        {isBaseFormReady && (
                            <section className="space-y-4 border-b pb-6 animate-in fade-in slide-in-from-top-2">
                                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs">2</span>
                                    Parâmetros da Solicitação
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label>Efetivo *</Label>
                                        <Input 
                                            type="number" 
                                            value={efetivo || ""} 
                                            onChange={(e) => setEfetivo(Number(e.target.value))}
                                            placeholder="Ex: 50"
                                            disabled={!isPTrabEditable}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Período (Dias) *</Label>
                                        <Input 
                                            type="number" 
                                            value={diasOperacao || ""} 
                                            onChange={(e) => setDiasOperacao(Number(e.target.value))}
                                            placeholder="Ex: 15"
                                            disabled={!isPTrabEditable}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>OM Destino do Recurso *</Label>
                                        <OmSelector
                                            selectedOmId={omDestino.id || undefined}
                                            onChange={handleOmDestinoChange}
                                            placeholder="Selecione a OM Destino"
                                            disabled={!isPTrabEditable}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Destino</Label>
                                        <Input value={formatCodug(omDestino.ug)} disabled className="bg-muted/50" />
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* TABLIST: SELETOR DE CATEGORIA (DINÂMICO) */}
                        {isBaseFormReady && efetivo > 0 && diasOperacao > 0 && (
                            <section className="space-y-6 animate-in fade-in zoom-in-95">
                                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CategoriaServico)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8 h-auto gap-1 bg-muted p-1">
                                        <TabsTrigger value="fretamento-aereo" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Plane className="h-4 w-4" /> Fretamento
                                        </TabsTrigger>
                                        <TabsTrigger value="servico-satelital" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Satellite className="h-4 w-4" /> Satelital
                                        </TabsTrigger>
                                        <TabsTrigger value="locacao-veiculos" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Car className="h-4 w-4" /> Veículos
                                        </TabsTrigger>
                                        <TabsTrigger value="locacao-engenharia" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <HardHat className="h-4 w-4" /> Engenharia
                                        </TabsTrigger>
                                        <TabsTrigger value="locacao-banheiro" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Trash2 className="h-4 w-4" /> Banheiros
                                        </TabsTrigger>
                                        <TabsTrigger value="locacao-estruturas" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Package className="h-4 w-4" /> Estruturas
                                        </TabsTrigger>
                                        <TabsTrigger value="servico-lavanderia" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <RefreshCw className="h-4 w-4" /> Lavanderia
                                        </TabsTrigger>
                                        <TabsTrigger value="servico-grafico" className="flex flex-col gap-1 py-2 text-[10px] uppercase font-bold">
                                            <Printer className="h-4 w-4" /> Gráfico
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* CONTEÚDO DAS ABAS (PLACEHOLDERS PARA FASE 2) */}
                                    <div className="mt-6 p-6 border rounded-xl bg-background shadow-inner min-h-[300px]">
                                        <div className="flex flex-col items-center justify-center text-center space-y-4 py-12">
                                            <div className="p-4 rounded-full bg-primary/10">
                                                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-bold text-foreground">Configuração de {activeTab.replace('-', ' ')}</h4>
                                                <p className="text-muted-foreground max-w-md mx-auto">
                                                    Na Fase 2, aqui aparecerá o seletor de itens específico para este serviço e a memória de cálculo automática.
                                                </p>
                                            </div>
                                            <Button disabled variant="outline" className="mt-4">
                                                <Package className="mr-2 h-4 w-4" />
                                                Selecionar Itens da Diretriz
                                            </Button>
                                        </div>
                                    </div>
                                </Tabs>

                                {/* SEÇÃO 5: RESUMO E SALVAMENTO (PLACEHOLDER) */}
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 bg-primary/5 rounded-xl border-2 border-primary/20">
                                    <div className="text-center md:text-left">
                                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Estimado do Lote</p>
                                        <p className="text-3xl font-black text-primary">{formatCurrency(0)}</p>
                                    </div>
                                    <div className="flex gap-3 w-full md:w-auto">
                                        <Button size="lg" className="flex-1 md:flex-none px-8" disabled>
                                            <Save className="mr-2 h-5 w-5" />
                                            Salvar Planejamento
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        )}
                    </CardContent>
                </Card>

                {/* SEÇÃO 4: REGISTROS SALVOS (PLACEHOLDER) */}
                <section className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-accent" />
                        Serviços Cadastrados neste P Trab
                    </h3>
                    <Card className="p-12 text-center border-dashed">
                        <p className="text-muted-foreground italic">Nenhum serviço ou locação cadastrada até o momento.</p>
                    </Card>
                </section>
            </div>
        </div>
    );
};

export default ServicosTerceirosForm;