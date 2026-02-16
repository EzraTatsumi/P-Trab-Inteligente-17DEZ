"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ItemAquisicaoPermanente } from '@/types/diretrizesMaterialPermanente';

interface MaterialPermanenteBulkJustificativaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: ItemAquisicaoPermanente[];
    onSave: (justificativa: Record<string, any>) => void;
}

const MaterialPermanenteBulkJustificativaDialog: React.FC<MaterialPermanenteBulkJustificativaDialogProps> = ({
    open,
    onOpenChange,
    items,
    onSave,
}) => {
    const [justificativa, setJustificativa] = React.useState("");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Justificativa em Massa ({items.length} itens)</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Texto da Justificativa para todos os itens selecionados</Label>
                        <Textarea 
                            value={justificativa} 
                            onChange={(e) => setJustificativa(e.target.value)}
                            placeholder="Descreva a necessidade comum destes materiais..."
                            rows={6}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => { onSave({ texto: justificativa }); onOpenChange(false); }}>Aplicar a Todos</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteBulkJustificativaDialog;