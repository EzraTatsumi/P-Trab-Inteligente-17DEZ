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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Save } from "lucide-react";

interface JustificativaData {
  proposito?: string;
  destinacao?: string;
  local?: string;
  finalidade?: string;
  periodo?: string;
  motivo?: string;
}

interface MaterialPermanenteJustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  data: JustificativaData;
  onSave: (data: JustificativaData) => void;
}

const MaterialPermanenteJustificativaDialog = ({
  open,
  onOpenChange,
  itemName,
  data,
  onSave
}: MaterialPermanenteJustificativaDialogProps) => {
  const [formData, setFormData] = React.useState<JustificativaData>(data);

  React.useEffect(() => {
    if (open) {
      setFormData(data);
    }
  }, [open, data]);

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Justificativa da Aquisição
          </DialogTitle>
          <DialogDescription>
            Detalhamento técnico para o item: <span className="font-semibold text-foreground">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Propósito (Obj imediato?)</Label>
            <Input 
              value={formData.proposito || ""} 
              onChange={(e) => setFormData({ ...formData, proposito: e.target.value })}
              placeholder="Ex: Atender demanda X"
            />
          </div>
          <div className="space-y-2">
            <Label>Destinação (Para quem?) Seç/OM</Label>
            <Input 
              value={formData.destinacao || ""} 
              onChange={(e) => setFormData({ ...formData, destinacao: e.target.value })}
              placeholder="Ex: 1ª Seção / OM"
            />
          </div>
          <div className="space-y-2">
            <Label>Local (Onde será empregado?)</Label>
            <Input 
              value={formData.local || ""} 
              onChange={(e) => setFormData({ ...formData, local: e.target.value })}
              placeholder="Ex: Campo de Instrução"
            />
          </div>
          <div className="space-y-2">
            <Label>Finalidade (Para quê?) Obj Geral</Label>
            <Input 
              value={formData.finalidade || ""} 
              onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
              placeholder="Ex: Apoio logístico"
            />
          </div>
          <div className="space-y-2">
            <Label>Período (Quando?)</Label>
            <Input 
              value={formData.periodo || ""} 
              onChange={(e) => setFormData({ ...formData, periodo: e.target.value })}
              placeholder="Ex: Durante a Operação Y"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Motivo (Porque?)</Label>
            <Textarea 
              value={formData.motivo || ""} 
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Descreva a necessidade técnica da aquisição..."
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Justificativa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPermanenteJustificativaDialog;