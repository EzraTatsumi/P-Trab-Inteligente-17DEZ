"use client";

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { MaterialConsumoItem } from "@/types/materialConsumo";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from '@/lib/utils';

interface MaterialConsumoItemSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diretrizes: DiretrizMaterialConsumo[];
  initialSelection: MaterialConsumoItem[];
  onConfirm: (selectedItens: MaterialConsumoItem[]) => void;
}

const MaterialConsumoItemSelectorDialog: React.FC<MaterialConsumoItemSelectorDialogProps> = ({
  open,
  onOpenChange,
  diretrizes,
  initialSelection,
  onConfirm,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelection.map(i => i.id)));

  // Flatten all items from all subitems for easier searching
  const allAvailableItems = useMemo(() => {
    return diretrizes.flatMap(diretriz => {
      const itens = (diretriz.itens_aquisicao || []) as ItemAquisicao[];
      return itens.map(item => ({
        ...item,
        subitemNr: diretriz.nr_subitem,
        subitemNome: diretriz.nome_subitem
      }));
    });
  }, [diretrizes]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return allAvailableItems;
    const lowerSearch = searchTerm.toLowerCase();
    return allAvailableItems.filter(item => 
      item.descricao_item.toLowerCase().includes(lowerSearch) ||
      item.codigo_catmat?.toLowerCase().includes(lowerSearch) ||
      item.subitemNr.toLowerCase().includes(lowerSearch) ||
      item.subitemNome.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm, allAvailableItems]);

  const handleToggleItem = (item: any) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    const selectedItens: MaterialConsumoItem[] = allAvailableItems
      .filter(item => selectedIds.has(item.id))
      .map(item => {
        // Check if it was already in initial selection to preserve quantity
        const existing = initialSelection.find(i => i.id === item.id);
        return {
          id: item.id,
          descricao_item: item.descricao_item,
          valor_unitario: item.valor_unitario,
          quantidade: existing?.quantidade || 0,
          valor_total: existing?.valor_total || 0,
          codigo_catmat: item.codigo_catmat || "",
          numero_pregao: item.numero_pregao || "",
          uasg: item.uasg || "",
          nr_subitem: item.subitemNr,
          unidade_medida: (item as any).unidade_medida || "UN"
        };
      });
    
    onConfirm(selectedItens);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col tour-item-selector-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Selecionar Itens de Material de Consumo
          </DialogTitle>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, CATMAT ou subitem..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-hidden border rounded-md">
          <ScrollArea className="h-full">
            {filteredItems.length > 0 ? (
              <div className="divide-y">
                {filteredItems.map((item) => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer",
                      selectedIds.has(item.id) && "bg-primary/5"
                    )}
                    onClick={() => handleToggleItem(item)}
                  >
                    <Checkbox 
                      checked={selectedIds.has(item.id)} 
                      onCheckedChange={() => handleToggleItem(item)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm font-medium leading-tight">{item.descricao_item}</p>
                        <span className="text-sm font-bold text-primary whitespace-nowrap">
                          {formatCurrency(item.valor_unitario)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-muted-foreground">
                        <span>Subitem: <span className="font-semibold text-foreground">{item.subitemNr} - {item.subitemNome}</span></span>
                        {item.codigo_catmat && <span>CATMAT: <span className="font-semibold text-foreground">{item.codigo_catmat}</span></span>}
                        {item.uasg && <span>UASG: <span className="font-semibold text-foreground">{formatCodug(item.uasg)}</span></span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-20" />
                <p>Nenhum item encontrado para a busca.</p>
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Seleção
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialConsumoItemSelectorDialog;