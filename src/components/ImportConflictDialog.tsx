import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImportConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabNumber: string;
  onOverwrite: () => void;
  // MUDANÇA: onStartCreateNew agora apenas inicia o fluxo de criação de minuta
  onStartCreateNew: () => void; 
}

export const ImportConflictDialog: React.FC<ImportConflictDialogProps> = ({
  open,
  onOpenChange,
  ptrabNumber,
  onOverwrite,
  onStartCreateNew,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Conflito de Numeração Oficial
          </AlertDialogTitle>
          <AlertDialogDescription>
            O P Trab que você está tentando importar possui o número oficial <span className="font-bold text-foreground">{ptrabNumber}</span>, que já existe na sua lista.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
                Escolha como proceder:
            </p>
            <div className="grid grid-cols-2 gap-4">
                <Button 
                    variant="destructive" 
                    onClick={onOverwrite}
                    className="h-auto py-4 flex flex-col items-center text-center"
                >
                    <RefreshCw className="h-5 w-5 mb-1" />
                    <span className="font-bold">Sobrescrever (Atualizar)</span>
                    <span className="text-xs font-normal opacity-80">Substitui o P Trab<br />existente.</span>
                </Button>
                <Button 
                    variant="secondary" 
                    onClick={onStartCreateNew}
                    className="h-auto py-4 flex flex-col items-center text-center"
                >
                    <Copy className="h-5 w-5 mb-1" />
                    <span className="font-bold">Criar Nova Minuta</span>
                    <span className="text-xs font-normal opacity-80">Importa como um novo<br />P Trab (Minuta).</span>
                </Button>
            </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar Importação</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};