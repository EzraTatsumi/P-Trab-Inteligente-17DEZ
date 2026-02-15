"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Loader2, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatPregao } from "@/lib/formatUtils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MaterialPermanenteItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    initialItems: ItemAquisicao[];
    onSelect: (items: ItemAquisicao[]) => void;
    onAddDiretriz: () => void;
    categoria: string;
}

const MaterialPermanenteItemSelectorDialog: React.FC<MaterialPermanenteItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialItems,
    onSelect,
    onAddDiretriz,
}) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [tempSelected, setTempSelected] = useState<ItemAquisicao[]>(initialItems);

    const { data: diretrizes, isLoading } = useQuery({
        queryKey: ['diretrizesMaterialPermanente', selectedYear],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('diretrizes_material_permanente')
                .select('*')
                .eq('ano_referencia', selectedYear)
                .eq('ativo', true);

            if (error) throw error;
            return data;
        },
        enabled: open
    });

    const allItems = React.useMemo(() => {
        if (!diretrizes) return [];
        return diretrizes.flatMap(d => (d.itens_aquisicao as any[] || []).map(item => ({
            ...item,
            subitem_nome: d.nome_subitem,
            subitem_nr: d.nr_subitem
        })));
    }, [diretrizes]);

    const filteredItems = allItems.filter(item => 
        item.descricao_item.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.codigo_catmat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.subitem_nome?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleItem = (item: any) => {
        const isSelected = tempSelected.some(i => i.id === item.id);
        if (isSelected) {
            setTempSelected(tempSelected.filter(i => i.id !== item.id));
        } else {
            setTempSelected([...tempSelected, { ...item, quantidade: 1 }]);
        }
    };

    const handleConfirm = () => {
        onSelect(tempSelected);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-primary" />
                        Selecionar Itens de Material Permanente ({selectedYear})
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-2 space-y-4 flex-1 flex flex-col min-h-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar por descrição, CATMAT ou subitem..." 
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <ScrollArea className="flex-1 border rounded-md bg-muted/20">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : filteredItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                                <p>Nenhum item encontrado para este ano.</p>
                                <Button variant="link" onClick={onAddDiretriz}>Cadastrar Diretriz</Button>
                            </div>
                        ) : (
                            <div className="p-4 space-y-2">
                                {filteredItems.map((item) => {
                                    const isSelected = tempSelected.some(i => i.id === item.id);
                                    return (
                                        <div 
                                            key={item.id}
                                            className={cn(
                                                "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                                                isSelected ? "bg-primary/10 border-primary" : "bg-background"
                                            )}
                                            onClick={() => toggleItem(item)}
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Badge variant="outline" className="text-[10px]">{item.subitem_nr} - {item.subitem_nome}</Badge>
                                                    <span className="text-[10px] text-muted-foreground font-mono">CATMAT: {item.codigo_catmat}</span>
                                                </div>
                                                <p className="text-sm font-medium truncate">{item.descricao_item}</p>
                                                <p className="text-[10px] text-muted-foreground">Pregão: {formatPregao(item.numero_pregao)} | UASG: {item.uasg}</p>
                                            </div>
                                            <div className="text-right flex flex-col items-end gap-2">
                                                <span className="text-sm font-bold text-primary">{formatCurrency(item.valor_unitario)}</span>
                                                <div className={cn(
                                                    "h-5 w-5 rounded-full border flex items-center justify-center transition-colors",
                                                    isSelected ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                                                )}>
                                                    {isSelected && <Plus className="h-3 w-3" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <div className="p-6 pt-2 border-t flex justify-between items-center bg-muted/10">
                    <span className="text-sm text-muted-foreground">
                        {tempSelected.length} item(ns) selecionado(s)
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={handleConfirm} disabled={tempSelected.length === 0}>Confirmar Seleção</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

import { cn } from "@/lib/utils";

export default MaterialPermanenteItemSelectorDialog;