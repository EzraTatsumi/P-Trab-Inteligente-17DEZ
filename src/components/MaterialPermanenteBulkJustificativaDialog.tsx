"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Table as TableIcon, Save, X, ClipboardPaste } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { toast } from "sonner";

interface MaterialPermanenteBulkJustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemAquisicao[];
  onSave: (updatedItems: ItemAquisicao[]) => void;
}

const FIELDS = ['grupo', 'proposito', 'destinacao', 'local', 'finalidade', 'motivo'];

const MaterialPermanenteBulkJustificativaDialog = ({
  open,
  onOpenChange,
  items,
  onSave
}: MaterialPermanenteBulkJustificativaDialogProps) => {
  const [localItems, setLocalItems] = React.useState<ItemAquisicao[]>([]);
  const [focusedCell, setFocusedCell] = React.useState<{ itemId: string, field: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setLocalItems(JSON.parse(JSON.stringify(items)));
      setFocusedCell(null);
    }
  }, [open, items]);

  const handleInputChange = (id: string, field: string, value: string) => {
    setLocalItems(prev => prev.map(item => {
      if (item.id === id) {
        const justificativa = { ...(item.justificativa || {}), [field]: value };
        return { ...item, justificativa };
      }
      return item;
    }));
  };

  const handlePaste = (e: React.ClipboardEvent, startItemId: string, startField: string) => {
    // Se for uma colagem simples (sem tabulações ou quebras de linha), deixa o comportamento padrão do input
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData.includes('\t') && !pasteData.includes('\n')) {
      return;
    }

    e.preventDefault();
    
    const rows = pasteData.split(/\r?\n/).filter(row => row.length > 0 || row === "");
    const startItemIdx = localItems.findIndex(item => item.id === startItemId);
    const startFieldIdx = FIELDS.indexOf(startField);

    if (startItemIdx === -1 || startFieldIdx === -1) return;

    setLocalItems(prev => {
      const newItems = [...prev];
      
      rows.forEach((rowText, rowOffset) => {
        const targetItemIdx = startItemIdx + rowOffset;
        if (targetItemIdx >= newItems.length) return;

        const cols = rowText.split('\t');
        cols.forEach((cellText, colOffset) => {
          const targetFieldIdx = startFieldIdx + colOffset;
          if (targetFieldIdx >= FIELDS.length) return;

          const fieldName = FIELDS[targetFieldIdx];
          const currentItem = { ...newItems[targetItemIdx] };
          currentItem.justificativa = { 
            ...(currentItem.justificativa || {}), 
            [fieldName]: cellText.trim() 
          };
          newItems[targetItemIdx] = currentItem;
        });
      });
      
      return newItems;
    });

    toast.success("Dados colados com sucesso!");
  };

  const handleSave = () => {
    onSave(localItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-primary" />
            Preenchimento Coletivo de Justificativas
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
            Dica: Copie dados do Excel e cole em uma célula para preencher múltiplas linhas e colunas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto border rounded-md my-4 shadow-inner bg-muted/5">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="min-w-[200px] bg-muted/50 border-r">Item</TableHead>
                <TableHead className="min-w-[150px] text-center">Grupo</TableHead>
                <TableHead className="min-w-[150px] text-center">Propósito</TableHead>
                <TableHead className="min-w-[150px] text-center">Destinação</TableHead>
                <TableHead className="min-w-[150px] text-center">Local</TableHead>
                <TableHead className="min-w-[150px] text-center">Finalidade</TableHead>
                <TableHead className="min-w-[300px] text-center">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item) => (
                <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="font-medium text-xs bg-muted/20 border-r sticky left-0 z-10">
                    {item.descricao_reduzida || item.descricao_item}
                  </TableCell>
                  {FIELDS.map((field) => (
                    <TableCell key={field} className="p-0 border-r last:border-r-0">
                      <Input 
                        className="h-10 text-xs border-none focus-visible:ring-1 focus-visible:ring-primary rounded-none bg-transparent w-full"
                        value={item.justificativa?.[field] || ""}
                        onChange={(e) => handleInputChange(item.id, field, e.target.value)}
                        onFocus={() => setFocusedCell({ itemId: item.id, field })}
                        onPaste={(e) => handlePaste(e, item.id, field)}
                        placeholder="..."
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex justify-end gap-3 pt-4 border-t">
          <Button onClick={handleSave} className="gap-2 px-8">
            <Save className="h-4 w-4" />
            Confirmar Alterações
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6">
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPermanenteBulkJustificativaDialog;