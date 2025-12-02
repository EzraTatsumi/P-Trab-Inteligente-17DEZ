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
import { TrendingUp } from "lucide-react";

interface CreditPromptDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CreditPromptDialog: React.FC<CreditPromptDialogProps> = ({
  open,
  onConfirm,
  onCancel,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={() => { /* Prevent closing via backdrop click */ }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-accent">
            <TrendingUp className="h-5 w-5" />
            Informar Crédito Disponível?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Parece que é a primeira vez que você acessa o P Trab ou seus créditos estão zerados.
            Deseja informar os valores orçamentários disponíveis (GND 3 e GND 4) agora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onConfirm}>
            Sim, informar agora
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>
            Não, continuar com R$ 0,00
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};