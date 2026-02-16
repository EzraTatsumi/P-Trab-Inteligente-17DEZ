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
import { FileText, Save, Eye } from "lucide-react";

interface JustificativaData {
  grupo?: string;
  proposito?: string;
  destinacao?: string;
  local?: string;
  finalidade?: string;
  motivo?: string;
}

interface MaterialPermanenteJustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  data: JustificativaData;
  diasOperacao: number;
  faseAtividade: string;
  onSave: (data: JustificativaData) => void;
}

const MaterialPermanenteJustificativaDialog = ({
  open,
  onOpenChange,
  itemName,
  data,
  diasOperacao,
  faseAtividade,
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

  const generatedText = React.useMemo(() => {
    const { grupo, proposito, destinacao, local, finalidade, motivo } = formData;
    const diasStr = `${diasOperacao} ${diasOperacao === 1 ? 'dia' : 'dias'}`;
    
    return `Aquisição de ${grupo || '[Grupo]'} para atender ${proposito || '[Propósito]'} ${destinacao || '[Destinação]'}, ${local || '[Local]'}, a fim de ${finalidade || '[Finalidade]'}, durante ${diasStr} de ${faseAtividade || '[Fase]'}. Justifica-se essa aquisição ${motivo || '[Motivo]'}.`;
  }, [formData, diasOperacao, faseAtividade]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Justificativa da Aquisição
          </DialogTitle>
          <DialogDescription>
            Detalhamento técnico para o item: <span className="font-semibold text-foreground">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Grupo do Item (Ex: Mobiliário, Informática, etc)</Label>
              <Input 
                value={formData.grupo || ""} 
                onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                placeholder="Informe o grupo do material"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-2">
              <Label>Motivo (Porque?)</Label>
              <Textarea 
                value={formData.motivo || ""} 
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Descreva a necessidade técnica da aquisição..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-muted/50 p-6 rounded-lg border border-dashed h-full flex flex-col">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-4">
                <Eye className="h-3 w-3" />
                Pré-visualização da Justificativa
              </div>
              <p className="text-base leading-relaxed italic text-foreground/80 flex-grow">
                {generatedText}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 mt-4">
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Justificativa
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPermanenteJustificativaDialog;