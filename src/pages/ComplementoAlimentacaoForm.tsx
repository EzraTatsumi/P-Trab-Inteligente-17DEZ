import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Trash2, Edit, Plus, Users, XCircle, Pencil, Sparkles, AlertCircle, RefreshCw, Check, Package, Minus, ChevronDown, ChevronUp, FileSpreadsheet, FileText, Utensils, Droplets, Coffee } from "lucide-react";
import { sanitizeError } from "@/lib/errorUtils";
import { useFormNavigation } from "@/hooks/useFormNavigation";
import { useMilitaryOrganizations } from "@/hooks/useMilitaryOrganizations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tables, TablesInsert, TablesUpdate, Json } from "@/integrations/supabase/types";
import { formatCurrency, formatCodug, formatPregao } from "@/lib/formatUtils";
import { PTrabData, fetchPTrabData, fetchPTrabRecords } from "@/lib/ptrabUtils";
import { 
    ComplementoAlimentacaoRegistro, 
    ConsolidatedComplementoRecord,
    AcquisitionGroup,
    calculateGroupTotals,
    generateComplementoMemoriaCalculo,
} from "@/lib/complementoAlimentacaoUtils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FaseAtividadeSelect } from "@/components/FaseAtividadeSelect";
import { OmSelector } from "@/components/OmSelector";
import { RmSelector } from "@/components/RmSelector";
import { cn } from "@/lib/utils"; 
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import ComplementoAlimentacaoMemoria from "@/components/ComplementoAlimentacaoMemoria";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import AcquisitionItemSelectorDialog from "@/components/AcquisitionItemSelectorDialog"; 
import PageMetadata from "@/components/PageMetadata";
import { PublicoSelect } from "@/components/PublicoSelect";
import CurrencyInput from "@/components/CurrencyInput";

// Tipo para o item calculado na lista pendente
interface StagedComplemento {
    tempId: string;
    categoria: 'genero' | 'agua' | 'lanche';
    om_favorecida: string;
    ug_favorecida: string;
    om_destino: string;
    ug_destino: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    publico: string;
    
    // Valores calculados
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    
    // Detalhes específicos para Gênero
    total_qs?: number;
    total_qr?: number;
    
    // Grupos para Água/Lanche
    acquisitionGroups?: AcquisitionGroup[];
}

// Estado inicial para o formulário
interface ComplementoAlimentacaoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    
    publico: string;
    valor_etapa_qs: number;
    pregao_qs: string;
    om_qs: string;
    ug_qs: string;
    valor_etapa_qr: number;
    pregao_qr: string;
    om_qr: string;
    ug_qr: string;

    acquisitionGroups: AcquisitionGroup[];
}

const initialFormState: ComplementoAlimentacaoFormState = {
    om_favorecida: "", 
    ug_favorecida: "", 
    rm_vinculacao: "",
    codug_rm_vinculacao: "",
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    categoria_complemento: 'genero',
    
    publico: "OSP",
    valor_etapa_qs: 0,
    pregao_qs: "",
    om_qs: "",
    ug_qs: "",
    valor_etapa_qr: 0,
    pregao_qr: "",
    om_qr: "",
    ug_qr: "",

    acquisitionGroups: [],
};

const ComplementoAlimentacaoForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const queryClient = useQueryClient();
    const { handleEnterToNextField } = useFormNavigation();
    
    const [formData, setFormData] = useState<ComplementoAlimentacaoFormState>(initialFormState);
    const [pendingItems, setPendingItems] = useState<StagedComplemento[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmQrId, setSelectedOmQrId] = useState<string | undefined>(undefined);
    
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<AcquisitionGroup | undefined>(undefined);
    
    const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicao[]>([]);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicao[] | null>(null);
    
    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: oms, isLoading: isLoadingOms } = useMilitaryOrganizations();
    
    // Lógica de pré-seleção das UASGs baseada na OM Favorecida
    const handleOmFavorecidaChange = (omData: any) => {
        if (omData) {
            setSelectedOmFavorecidaId(omData.id);
            setSelectedOmQrId(omData.id);

            setFormData(prev => ({ 
                ...prev, 
                om_favorecida: omData.nome_om, 
                ug_favorecida: omData.codug_om, 
                rm_vinculacao: omData.rm_vinculacao,
                codug_rm_vinculacao: omData.codug_rm_vinculacao,
                om_qs: omData.rm_vinculacao,
                ug_qs: omData.codug_rm_vinculacao,
                om_qr: omData.nome_om,
                ug_qr: omData.codug_om,
                om_destino: omData.nome_om,
                ug_destino: omData.codug_om
            }));
        }
    };

    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isGenero = formData.categoria_complemento === 'genero';

    // Cálculos em tempo real para exibição nos containers
    const currentTotalQS = useMemo(() => {
        return formData.efetivo * formData.valor_etapa_qs * formData.dias_operacao;
    }, [formData.efetivo, formData.valor_etapa_qs, formData.dias_operacao]);

    const currentTotalQR = useMemo(() => {
        return formData.efetivo * formData.valor_etapa_qr * formData.dias_operacao;
    }, [formData.efetivo, formData.valor_etapa_qr, formData.dias_operacao]);

    // Lógica de cálculo e adição à lista pendente
    const handleStageCalculation = () => {
        const { categoria_complemento, efetivo, dias_operacao } = formData;
        
        let newItem: StagedComplemento;

        if (categoria_complemento === 'genero') {
            const totalQS = currentTotalQS;
            const totalQR = currentTotalQR;
            const totalGeral = totalQS + totalQR;

            newItem = {
                tempId: crypto.randomUUID(),
                categoria: 'genero',
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                om_destino: formData.om_qr, // Para gênero, a OM Destino é a do QR
                ug_destino: formData.ug_qr,
                dias_operacao,
                efetivo,
                fase_atividade: formData.fase_atividade,
                publico: formData.publico,
                valor_total: totalGeral,
                valor_nd_30: totalGeral,
                valor_nd_39: 0,
                total_qs: totalQS,
                total_qr: totalQR
            };
        } else {
            // Para Água e Lanche, usamos os grupos de aquisição
            const totalValue = formData.acquisitionGroups.reduce((sum, g) => sum + g.totalValue, 0);
            const totalND30 = formData.acquisitionGroups.reduce((sum, g) => sum + g.totalND30, 0);
            const totalND39 = formData.acquisitionGroups.reduce((sum, g) => sum + g.totalND39, 0);

            newItem = {
                tempId: crypto.randomUUID(),
                categoria: categoria_complemento,
                om_favorecida: formData.om_favorecida,
                ug_favorecida: formData.ug_favorecida,
                om_destino: formData.om_destino,
                ug_destino: formData.ug_destino,
                dias_operacao,
                efetivo,
                fase_atividade: formData.fase_atividade,
                publico: formData.publico,
                valor_total: totalValue,
                valor_nd_30: totalND30,
                valor_nd_39: totalND39,
                acquisitionGroups: [...formData.acquisitionGroups]
            };
        }

        setPendingItems(prev => [...prev, newItem]);
        
        // Reset parcial do form para permitir nova adição
        setFormData(prev => ({
            ...prev,
            acquisitionGroups: [],
            valor_etapa_qs: 0,
            valor_etapa_qr: 0,
            pregao_qs: "",
            pregao_qr: ""
        }));
        
        toast.success("Item adicionado à lista de revisão.");
    };

    const handleRemovePending = (id: string) => {
        setPendingItems(prev => prev.filter(item => item.tempId !== id));
    };

    const totalGeralOM = useMemo(() => {
        return pendingItems.reduce((sum, item) => sum + item.valor_total, 0);
    }, [pendingItems]);

    const isSaveDisabled = useMemo(() => {
        if (!isBaseFormReady) return true;
        if (formData.efetivo <= 0 || formData.dias_operacao <= 0) return true;
        
        if (isGenero) {
            return (
                formData.valor_etapa_qs <= 0 || 
                !formData.pregao_qs || 
                !formData.om_qs ||
                formData.valor_etapa_qr <= 0 || 
                !formData.pregao_qr || 
                !formData.om_qr
            );
        } else {
            return formData.acquisitionGroups.length === 0;
        }
    }, [formData, isBaseFormReady, isGenero]);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <PageMetadata title="Complemento de Alimentação" description="Gerenciamento de Complemento de Alimentação" canonicalPath={`/ptrab/complemento-alimentacao?ptrabId=${ptrabId}`} />
            
            <div className="max-w-6xl mx-auto space-y-6">
                <Button variant="ghost" onClick={() => navigate(`/ptrab/form?ptrabId=${ptrabId}`)} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                </Button>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            Complemento de Alimentação
                        </CardTitle>
                        <CardDescription>
                            Levantamento de necessidades de Gêneros, Água e Lanches.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {/* SEÇÃO 1: DADOS DA ORGANIZAÇÃO */}
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={selectedOmFavorecidaId} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(formData.ug_favorecida)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData({...formData, fase_atividade: f})} disabled={false} />
                                    </div>
                                </div>
                            </section>

                            {/* SEÇÃO 2: CONFIGURAR COMPLEMENTO */}
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Complemento</h3>
                                    
                                    <Tabs value={formData.categoria_complemento} onValueChange={(v: any) => setFormData({...formData, categoria_complemento: v})} className="w-full">
                                        <TabsList className="grid w-full grid-cols-3 mb-6">
                                            <TabsTrigger value="genero" className="flex items-center gap-2">
                                                <Utensils className="h-4 w-4" />
                                                Gênero Alimentício
                                            </TabsTrigger>
                                            <TabsTrigger value="agua" className="flex items-center gap-2">
                                                <Droplets className="h-4 w-4" />
                                                Água Mineral
                                            </TabsTrigger>
                                            <TabsTrigger value="lanche" className="flex items-center gap-2">
                                                <Coffee className="h-4 w-4" />
                                                Lanche/Catanho
                                            </TabsTrigger>
                                        </TabsList>

                                        <Card className="bg-muted/50 p-4">
                                            <div className="space-y-6 bg-background p-4 rounded-lg border">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Efetivo *</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={formData.efetivo || ""} 
                                                            onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})}
                                                            placeholder="Ex: 150"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Público *</Label>
                                                        <PublicoSelect value={formData.publico} onChange={(v) => setFormData({...formData, publico: v})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Período (Nr Dias) *</Label>
                                                        <Input 
                                                            type="number" 
                                                            value={formData.dias_operacao || ""} 
                                                            onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})}
                                                            placeholder="Ex: 15"
                                                            className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                    </div>
                                                </div>

                                                {isGenero && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                        <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-primary uppercase">Quantitativo de Subsistência (QS)</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-primary">{formatCurrency(currentTotalQS)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Valor Complemento *</Label>
                                                                    <CurrencyInput value={formData.valor_etapa_qs} onChange={(val) => setFormData({...formData, valor_etapa_qs: val})} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input value={formData.pregao_qs} onChange={(e) => setFormData({...formData, pregao_qs: e.target.value})} placeholder="Ex: 90.001/24" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UASG *</Label>
                                                                <RmSelector value={formData.om_qs} onChange={(name, codug) => setFormData({...formData, om_qs: name, ug_qs: codug})} placeholder="Selecione a UASG" />
                                                            </div>
                                                        </div>

                                                        <div className="space-y-4 p-4 bg-orange-500/5 rounded-md border border-orange-500/10 relative overflow-hidden">
                                                            <div className="flex justify-between items-start">
                                                                <h4 className="font-bold text-sm text-orange-600 uppercase">Quantitativo de Rancho (QR)</h4>
                                                                <div className="text-right">
                                                                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Subtotal Estimado</p>
                                                                    <p className="text-sm font-extrabold text-orange-600">{formatCurrency(currentTotalQR)}</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <Label>Valor Complemento *</Label>
                                                                    <CurrencyInput value={formData.valor_etapa_qr} onChange={(val) => setFormData({...formData, valor_etapa_qr: val})} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>Pregão *</Label>
                                                                    <Input value={formData.pregao_qr} onChange={(e) => setFormData({...formData, pregao_qr: e.target.value})} placeholder="Ex: 90.001/24" />
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>UASG *</Label>
                                                                <OmSelector selectedOmId={selectedOmQrId} onChange={(om) => setFormData({...formData, om_qr: om?.nome_om || "", ug_qr: om?.codug_om || ""})} placeholder="Selecione a UASG" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {!isGenero && (
                                                <div className="mt-6">
                                                    <Card className="p-4 bg-background">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <h4 className="text-base font-semibold">Itens de Aquisição ({formData.acquisitionGroups.length})</h4>
                                                        </div>
                                                        
                                                        {isGroupFormOpen ? (
                                                            <AcquisitionGroupForm 
                                                                initialGroup={groupToEdit} 
                                                                onSave={(g) => { setFormData(prev => ({...prev, acquisitionGroups: [...prev.acquisitionGroups, g]})); setIsGroupFormOpen(false); }} 
                                                                onCancel={() => setIsGroupFormOpen(false)}
                                                                onOpenItemSelector={(items) => { setItemsToPreselect(items); setIsItemSelectorOpen(true); }}
                                                                selectedItemsFromSelector={selectedItemsFromSelector}
                                                                onOpenChange={setIsItemSelectorOpen}
                                                                onClearSelectedItems={() => setSelectedItemsFromSelector(null)}
                                                            />
                                                        ) : (
                                                            <div className="space-y-4">
                                                                {formData.acquisitionGroups.length === 0 ? (
                                                                    <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Nenhum item</AlertTitle><AlertDescription>Adicione itens para esta categoria.</AlertDescription></Alert>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {formData.acquisitionGroups.map(g => (
                                                                            <div key={g.tempId} className="flex justify-between items-center p-2 border rounded bg-muted/30">
                                                                                <span className="text-sm font-medium">{g.groupName}</span>
                                                                                <span className="text-sm font-bold">{formatCurrency(g.totalValue)}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <Button variant="outline" className="w-full" onClick={() => setIsGroupFormOpen(true)}>
                                                                    <Plus className="mr-2 h-4 w-4" /> Adicionar Itens de Aquisição
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </Card>
                                                </div>
                                            )}

                                            <div className="mt-6 flex justify-end">
                                                <Button className="w-full md:w-auto" disabled={isSaveDisabled} onClick={handleStageCalculation}>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Salvar Itens na Lista
                                                </Button>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÃO 3: ITENS ADICIONADOS (REVISÃO) */}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingItems.length})</h3>
                                    
                                    <div className="space-y-4">
                                        {pendingItems.map((item) => (
                                            <Card key={item.tempId} className="border-2 border-secondary bg-secondary/5 shadow-sm">
                                                <CardContent className="p-4">
                                                    <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/20">
                                                        <h4 className="font-bold text-base text-foreground">
                                                            Complemento de Alimentação ({item.categoria === 'genero' ? 'Gênero Alimentício' : item.categoria === 'agua' ? 'Água' : 'Lanche'})
                                                        </h4>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-extrabold text-lg text-foreground">
                                                                {formatCurrency(item.valor_total)}
                                                            </p>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemovePending(item.tempId)} className="h-8 w-8 text-destructive">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 gap-4 text-xs pt-1">
                                                        <div className="space-y-1">
                                                            <p className="font-medium text-muted-foreground">OM Favorecida:</p>
                                                            <p className="font-medium text-muted-foreground">OM Destino do Recurso:</p>
                                                            <p className="font-medium text-muted-foreground">Período/Efetivo:</p>
                                                        </div>
                                                        <div className="text-right space-y-1">
                                                            <p className="font-bold">{item.om_favorecida} ({formatCodug(item.ug_favorecida)})</p>
                                                            <p className="font-bold">{item.om_destino} ({formatCodug(item.ug_destino)})</p>
                                                            <p className="font-bold">{item.dias_operacao} {item.dias_operacao === 1 ? 'dia' : 'dias'} / {item.efetivo} {item.efetivo === 1 ? 'militar' : 'militares'}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="w-full h-[1px] bg-secondary/20 my-3" />

                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground">ND 33.90.30:</span>
                                                        <div className="flex gap-3">
                                                            {item.categoria === 'genero' ? (
                                                                <>
                                                                    <span className="font-bold text-blue-600">{formatCurrency(item.total_qs || 0)} (QS)</span>
                                                                    <span className="font-bold text-green-600">{formatCurrency(item.total_qr || 0)} (QR)</span>
                                                                </>
                                                            ) : (
                                                                <span className="font-bold text-green-600">{formatCurrency(item.valor_nd_30)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    <Card className="bg-muted shadow-inner">
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span>
                                            <span className="font-extrabold text-xl text-foreground">{formatCurrency(totalGeralOM)}</span>
                                        </CardContent>
                                    </Card>

                                    <div className="flex justify-end gap-3 pt-4">
                                        <Button className="bg-primary hover:bg-primary/90">
                                            <Save className="mr-2 h-4 w-4" />
                                            Salvar Registros
                                        </Button>
                                        <Button variant="outline" onClick={() => setPendingItems([])}>
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Limpar Lista
                                        </Button>
                                    </div>
                                </section>
                            )}

                            {/* SEÇÕES 4 e 5 (Placeholders) */}
                            <section className="opacity-50 pointer-events-none">
                                <h3 className="text-lg font-semibold mb-4">4. OMs Cadastradas (Em breve)</h3>
                                <h3 className="text-lg font-semibold mb-4">5. Memórias de Cálculo (Em breve)</h3>
                            </section>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AcquisitionItemSelectorDialog 
                open={isItemSelectorOpen} 
                onOpenChange={setIsItemSelectorOpen} 
                selectedYear={new Date().getFullYear()} 
                initialItems={itemsToPreselect} 
                onSelect={(items) => { setSelectedItemsFromSelector(items); setIsItemSelectorOpen(false); }} 
            />
        </div>
    );
};

export default ComplementoAlimentacaoForm;