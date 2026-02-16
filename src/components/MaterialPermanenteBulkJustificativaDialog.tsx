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
import { Textarea } from "@/components/ui/textarea";
import { Save, X, ClipboardPaste } from "lucide-react";
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
  const [selection, setSelection] = React.useState<{
    start: { row: number, col: number } | null,
    end: { row: number, col: number } | null,
    isSelecting: boolean
  }>({ start: null, end: null, isSelecting: false });

  React.useEffect(() => {
    if (open) {
      setLocalItems(JSON.parse(JSON.stringify(items)));
      setSelection({ start: null, end: null, isSelecting: false });
    }
  }, [open, items]);

  // Atalho de teclado para Cópia (Ctrl+C)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || !selection.start || !selection.end) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        // Se houver um elemento focado que não seja o corpo da tabela (como um input), 
        // deixamos o comportamento padrão do navegador agir se houver texto selecionado.
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'TEXTAREA' || activeElement?.tagName === 'INPUT') {
          const selectionText = window.getSelection()?.toString();
          if (selectionText) return; // Deixa copiar o texto interno
        }

        const startRow = Math.min(selection.start.row, selection.end.row);
        const endRow = Math.max(selection.start.row, selection.end.row);
        const startCol = Math.min(selection.start.col, selection.end.col);
        const endCol = Math.max(selection.start.col, selection.end.col);

        let copyText = "";
        for (let r = startRow; r <= endRow; r++) {
          const rowData = [];
          for (let c = startCol; c <= endCol; c++) {
            const field = FIELDS[c];
            rowData.push(localItems[r].justificativa?.[field] || "");
          }
          copyText += rowData.join('\t') + (r === endRow ? "" : "\n");
        }

        navigator.clipboard.writeText(copyText).then(() => {
          toast.success("Células copiadas!");
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selection, localItems]);

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

  const isCellSelected = (rowIdx: number, colIdx: number) => {
    if (!selection.start || !selection.end) return false;
    const startRow = Math.min(selection.start.row, selection.end.row);
    const endRow = Math.max(selection.start.row, selection.end.row);
    const startCol = Math.min(selection.start.col, selection.end.col);
    const endCol = Math.max(selection.start.col, selection.end.col);

    return rowIdx >= startRow && rowIdx <= endRow && colIdx >= startCol && colIdx <= endCol;
  };

  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    setSelection({
      start: { row: rowIdx, col: colIdx },
      end: { row: rowIdx, col: colIdx },
      isSelecting: true
    });
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (selection.isSelecting) {
      setSelection(prev => ({ ...prev, end: { row: rowIdx, col: colIdx } }));
    }
  };

  const handleMouseUp = () => {
    setSelection(prev => ({ ...prev, isSelecting: false }));
  };

  const handleSave = () => {
    onSave(localItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col"
        onMouseUp={handleMouseUp}
      >
        <DialogHeader>
          <DialogTitle>
            Preenchimento Coletivo de Justificativas
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
            Selecione células e use Ctrl+C / Ctrl+V para manipular os dados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto border rounded-md my-4 shadow-inner bg-muted/5 select-none">
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
              {localItems.map((item, rowIdx) => (
                <TableRow key={item.id} className="hover:bg-primary/5 transition-colors">
                  <TableCell className="font-medium text-xs bg-muted/20 border-r sticky left-0 z-10">
                    {item.descricao_reduzida || item.descricao_item}
                  </TableCell>
                  {FIELDS.map((field, colIdx) => {
                    const selected = isCellSelected(rowIdx, colIdx);
                    return (
                      <TableCell 
                        key={field} 
                        className={`p-0 border-r last:border-r-0 align-top transition-colors ${selected ? 'bg-primary/20 ring-1 ring-inset ring-primary/30' : ''}`}
                        onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                        onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                      >
                        <Textarea 
                          className="min-h-[40px] text-xs border-none focus-visible:ring-1 focus-visible:ring-primary rounded-none bg-transparent w-full resize-none overflow-hidden py-2 px-3 cursor-text"
                          value={item.justificativa?.[field] || ""}
                          onChange={(e) => {
                            handleInputChange(item.id, field, e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onPaste={(e) => handlePaste(e, item.id, field)}
                          placeholder="..."
                          rows={1}
                        />
                      </TableCell>
                    );
                  })}
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