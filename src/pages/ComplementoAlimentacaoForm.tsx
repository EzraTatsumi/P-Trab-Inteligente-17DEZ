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
import { cn } from "@/lib/utils"; 
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcquisitionGroupForm from "@/components/AcquisitionGroupForm";
import ComplementoAlimentacaoMemoria from "@/components/ComplementoAlimentacaoMemoria";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo"; 
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import AcquisitionItemSelectorDialog from "@/components/AcquisitionItemSelectorDialog"; 
import PageMetadata from "@/components/PageMetadata";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Estado inicial para o formulário
interface ComplementoAlimentacaoFormState {
    om_favorecida: string; 
    ug_favorecida: string; 
    om_destino: string; 
    ug_destino: string; 
    dias_operacao: number;
    efetivo: number; 
    fase_atividade: string;
    categoria_complemento: 'genero' | 'agua' | 'lanche';
    
    // Novos campos Parte A
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
    om_destino: "",
    ug_destino: "",
    dias_operacao: 0,
    efetivo: 0, 
    fase_atividade: "",
    categoria_complemento: 'genero',
    
    publico: "Militares",
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    
    const [selectedOmFavorecidaId, setSelectedOmFavorecidaId] = useState<string | undefined>(undefined);
    const [selectedOmDestinoId, setSelectedOmDestinoId] = useState<string | undefined>(undefined);
    const [selectedOmQsId, setSelectedOmQsId] = useState<string | undefined>(undefined);
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
            setSelectedOmDestinoId(omData.id); 
            
            // Regra Geral: UASG (QS) = RM de Vinculação
            const rmOm = oms?.find(om => om.nome_om === omData.rm_vinculacao && om.codug_om === omData.codug_rm_vinculacao);
            setSelectedOmQsId(rmOm?.id || undefined);

            // Regra Geral: UASG (QR) = OM Favorecida
            setSelectedOmQrId(omData.id);

            setFormData(prev => ({ 
                ...prev, 
                om_favorecida: omData.nome_om, 
                ug_favorecida: omData.codug_om, 
                om_destino: omData.nome_om, 
                ug_destino: omData.codug_om,
                om_qs: omData.rm_vinculacao,
                ug_qs: omData.codug_rm_vinculacao,
                om_qr: omData.nome_om,
                ug_qr: omData.codug_om
            }));
        }
    };

    const isBaseFormReady = formData.om_favorecida.length > 0 && formData.fase_atividade.length > 0;
    const isGenero = formData.categoria_complemento === 'genero';

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
                            <Utensils className="h-6 w-6 text-primary" />
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
                                        <FaseAtividadeSelect value={formData.fase_atividade} onChange={(f) => setFormData({...formData, fase_atividade: f})} />
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
                                            {/* Parte A: Contexto da Categoria */}
                                            <div className="space-y-6 bg-background p-4 rounded-lg border">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Efetivo *</Label>
                                                        <Input type="number" value={formData.efetivo || ""} onChange={(e) => setFormData({...formData, efetivo: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Público *</Label>
                                                        <Select value={formData.publico} onValueChange={(v) => setFormData({...formData, publico: v})}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="Militares">Militares</SelectItem>
                                                                <SelectItem value="OSP">OSP</SelectItem>
                                                                <SelectItem value="Civis">Civis</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Período (Nr Dias) *</Label>
                                                        <Input type="number" value={formData.dias_operacao || ""} onChange={(e) => setFormData({...formData, dias_operacao: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>OM Destino do Recurso *</Label>
                                                        <OmSelector selectedOmId={selectedOmDestinoId} onChange={(om) => setFormData({...formData, om_destino: om?.nome_om || "", ug_destino: om?.codug_om || ""})} />
                                                    </div>
                                                </div>

                                                {/* Campos Específicos de Gênero (QS e QR) */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                                                    {/* Grupo QS */}
                                                    <div className="space-y-4 p-4 bg-primary/5 rounded-md border border-primary/10">
                                                        <h4 className="font-bold text-sm text-primary uppercase">Quota Suplementar (QS)</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Valor Etapa (QS)</Label>
                                                                <Input type="number" step="0.01" value={formData.valor_etapa_qs || ""} onChange={(e) => setFormData({...formData, valor_etapa_qs: parseFloat(e.target.value) || 0})} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Pregão (QS)</Label>
                                                                <Input value={formData.pregao_qs} onChange={(e) => setFormData({...formData, pregao_qs: e.target.value})} placeholder="Ex: 01/2024" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>UASG (QS)</Label>
                                                            <OmSelector selectedOmId={selectedOmQsId} onChange={(om) => setFormData({...formData, om_qs: om?.nome_om || "", ug_qs: om?.codug_om || ""})} placeholder="Selecione a UASG do QS" />
                                                        </div>
                                                    </div>

                                                    {/* Grupo QR */}
                                                    <div className="space-y-4 p-4 bg-orange-500/5 rounded-md border border-orange-500/10">
                                                        <h4 className="font-bold text-sm text-orange-600 uppercase">Quota de Ração (QR)</h4>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Valor Etapa (QR)</Label>
                                                                <Input type="number" step="0.01" value={formData.valor_etapa_qr || ""} onChange={(e) => setFormData({...formData, valor_etapa_qr: parseFloat(e.target.value) || 0})} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Pregão (QR)</Label>
                                                                <Input value={formData.pregao_qr} onChange={(e) => setFormData({...formData, pregao_qr: e.target.value})} placeholder="Ex: 05/2024" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>UASG (QR)</Label>
                                                            <OmSelector selectedOmId={selectedOmQrId} onChange={(om) => setFormData({...formData, om_qr: om?.nome_om || "", ug_qr: om?.codug_om || ""})} placeholder="Selecione a UASG do QR" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Parte B: Grupos de Aquisição (Importação) */}
                                            <div className={cn("mt-6", isGenero && "opacity-50 pointer-events-none grayscale")}>
                                                <Card className="p-4 bg-background">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h4 className="text-base font-semibold">Itens de Aquisição ({formData.acquisitionGroups.length})</h4>
                                                        {isGenero && <Badge variant="outline" className="text-orange-600 border-orange-600">Desabilitado para Gênero</Badge>}
                                                    </div>
                                                    
                                                    {isGroupFormOpen ? (
                                                        <AcquisitionGroupForm 
                                                            initialGroup={groupToEdit} 
                                                            onSave={(g) => setFormData(prev => ({...prev, acquisitionGroups: [...prev.acquisitionGroups, g]}))} 
                                                            onCancel={() => setIsGroupFormOpen(false)}
                                                            onOpenItemSelector={(items) => { setItemsToPreselect(items); setIsItemSelectorOpen(true); }}
                                                            selectedItemsFromSelector={selectedItemsFromSelector}
                                                            onClearSelectedItems={() => setSelectedItemsFromSelector(null)}
                                                        />
                                                    ) : (
                                                        <div className="space-y-4">
                                                            {formData.acquisitionGroups.length === 0 ? (
                                                                <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Nenhum item</AlertTitle><AlertDescription>Adicione itens para esta categoria.</AlertDescription></Alert>
                                                            ) : (
                                                                <div className="border rounded-md p-2">Lista de grupos aqui...</div>
                                                            )}
                                                            <Button variant="outline" className="w-full" onClick={() => setIsGroupFormOpen(true)} disabled={isGenero}>
                                                                <Plus className="mr-2 h-4 w-4" /> Adicionar Itens de Aquisição
                                                            </Button>
                                                        </div>
                                                    )}
                                                </Card>
                                            </div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}

                            {/* SEÇÕES 3, 4 e 5 (Placeholders) */}
                            <section className="opacity-50 pointer-events-none">
                                <h3 className="text-lg font-semibold mb-4">3. Itens Adicionados (Em breve)</h3>
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