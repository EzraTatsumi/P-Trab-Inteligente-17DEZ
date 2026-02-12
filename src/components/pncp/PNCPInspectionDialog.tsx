import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/tabs";
import { Loader2, Import, Check, X, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { InspectionItem, InspectionStatus } from "@/types/pncpInspection";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { saveNewCatmatEntry, saveNewCatserEntry } from '@/integrations/supabase/api';
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
    mode: 'material' | 'servico';
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
    mode
}) => {
    const [inspectionList, setInspectionList] = useState(initialInspectionList);
    const [activeTab, setActiveTab] = useState<InspectionStatus>('valid');
    const [isSaving, setIsSaving] = useState(false);
    const queryClient = useQueryClient();

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
    };

    const handleFinalImport = async () => {
        const finalItems = inspectionList.filter(item => item.status === 'valid').map(item => item.mappedItem);
        setIsSaving(true);
        try {
            const persistencePromises = inspectionList
                .filter(item => item.status === 'valid' && !item.isCatmatCataloged)
                .map(item => {
                    if (mode === 'material') {
                        return saveNewCatmatEntry(item.mappedItem.codigo_catmat, item.mappedItem.descricao_item, item.mappedItem.descricao_reduzida);
                    } else {
                        // Função para CATSER (Serviços)
                        return saveNewCatserEntry(item.mappedItem.codigo_catmat, item.mappedItem.descricao_item, item.mappedItem.descricao_reduzida);
                    }
                });
            await Promise.all(persistencePromises);
            queryClient.invalidateQueries({ queryKey: [mode === 'material' ? 'catmatCatalog' : 'catserCatalog'] });
            onFinalImport(finalItems);
            onOpenChange(false);
        } catch (error: any) {
            toast.error(`Erro ao salvar no catálogo: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <DialogTitle>Inspeção de Itens PNCP ({mode === 'material' ? 'Material' : 'Serviço'})</DialogTitle>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as InspectionStatus)}>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="valid">Prontos ({groupedItems.valid?.length || 0})</TabsTrigger>
                        <TabsTrigger value="needs_catmat_info">Requer Revisão ({groupedItems.needs_catmat_info?.length || 0})</TabsTrigger>
                        <TabsTrigger value="duplicate">Duplicados ({groupedItems.duplicate?.length || 0})</TabsTrigger>
                    </TabsList>
                    <div className="min-h-[55vh]">
                        {/* Renderização das tabelas conforme layout original */}
                        <TabsContent value={activeTab}>
                            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow>
                                            <TableHead className="text-center">Cód. {mode === 'material' ? 'CATMAT' : 'CATSER'}</TableHead>
                                            <TableHead className="text-center">Descrição ARP</TableHead>
                                            <TableHead className="text-center">Nome Reduzido</TableHead>
                                            <TableHead className="text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(groupedItems[activeTab] || []).map(item => (
                                            <TableRow key={item.originalPncpItem.id}>
                                                <TableCell className="text-center font-semibold">{item.mappedItem.codigo_catmat}</TableCell>
                                                <TableCell className="max-w-xs text-center">{item.mappedItem.descricao_item}</TableCell>
                                                <TableCell>
                                                    {activeTab === 'needs_catmat_info' ? (
                                                        <Input 
                                                            value={item.userShortDescription} 
                                                            onChange={e => setInspectionList(prev => prev.map(i => i.originalPncpItem.id === item.originalPncpItem.id ? {...i, userShortDescription: e.target.value} : i))}
                                                        />
                                                    ) : item.mappedItem.descricao_reduzida}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {activeTab === 'needs_catmat_info' && (
                                                        <Button size="sm" onClick={() => handleMarkAsValid(item)}>Validar</Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
                <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button onClick={handleFinalImport} disabled={isSaving || (groupedItems.needs_catmat_info?.length || 0) > 0}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Importar Itens Válidos
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PNCPInspectionDialog;