"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ItemAquisicaoMaterial } from "@/types/diretrizesMaterialPermanente";
import { Textarea } from "@/components/ui/textarea";
import { Save, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface MaterialPermanenteBulkJustificativaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: ItemAquisicaoMaterial[];
    onSave: (items: ItemAquisicaoMaterial[]) => void;
}

const FIELDS = ['finalidade'];

const MaterialPermanenteBulkJustificativaDialog: React.FC<MaterialPermanenteBulkJustificativaDialogProps> = ({
    open,
    onOpenChange,
    items,
    onSave,
}) => {
    const [localItems, setLocalItems] = useState<ItemAquisicaoMaterial[]>([]);
    const [activeCell, setActiveCell] = useState({ r: -1, c: -1 });

    useEffect(() => {
        if (open) {
            setLocalItems(JSON.parse(JSON.stringify(items)));
        }
    }, [open, items]);

    const handlePaste = (e: React.ClipboardEvent, r: number, c: number) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== "");
        
        const newItems = [...localItems];
        rows.forEach((rowText, rowIndex) => {
            const targetRow = r + rowIndex;
            if (targetRow < newItems.length) {
                const field = FIELDS[c];
                newItems[targetRow] = {
                    ...newItems[targetRow],
                    justificativa: { ...(newItems[targetRow].justificativa || {}), [field]: rowText.trim() }
                };
            }
        });
        setLocalItems(newItems);
    };

    const handleClearColumn = (c: number) => {
        const field = FIELDS[c];
        const next = localItems.map(item => ({
            ...item,
            justificativa: { ...(item.justificativa || {}), [field]: "" }
        }));
        setLocalItems(next);
        toast.info("Coluna limpa");
    };

    const handleSave = () => {
        onSave(localItems);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Preenchimento em Lote - Justificativas</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden border rounded-md mt-4">
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                                <TableRow>
                                    <TableHead className="w-[300px]">Item</TableHead>
                                    <TableHead>
                                        <div className="flex items-center justify-between">
                                            <span>Finalidade / Necessidade</span>
                                            <Button variant="ghost" size="icon" onClick={() => handleClearColumn(0)} className="h-6 w-6 text-destructive">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {localItems.map((item, r) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium text-xs">
                                            {item.descricao_reduzida || item.descricao_item}
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Textarea 
                                                className="min-h-[60px] text-xs resize-none"
                                                value={item.justificativa?.finalidade || ""}
                                                onChange={(e) => {
                                                    const next = [...localItems];
                                                    next[r] = {
                                                        ...next[r],
                                                        justificativa: { ...(next[r].justificativa || {}), finalidade: e.target.value }
                                                    };
                                                    setLocalItems(next);
                                                }}
                                                onPaste={(e) => handlePaste(e, r, 0)}
                                                onFocus={() => setActiveCell({ r, c: 0 })}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>

                <DialogFooter className="mt-4">
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" /> Salvar Tudo
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteBulkJustificativaDialog;