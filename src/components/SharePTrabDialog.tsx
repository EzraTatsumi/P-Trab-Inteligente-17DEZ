import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PTrab } from '@/types/ptrab';

interface SharePTrabDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ptrab?: PTrab;
}

const SharePTrabDialog: React.FC<SharePTrabDialogProps> = ({ open, onOpenChange, ptrab }) => {
  if (!ptrab) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Compartilhar P Trab: {ptrab.numero_ptrab || 'Sem Número'}</DialogTitle>
          <DialogDescription>
            Aqui você poderá adicionar colaboradores por e-mail e gerar o link de compartilhamento.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Funcionalidade de compartilhamento em desenvolvimento.
          </p>
          <p className="mt-2 font-mono text-xs break-all">
            Token de Compartilhamento: {ptrab.share_token || 'N/A'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePTrabDialog;