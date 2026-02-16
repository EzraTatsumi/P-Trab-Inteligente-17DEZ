"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";

interface MaterialPermanenteJustificativaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemName: string;
    data: Record<string, string>;
    diasOperacao: number;
    faseAtividade: string;
    onSave: (data: Record<string, string>) => void;
}

const MaterialPermanenteJustificativaDialog: React.FC<MaterialPermanenteJustificativaDialogProps> = ({
    open,
    onOpenChange,
    itemName,
    data,
    onSave,
}) => {
    const [justificativa, setJustificativa] = useState<Record<string, string>>({});

    useEffect(() => {
        if (open) {
            setJustificativa(data || {});
        }
    }, [open, data]);

    const handleSave = () => {
        onSave(justificativa);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Justificativa: {itemName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Finalidade / Necessidade</Label>
                        <Textarea 
                            value={justificativa.finalidade || ""} 
                            onChange={(e) => setJustificativa(prev => ({ ...prev, finalidade: e.target.value }))}
                            placeholder="Descreva a finalidade da aquisição..."
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" /> Salvar Justificativa
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteJustificativaDialog;