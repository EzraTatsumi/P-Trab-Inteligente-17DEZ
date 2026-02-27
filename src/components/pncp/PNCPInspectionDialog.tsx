"use client";

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
import { isGhostMode } from '@/lib/ghostStore';

interface PNCPInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionList: InspectionItem[];
    onFinalImport: (items: ItemAquisicao[]) => void;
    onReviewItem: (item: ItemAquisicao) => void;
    mode?: 'material' | 'servico';
}

const formatItemCount = (count: number) => {
    const itemWord = count === 1 ? 'item' : 'itens';
    return `${count} ${itemWord}`;
};

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
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.max(scrollHeight, 80)}px`;
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
    mode = 'material',
}) => {
    const [inspectionList, setInspectionList] = useState(initialInspectionList);
    const [activeTab, setActiveTab] = useState<InspectionStatus>('valid');
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();

    useEffect(() => {
        setInspectionList(initialInspectionList);
        if (initialInspectionList.some(item => item.status === 'needs_catmat_info')) setActiveTab('needs_catmat_info');
        else setActiveTab('valid');
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
        setInspectionList(prev => prev.map(item => item.originalPncpItem.id === itemId ? { ...item, userShortDescription: value } : item));
    };

    const handleUpdateFullDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => item.originalPncpItem.id === itemId ? { ...item, mappedItem: { ...item.mappedItem, descricao_item: value } } : item));
    };

    const handleMarkAsValid = (item: InspectionItem) => {
        const shortDescription = (item.userShortDescription || '').trim();
        if (!shortDescription) {
            toast.error("A descrição reduzida não pode ser vazia.");
            return;
        }
        setInspectionList(prev => prev.map(i => i.originalPncpItem.id === item.originalPncpItem.id ? {
            ...i,
            status: 'valid',
            mappedItem: { ...i.mappedItem, descricao_reduzida: shortDescription },
            messages: ['Pronto para importação.'],
        } : i));
        toast.success("Item movido para a aba 'Prontos'.");
    };

    const handleRemoveItem = (itemId: string) => {
        setInspectionList(prev => prev.filter(item => item.originalPncpItem.id !== itemId));
    };

    const handleReviewItemLocal = (item: InspectionItem) => {
        if (item.status === 'valid') {
            setInspectionList(prev => prev.map(i => i.originalPncpItem.id === item.originalPncpItem.id ? {
                ...i,
                status: 'needs_catmat_info',
                messages: ['Item movido para revisão manual.'],
                userShortDescription: item.mappedItem.descricao_reduzida || '', 
            } : i));
            setActiveTab('needs_catmat_info');
            toast.info("Item movido para a aba 'Requer Revisão'.");
        } else {
            onReviewItem(item.mappedItem);
            onOpenChange(false);
        }
    };

    const handleFinalImportAction = async () => {
        if (totalNeedsInfo > 0) {
            toast.error("Ainda existem itens que requerem descrição reduzida.");
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
                .map(item => saveNewCatalogEntry(item.mappedItem.codigo_catmat, item.mappedItem.descricao_item, item.mappedItem.descricao_reduzida, mode));
            await Promise.all(persistencePromises);
            queryClient.invalidateQueries({ queryKey: [mode === 'material' ? 'catmatCatalog' : 'catserCatalog'] });
            onFinalImport(finalItems);
            
            // Avança o tour com um pequeno delay para permitir a limpeza da tela (fechamento do modal)
            if (isGhostMode()) {
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('tour:avancar'));
                }, 600);
            }
            
            toast.success(`Importação de ${formatItemCount(finalItems.length)} concluída.`);
        } catch (error: any) {
            console.error("Erro durante a importação final:", error);
            toast.error(`Falha ao salvar itens no catálogo local.`);
        } finally {
            setIsSaving(false);
        }
    };

    const renderInspectionTable = (status: InspectionStatus) => {
        const items = groupedItems[status] || [];
        if (items.length === 0) return <div className="text-center py-8 text-muted-foreground">Nenhum item nesta categoria.</div>;
        
        const codeLabel = mode === 'material' ? 'Cód. Item' : 'Cód. Serviço';
        const catalogLabel = mode === 'material' ? 'CATMAT' : 'CATSER';

        return (
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[10%] text-center">{codeLabel}</TableHead>
                            <TableHead className="w-[35%] text-center">Descrição Completa (ARP)</TableHead>
                            <TableHead className="w-[35%] text-center">Descrição Completa (PNCP)</TableHead>
                            <TableHead className="w-[20%] text-center">{status === 'duplicate' ? 'Status' : 'Nome Reduzido'}</TableHead>
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
                                    <p className="text-xs text-muted-foreground mt-1">Pregão: {item.mappedItem.numero_pregao.replace(/^0+/, '')} ({formatCodug(item.mappedItem.uasg)}) | R$: {formatCurrency(item.mappedItem.valor_unitario)}</p>
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
                                            <span className="text-xs text-red-600 font-medium">Duplicidade na Chave de Contrato.</span>
                                            <p className={cn("text-xs", item.isCatmatCataloged ? "text-green-600" : "text-red-600")}>{item.isCatmatCataloged ? `Presente no Catálogo ${catalogLabel}` : `Não presente no Catálogo ${catalogLabel}`}</p>
                                        </div>
                                    )}
                                </TableCell>
                                {status !== 'duplicate' && (
                                    <TableCell className="text-right space-y-1">
                                        {status === 'needs_catmat_info' && <Button variant="secondary" size="sm" className="w-full" onClick={() => handleMarkAsValid(item)} disabled={isSaving || !item.userShortDescription.trim()}><Check className="h-4 w-4 mr-2" />Validar</Button>}
                                        {status === 'valid' && <Button variant="outline" size="sm" onClick={() => handleReviewItemLocal(item)} className="w-full"><Pencil className="h-4 w-4 mr-1" />Revisar</Button>}
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
            <DialogContent className="max-w-7xl tour-inspection-dialog">
                <DialogHeader>
                    <DialogTitle>Inspeção de Itens PNCP ({mode === 'material' ? 'Materiais' : 'Serviços'})</DialogTitle>
                    <DialogDescription>Revise os {formatItemCount(initialInspectionList.length)} selecionados. Itens duplicados serão descartados.</DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InspectionStatus)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="valid" className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" />Prontos ({totalValid})</TabsTrigger>
                        <TabsTrigger value="needs_catmat_info" className="flex items-center gap-2" disabled={totalNeedsInfo === 0}><AlertTriangle className="h-4 w-4 text-yellow-600" />Requer Revisão ({totalNeedsInfo})</TabsTrigger>
                        <TabsTrigger value="duplicate" className="flex items-center gap-2" disabled={totalDuplicates === 0}><X className="h-4 w-4 text-red-600" />Duplicados ({totalDuplicates})</TabsTrigger>
                    </TabsList>
                    <div className="min-h-[55vh]">
                        <TabsContent value="valid">{renderInspectionTable('valid')}</TabsContent>
                        <TabsContent value="needs_catmat_info">
                            <p className="text-sm text-muted-foreground mb-3">Forneça um nome curto para facilitar a identificação e clique em "Validar".</p>
                            {renderInspectionTable('needs_catmat_info')}
                        </TabsContent>
                        <TabsContent value="duplicate">
                            <p className="text-sm text-muted-foreground mb-3 text-red-600">Itens com Chave de Contrato idêntica a um item já existente.</p>
                            {renderInspectionTable('duplicate')}
                        </TabsContent>
                    </div>
                </Tabs>
                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">{totalNeedsInfo > 0 ? <span className="text-red-600 font-medium">Atenção: {formatItemCount(totalNeedsInfo)} requerem ação.</span> : <span className="text-green-600 font-medium">Todos os {formatItemCount(totalValid)} estão prontos.</span>}</p>
                    <div className="flex gap-2">
                        <Button type="button" onClick={handleFinalImportAction} disabled={totalValid === 0 || totalNeedsInfo > 0 || isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Import className="h-4 w-4 mr-2" />}
                            Importar {formatItemCount(totalValid)}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PNCPInspectionDialog;