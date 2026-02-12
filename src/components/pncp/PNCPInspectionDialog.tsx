import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Import, Check, X, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { InspectionItem, InspectionStatus } from "@/types/pncpInspection";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { saveNewCatalogEntry } from '@/integrations/supabase/api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatCodug, formatCurrency } from '@/lib/formatUtils';
import { Textarea } from "@/components/ui/textarea";

interface PNCPInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionList: InspectionItem[];
    onFinalImport: (items: ItemAquisicao[]) => void;
    onReviewItem: (item: ItemAquisicao) => void;
    mode?: 'material' | 'servico'; // NOVO: Propriedade de modo
}

const AutoResizeTextarea: React.FC<{
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    disabled: boolean;
    className?: string;
}> = ({ value, onChange, disabled, className }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 80)}px`;
        }
    }, [value]);
    return (
        <Textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={cn("text-center text-sm overflow-hidden resize-none", className)}
            disabled={disabled}
            rows={1}
        />
    );
};

const PNCPInspectionDialog: React.FC<PNCPInspectionDialogProps> = ({
    open,
    onOpenChange,
    inspectionList: initialInspectionList,
    onFinalImport,
    onReviewItem,
    mode = 'material'
}) => {
    const [inspectionList, setInspectionList] = useState(initialInspectionList);
    const [activeTab, setActiveTab] = useState<InspectionStatus>('valid');
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();

    const catalogLabel = mode === 'material' ? 'CATMAT' : 'CATSER';

    useEffect(() => {
        setInspectionList(initialInspectionList);
        if (initialInspectionList.some(item => item.status === 'needs_catmat_info')) {
            setActiveTab('needs_catmat_info');
        } else {
            setActiveTab('valid');
        }
    }, [initialInspectionList]);

    const groupedItems = useMemo(() => {
        return inspectionList.reduce((acc, item) => {
            if (!acc[item.status]) acc[item.status] = [];
            acc[item.status].push(item);
            return acc;
        }, {} as Record<InspectionStatus, InspectionItem[]>);
    }, [inspectionList]);
    
    const totalValid = groupedItems.valid?.length || 0;
    const totalNeedsInfo = groupedItems.needs_catmat_info?.length || 0;
    const totalDuplicates = groupedItems.duplicate?.length || 0;

    const handleUpdateShortDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) return { ...item, userShortDescription: value };
            return item;
        }));
    };
    
    const handleUpdateFullDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                return { ...item, mappedItem: { ...item.mappedItem, descricao_item: value } };
            }
            return item;
        }));
    };
    
    const handleMarkAsValid = (item: InspectionItem) => {
        const shortDescription = (item.userShortDescription || '').trim();
        if (!shortDescription) {
            toast.error("A descrição reduzida não pode ser vazia.");
            return;
        }
        setInspectionList(prev => prev.map(i => {
            if (i.originalPncpItem.id === item.originalPncpItem.id) {
                return {
                    ...i,
                    status: 'valid',
                    mappedItem: { ...i.mappedItem, descricao_reduzida: shortDescription },
                    messages: ['Pronto para importação.'],
                };
            }
            return i;
        }));
        toast.success("Item movido para a aba 'Prontos'.");
    };

    const handleRemoveItem = (itemId: string) => {
        setInspectionList(prev => prev.filter(item => item.originalPncpItem.id !== itemId));
    };
    
    const handleReviewItemLocal = (item: InspectionItem) => {
        if (item.status === 'valid') {
            setInspectionList(prev => prev.map(i => {
                if (i.originalPncpItem.id === item.originalPncpItem.id) {
                    return { ...i, status: 'needs_catmat_info', messages: ['Item movido para revisão manual.'], userShortDescription: item.mappedItem.descricao_reduzida || '' };
                }
                return i;
            }));
            setActiveTab('needs_catmat_info');
        } else {
            onReviewItem(item.mappedItem);
            onOpenChange(false);
        }
    };

    const handleFinalImport = async () => {
        if (totalNeedsInfo > 0) {
            toast.error(`Ainda existem itens que requerem descrição reduzida.`);
            setActiveTab('needs_catmat_info');
            return;
        }
            
        const finalItems = inspectionList.filter(item => item.status === 'valid').map(item => item.mappedItem);
        if (finalItems.length === 0) {
            toast.error("Nenhum item válido para importação.");
            return;
        }
        
        setIsSaving(true);
        try {
            const persistencePromises = inspectionList
                .filter(item => item.status === 'valid' && !item.isCatmatCataloged)
                .map(item => saveNewCatalogEntry(
                    mode,
                    item.mappedItem.codigo_catmat,
                    item.mappedItem.descricao_item,
                    item.mappedItem.descricao_reduzida
                ));
                
            await Promise.all(persistencePromises);
            queryClient.invalidateQueries({ queryKey: [mode === 'material' ? 'catmatCatalog' : 'catserCatalog'] });
            onFinalImport(finalItems);
        } catch (error: any) {
            console.error("Erro ao salvar no catálogo:", error);
            toast.error(`Falha ao salvar itens no catálogo local.`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const renderInspectionTable = (status: InspectionStatus) => {
        const items = groupedItems[status] || [];
        if (items.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum item nesta categoria.</div>;
        
        return (
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[10%] text-center">Cód. Item</TableHead>
                            <TableHead className="w-[35%] text-center">Descrição (ARP)</TableHead>
                            <TableHead className="w-[35%] text-center">Descrição (PNCP)</TableHead>
                            <TableHead className="w-[20%] text-center">{status === 'needs_catmat_info' ? 'Nome Reduzido *' : 'Status'}</TableHead>
                            {status !== 'duplicate' && <TableHead className="w-[5%] text-center">Ações</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.originalPncpItem.id}>
                                <TableCell className="font-semibold text-sm text-center">{item.mappedItem.codigo_catmat}</TableCell>
                                <TableCell className="text-sm max-w-xs whitespace-normal text-center">
                                    {status === 'needs_catmat_info' ? (
                                        <AutoResizeTextarea value={item.mappedItem.descricao_item} onChange={(e) => handleUpdateFullDescription(item.originalPncpItem.id, e.target.value)} disabled={isSaving} />
                                    ) : item.mappedItem.descricao_item}
                                    <p className="text-xs text-muted-foreground mt-1">Pregão: {item.mappedItem.numero_pregao} ({formatCodug(item.mappedItem.uasg)}) | {formatCurrency(item.mappedItem.valor_unitario)}</p>
                                </TableCell>
                                <TableCell className="text-sm max-w-xs whitespace-normal text-muted-foreground text-center">
                                    {status === 'duplicate' ? <span className="text-gray-800 font-medium">{item.nomePdm || 'N/A'}</span> : item.fullPncpDescription}
                                </TableCell>
                                <TableCell className="py-2 text-center">
                                    {status === 'needs_catmat_info' ? (
                                        <>
                                            <Input value={item.userShortDescription} onChange={(e) => handleUpdateShortDescription(item.originalPncpItem.id, e.target.value)} placeholder="Inserir nome reduzido" disabled={isSaving} />
                                            {item.nomePdm && <p className="text-xs text-muted-foreground mt-1">Sugestão: {item.nomePdm}</p>}
                                        </>
                                    ) : status === 'valid' ? (
                                        <span className="font-medium text-sm">{item.mappedItem.descricao_reduzida}</span>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xs text-red-600 font-medium">Duplicado</span>
                                            <p className="text-[10px]">{item.isCatmatCataloged ? `No catálogo ${catalogLabel}` : `Fora do catálogo ${catalogLabel}`}</p>
                                        </div>
                                    )}
                                </TableCell>
                                {status !== 'duplicate' && (
                                    <TableCell className="text-right space-y-1">
                                        {status === 'needs_catmat_info' && <Button variant="secondary" size="sm" className="w-full" onClick={() => handleMarkAsValid(item)} disabled={isSaving || !item.userShortDescription.trim()}><Check className="h-4 w-4 mr-2" />Validar</Button>}
                                        {status === 'valid' && <Button variant="outline" size="sm" className="w-full" onClick={() => handleReviewItemLocal(item)}><Pencil className="h-4 w-4 mr-1" />Revisar</Button>}
                                        <Button variant="outline" size="sm" onClick={() => handleRemoveItem(item.originalPncpItem.id)} className="w-full text-red-600 border-red-300 hover:bg-red-100"><Trash2 className="h-4 w-4 mr-1" />Remover</Button>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <DialogTitle>Inspeção de Itens PNCP ({mode === 'material' ? 'Material' : 'Serviço'})</DialogTitle>
                    <DialogDescription>Revise os itens selecionados. Itens que requerem descrição reduzida para o catálogo {catalogLabel} devem ser resolvidos.</DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InspectionStatus)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="valid" className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" />Prontos ({totalValid})</TabsTrigger>
                        <TabsTrigger value="needs_catmat_info" className="flex items-center gap-2" disabled={totalNeedsInfo === 0}><AlertTriangle className="h-4 w-4 text-yellow-600" />Requer Revisão ({totalNeedsInfo})</TabsTrigger>
                        <TabsTrigger value="duplicate" className="flex items-center gap-2" disabled={totalDuplicates === 0}><X className="h-4 w-4 text-red-600" />Duplicados ({totalDuplicates})</TabsTrigger>
                    </TabsList>
                    <div className="min-h-[55vh]">
                        <TabsContent value="valid">{renderInspectionTable('valid')}</TabsContent>
                        <TabsContent value="needs_catmat_info">{renderInspectionTable('needs_catmat_info')}</TabsContent>
                        <TabsContent value="duplicate">{renderInspectionTable('duplicate')}</TabsContent>
                    </div>
                </Tabs>
                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">{totalNeedsInfo > 0 ? <span className="text-red-600 font-medium">Atenção: {totalNeedsInfo} requerem ação.</span> : <span className="text-green-600 font-medium">Todos os {totalValid} estão prontos.</span>}</p>
                    <div className="flex gap-2">
                        <Button type="button" onClick={handleFinalImport} disabled={totalValid === 0 || totalNeedsInfo > 0 || isSaving}>{isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Import className="h-4 w-4 mr-2" />}Importar {totalValid} Válido{totalValid === 1 ? '' : 's'}</Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PNCPInspectionDialog;