import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Search, Check, Package, Plus, FileSpreadsheet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useMaterialConsumoDiretrizes } from "@/hooks/useMaterialConsumoDiretrizes";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

interface MaterialConsumoItemSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    initialSelections: ItemAquisicao[];
    onSelect: (items: ItemAquisicao[]) => void;
    onAddDiretriz: () => void;
}

// Tipo auxiliar para rastrear o estado de seleção
interface SelectableItem extends ItemAquisicao {
    isSelected: boolean;
}

const MaterialConsumoItemSelectorDialog: React.FC<MaterialConsumoItemSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    initialSelections,
    onSelect,
    onAddDiretriz,
}) => {
    const { diretrizes, isLoading } = useMaterialConsumoDiretrizes(selectedYear);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, ItemAquisicao>>({});
    
    // Estado para controlar a expansão das diretrizes
    const [expandedDiretrizes, setExpandedDiretrizes] = useState<Record<string, boolean>>({});

    // Efeito para inicializar o mapa de seleção com base nos itens iniciais
    useEffect(() => {
        if (open) {
            const initialMap: Record<string, ItemAquisicao> = {};
            initialSelections.forEach(item => {
                initialMap[item.id] = item;
            });
            setSelectedItemsMap(initialMap);
        }
    }, [open, initialSelections]);

    // 1. Indexação e Filtragem de todos os itens disponíveis
    const filteredDiretrizes = useMemo(() => {
        if (isLoading || !diretrizes) return [];

        const lowerCaseSearch = searchTerm.toLowerCase().trim();

        return diretrizes
            .map(diretriz => {
                // Mapear itens_aquisicao (Json) de volta para ItemAquisicao[]
                const itemsAquisicao = (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
                
                // 1. Filtrar itens dentro da diretriz
                const filteredItems = itemsAquisicao.filter(item => {
                    if (!lowerCaseSearch) return true;
                    
                    const searchString = [
                        item.descricao_item,
                        item.codigo_catmat,
                        item.numero_pregao,
                        item.uasg,
                        diretriz.nr_subitem,
                        diretriz.nome_subitem,
                    ].join(' ').toLowerCase();
                    
                    return searchString.includes(lowerCaseSearch);
                });

                // 2. Se a diretriz ou qualquer item corresponder, incluir
                const diretrizMatches = diretriz.nr_subitem.toLowerCase().includes(lowerCaseSearch) ||
                                        diretriz.nome_subitem.toLowerCase().includes(lowerCaseSearch) ||
                                        filteredItems.length > 0;

                if (diretrizMatches) {
                    return {
                        ...diretriz,
                        itens_aquisicao: filteredItems,
                    };
                }
                return null;
            })
            .filter((d): d is DiretrizMaterialConsumo => d !== null);
    }, [diretrizes, searchTerm, isLoading]);
    
    // 2. Contagem de itens selecionados
    const selectedCount = Object.keys(selectedItemsMap).length;

    // 3. Handlers de Seleção
    const handleToggleItem = (item: ItemAquisicao) => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            if (newMap[item.id]) {
                delete newMap[item.id];
            } else {
                // Ao selecionar, garantimos que a quantidade inicial seja 1 e o valor total seja calculado
                newMap[item.id] = {
                    ...item,
                    quantidade: 1,
                    valor_total: item.valor_unitario * 1,
                };
            }
            return newMap;
        });
    };
    
    const handleSelectAllInDiretriz = (diretriz: DiretrizMaterialConsumo, select: boolean) => {
        setSelectedItemsMap(prev => {
            const newMap = { ...prev };
            const itemsAquisicao = (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
            
            itemsAquisicao.forEach(item => {
                if (select) {
                    // Adicionar, garantindo quantidade inicial 1
                    newMap[item.id] = {
                        ...item,
                        quantidade: 1,
                        valor_total: item.valor_unitario * 1,
                    };
                } else {
                    delete newMap[item.id];
                }
            });
            return newMap;
        });
    };

    const handleConfirmSelection = () => {
        const finalItems = Object.values(selectedItemsMap);
        onSelect(finalItems);
        onOpenChange(false);
        toast.success(`${finalItems.length} itens selecionados.`);
    };
    
    const handleOpenDiretrizConfig = () => {
        onOpenChange(false);
        onAddDiretriz();
    };
    
    // Verifica se todos os itens visíveis de uma diretriz estão selecionados
    const isDiretrizFullySelected = (diretriz: DiretrizMaterialConsumo) => {
        const itemsAquisicao = (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        if (itemsAquisicao.length === 0) return false;
        return itemsAquisicao.every(item => selectedItemsMap[item.id]);
    };
    
    // Verifica se pelo menos um item visível de uma diretriz está selecionado
    const isDiretrizPartiallySelected = (diretriz: DiretrizMaterialConsumo) => {
        const itemsAquisicao = (diretriz.itens_aquisicao as unknown as ItemAquisicao[]) || [];
        if (itemsAquisicao.length === 0) return false;
        return itemsAquisicao.some(item => selectedItemsMap[item.id]);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Selecionar Itens de Aquisição (ND 33.90.30/39)
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Selecione os itens de aquisição cadastrados nas diretrizes do ano {selectedYear}.
                    </p>
                </DialogHeader>

                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por CATMAT, Pregão, UASG ou descrição..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isLoading}
                            className="pl-10"
                        />
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={handleOpenDiretrizConfig}
                        disabled={isLoading}
                    >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Gerenciar Diretrizes
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">Carregando diretrizes...</span>
                    </div>
                ) : filteredDiretrizes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                        <p>Nenhuma diretriz ou item encontrado para o ano {selectedYear}.</p>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-4">
                            {filteredDiretrizes.map(diretriz => {
                                const isFullySelected = isDiretrizFullySelected(diretriz);
                                const isPartiallySelected = isDiretrizPartiallySelected(diretriz);
                                
                                return (
                                    <Collapsible 
                                        key={diretriz.id}
                                        open={expandedDiretrizes[diretriz.id] ?? false}
                                        onOpenChange={(open) => setExpandedDiretrizes(prev => ({ ...prev, [diretriz.id]: open }))}
                                    >
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md cursor-pointer hover:bg-muted transition-colors border">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        checked={isFullySelected}
                                                        indeterminate={!isFullySelected && isPartiallySelected}
                                                        onCheckedChange={(checked) => handleSelectAllInDiretriz(diretriz, checked === true)}
                                                        disabled={diretriz.itens_aquisicao.length === 0}
                                                        className="h-5 w-5"
                                                    />
                                                    <span className="font-semibold text-sm">
                                                        {diretriz.nr_subitem} - {diretriz.nome_subitem} 
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ({diretriz.itens_aquisicao.length} itens disponíveis)
                                                        </span>
                                                    </span>
                                                </div>
                                                {expandedDiretrizes[diretriz.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="pt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[50px]"></TableHead>
                                                        <TableHead>Item de Aquisição</TableHead>
                                                        <TableHead className="text-right w-[120px]">Vlr Unitário</TableHead>
                                                        <TableHead className="text-center w-[100px]">ND</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {diretriz.itens_aquisicao.map(item => (
                                                        <TableRow key={item.id} className={cn(selectedItemsMap[item.id] && "bg-primary/5")}>
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={!!selectedItemsMap[item.id]}
                                                                    onCheckedChange={() => handleToggleItem(item)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {item.descricao_item}
                                                                <p className="text-muted-foreground text-[10px]">
                                                                    CATMAT: {item.codigo_catmat} | Pregão: {item.numero_pregao}
                                                                </p>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs font-medium">
                                                                {formatCurrency(item.valor_unitario)}
                                                            </TableCell>
                                                            <TableCell className="text-center text-xs font-medium">
                                                                <Badge variant={item.nd === '33.90.30' ? 'secondary' : 'outline'}>
                                                                    {item.nd}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CollapsibleContent>
                                    </Collapsible>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <DialogFooter className="mt-4">
                    <div className="flex justify-between items-center w-full">
                        <p className="font-semibold">
                            Itens Selecionados: <span className="text-primary">{selectedCount}</span>
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmSelection} disabled={selectedCount === 0 || isLoading}>
                                <Check className="h-4 w-4 mr-2" />
                                Confirmar Seleção ({selectedCount})
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialConsumoItemSelectorDialog;