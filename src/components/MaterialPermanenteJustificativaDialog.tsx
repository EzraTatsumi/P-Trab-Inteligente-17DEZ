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
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Justificativa da Aquisição
          </DialogTitle>
          <DialogDescription>
            Detalhamento técnico para o item: <span className="font-semibold text-foreground">{itemName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto pr-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Grupo do Item (Ex: Mobiliário, Informática, etc)</Label>
                <Input 
                  value={formData.grupo || ""} 
                  onChange={(e) => setFormData({ ...formData, grupo: e.target.value })}
                  placeholder="Informe o grupo do material"
                  className="h-10"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">Propósito (Obj imediato?)</Label>
                  <Input 
                    value={formData.proposito || ""} 
                    onChange={(e) => setFormData({ ...formData, proposito: e.target.value })}
                    placeholder="Ex: Atender demanda X"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">Destinação (Para quem?) Seç/OM</Label>
                  <Input 
                    value={formData.destinacao || ""} 
                    onChange={(e) => setFormData({ ...formData, destinacao: e.target.value })}
                    placeholder="Ex: 1ª Seção / OM"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">Local (Onde será empregado?)</Label>
                  <Input 
                    value={formData.local || ""} 
                    onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                    placeholder="Ex: Campo de Instrução"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold whitespace-nowrap">Finalidade (Para quê?) Obj Geral</Label>
                  <Input 
                    value={formData.finalidade || ""} 
                    onChange={(e) => setFormData({ ...formData, finalidade: e.target.value })}
                    placeholder="Ex: Apoio logístico"
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Motivo (Porque?)</Label>
                <Textarea 
                  value={formData.motivo || ""} 
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  placeholder="Descreva a necessidade técnica da aquisição..."
                  className="min-h-[150px] resize-none"
                />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="bg-muted/40 p-6 rounded-xl border border-dashed h-full flex flex-col sticky top-0">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase mb-6 tracking-wider">
                  <Eye className="h-4 w-4" />
                  Pré-visualização da Justificativa
                </div>
                <div className="flex-grow">
                  <p className="text-lg leading-relaxed italic text-foreground/90 font-serif">
                    {generatedText}
                  </p>
                </div>
                <div className="mt-6 pt-6 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Dica:</p>
                  <p className="text-[11px] text-muted-foreground">O texto acima é gerado automaticamente com base nos campos preenchidos ao lado.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <Button onClick={handleSave} className="gap-2 px-8">
            <Save className="h-4 w-4" />
            Salvar Justificativa
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6">Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPermanenteJustificativaDialog;