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
import { XCircle, Loader2 } from "lucide-react";

interface UnlinkPTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrabName: string;
  onConfirm: () => void;
  loading: boolean;
}

const UnlinkPTrabDialog: React.FC<UnlinkPTrabDialogProps> = ({
  open,
  onOpenChange,
  ptrabName,
  onConfirm,
  loading,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[450px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Desvincular P Trab
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja desvincular o P Trab <span className="font-bold text-foreground">{ptrabName}</span>? Você perderá o acesso de edição.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Desvinculação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default UnlinkPTrabDialog;