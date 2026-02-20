"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { ItemAquisicaoPermanente } from "@/types/diretrizesMaterialPermanente";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MaterialPermanenteBulkJustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemAquisicaoPermanente[];
  onSave: (updatedItems: ItemAquisicaoPermanente[]) => void;
}

const FIELDS = ['grupo', 'proposito', 'destinacao', 'local', 'finalidade', 'motivo'];

const FIELD_LABELS: Record<string, string> = {
  grupo: 'Grupo (Tipo Material?)',
  proposito: 'Propósito (Obj imediato?)',
  destinacao: 'Destinação (Para quem?)',
  local: 'Local (Onde será empregado?)',
  finalidade: 'Finalidade (Para quê?)',
  motivo: 'Motivo (Porque?)'
};

const MaterialPermanenteBulkJustificativaDialog = ({
  open,
  onOpenChange,
  items,
  onSave
}: MaterialPermanenteBulkJustificativaDialogProps) => {
  const [localItems, setLocalItems] = useState<ItemAquisicaoPermanente[]>([]);
  const [activeCell, setActiveCell] = useState<{ r: number, c: number }>({ r: 0, c: 0 });
  const [selection, setSelection] = useState<{ start: { r: number, c: number }, end: { r: number, c: number } | null }>({
    start: { r: 0, c: 0 },
    end: null
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setLocalItems(JSON.parse(JSON.stringify(items)));
      setActiveCell({ r: 0, c: 0 });
      setSelection({ start: { r: 0, c: 0 }, end: null });
      setIsEditing(false);
    }
  }, [open, items]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const getSelectionRange = useCallback(() => {
    const start = selection.start;
    const end = selection.end || selection.start;
    return {
      minR: Math.min(start.r, end.r),
      maxR: Math.max(start.r, end.r),
      minC: Math.min(start.c, end.c),
      maxC: Math.max(start.c, end.c)
    };
  }, [selection]);

  const isCellSelected = (r: number, c: number) => {
    const { minR, maxR, minC, maxC } = getSelectionRange();
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  const handleCopy = useCallback(() => {
    const { minR, maxR, minC, maxC } = getSelectionRange();
    let copyText = "";
    for (let r = minR; r <= maxR; r++) {
      const rowData = [];
      for (let c = minC; c <= maxC; c++) {
        rowData.push(localItems[r].justificativa?.[FIELDS[c]] || "");
      }
      copyText += rowData.join('\t') + (r === maxR ? "" : "\n");
    }
    navigator.clipboard.writeText(copyText);
    toast.success("Células copiadas");
  }, [localItems, getSelectionRange]);

  const handlePaste = useCallback(async (targetR: number, targetC: number) => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split(/\r?\n/).filter(row => row.length > 0 || row === "");
      
      setLocalItems(prev => {
        const newItems = [...prev];
        rows.forEach((rowText, rowOffset) => {
          const r = targetR + rowOffset;
          if (r >= newItems.length) return;

          const cols = rowText.split('\t');
          cols.forEach((cellText, colOffset) => {
            const c = targetC + colOffset;
            if (c >= FIELDS.length) return;

            const field = FIELDS[c];
            newItems[r] = {
              ...newItems[r],
              justificativa: { ...(newItems[r].justificativa || {}), [field]: cellText.trim() }
            };
          });
        });
        return newItems;
      });
      toast.success("Dados colados");
    } catch (err) {
      toast.error("Erro ao acessar área de transferência");
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Escape') {
        setIsEditing(false);
        e.preventDefault();
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        setIsEditing(false);
        if (activeCell.r < localItems.length - 1) {
          const next = { r: activeCell.r + 1, c: activeCell.c };
          setActiveCell(next);
          setSelection({ start: next, end: null });
        }
        e.preventDefault();
      }
      return;
    }

    // Atalhos Globais (Modo Seleção)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      handleCopy();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      handlePaste(activeCell.r, activeCell.c);
      e.preventDefault();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const { minR, maxR, minC, maxC } = getSelectionRange();
      setLocalItems(prev => {
        const next = [...prev];
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            const field = FIELDS[c];
            next[r] = { ...next[r], justificativa: { ...(next[r].justificativa || {}), [field]: "" } };
          }
        }
        return next;
      });
      e.preventDefault();
      return;
    }

    // Navegação
    let { r, c } = activeCell;
    if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') r = Math.min(localItems.length - 1, r + 1);
    else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') c = Math.min(FIELDS.length - 1, c + 1);
    else if (e.key === 'Enter') {
      setIsEditing(true);
      e.preventDefault();
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Começar a digitar limpa a célula e entra em edição
      const field = FIELDS[activeCell.c];
      setLocalItems(prev => {
        const next = [...prev];
        next[activeCell.r] = { ...next[activeCell.r], justificativa: { ...(next[activeCell.r].justificativa || {}), [field]: "" } };
        return next;
      });
      setIsEditing(true);
      return;
    } else return;

    const nextPos = { r, c };
    setActiveCell(nextPos);
    if (e.shiftKey) {
      setSelection(prev => ({ ...prev, end: nextPos }));
    } else {
      setSelection({ start: nextPos, end: null });
    }
    e.preventDefault();
  };

  const handleMouseDown = (r: number, c: number) => {
    if (isEditing && (r !== activeCell.r || c !== activeCell.c)) {
      setIsEditing(false);
    }
    setIsSelecting(true);
    setActiveCell({ r, c });
    setSelection({ start: { r, c }, end: null });
  };

  const handleMouseEnter = (r: number, c: number) => {
    if (isSelecting) {
      setSelection(prev => ({ ...prev, end: { r, c } }));
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleSave = () => {
    onSave(localItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-[95vw] w-full max-h-[90vh] overflow-hidden flex flex-col outline-none"
        onKeyDown={handleKeyDown}
        onMouseUp={handleMouseUp}
        tabIndex={0}
      >
        <DialogHeader>
          <DialogTitle>Preenchimento Coletivo de Justificativas</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
            Use as setas para navegar, Shift para selecionar e Ctrl+C/V para copiar e colar (aceita dados do Excel).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto border rounded-md my-4 shadow-inner bg-muted/5 select-none relative">
          <Table className="border-collapse table-fixed w-full">
            <TableHeader className="sticky top-0 bg-background z-20 shadow-sm">
              <TableRow>
                <TableHead className="w-[200px] bg-muted/50 border-r text-xs font-bold">Item</TableHead>
                {FIELDS.map(f => (
                  <TableHead key={f} className="w-[180px] text-center text-[10px] font-bold border-r uppercase tracking-tighter leading-tight py-2">
                    {FIELD_LABELS[f]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item, r) => (
                <TableRow key={item.id} className="h-[40px]">
                  <TableCell className="font-medium text-[10px] bg-muted/20 border-r sticky left-0 z-10 truncate px-2">
                    {item.descricao_reduzida || item.descricao_item}
                  </TableCell>
                  {FIELDS.map((field, c) => {
                    const isSelected = isCellSelected(r, c);
                    const isActive = activeCell.r === r && activeCell.c === c;
                    const value = item.justificativa?.[field] || "";

                    return (
                      <TableCell 
                        key={field} 
                        className={cn(
                          "p-0 border-r last:border-r-0 relative cursor-cell transition-colors",
                          isSelected && "bg-primary/10",
                          isActive && "ring-2 ring-inset ring-primary z-10"
                        )}
                        onMouseDown={() => handleMouseDown(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        onDoubleClick={() => setIsEditing(true)}
                      >
                        {isEditing && isActive ? (
                          <Textarea 
                            ref={textareaRef}
                            className="absolute inset-0 h-full w-full text-xs border-none focus-visible:ring-0 rounded-none bg-background z-30 resize-none p-2"
                            value={value}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalItems(prev => {
                                const next = [...prev];
                                next[r] = { ...next[r], justificativa: { ...(next[r].justificativa || {}), [field]: val } };
                                return next;
                              });
                            }}
                            onBlur={() => setIsEditing(false)}
                          />
                        ) : (
                          <div className="w-full h-full min-h-[40px] p-2 text-[11px] overflow-hidden whitespace-pre-wrap break-words">
                            {value}
                          </div>
                        )}
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