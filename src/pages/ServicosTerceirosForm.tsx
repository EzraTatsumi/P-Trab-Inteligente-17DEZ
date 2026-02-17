"use client";

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
    Plane, 
    Satellite, 
    Car, 
    TentTree, 
    Trash2, 
    Printer, 
    Plus, 
    XCircle, 
    Pencil,
    Info,
    Bus,
    ArrowDownUp,
    ChevronDown,
    HandPlatter
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
import { ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import ServicosTerceirosItemSelectorDialog from "@/components/ServicosTerceirosItemSelectorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateServicoTotals, ServicoTerceiroRegistro } from "@/lib/servicosTerceirosUtils";
import ServicosTerceirosMemoria from "@/components/ServicosTerceirosMemoria";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import VehicleGroupForm from "@/components/VehicleGroupForm";
import { VehicleGroup } from "@/lib/vehicleGroupUtils";

export type CategoriaServico = 
    | "fretamento-aereo" 
    | "servico-satelital" 
    | "transporte-coletivo"
    | "locacao-veiculos" 
    | "outros" 
    | "locacao-estruturas" 
    | "servico-grafico";

export type SubCategoriaTransporte = "meio-transporte" | "servico-adicional";

interface OMData {
    id: string;
    nome_om: string;
    codug_om: string;
    rm_vinculacao: string;
    codug_rm_vinculacao: string;
    cidade: string | null;
    ativo: boolean;
}

interface PendingServicoItem {
    tempId: string;
    dbId?: string;
    organizacao: string;
    ug: string;
    om_detentora: string;
    ug_detentora: string;
    dias_operacao: number;
    efetivo: number;
    fase_atividade: string;
    categoria: CategoriaServico;
    detalhes_planejamento: any;
    valor_total: number;
    valor_nd_30: number;
    valor_nd_39: number;
    group_name?: string;
    group_purpose?: string | null;
}

interface ConsolidatedServicoRecord {
    groupKey: string;
    organizacao: string;
    ug: string;
    records: ServicoTerceiroRegistro[];
    totalGeral: number;
}

interface ItemAquisicaoServicoExt extends ItemAquisicaoServico {
    sub_categoria?: SubCategoriaTransporte;
    has_daily_limit?: boolean;
    daily_limit_km?: number | "";
    natureza_despesa?: '33' | '39';
    // Propriedades garantidas pela interface base mas explicitadas aqui para clareza
    quantidade?: number;
    periodo?: number;
}

const formatUnitPlural = (unit: string, count: number) => {
    if (!unit || count <= 1) return unit;
    const lowerUnit = unit.toLowerCase().trim();
    const noPlural = ['m', 'km', 'kg', 'l', 'un', 'hv', 'gl', 'pax', 'cx', 'pct', 'm2', 'm3'];
    if (noPlural.includes(lowerUnit)) return unit;
    if (lowerUnit === 'mês') return 'meses';
    if (lowerUnit.endsWith('r') || lowerUnit.endsWith('z')) return `${unit}es`;
    if (lowerUnit.endsWith('m')) unit.slice(0, -1) + 'ns';
    if (lowerUnit.endsWith('al') || lowerUnit.endsWith('el') || lowerUnit.endsWith('ol') || lowerUnit.endsWith('ul')) {
        return unit.slice(0, -1) + 'is';
    }
    return `${unit}s`;
};

const formatCategoryName = (cat: string, details?: any) => {
    if (cat === 'outros' && details?.nome_servico_outros) return details.nome_servico_outros;
    if (cat === 'fretamento-aereo') return 'Fretamento Aéreo';
    if (cat === 'servico-satelital') return 'Serviço Satelital';
    if (cat === 'transporte-coletivo') return 'Transporte Coletivo';
    if (cat === 'locacao-veiculos') return 'Locação de Veículos';
    if (cat === 'locacao-estruturas') return 'Locação de Estruturas';
    if (cat === 'servico-grafico') return 'Serviço Gráfico';
    if (cat === 'outros') return 'Outros Serviços/Locações';
    return cat.split('-').map(word => {
        if (word === 'aereo') return 'Aéreo';
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
};

const ServiceItemRow = ({ 
    item, 
    activeTab, 
    suggestedHV, 
    distanciaPercorrer, 
    velocidadeCruzeiro, 
    numeroViagens, 
    onQuantityChange, 
    onPeriodChange, 
    onMoveItem, 
    onRemoveItem, 
    onLimitToggle, 
    onLimitChange, 
    onNDToggle,
    isPTrabEditable,
    showClassificationActions,
    hidePeriod,
    hideTotalUnits
}: any) => {
    const isCharter = activeTab === "fretamento-aereo";
    const isTransport = activeTab === "transporte-coletivo";
    const showHvWarning = isCharter && suggestedHV !== null && item.quantidade !== suggestedHV;
    const period = (item as any).periodo;
    const unit = item.unidade_medida || 'UN';
    const trips = isTransport ? (Number(numeroViagens) || 1) : 1;
    const multiplier = (isTransport && item.sub_categoria === 'servico-adicional') ? 1 : trips;
    const totalUnits = (item.quantidade || 0) * (period || 0) * multiplier;

    const [localPeriod, setLocalPeriod] = useState<string>(
        period !== undefined ? period.toString().replace('.', ',') : ""
    );

    useEffect(() => {
        const formattedProp = period !== undefined ? period.toString().replace('.', ',') : "";
        const currentLocalNum = parseFloat(localPeriod.replace(',', '.'));
        if (isNaN(currentLocalNum) || currentLocalNum !== period) {
            setLocalPeriod(formattedProp);
        }
    }, [period]);

    const handlePeriodInput = (val: string) => {
        const sanitized = val.replace(/[^0-9.,]/g, '').replace('.', ',');
        const parts = sanitized.split(',');
        const finalVal = parts[0] + (parts.length > 1 ? ',' + parts.slice(1).join('') : '');
        setLocalPeriod(finalVal);
        onPeriodChange(item.id, finalVal);
    };

    return (
        <TableRow key={item.id}>
            <TableCell className="align-top pt-4">
                <div className="space-y-1">
                    <Input 
                        type="number" 
                        min={0}
                        value={item.quantidade ?? ""} 
                        onChange={(e) => onQuantityChange(item.id, e.target.value)} 
                        onWheel={(e) => e.currentTarget.blur()}
                        onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
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
                                onClick={() => onQuantityChange(item.id, suggestedHV!.toString())}
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
                {activeTab !== 'outros' && (
                    <div className="mt-2 flex items-center gap-2 p-1.5 bg-muted/50 rounded border border-muted-foreground/20 w-fit">
                        <span className={cn("text-[9px] font-bold", item.natureza_despesa === '33' ? "text-primary" : "text-muted-foreground")}>ND 33</span>
                        <Switch 
                            checked={item.natureza_despesa === '39' || !item.natureza_despesa} 
                            onCheckedChange={(checked) => onNDToggle?.(item.id, checked ? '39' : '33')}
                            disabled={!isPTrabEditable}
                            className="scale-50"
                        />
                        <span className={cn("text-[9px] font-bold", (item.natureza_despesa === '39' || !item.natureza_despesa) ? "text-primary" : "text-muted-foreground")}>ND 39</span>
                    </div>
                )}
                {isCharter && suggestedHV !== null && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded flex items-start gap-2">
                        <Info className="h-3 w-3 text-blue-600 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-tight">
                            Cálculo: {distanciaPercorrer}km / {velocidadeCruzeiro}km/h = {(Number(distanciaPercorrer) / Number(velocidadeCruzeiro)).toFixed(2)}h. 
                            <br />
                            <strong>Arredondado para cima: {suggestedHV} HV.</strong>
                        </p>
                    </div>
                )}
            </TableCell>
            <TableCell className="text-right text-xs text-muted-foreground align-top pt-4">
                <div>{formatCurrency(item.valor_unitario)} / {unit}</div>
                {isTransport && item.sub_categoria === 'meio-transporte' && (
                    <div className="mt-2 flex flex-col items-center gap-1.5 p-2 bg-blue-50/50 rounded border border-blue-100 w-full max-w-[120px] ml-auto">
                        <div className="flex items-center justify-between w-full gap-2">
                            <Label className="text-[10px] font-bold text-blue-700 cursor-pointer leading-tight">Limite Diário?</Label>
                            <Switch 
                                checked={item.has_daily_limit || false} 
                                onCheckedChange={(checked) => onLimitToggle?.(item.id, checked)}
                                disabled={!isPTrabEditable}
                                className="scale-50"
                            />
                        </div>
                        {item.has_daily_limit && (
                            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200 w-full justify-center">
                                <Input 
                                    type="number" 
                                    value={item.daily_limit_km || ""} 
                                    onChange={(e) => onLimitChange?.(item.id, e.target.value)}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                    className="h-8 w-16 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    disabled={!isPTrabEditable}
                                />
                                <span className="text-[9px] font-bold text-blue-600">Km</span>
                            </div>
                        )}
                    </div>
                )}
            </TableCell>
            {!hidePeriod && activeTab !== "fretamento-aereo" && (
                <TableCell className="align-top pt-4">
                    <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2 justify-center">
                            <Input 
                                type="text" 
                                inputMode="decimal"
                                value={localPeriod} 
                                onChange={(e) => handlePeriodInput(e.target.value)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-8 w-16 text-center"
                            />
                            <span className="text-[10px] text-muted-foreground font-medium">
                                {formatUnitPlural(unit, period)}
                            </span>
                        </div>
                        <span className="text-[8px] text-muted-foreground leading-none">Aceita frações (ex: 0,5)</span>
                    </div>
                </TableCell>
            )}
            <TableCell className="text-right text-sm font-bold align-top pt-4">
                {formatCurrency(item.valor_total)}
                {!hideTotalUnits && isTransport && (
                    <div className="text-[10px] text-muted-foreground font-normal mt-1">
                        Total: {totalUnits} {formatUnitPlural(unit, totalUnits)}
                    </div>
                )}
            </TableCell>
            <TableCell className="align-top pt-3">
                <div className="flex flex-col gap-1 items-center">
                    {showClassificationActions && (
                        <div className="flex gap-1">
                            {item.sub_categoria !== 'meio-transporte' && (
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7 text-blue-600 border-blue-200 hover:bg-blue-50" 
                                    title="Mover para Meios de Transporte"
                                    onClick={() => onMoveItem(item.id, 'meio-transporte')}
                                >
                                    <Bus className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {item.sub_categoria !== 'servico-adicional' && (
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7 text-purple-600 border-purple-200 hover:bg-purple-50" 
                                    title="Mover para Serviços Adicionais"
                                    onClick={() => onMoveItem(item.id, 'servico-adicional')}
                                >
                                    <HandPlatter className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {item.sub_categoria && (
                                <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-7 w-7 text-gray-600 border-gray-200 hover:bg-gray-50" 
                                    title="Remover Classificação"
                                    onClick={() => onMoveItem(item.id, undefined)}
                                >
                                    <ArrowDownUp className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

const ItemsTable = ({ 
    items, 
    title, 
    showClassificationActions = false,
    hidePeriod = false,
    hideTotalUnits = false,
    activeTab,
    suggestedHV,
    distanciaPercorrer,
    velocidadeCruzeiro,
    numeroViagens,
    onQuantityChange,
    onPeriodChange,
    onMoveItem,
    onRemoveItem,
    onLimitToggle,
    onLimitChange,
    onNDToggle,
    isPTrabEditable
}: any) => {
    if (items.length === 0) return null;
    return (
        <div className="space-y-2">
            {title && (
                <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    {title === "Serviços Adicionais" ? <HandPlatter className="h-4 w-4" /> : <Bus className="h-4 w-4" />}
                    {title}
                </h5>
            )}
            <div className="border rounded-md overflow-hidden bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px] text-center">Qtd</TableHead>
                            <TableHead>Descrição do Serviço</TableHead>
                            <TableHead className="text-right w-[140px]">Valor Unitário</TableHead>
                            {!hidePeriod && activeTab !== "fretamento-aereo" && <TableHead className="text-center w-[120px]">Período</TableHead>}
                            <TableHead className="text-right w-[140px]">Total</TableHead>
                            <TableHead className="w-[100px] text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item: any) => (
                            <ServiceItemRow 
                                key={item.id}
                                item={item}
                                activeTab={activeTab}
                                suggestedHV={suggestedHV}
                                distanciaPercorrer={distanciaPercorrer}
                                velocidadeCruzeiro={velocidadeCruzeiro}
                                numeroViagens={numeroViagens}
                                onQuantityChange={onQuantityChange}
                                onPeriodChange={onPeriodChange}
                                onMoveItem={onMoveItem}
                                onRemoveItem={onRemoveItem}
                                onLimitToggle={onLimitToggle}
                                onLimitChange={onLimitChange}
                                onNDToggle={onNDToggle}
                                isPTrabEditable={isPTrabEditable}
                                showClassificationActions={showClassificationActions}
                                hidePeriod={hidePeriod}
                                hideTotalUnits={hideTotalUnits}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

const ServicosTerceirosForm = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const ptrabId = searchParams.get('ptrabId');
    const initialTab = (searchParams.get('tab') as CategoriaServico) || "fretamento-aereo";
    const queryClient = useQueryClient();
    const { data: oms } = useMilitaryOrganizations();

    const [activeTab, setActiveTab] = useState<CategoriaServico>(initialTab);
    const [omFavorecida, setOmFavorecida] = useState({ nome: "", ug: "", id: "" });
    const [faseAtividade, setFaseAtividade] = useState("");
    const [efetivo, setEfetivo] = useState<number>(0);
    const [hasEfetivo, setHasEfetivo] = useState(true);
    const [diasOperacao, setDiasOperacao] = useState<number>(0);
    const [omDestino, setOmDestino] = useState({ nome: "", ug: "", id: "" });
    const [tipoAnv, setTipoAnv] = useState("");
    const [capacidade, setCapacidade] = useState("");
    const [velocidadeCruzeiro, setVelocidadeCruzeiro] = useState<number | "">("");
    const [distanciaPercorrer, setDistanciaPercorrer] = useState<number | "">("");
    const [tipoEquipamento, setTipoEquipamento] = useState("");
    const [proposito, setProposito] = useState("");
    const [itinerario, setItinerario] = useState("");
    const [distanciaItinerario, setDistanciaItinerario] = useState<number | "">("");
    const [distanciaPercorridaDia, setDistanciaPercorridaDia] = useState<number | "">("");
    const [numeroViagens, setNumeroViagens] = useState<number | "">("");
    const [nomeServicoOutros, setNomeServicoOutros] = useState("");
    const [naturezaDespesaOutros, setNaturezaDespesaOutros] = useState<'33' | '39'>('39');
    const [tipoContratoOutros, setTipoContratoOutros] = useState<"contratacao" | "locacao">("contratacao");
    const [selectedItems, setSelectedItems] = useState<ItemAquisicaoServicoExt[]>([]);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [itemsToPreselect, setItemsToPreselect] = useState<ItemAquisicaoServico[]>([]);
    const [pendingItems, setPendingItems] = useState<PendingServicoItem[]>([]);
    const [lastStagedState, setLastStagedState] = useState<any>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeCompositionId, setActiveCompositionId] = useState<string | null>(null);
    const [editingMemoriaId, setEditingMemoriaId] = useState<string | null>(null);
    const [memoriaEdit, setMemoriaEdit] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<ServicoTerceiroRegistro | null>(null);
    const [vehicleGroups, setVehicleGroups] = useState<VehicleGroup[]>([]);
    const [isGroupFormOpen, setIsGroupFormOpen] = useState(false);
    const [groupToEdit, setGroupToEdit] = useState<VehicleGroup | undefined>(undefined);
    const [selectedItemsFromSelector, setSelectedItemsFromSelector] = useState<ItemAquisicaoServico[] | null>(null);

    const suggestedHV = useMemo(() => {
        if (activeTab === "fretamento-aereo" && velocidadeCruzeiro && distanciaPercorrer) {
            return Math.ceil(Number(distanciaPercorrer) / Number(velocidadeCruzeiro));
        }
        return null;
    }, [activeTab, velocidadeCruzeiro, distanciaPercorrer]);

    const totalLote = useMemo(() => {
        if (activeTab === "locacao-veiculos") return vehicleGroups.reduce((acc, g) => acc + g.totalValue, 0);
        const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
        return selectedItems.reduce((acc, item) => {
            const qty = item.quantidade || 0;
            const period = (item as any).periodo || 0;
            const multiplier = (activeTab === "transporte-coletivo" && item.sub_categoria === 'servico-adicional') ? 1 : trips;
            return acc + (qty * period * item.valor_unitario * multiplier);
        }, 0);
    }, [selectedItems, activeTab, numeroViagens, vehicleGroups]);

    const isServicosTerceirosDirty = useMemo(() => {
        if (!lastStagedState || pendingItems.length === 0) return false;
        const contextChanged = (
            omFavorecida.id !== lastStagedState.omFavorecidaId ||
            faseAtividade !== lastStagedState.faseAtividade ||
            efetivo !== lastStagedState.efetivo ||
            hasEfetivo !== lastStagedState.hasEfetivo ||
            diasOperacao !== lastStagedState.diasOperacao ||
            omDestino.id !== lastStagedState.omDestinoId ||
            activeTab !== lastStagedState.categoria
        );
        if (contextChanged) return true;
        const detailsChanged = (
            tipoAnv !== lastStagedState.tipoAnv ||
            capacidade !== lastStagedState.capacidade ||
            velocidadeCruzeiro !== lastStagedState.velocidadeCruzeiro ||
            distanciaPercorrer !== lastStagedState.distanciaPercorrer ||
            tipoEquipamento !== lastStagedState.tipoEquipamento ||
            proposito !== lastStagedState.proposito ||
            itinerario !== lastStagedState.itinerario ||
            distanciaItinerario !== lastStagedState.distanciaItinerario ||
            distanciaPercorridaDia !== lastStagedState.distanciaPercorridaDia ||
            numeroViagens !== lastStagedState.numeroViagens ||
            nomeServicoOutros !== lastStagedState.nomeServicoOutros ||
            tipoContratoOutros !== lastStagedState.tipoContratoOutros ||
            (activeTab === 'outros' && naturezaDespesaOutros !== lastStagedState.naturezaDespesaOutros)
        );
        if (detailsChanged) return true;
        if (activeTab === "locacao-veiculos") {
            const currentGroupsKey = vehicleGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|');
            return currentGroupsKey !== lastStagedState.groupsKey;
        }
        const currentItemsKey = selectedItems.map(i => `${i.id}-${i.quantidade}-${(i as any).periodo || 1}-${i.sub_categoria || 'none'}-${i.natureza_despesa || '39'}`).sort().join('|');
        return currentItemsKey !== lastStagedState.itemsKey;
    }, [omFavorecida, faseAtividade, efetivo, hasEfetivo, diasOperacao, omDestino, activeTab, selectedItems, lastStagedState, pendingItems, vehicleGroups, tipoAnv, capacidade, velocidadeCruzeiro, distanciaPercorrer, tipoEquipamento, proposito, itinerario, distanciaItinerario, distanciaPercorridaDia, numeroViagens, nomeServicoOutros, naturezaDespesaOutros, tipoContratoOutros]);

    useEffect(() => {
        if (activeTab === "transporte-coletivo" && selectedItems.length > 0) {
            const trips = Number(numeroViagens) || 1;
            setSelectedItems(prev => prev.map(item => {
                const qty = item.quantidade || 0;
                const period = (item as any).periodo || 0;
                const multiplier = (item.sub_categoria === 'servico-adicional') ? 1 : trips;
                return { ...item, valor_total: qty * period * item.valor_unitario * multiplier };
            }));
        }
    }, [numeroViagens, activeTab]);

    const { data: ptrabData, isLoading: isLoadingPTrab } = useQuery<PTrabData>({
        queryKey: ['ptrabData', ptrabId],
        queryFn: () => fetchPTrabData(ptrabId!),
        enabled: !!ptrabId,
    });

    const { data: registros, isLoading: isLoadingRegistros } = useQuery<ServicoTerceiroRegistro[]>({
        queryKey: ['servicosTerceirosRegistros', ptrabId],
        queryFn: async () => {
            const data = await fetchPTrabRecords('servicos_terceiros_registros' as any, ptrabId!);
            return data as unknown as ServicoTerceiroRegistro[];
        },
        enabled: !!ptrabId,
    });

    const consolidatedRegistros = useMemo<ConsolidatedServicoRecord[]>(() => {
        if (!registros) return [];
        const groups = (registros as ServicoTerceiroRegistro[]).reduce((acc, reg) => {
            const key = `${reg.organizacao}|${reg.ug}`;
            if (!acc[key]) acc[key] = { groupKey: key, organizacao: reg.organizacao, ug: reg.ug, records: [], totalGeral: 0 };
            acc[key].records.push(reg);
            acc[key].totalGeral += Number(reg.valor_total || 0);
            return acc;
        }, {} as Record<string, ConsolidatedServicoRecord>);
        const result = Object.values(groups).sort((a, b) => a.organizacao.localeCompare(b.organizacao));
        result.forEach(group => {
            group.records.sort((a, b) => {
                const nameA = formatCategoryName(a.categoria, a.detalhes_planejamento);
                const nameB = formatCategoryName(b.categoria, b.detalhes_planejamento);
                return nameA.localeCompare(nameB);
            });
        });
        return result;
    }, [registros]);

    const sortedRegistrosForMemoria = useMemo(() => consolidatedRegistros.flatMap(group => group.records), [consolidatedRegistros]);

    const saveMutation = useMutation({
        mutationFn: async (itemsToSave: PendingServicoItem[]) => {
            const idsToDelete = itemsToSave.map(i => i.dbId).filter(Boolean) as string[];
            if (idsToDelete.length > 0) {
                const { error: deleteError } = await supabase.from('servicos_terceiros_registros' as any).delete().in('id', idsToDelete);
                if (deleteError) throw deleteError;
            }
            const records = itemsToSave.map(item => ({
                p_trab_id: ptrabId,
                organizacao: item.organizacao,
                ug: item.ug,
                om_detentora: item.om_detentora,
                ug_detentora: item.ug_detentora,
                dias_operacao: item.dias_operacao,
                efetivo: item.efetivo,
                fase_atividade: item.fase_atividade,
                categoria: item.categoria,
                detalhes_planejamento: { ...item.detalhes_planejamento, group_name: item.group_name, group_purpose: item.group_purpose },
                valor_total: item.valor_total,
                valor_nd_30: item.valor_nd_30,
                valor_nd_39: item.valor_nd_39,
            }));
            const { error } = await supabase.from('servicos_terceiros_registros' as any).insert(records);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success(editingId ? "Registro atualizado com sucesso!" : "Registros salvos com sucesso!");
            resetForm();
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
        },
        onError: (err) => toast.error("Erro ao salvar: " + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            const { error } = await supabase.from('servicos_terceiros_registros' as any).delete().in('id', ids);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success("Registro excluído.");
            queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] });
            queryClient.invalidateQueries({ queryKey: ['ptrabTotals', ptrabId] });
            setShowDeleteDialog(false);
            setRecordToDelete(null);
        },
        onError: (err) => toast.error("Erro ao excluir: " + err.message)
    });

    const resetForm = () => {
        setPendingItems([]);
        setLastStagedState(null);
        setSelectedItems([]);
        setVehicleGroups([]);
        setEfetivo(0);
        setHasEfetivo(true);
        setDiasOperacao(0);
        setFaseAtividade("");
        setTipoAnv("");
        setCapacidade("");
        setVelocidadeCruzeiro("");
        setDistanciaPercorrer("");
        setTipoEquipamento("");
        setProposito("");
        setItinerario("");
        setDistanciaItinerario("");
        setDistanciaPercorridaDia("");
        setNumeroViagens("");
        setNomeServicoOutros("");
        setNaturezaDespesaOutros('39');
        setTipoContratoOutros("contratacao");
        setEditingId(null);
        setActiveCompositionId(null);
    };

    const handleOmFavorecidaChange = (omData: OMData | undefined) => {
        if (omData) {
            setOmFavorecida({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
            if (!omDestino.id) setOmDestino({ nome: omData.nome_om, ug: omData.codug_om, id: omData.id });
        } else setOmFavorecida({ nome: "", ug: "", id: "" });
    };

    const handleItemsSelected = (items: ItemAquisicaoServico[]) => {
        const newItems = items.map(item => {
            const existing = selectedItems.find(i => i.id === item.id);
            const initialQty = (activeTab === "fretamento-aereo" && suggestedHV) ? suggestedHV : 1;
            const initialPeriod = 1;
            const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
            const multiplier = (activeTab === "transporte-coletivo" && (item as any).sub_categoria === 'servico-adicional') ? 1 : trips;
            return existing ? existing : ({ 
                ...item, 
                quantidade: initialQty, 
                periodo: initialPeriod,
                valor_total: initialQty * initialPeriod * item.valor_unitario * multiplier,
                sub_categoria: undefined,
                has_daily_limit: false,
                daily_limit_km: "" as const,
                natureza_despesa: (activeTab === 'fretamento-aereo' || activeTab === 'transporte-coletivo') ? '33' : '39'
            } as ItemAquisicaoServicoExt);
        });
        setSelectedItems(newItems);
    };

    const handleQuantityChange = (id: string, rawValue: string) => {
        const qty = rawValue === "" ? undefined : parseInt(rawValue);
        setSelectedItems(prev => prev.map(item => {
            if (item.id === id) {
                const period = (item as any).periodo || 1;
                const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
                const multiplier = (activeTab === "transporte-coletivo" && item.sub_categoria === 'servico-adicional') ? 1 : trips;
                const numQty = qty ?? 0;
                return { ...item, quantidade: qty, valor_total: numQty * period * item.valor_unitario * multiplier };
            }
            return item;
        }));
    };

    const handlePeriodChange = (id: string, rawValue: string) => {
        const parsed = parseFloat(rawValue.replace(',', '.'));
        const period = rawValue === "" ? undefined : (isNaN(parsed) ? 0 : parsed);
        setSelectedItems(prev => prev.map(item => {
            if (item.id === id) {
                const qty = item.quantidade || 0;
                const numPeriod = typeof period === 'number' ? period : 0;
                const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
                const multiplier = (activeTab === "transporte-coletivo" && item.sub_categoria === 'servico-adicional') ? 1 : trips;
                return { ...item, periodo: period, valor_total: qty * numPeriod * item.valor_unitario * multiplier };
            }
            return item;
        }));
    };

    const handleMoveItem = (id: string, subCat: SubCategoriaTransporte | undefined) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id === id) {
                const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
                const multiplier = (activeTab === "transporte-coletivo" && subCat === 'servico-adicional') ? 1 : trips;
                const qty = item.quantidade || 0;
                const period = (item as any).periodo || 1;
                return { ...item, sub_categoria: subCat, valor_total: qty * period * item.valor_unitario * multiplier };
            }
            return item;
        }));
    };

    const handleLimitToggle = (id: string, checked: boolean) => {
        setSelectedItems(prev => prev.map(item => item.id === id ? { ...item, has_daily_limit: checked, daily_limit_km: checked ? item.daily_limit_km : "" } : item));
    };

    const handleLimitChange = (id: string, val: string) => {
        const km = val === "" ? "" : Number(val);
        setSelectedItems(prev => prev.map(item => item.id === id ? { ...item, daily_limit_km: km } : item));
    };

    const handleNDToggle = (id: string, nd: '33' | '39') => {
        setSelectedItems(prev => prev.map(item => item.id === id ? { ...item, natureza_despesa: nd } : item));
    };

    const handleSaveVehicleGroup = (group: VehicleGroup) => {
        setVehicleGroups(prev => {
            const idx = prev.findIndex(g => g.tempId === group.tempId);
            if (idx !== -1) {
                const newGroups = [...prev];
                newGroups[idx] = group;
                return newGroups;
            }
            return [...prev, group];
        });
        setIsGroupFormOpen(false);
        setGroupToEdit(undefined);
        toast.success(`Grupo "${group.groupName}" salvo.`);
    };

    const handleAddToPending = () => {
        const isLocacao = activeTab === "locacao-veiculos";
        if (!isLocacao && selectedItems.length === 0) { toast.warning("Selecione pelo menos um item."); return; }
        if (isLocacao && vehicleGroups.length === 0) { toast.warning("Crie pelo menos um grupo de veículos."); return; }
        if (activeTab === "transporte-coletivo") {
            const unclassified = selectedItems.some(i => !i.sub_categoria);
            if (unclassified) { toast.warning("Classifique todos os itens em 'Meios de Transporte' ou 'Serviços Adicionais' antes de prosseguir."); return; }
        }
        const isSatelital = activeTab === "servico-satelital";
        const isLocacaoVeiculos = activeTab === "locacao-veiculos";
        const isLocacaoEstruturas = activeTab === "locacao-estruturas";
        const isServicoGrafico = activeTab === "servico-grafico";
        const isOutros = activeTab === "outros";
        if ((!isSatelital && !isLocacaoVeiculos && !isLocacaoEstruturas && !isServicoGrafico && !isOutros && efetivo <= 0) || diasOperacao <= 0) { toast.warning("Informe o efetivo e o período."); return; }
        if (isSatelital && (!tipoEquipamento || !proposito)) { toast.warning("Informe o tipo de equipamento e o propósito."); return; }
        if (isOutros && !nomeServicoOutros) { toast.warning("Informe o nome do serviço/locação."); return; }
        const compositionId = editingId || activeCompositionId || crypto.randomUUID();
        if (!editingId && !activeCompositionId) setActiveCompositionId(compositionId);
        let newItems: PendingServicoItem[] = [];
        if (isLocacao) {
            newItems = vehicleGroups.map(group => ({
                tempId: compositionId,
                dbId: editingId || undefined,
                organizacao: omFavorecida.nome,
                ug: omFavorecida.ug,
                om_detentora: omDestino.nome,
                ug_detentora: omDestino.ug || omFavorecida.ug,
                dias_operacao: diasOperacao,
                efetivo: efetivo,
                fase_atividade: faseAtividade,
                categoria: activeTab,
                group_name: group.groupName,
                group_purpose: group.groupPurpose,
                detalhes_planejamento: { itens_selecionados: group.items },
                valor_total: group.totalValue,
                valor_nd_30: group.totalND30,
                valor_nd_39: group.totalND39,
            }));
        } else {
            const trips = activeTab === "transporte-coletivo" ? (Number(numeroViagens) || 1) : 1;
            const itemsForCalc = selectedItems.map(i => ({ ...i, periodo: (i as any).periodo || 0, ...(activeTab === 'outros' ? { natureza_despesa: naturezaDespesaOutros } : {}) }));
            const { totalND30, totalND39, totalGeral } = calculateServicoTotals(itemsForCalc, trips);
            const newItem: PendingServicoItem = {
                tempId: compositionId,
                dbId: editingId || undefined,
                organizacao: omFavorecida.nome,
                ug: omFavorecida.ug,
                om_detentora: omDestino.nome,
                ug_detentora: omDestino.ug || omFavorecida.ug,
                dias_operacao: diasOperacao,
                efetivo: (isSatelital || isLocacaoEstruturas || isServicoGrafico || (isOutros && !hasEfetivo)) ? 0 : efetivo,
                fase_atividade: faseAtividade,
                categoria: activeTab,
                detalhes_planejamento: { itens_selecionados: itemsForCalc, tipo_anv, capacidade, velocidade_cruzeiro: velocidadeCruzeiro, distancia_percorrer: distanciaPercorrer, tipo_equipamento: tipoEquipamento, proposito, itinerario, distancia_itinerario: distanciaItinerario, distancia_percorrida_dia: distanciaPercorridaDia, numero_viagens: numeroViagens, nome_servico_outros: nomeServicoOutros, tipo_contrato_outros: tipoContratoOutros, has_efetivo: hasEfetivo },
                valor_total: totalGeral,
                valor_nd_30: totalND30,
                valor_nd_39: totalND39,
            };
            newItems = [newItem];
        }
        setPendingItems(prev => { const filtered = prev.filter(p => p.tempId !== compositionId); return [...filtered, ...newItems]; });
        setLastStagedState({ omFavorecidaId: omFavorecida.id, faseAtividade, efetivo, hasEfetivo, diasOperacao, omDestinoId: omDestino.id, categoria: activeTab, tipoAnv, capacidade, velocidadeCruzeiro, distanciaPercorrer, tipoEquipamento, proposito, itinerario, distanciaItinerario, distanciaPercorridaDia, numeroViagens, nomeServicoOutros, tipoContratoOutros, naturezaDespesaOutros: activeTab === 'outros' ? naturezaDespesaOutros : undefined, itemsKey: isLocacao ? "" : selectedItems.map(i => `${i.id}-${i.quantidade}-${(i as any).periodo || 1}-${i.sub_categoria || 'none'}-${i.natureza_despesa || '39'}`).sort().join('|'), groupsKey: isLocacao ? vehicleGroups.map(g => `${g.tempId}-${g.totalValue}`).sort().join('|') : "" });
        setEditingId(null);
        toast.info(activeCompositionId ? "Item atualizado na lista." : "Item adicionado à lista de pendentes.");
    };

    const handleEdit = (reg: ServicoTerceiroRegistro) => {
        if (pendingItems.length > 0) { toast.warning("Salve ou limpe os itens pendentes antes de editar um registro existente."); return; }
        setEditingId(reg.id);
        setActiveCompositionId(reg.id);
        const omFav = oms?.find(om => om.nome_om === reg.organizacao && om.codug_om === reg.ug);
        if (omFav) setOmFavorecida({ nome: omFav.nome_om, ug: omFav.codug_om, id: omFav.id });
        else setOmFavorecida({ nome: reg.organizacao, ug: reg.ug, id: "" });
        setFaseAtividade(reg.fase_atividade || "");
        setEfetivo(reg.efetivo || 0);
        setDiasOperacao(reg.dias_operacao || 0);
        const omDest = oms?.find(om => om.nome_om === reg.om_detentora && om.codug_om === reg.ug_detentora) || oms?.find(om => om.nome_om === reg.om_detentora);
        if (omDest) setOmDestino({ nome: omDest.nome_om, ug: omDest.codug_om, id: omDest.id });
        else setOmDestino({ nome: reg.om_detentora || "", ug: reg.ug_detentora || "", id: "" });
        setActiveTab(reg.categoria as CategoriaServico);
        const details = reg.detalhes_planejamento;
        if (details) {
            if (reg.categoria === 'locacao-veiculos') {
                const group: VehicleGroup = { tempId: reg.id, groupName: reg.group_name || details.group_name || 'Grupo de Veículos', groupPurpose: reg.group_purpose || details.group_purpose || null, items: details.itens_selecionados || [], totalValue: Number(reg.valor_total), totalND30: Number(reg.valor_nd_30), totalND39: Number(reg.valor_nd_39) };
                setVehicleGroups([group]);
            } else {
                setSelectedItems(details.itens_selecionados || []);
                setTipoAnv(details.tipo_anv || "");
                setCapacidade(details.capacidade || "");
                setVelocidadeCruzeiro(details.velocidade_cruzeiro || "");
                setDistanciaPercorrer(details.distancia_percorrer || "");
                setTipoEquipamento(details.tipo_equipamento || "");
                setProposito(details.proposito || "");
                setItinerario(details.itinerario || "");
                setDistanciaItinerario(details.distancia_itinerario || "");
                setDistanciaPercorridaDia(details.distancia_percorrida_dia || "");
                setNumeroViagens(details.numero_viagens || "");
                setNomeServicoOutros(details.nome_servico_outros || "");
                setTipoContratoOutros(details.tipo_contrato_outros || "contratacao");
                setHasEfetivo(details.has_efetivo !== undefined ? details.has_efetivo : true);
                if (reg.categoria === 'outros') setNaturezaDespesaOutros(details.itens_selecionados?.[0]?.natureza_despesa || '39');
            }
        }
        if (reg.categoria === 'locacao-veiculos') {
            const stagedItem: PendingServicoItem = { tempId: reg.id, dbId: reg.id, organizacao: reg.organizacao, ug: reg.ug, om_detentora: reg.om_detentora || '', ug_detentora: reg.ug_detentora || '', dias_operacao: reg.dias_operacao, efetivo: reg.efetivo || 0, fase_atividade: reg.fase_atividade || '', categoria: reg.categoria as CategoriaServico, group_name: reg.group_name || details?.group_name || '', group_purpose: reg.group_purpose || details?.group_purpose, detalhes_planejamento: details, valor_total: Number(reg.valor_total), valor_nd_30: Number(reg.valor_nd_30), valor_nd_39: Number(reg.valor_nd_39) };
            setPendingItems([stagedItem]);
            setLastStagedState({ omFavorecidaId: omFav?.id || "", faseAtividade: reg.fase_atividade, efetivo: reg.efetivo, hasEfetivo: true, diasOperacao: reg.dias_operacao, omDestinoId: omDest?.id || "", categoria: reg.categoria, groupsKey: `${reg.id}-${reg.valor_total}` });
        } else {
            const trips = reg.categoria === 'transporte-coletivo' ? (Number(details.numero_viagens) || 1) : 1;
            const { totalND30, totalND39, totalGeral } = calculateServicoTotals(details.itens_selecionados || [], trips);
            const stagedItem: PendingServicoItem = { tempId: reg.id, dbId: reg.id, organizacao: reg.organizacao, ug: reg.ug, om_detentora: reg.om_detentora || '', ug_detentora: reg.ug_detentora || '', dias_operacao: reg.dias_operacao, efetivo: reg.efetivo || 0, fase_atividade: reg.fase_atividade || '', categoria: reg.categoria as CategoriaServico, detalhes_planejamento: details, valor_total: totalGeral, valor_nd_30: totalND30, valor_nd_39: totalND39 };
            setPendingItems([stagedItem]);
            setLastStagedState({ omFavorecidaId: omFav?.id || "", faseAtividade: reg.fase_atividade, efetivo: reg.efetivo, hasEfetivo: details.has_efetivo !== undefined ? details.has_efetivo : true, diasOperacao: reg.dias_operacao, omDestinoId: omDest?.id || "", categoria: reg.categoria, itemsKey: (details.itens_selecionados || []).map((i: any) => `${i.id}-${i.quantidade}-${i.periodo || 1}-${i.sub_categoria || 'none'}-${i.natureza_despesa || '39'}`).sort().join('|'), naturezaDespesaOutros: reg.categoria === 'outros' ? (details.itens_selecionados?.[0]?.natureza_despesa || '39') : undefined, tipoContratoOutros: reg.categoria === 'outros' ? (details.tipo_contrato_outros || "contratacao") : undefined });
        }
        toast.info("Modo Edição ativado. Altere os dados e clique em 'Recalcular/Revisar Lote'.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmDelete = (reg: ServicoTerceiroRegistro) => { setRecordToDelete(reg); setShowDeleteDialog(true); };

    const handleSaveMemoria = async (id: string) => {
        const { error } = await supabase.from('servicos_terceiros_registros' as any).update({ detalhamento_customizado: memoriaEdit }).eq('id', id);
        if (error) toast.error("Erro ao salvar memória.");
        else { toast.success("Memória atualizada."); setEditingMemoriaId(null); queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] }); }
    };

    const handleRestoreMemoria = async (id: string) => {
        const { error = null } = await supabase.from('servicos_terceiros_registros' as any).update({ detalhamento_customizado: null }).eq('id', id);
        if (error) toast.error("Erro ao restaurar.");
        else { toast.success("Memória automática restaurada."); queryClient.invalidateQueries({ queryKey: ['servicosTerceirosRegistros', ptrabId] }); }
    };

    const isGlobalLoading = isLoadingPTrab || isLoadingRegistros;
    if (isGlobalLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
    const isPTrabEditable = ptrabData?.status !== 'aprovado' && ptrabData?.status !== 'arquivado';
    const isBaseFormReady = (omFavorecida.nome !== "" && faseAtividade !== "") || !!editingId;
    const totalPendingValue = pendingItems.reduce((acc, item) => acc + item.valor_total, 0);

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
                            <section className="space-y-4 border-b pb-6">
                                <h3 className="text-lg font-semibold flex items-center gap-2">1. Dados da Organização</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>OM Favorecida *</Label>
                                        <OmSelector selectedOmId={omFavorecida.id || undefined} onChange={handleOmFavorecidaChange} placeholder="Selecione a OM Favorecida" disabled={!isPTrabEditable || (pendingItems.length > 0 && !editingId)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UG Favorecida</Label>
                                        <Input value={formatCodug(omFavorecida.ug)} disabled className="bg-muted/50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fase da Atividade *</Label>
                                        <FaseAtividadeSelect value={faseAtividade} onChange={setFaseAtividade} disabled={!isPTrabEditable || (pendingItems.length > 0 && !editingId)} />
                                    </div>
                                </div>
                            </section>
                            {isBaseFormReady && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">2. Configurar Planejamento</h3>
                                    <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as CategoriaServico); setSelectedItems([]); setVehicleGroups([]); if (!editingId) setActiveCompositionId(null); }} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 h-auto gap-1 bg-muted p-1 mb-6">
                                            <TabsTrigger value="fretamento-aereo" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Plane className="h-4 w-4" /> Fretamento</TabsTrigger>
                                            <TabsTrigger value="servico-satelital" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Satellite className="h-4 w-4" /> Satelital</TabsTrigger>
                                            <TabsTrigger value="transporte-coletivo" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Bus className="h-4 w-4" /> Trnp Coletivo</TabsTrigger>
                                            <TabsTrigger value="locacao-veiculos" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Car className="h-4 w-4" /> Veículos</TabsTrigger>
                                            <TabsTrigger value="locacao-estruturas" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><TentTree className="h-4 w-4" /> Estruturas</TabsTrigger>
                                            <TabsTrigger value="servico-grafico" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><Printer className="h-4 w-4" /> Gráfico</TabsTrigger>
                                            <TabsTrigger value="outros" className="flex items-center gap-2 py-2 text-[10px] uppercase font-bold"><ClipboardList className="h-4 w-4" /> Outros</TabsTrigger>
                                        </TabsList>
                                        <Card className="bg-muted/50 rounded-lg p-4">
                                            <Card className="rounded-lg mb-4">
                                                <CardHeader className="py-3"><CardTitle className="text-base font-semibold">Período, Efetivo e Destino do Recurso</CardTitle></CardHeader>
                                                <CardContent className="pt-2">
                                                    <div className="p-4 bg-background rounded-lg border">
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div className="space-y-2">
                                                                <Label>Período (Nr Dias) *</Label>
                                                                <Input type="number" value={diasOperacao || ""} onChange={(e) => setDiasOperacao(Number(e.target.value))} placeholder="Ex: 15" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Efetivo *</Label>
                                                                <Input type="number" value={(activeTab === "servico-satelital" || activeTab === "locacao-veiculos" || activeTab === "locacao-estruturas" || activeTab === "servico-grafico" || !hasEfetivo) ? "" : (efetivo || "")} onChange={(e) => setEfetivo(Number(e.target.value))} placeholder={(activeTab === "servico-satelital" || activeTab === "locacao-veiculos" || activeTab === "locacao-estruturas" || activeTab === "servico-grafico" || !hasEfetivo) ? "N/A" : "Ex: 50"} disabled={!isPTrabEditable || activeTab === "servico-satelital" || activeTab === "locacao-veiculos" || activeTab === "locacao-estruturas" || activeTab === "servico-grafico" || !hasEfetivo} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="max-w-[150px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                                                {activeTab === 'outros' && (
                                                                    <div className="flex items-center gap-1 mt-1">
                                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{hasEfetivo ? 'Ativo' : 'Inativo'}</span>
                                                                        <Switch checked={hasEfetivo} onCheckedChange={(checked) => { setHasEfetivo(checked); if (!checked) setEfetivo(0); }} disabled={!isPTrabEditable} className="scale-75" />
                                                                    </div>
                                                                )}
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
                                            <Card className="mt-4 rounded-lg p-4 bg-background">
                                                <div className="space-y-4">
                                                    {activeTab === "locacao-veiculos" ? (
                                                        <>
                                                            <div className="flex justify-between items-center"><h4 className="text-base font-semibold">Grupos de Veículos ({vehicleGroups.length})</h4></div>
                                                            {isGroupFormOpen && (
                                                                <VehicleGroupForm initialGroup={groupToEdit} onSave={handleSaveVehicleGroup} onCancel={() => { setIsGroupFormOpen(false); setGroupToEdit(undefined); }} isSaving={saveMutation.isPending} onOpenItemSelector={(items) => { setItemsToPreselect(items); setIsSelectorOpen(true); }} selectedItemsFromSelector={selectedItemsFromSelector as any} onClearSelectedItems={() => setSelectedItemsFromSelector(null)} />
                                                            )}
                                                            {!isGroupFormOpen && vehicleGroups.length > 0 && (
                                                                <div className="space-y-3">
                                                                    {vehicleGroups.map(group => (
                                                                        <Collapsible key={group.tempId} defaultOpen={false}>
                                                                            <Card>
                                                                                <CollapsibleTrigger asChild>
                                                                                    <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50 transition-colors border rounded-md">
                                                                                        <div className="flex items-center gap-2"><span className="font-semibold">{group.groupName}</span><Badge variant="secondary" className="text-xs">{group.items.length} Veículos</Badge></div>
                                                                                        <div className="flex items-center gap-2"><span className="font-bold text-sm">{formatCurrency(group.totalValue)}</span><ChevronDown className="h-4 w-4" /></div>
                                                                                    </div>
                                                                                </CollapsibleTrigger>
                                                                                <CollapsibleContent className="border-t p-3 bg-background">
                                                                                    <div className="space-y-2">
                                                                                        {group.groupPurpose && <p className="text-sm text-muted-foreground">Finalidade: Locação de Viatura para atender {group.groupPurpose}.</p>}
                                                                                        <div className="max-h-[350px] overflow-y-auto relative">
                                                                                            <Table>
                                                                                                <TableHeader className="sticky top-0 bg-background z-10">
                                                                                                    <TableRow>
                                                                                                        <TableHead className="w-[80px] text-center">Qtd</TableHead>
                                                                                                        <TableHead>Veículo</TableHead>
                                                                                                        <TableHead className="text-right w-[140px]">Vlr Unitário</TableHead>
                                                                                                        <TableHead className="text-center w-[100px]">Período</TableHead>
                                                                                                        <TableHead className="text-right w-[120px]">Total</TableHead>
                                                                                                    </TableRow>
                                                                                                </TableHeader>
                                                                                                <TableBody>
                                                                                                    {group.items.map(item => (
                                                                                                        <TableRow key={item.id}>
                                                                                                            <TableCell className="text-center text-xs">{item.quantidade}</TableCell>
                                                                                                            <TableCell className="text-xs">{item.descricao_reduzida || item.descricao_item}<p className="text-muted-foreground text-[10px]">Pregão: {formatPregao(item.numero_pregao)}</p></TableCell>
                                                                                                            <TableCell className="text-right text-xs text-muted-foreground">{formatCurrency(item.valor_unitario)} / {item.unidade_medida || 'UN'}</TableCell>
                                                                                                            <TableCell className="text-center text-xs">{(item as any).periodo}</TableCell>
                                                                                                            <TableCell className="text-right text-sm font-medium">{formatCurrency((item.quantidade || 0) * ((item as any).periodo || 0) * item.valor_unitario)}</TableCell>
                                                                                                        </TableRow>
                                                                                                    ))}
                                                                                                </TableBody>
                                                                                            </Table>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                                                                                        <Button type="button" variant="outline" size="sm" onClick={() => { setGroupToEdit(group); setIsGroupFormOpen(true); }}><Pencil className="mr-2 h-4 w-4" /> Editar Grupo</Button>
                                                                                        <Button type="button" variant="destructive" size="sm" onClick={() => setVehicleGroups(prev => prev.filter(g => g.tempId !== group.tempId))}><Trash2 className="mr-2 h-4 w-4" /> Excluir Grupo</Button>
                                                                                    </div>
                                                                                </CollapsibleContent>
                                                                            </Card>
                                                                        </Collapsible>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {!isGroupFormOpen && vehicleGroups.length === 0 && (
                                                                <Alert variant="default" className="border border-gray-300"><AlertCircle className="h-4 w-4 text-muted-foreground" /><AlertTitle>Nenhum Grupo Adicionado</AlertTitle><AlertDescription>Crie um grupo para selecionar os veículos necessários.</AlertDescription></Alert>
                                                            )}
                                                            {!isGroupFormOpen && (
                                                                <div className="flex justify-end mt-4"><Button type="button" onClick={() => { setGroupToEdit(undefined); setIsGroupFormOpen(true); }} disabled={!isPTrabEditable || saveMutation.isPending} variant="outline" className="w-full"><Plus className="mr-2 h-4 w-4" />Criar Novo Grupo de Veículos</Button></div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="flex justify-between items-center"><h4 className="text-base font-semibold">Itens de {formatCategoryName(activeTab, { nome_servico_outros: nomeServicoOutros })}</h4><Button type="button" variant="outline" size="sm" onClick={() => setIsSelectorOpen(true)} disabled={!isPTrabEditable}><Plus className="mr-2 h-4 w-4" /> Importar da Diretriz</Button></div>
                                                            {activeTab === "fretamento-aereo" && (
                                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                                                    <div className="space-y-2"><Label>Tipo Anv</Label><Input value={tipoAnv} onChange={(e) => setTipoAnv(e.target.value)} placeholder="Ex: Caravan" disabled={!isPTrabEditable} /></div>
                                                                    <div className="space-y-2"><Label>Capacidade</Label><Input value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder="Ex: 9 Pax ou 450kg" disabled={!isPTrabEditable} /></div>
                                                                    <div className="space-y-2"><Label>Velocidade de Cruzeiro</Label><div className="relative"><Input type="number" value={velocidadeCruzeiro} onChange={(e) => setVelocidadeCruzeiro(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 350" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="pr-14 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Km/h</span></div></div>
                                                                    <div className="space-y-2"><Label>Distância a percorrer</Label><div className="relative"><Input type="number" value={distanciaPercorrer} onChange={(e) => setDistanciaPercorrer(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 1500" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="pr-10 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Km</span></div></div>
                                                                </div>
                                                            )}
                                                            {activeTab === "servico-satelital" && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                                                    <div className="space-y-2"><Label>Tipo de Equipamento/Serviço *</Label><Input value={tipoEquipamento} onChange={(e) => setTipoEquipamento(e.target.value)} placeholder="Ex: Comunicação e Rastreamento Satelital" disabled={!isPTrabEditable} /></div>
                                                                    <div className="space-y-2"><Label>Propósito *</Label><Input value={proposito} onChange={(e) => setProposito(e.target.value)} placeholder="Ex: melhor comunicabilidade e consciência situacional" disabled={!isPTrabEditable} /></div>
                                                                </div>
                                                            )}
                                                            {activeTab === "transporte-coletivo" && (
                                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                                                    <div className="space-y-2"><Label>Itinerário</Label><Input value={itinerario} onChange={(e) => setItinerario(e.target.value)} placeholder="Ex: MAB-BEL" disabled={!isPTrabEditable} /></div>
                                                                    <div className="space-y-2"><Label>Distância Itinerário</Label><div className="relative"><Input type="number" value={distanciaItinerario} onChange={(e) => setDistanciaItinerario(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 950" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="pr-10 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Km</span></div></div>
                                                                    <div className="space-y-2"><Label>Distância percorrida / dia</Label><div className="relative"><Input type="number" value={distanciaPercorridaDia} onChange={(e) => setDistanciaPercorridaDia(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 600" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="pr-10 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">Km</span></div></div>
                                                                    <div className="space-y-2"><Label>Número de Viagens</Label><Input type="number" value={numeroViagens} onChange={(e) => setNumeroViagens(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Ex: 4" disabled={!isPTrabEditable} onWheel={(e) => e.currentTarget.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                                                                </div>
                                                            )}
                                                            {activeTab === "outros" && (
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed">
                                                                    <div className="space-y-2"><Label>Tipo de Contrato</Label><div className="flex items-center gap-2 p-2 bg-background rounded border h-10 w-fit"><span className={cn("text-[10px] font-bold", tipoContratoOutros === 'contratacao' ? "text-primary" : "text-muted-foreground")}>CONTRATAÇÃO</span><Switch checked={tipoContratoOutros === 'locacao'} onCheckedChange={(checked) => setTipoContratoOutros(checked ? 'locacao' : 'contratacao')} disabled={!isPTrabEditable} className="scale-75" /><span className={cn("text-[10px] font-bold", tipoContratoOutros === 'locacao' ? "text-primary" : "text-muted-foreground")}>LOCAÇÃO</span></div></div>
                                                                    <div className="space-y-2"><Label>Natureza de Despesa</Label><div className="flex items-center gap-2 p-2 bg-background rounded border h-10 w-fit"><span className={cn("text-[10px] font-bold", naturezaDespesaOutros === '33' ? "text-primary" : "text-muted-foreground")}>ND 33</span><Switch checked={naturezaDespesaOutros === '39'} onCheckedChange={(checked) => setNaturezaDespesaOutros(checked ? '39' : '33')} disabled={!isPTrabEditable} className="scale-75" /><span className={cn("text-[10px] font-bold", naturezaDespesaOutros === '39' ? "text-primary" : "text-muted-foreground")}>ND 39</span></div><p className="text-[10px] text-muted-foreground">Aplica-se a todos os itens deste lote.</p></div>
                                                                    <div className="space-y-2"><Label>Nome do Serviço/Locação *</Label><Input value={nomeServicoOutros} onChange={(e) => setNomeServicoOutros(e.target.value)} placeholder="Ex: Serviço de Lavandeira" disabled={!isPTrabEditable} /></div>
                                                                </div>
                                                            )}
                                                            {selectedItems.length > 0 ? (
                                                                <div className="space-y-6">
                                                                    {activeTab === "transporte-coletivo" ? (
                                                                        <>
                                                                            {selectedItems.filter(i => !i.sub_categoria).length > 0 && (
                                                                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3"><div className="flex items-center gap-2 text-orange-700"><AlertCircle className="h-5 w-5" /><h5 className="font-bold text-sm uppercase">Itens Pendentes de Classificação</h5></div><ItemsTable items={selectedItems.filter(i => !i.sub_categoria)} showClassificationActions={true} activeTab={activeTab} suggestedHV={suggestedHV} distanciaPercorrer={distanciaPercorrer} velocidadeCruzeiro={velocidadeCruzeiro} numeroViagens={numeroViagens} onQuantityChange={handleQuantityChange} onPeriodChange={handlePeriodChange} onMoveItem={handleMoveItem} onRemoveItem={(id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id))} onNDToggle={handleNDToggle} isPTrabEditable={isPTrabEditable} /></div>
                                                                            )}
                                                                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3"><ItemsTable title="Meios de Transporte" items={selectedItems.filter(i => i.sub_categoria === 'meio-transporte')} showClassificationActions={true} activeTab={activeTab} suggestedHV={suggestedHV} distanciaPercorrer={distanciaPercorrer} velocidadeCruzeiro={velocidadeCruzeiro} numeroViagens={numeroViagens} onQuantityChange={handleQuantityChange} onPeriodChange={handlePeriodChange} onMoveItem={handleMoveItem} onRemoveItem={(id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id))} onLimitToggle={handleLimitToggle} onLimitChange={handleLimitChange} onNDToggle={handleNDToggle} isPTrabEditable={isPTrabEditable} />{selectedItems.filter(i => i.sub_categoria === 'meio-transporte').length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum meio de transporte classificado.</p>}</div>
                                                                            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-lg space-y-3"><ItemsTable title="Serviços Adicionais" items={selectedItems.filter(i => i.sub_categoria === 'servico-adicional')} showClassificationActions={true} hidePeriod={true} hideTotalUnits={true} activeTab={activeTab} suggestedHV={suggestedHV} distanciaPercorrer={distanciaPercorrer} velocidadeCruzeiro={velocidadeCruzeiro} numeroViagens={numeroViagens} onQuantityChange={handleQuantityChange} onPeriodChange={handlePeriodChange} onMoveItem={handleMoveItem} onRemoveItem={(id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id))} onNDToggle={handleNDToggle} isPTrabEditable={isPTrabEditable} />{selectedItems.filter(i => i.sub_categoria === 'servico-adicional').length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">Nenhum serviço adicional classificado.</p>}</div>
                                                                        </>
                                                                    ) : (
                                                                        <ItemsTable items={selectedItems} activeTab={activeTab} suggestedHV={suggestedHV} distanciaPercorrer={distanciaPercorrer} velocidadeCruzeiro={velocidadeCruzeiro} numeroViagens={numeroViagens} onQuantityChange={handleQuantityChange} onPeriodChange={handlePeriodChange} onMoveItem={handleMoveItem} onRemoveItem={(id: string) => setSelectedItems(prev => prev.filter(i => i.id !== id))} onNDToggle={handleNDToggle} isPTrabEditable={isPTrabEditable} />
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <Alert variant="default" className="border border-gray-300"><AlertCircle className="h-4 w-4 text-muted-foreground" /><AlertTitle>Nenhum Item Selecionado</AlertTitle><AlertDescription>Importe itens da diretriz para iniciar o planejamento.</AlertDescription></Alert>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex justify-between items-center p-3 mt-4 border-t pt-4"><span className="font-bold text-sm uppercase">VALOR TOTAL DO LOTE:</span><span className="font-extrabold text-lg text-primary">{formatCurrency(totalLote)}</span></div>
                                            </Card>
                                            <div className="flex justify-end gap-3 pt-4"><Button className="w-full md:w-auto bg-primary hover:bg-primary/90" disabled={(activeTab === "locacao-veiculos" ? vehicleGroups.length === 0 : selectedItems.length === 0) || saveMutation.isPending || (activeTab !== "servico-satelital" && activeTab !== "locacao-veiculos" && activeTab !== "locacao-estruturas" && activeTab !== "servico-grafico" && activeTab !== "outros" && efetivo <= 0) || (activeTab === "servico-satelital" && (!tipoEquipamento || !proposito)) || (activeTab === "outros" && !nomeServicoOutros) || diasOperacao <= 0 || isGroupFormOpen} onClick={handleAddToPending}>{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingId ? "Recalcular/Revisar Lote" : "Salvar Item na Lista"}</Button></div>
                                        </Card>
                                    </Tabs>
                                </section>
                            )}
                            {pendingItems.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">3. Itens Adicionados ({pendingItems.length})</h3>
                                    {isServicosTerceirosDirty && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="font-medium">Atenção: Os dados do formulário foram alterados. Clique em "Salvar Item na Lista" na Seção 2 para atualizar o lote pendente.</AlertDescription></Alert>}
                                    <div className="space-y-4">
                                        {pendingItems.map((item) => {
                                            const isOmDestinoDifferent = item.organizacao.trim() !== item.om_detentora.trim();
                                            const totalUnits = item.detalhes_planejamento?.itens_selecionados?.reduce((acc: number, i: any) => {
                                                const qty = i.quantidade || 0;
                                                const period = item.categoria === 'fretamento-aereo' ? 1 : (i.periodo || 0);
                                                const trips = item.categoria === 'transporte-coletivo' ? (Number(item.detalhes_planejamento.numero_viagens) || 1) : 1;
                                                const multiplier = (item.categoria === 'transporte-coletivo' && i.sub_categoria === 'servico-adicional') ? 1 : trips;
                                                return acc + (qty * period * multiplier);
                                            }, 0) || 0;
                                            const totalQty = item.detalhes_planejamento?.itens_selecionados?.reduce((acc: number, i: any) => acc + (i.quantidade || 0), 0) || 0;
                                            const totalDiarias = item.categoria === 'transporte-coletivo' ? item.detalhes_planejamento.itens_selecionados.filter((i: any) => i.sub_categoria === 'meio-transporte').reduce((acc: number, i: any) => { const qty = i.quantidade || 0; const period = i.periodo || 0; const trips = Number(item.detalhes_planejamento.numero_viagens) || 1; return acc + (qty * period * trips); }, 0) : 0;
                                            const totalKmAdicional = item.categoria === 'transporte-coletivo' ? item.detalhes_planejamento.itens_selecionados.filter((i: any) => i.sub_categoria === 'servico-adicional').reduce((acc: number, i: any) => acc + (i.quantidade || 0), 0) : 0;
                                            return (
                                                <Card key={item.tempId} className="border-2 shadow-md border-secondary bg-secondary/10">
                                                    <CardContent className="p-4">
                                                        <div className="flex justify-between items-center pb-2 mb-2 border-b border-secondary/30"><h4 className="font-bold text-base text-foreground">{formatCategoryName(item.categoria, item.detalhes_planejamento)}{item.group_name && ` (${item.group_name})`}</h4><div className="flex items-center gap-2"><p className="font-extrabold text-lg text-foreground text-right">{formatCurrency(item.valor_total)}</p>{!editingId && <Button variant="ghost" size="icon" onClick={() => setPendingItems(prev => prev.filter(i => i.tempId !== item.tempId))} disabled={saveMutation.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></div>
                                                        <div className="grid grid-cols-2 gap-4 text-xs pt-1"><div className="space-y-1"><p className="font-medium">OM Favorecida:</p><p className="font-medium">OM Destino do Recurso:</p><p className="font-medium">{item.categoria === 'fretamento-aereo' && "Período / Efetivo / HV:"}{item.categoria === 'servico-satelital' && "Período / Qtd Equipamento:"}{item.categoria === 'transporte-coletivo' && "Período / Efetivo / Nr Viagens:"}{item.categoria === 'locacao-veiculos' && "Período / Qtd Veículos:"}{item.categoria === 'locacao-estruturas' && "Período / Qtd Itens:"}{item.categoria === 'servico-grafico' && "Período / Qtd Itens:"}{item.categoria === 'outros' && "Período / Efetivo / Qtd Itens:"}{!['fretamento-aereo', 'servico-satelital', 'transporte-coletivo', 'locacao-veiculos', 'locacao-estruturas', 'servico-grafico', 'outros'].includes(item.categoria) && "Período / Detalhes:"}</p>{item.categoria === 'transporte-coletivo' && <p className="font-medium">Nr Diárias / Qtd Km Adicional:</p>}</div><div className="text-right space-y-1"><p className="font-medium">{item.organizacao} ({formatCodug(item.ug)})</p><p className={cn("font-medium", isOmDestinoDifferent && "text-destructive font-bold")}>{item.om_detentora} ({formatCodug(item.ug_detentora)})</p><p className="font-medium">{item.categoria === 'fretamento-aereo' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${item.efetivo} ${item.efetivo === 1 ? 'militar' : 'militares'} / ${totalUnits} HV`}{item.categoria === 'servico-satelital' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${totalQty} un`}{item.categoria === 'transporte-coletivo' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${item.efetivo} ${item.efetivo === 1 ? 'militar' : 'militares'} / ${item.detalhes_planejamento.numero_viagens || 1} viagens`}{item.categoria === 'locacao-veiculos' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${totalQty} un`}{item.categoria === 'locacao-estruturas' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${totalQty} un`}{item.categoria === 'servico-grafico' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${totalQty} un`}{item.categoria === 'outros' && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${item.efetivo > 0 ? `${item.efetivo} mil` : 'N/A'} / ${totalQty} un`}{!['fretamento-aereo', 'servico-satelital', 'transporte-coletivo', 'locacao-veiculos', 'locacao-estruturas', 'servico-grafico', 'outros'].includes(item.categoria) && `${item.dias_operacao} ${item.dias_operacao === 1 ? 'dia' : 'dias'} / ${totalUnits} un`}</p>{item.categoria === 'transporte-coletivo' && <p className="font-medium">{totalDiarias} {totalDiarias === 1 ? 'diária' : 'diárias'} / {totalKmAdicional} Km</p>}</div></div>
                                                        <div className="w-full h-[1px] bg-secondary/30 my-3" /><div className="flex flex-col gap-1">{item.valor_nd_30 > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total ND 33:</span><span className="font-medium text-green-600">{formatCurrency(item.valor_nd_30)}</span></div>}{item.valor_nd_39 > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total ND 39:</span><span className="font-medium text-green-600">{formatCurrency(item.valor_nd_39)}</span></div>}</div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    <Card className="bg-gray-100 shadow-inner"><CardContent className="p-4 flex justify-between items-center"><span className="font-bold text-base uppercase">VALOR TOTAL DA OM</span><span className="font-extrabold text-xl text-foreground">{formatCurrency(totalPendingValue)}</span></CardContent></Card>
                                    <div className="flex justify-end gap-3 pt-4"><Button type="button" onClick={() => saveMutation.mutate(pendingItems)} disabled={saveMutation.isPending || pendingItems.length === 0 || isServicosTerceirosDirty} className="w-full md:w-auto bg-primary hover:bg-primary/90" id="save-records-btn">{saveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{editingId ? "Atualizar Lote" : "Salvar Registros"}</Button><Button type="button" variant="outline" onClick={resetForm} disabled={saveMutation.isPending}><XCircle className="mr-2 h-4 w-4" /> {editingId ? "Cancelar Edição" : "Limpar Lista"}</Button></div>
                                </section>
                            )}
                            {consolidatedRegistros && consolidatedRegistros.length > 0 && (
                                <section className="space-y-4 border-b pb-6">
                                    <h3 className="text-xl font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" />OMs Cadastradas ({consolidatedRegistros.length})</h3>
                                    {consolidatedRegistros.map((group) => (
                                        <Card key={group.groupKey} className="p-4 bg-primary/5 border-primary/20">
                                            <div className="flex items-center justify-between mb-3 border-b pb-2"><h3 className="font-bold text-lg text-primary flex items-center gap-2">{group.organizacao} (UG: {formatCodug(group.ug)})</h3><span className="font-extrabold text-xl text-primary">{formatCurrency(group.totalGeral)}</span></div>
                                            <div className="space-y-3">
                                                {group.records.map((reg) => {
                                                    const isDifferentOm = reg.om_detentora?.trim() !== reg.organizacao?.trim();
                                                    const totalUnits = reg.detalhes_planejamento?.itens_selecionados?.reduce((acc: number, i: any) => { const qty = i.quantidade || 0; const period = reg.categoria === 'fretamento-aereo' ? 1 : (i.periodo || 0); const trips = reg.categoria === 'transporte-coletivo' ? (Number(reg.detalhes_planejamento.numero_viagens) || 1) : 1; const multiplier = (reg.categoria === 'transporte-coletivo' && i.sub_categoria === 'servico-adicional') ? 1 : trips; return acc + (qty * period * multiplier); }, 0) || 0;
                                                    const totalQty = reg.detalhes_planejamento?.itens_selecionados?.reduce((acc: number, i: any) => acc + (i.quantidade || 0), 0) || 0;
                                                    const totalDiarias = reg.categoria === 'transporte-coletivo' ? reg.detalhes_planejamento?.itens_selecionados?.filter((i: any) => i.sub_categoria === 'meio-transporte')?.reduce((acc: number, i: any) => { const qty = i.quantidade || 0; const period = i.periodo || 0; const trips = Number(reg.detalhes_planejamento.numero_viagens) || 1; return acc + (qty * period * trips); }, 0) : 0;
                                                    const totalKmAdicional = reg.categoria === 'transporte-coletivo' ? reg.detalhes_planejamento?.itens_selecionados?.filter((i: any) => i.sub_categoria === 'servico-adicional')?.reduce((acc: number, i: any) => acc + (i.quantidade || 0), 0) : 0;
                                                    return (
                                                        <Card key={reg.id} className="p-3 bg-background border">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex flex-col"><h4 className="font-semibold text-base text-foreground flex items-center gap-2">{formatCategoryName(reg.categoria, reg.detalhes_planejamento)}{(reg.group_name || reg.detalhes_planejamento?.group_name) && ` (${reg.group_name || reg.detalhes_planejamento?.group_name})`}<Badge variant="outline" className="text-xs font-semibold">{reg.fase_atividade}</Badge></h4><p className="text-xs text-muted-foreground">{reg.categoria === 'fretamento-aereo' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Efetivo: ${reg.efetivo} ${reg.efetivo === 1 ? 'militar' : 'militares'} | HV: ${totalUnits}`}{reg.categoria === 'servico-satelital' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Qtd: ${totalQty} un`}{reg.categoria === 'transporte-coletivo' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Efetivo: ${reg.efetivo} ${reg.efetivo === 1 ? 'militar' : 'militares'} | Viagens: ${reg.detalhes_planejamento?.numero_viagens || 1}`}{reg.categoria === 'locacao-veiculos' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Qtd: ${totalQty} un`}{reg.categoria === 'locacao-estruturas' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Qtd: ${totalQty} un`}{reg.categoria === 'servico-grafico' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Qtd: ${totalQty} un`}{reg.categoria === 'outros' && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Efetivo: ${reg.efetivo > 0 ? `${reg.efetivo} mil` : 'N/A'} | Qtd: ${totalQty} un`}{!['fretamento-aereo', 'servico-satelital', 'transporte-coletivo', 'locacao-veiculos', 'locacao-estruturas', 'servico-grafico', 'outros'].includes(reg.categoria) && `Período: ${reg.dias_operacao} ${reg.dias_operacao === 1 ? 'dia' : 'dias'} | Efetivo: ${reg.efetivo} ${reg.efetivo === 1 ? 'militar' : 'militares'} | Qtd: ${totalUnits} un`}</p>{reg.categoria === 'transporte-coletivo' && <p className="text-xs text-muted-foreground">Nr Diárias: {totalDiarias} {totalDiarias === 1 ? 'diária' : 'diárias'} | Qtd Km Adicional: {totalKmAdicional} Km</p>}</div>
                                                                <div className="flex items-center gap-2"><span className="font-extrabold text-xl text-foreground">{formatCurrency(Number(reg.valor_total))}</span><div className="flex gap-1 shrink-0"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(reg)} disabled={!isPTrabEditable || pendingItems.length > 0}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleConfirmDelete(reg)} disabled={!isPTrabEditable}><Trash2 className="h-4 w-4" /></Button></div></div>
                                                            </div>
                                                            <div className="pt-2 border-t mt-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">OM Destino Recurso:</span><span className={cn("font-medium", isDifferentOm && "text-red-600")}>{reg.om_detentora} ({formatCodug(reg.ug_detentora || '')})</span></div>{Number(reg.valor_nd_30) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">ND 33.90.33:</span><span className="text-green-600 font-medium">{formatCurrency(Number(reg.valor_nd_30))}</span></div>}{Number(reg.valor_nd_39) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">ND 33.90.39:</span><span className="text-green-600 font-medium">{formatCurrency(Number(reg.valor_nd_39))}</span></div>}</div>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    ))}
                                </section>
                            )}
                            {sortedRegistrosForMemoria && sortedRegistrosForMemoria.length > 0 && (
                                <section className="space-y-4 mt-8">
                                    <h3 className="text-xl font-bold flex items-center gap-2">📋 Memórias de Cálculos Detalhadas</h3>
                                    {sortedRegistrosForMemoria.map(reg => (
                                        <ServicosTerceirosMemoria key={`mem-${reg.id}`} registro={reg} isPTrabEditable={isPTrabEditable} isSaving={false} editingMemoriaId={editingMemoriaId} memoriaEdit={memoriaEdit} setMemoriaEdit={setMemoriaEdit} onStartEdit={(id, text) => { setEditingMemoriaId(id); setMemoriaEdit(text); }} onCancelEdit={() => setEditingMemoriaId(null)} onSave={handleSaveMemoria} onRestore={handleRestoreMemoria} />
                                    ))}
                                </section>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            <ServicosTerceirosItemSelectorDialog open={isSelectorOpen} onOpenChange={setIsSelectorOpen} selectedYear={new Date().getFullYear()} initialItems={activeTab === 'locacao-veiculos' ? (groupToEdit?.items || []) : selectedItems} onSelect={activeTab === 'locacao-veiculos' ? (setSelectedItemsFromSelector as any) : handleItemsSelected} onAddDiretriz={() => navigate('/config/custos-operacionais')} categoria={activeTab} />
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-5 w-5" /> Confirmar Exclusão de Registro</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir o registro de <span className="font-bold">{recordToDelete ? formatCategoryName(recordToDelete.categoria, recordToDelete.detalhes_planejamento) : ''}</span> para a OM <span className="font-bold">{recordToDelete?.organizacao}</span>? Esta ação é irreversível.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogAction onClick={() => recordToDelete && deleteMutation.mutate([recordToDelete.id])} className="bg-destructive hover:bg-destructive/90">Excluir Registro</AlertDialogAction><AlertDialogCancel>Cancelar</AlertDialogCancel></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default ServicosTerceirosForm;