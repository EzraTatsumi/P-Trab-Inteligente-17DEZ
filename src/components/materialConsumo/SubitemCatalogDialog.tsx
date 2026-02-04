import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GlobalSubitemCatalog } from '@/types/materialConsumo'; // Importa o novo tipo
import { Package, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubitemCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subitems: GlobalSubitemCatalog[]; // Usa o tipo GlobalSubitemCatalog
  onSelectSubitem: (subitem: GlobalSubitemCatalog) => void;
}

const SubitemCatalogDialog: React.FC<SubitemCatalogDialogProps> = ({ open, onOpenChange, subitems, onSelectSubitem }) => {
  
  const handleSelect = (subitem: GlobalSubitemCatalog) => {
    onSelectSubitem(subitem);
    onOpenChange(false); // Fecha o catálogo após a seleção
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Catálogo Global de Subitens
          </DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {subitems.length === 0 ? (
            <p className="text-center text-muted-foreground p-4">Nenhum subitem cadastrado no catálogo global.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Nr Subitem</TableHead>
                  <TableHead>Nome Subitem</TableHead>
                  <TableHead>Descrição do Subitem</TableHead>
                  <TableHead className="w-[80px] text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subitems.map((subitem) => (
                  <TableRow key={subitem.id}>
                    {/* CORREÇÃO: Usando os novos nomes de campo */}
                    <TableCell className="font-mono text-xs">{subitem.nr_subitem || '-'}</TableCell>
                    <TableCell className="font-medium">{subitem.nome_subitem}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{subitem.descricao_subitem || 'Nenhuma descrição fornecida.'}</TableCell>
                    <TableCell className="text-center">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSelect(subitem)}
                        >
                            <Check className="h-4 w-4 mr-1" /> Selecionar
                        </Button>
                    </TableCell>
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