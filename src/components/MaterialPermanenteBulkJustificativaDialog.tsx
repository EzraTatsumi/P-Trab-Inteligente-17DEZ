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
import { Table as TableIcon, Save, X } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";

interface MaterialPermanenteBulkJustificativaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemAquisicao[];
  onSave: (updatedItems: ItemAquisicao[]) => void;
}

const MaterialPermanenteBulkJustificativaDialog = ({
  open,
  onOpenChange,
  items,
  onSave
}: MaterialPermanenteBulkJustificativaDialogProps) => {
  const [localItems, setLocalItems] = React.useState<ItemAquisicao[]>([]);

  React.useEffect(() => {
    if (open) {
      setLocalItems(JSON.parse(JSON.stringify(items)));
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
          <DialogDescription>
            Edite as justificativas de todos os itens simultaneamente. Você pode copiar e colar dados diretamente nas células.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-auto border rounded-md my-4">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="min-w-[200px] bg-muted/50">Item</TableHead>
                <TableHead className="min-w-[150px]">Grupo</TableHead>
                <TableHead className="min-w-[150px]">Propósito</TableHead>
                <TableHead className="min-w-[150px]">Destinação</TableHead>
                <TableHead className="min-w-[150px]">Local</TableHead>
                <TableHead className="min-w-[150px]">Finalidade</TableHead>
                <TableHead className="min-w-[250px]">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-xs bg-muted/20">
                    {item.descricao_reduzida || item.descricao_item}
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.grupo || ""}
                      onChange={(e) => handleInputChange(item.id, 'grupo', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.proposito || ""}
                      onChange={(e) => handleInputChange(item.id, 'proposito', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.destinacao || ""}
                      onChange={(e) => handleInputChange(item.id, 'destinacao', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.local || ""}
                      onChange={(e) => handleInputChange(item.id, 'local', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.finalidade || ""}
                      onChange={(e) => handleInputChange(item.id, 'finalidade', e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input 
                      className="h-8 text-xs border-transparent focus:border-primary rounded-none"
                      value={item.justificativa?.motivo || ""}
                      onChange={(e) => handleInputChange(item.id, 'motivo', e.target.value)}
                    />
                  </TableCell>
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