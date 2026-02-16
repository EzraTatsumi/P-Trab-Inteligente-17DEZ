"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MaterialPermanenteJustificativaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    itemName: string;
    data: Record<string, any>;
    diasOperacao: number;
    faseAtividade: string;
    onSave: (data: Record<string, any>) => void;
}

const MaterialPermanenteJustificativaDialog: React.FC<MaterialPermanenteJustificativaDialogProps> = ({
    open,
    onOpenChange,
    itemName,
    data,
    onSave,
}) => {
    const [justificativa, setJustificativa] = React.useState(data.texto || "");

    React.useEffect(() => {
        if (open) setJustificativa(data.texto || "");
    }, [open, data]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Justificativa: {itemName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Texto da Justificativa</Label>
                        <Textarea 
                            value={justificativa} 
                            onChange={(e) => setJustificativa(e.target.value)}
                            placeholder="Descreva a necessidade deste material..."
                            rows={6}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => { onSave({ texto: justificativa }); onOpenChange(false); }}>Salvar</Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MaterialPermanenteJustificativaDialog;