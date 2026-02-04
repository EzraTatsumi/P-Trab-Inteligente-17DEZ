import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaterialConsumoSubitem } from '@/types/materialConsumo';
import { Package } from 'lucide-react';

interface SubitemCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subitems: MaterialConsumoSubitem[];
}

const SubitemCatalogDialog: React.FC<SubitemCatalogDialogProps> = ({ open, onOpenChange, subitems }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo de Subitens de Material de Consumo
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {subitems.length === 0 ? (
            <p className="text-center text-muted-foreground p-4">Nenhum subitem cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Nr Subitem</TableHead>
                  <TableHead>Nome Subitem</TableHead>
                  <TableHead>Descrição do Subitem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subitems.map((subitem) => (
                  <TableRow key={subitem.id}>
                    <TableCell className="font-mono text-xs">{subitem.nr_subitem || '-'}</TableCell>
                    <TableCell className="font-medium">{subitem.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{subitem.descricao || 'Nenhuma descrição fornecida.'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubitemCatalogDialog;