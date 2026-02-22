"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Package, ChevronRight } from "lucide-react";
import { MaterialConsumoGroup } from "@/types/materialConsumo";
import { formatCurrency } from "@/lib/formatUtils";

interface MaterialConsumoGroupCardProps {
  group: MaterialConsumoGroup;
  onEdit: () => void;
  onRemove: () => void;
}

const MaterialConsumoGroupCard: React.FC<MaterialConsumoGroupCardProps> = ({ group, onEdit, onRemove }) => {
  const itemCount = group.itens?.length || 0;

  return (
    <Card className="hover:border-primary/50 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold text-sm truncate">{group.nome_grupo}</h4>
              <p className="text-xs text-muted-foreground">
                {itemCount} {itemCount === 1 ? 'item' : 'itens'} cadastrados
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total do Grupo</p>
            <p className="font-bold text-sm text-primary">{formatCurrency(group.valor_total)}</p>
          </div>

          <div className="flex items-center gap-1 border-l pl-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaterialConsumoGroupCard;