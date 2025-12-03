import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Printer, Pencil, Copy, Archive, RefreshCw, Trash2, MoreVertical } from "lucide-react";
import { PTrab } from "@/hooks/usePTrabManager";

interface PTrabActionsMenuProps {
  ptrab: PTrab;
  isEditable: boolean;
  isFinalStatus: boolean;
  onEdit: (ptrab: PTrab) => void;
  onClone: (ptrab: PTrab) => void;
  onArchive: (id: string, name: string) => void;
  onReactivate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onNavigateToPrint: (id: string) => void;
}

export const PTrabActionsMenu: React.FC<PTrabActionsMenuProps> = ({
  ptrab,
  isEditable,
  isFinalStatus,
  onEdit,
  onClone,
  onArchive,
  onReactivate,
  onDelete,
  onNavigateToPrint,
}) => {
  const ptrabName = `${ptrab.numero_ptrab} - ${ptrab.nome_operacao}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => onNavigateToPrint(ptrab.id)}>
          <Printer className="mr-2 h-4 w-4" />
          Visualizar Impressão
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => isEditable && onEdit(ptrab)}
          disabled={!isEditable}
          className={!isEditable ? "opacity-50 cursor-not-allowed" : ""}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Editar P Trab
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => ptrab.status !== 'arquivado' && onClone(ptrab)}
          disabled={ptrab.status === 'arquivado'}
          className={ptrab.status === 'arquivado' ? "opacity-50 cursor-not-allowed" : ""}
        >
          <Copy className="mr-2 h-4 w-4" />
          Clonar P Trab
        </DropdownMenuItem>
        
        {ptrab.status !== 'arquivado' && (
          <DropdownMenuItem 
            onClick={() => onArchive(ptrab.id, ptrabName)}
          >
            <Archive className="mr-2 h-4 w-4" />
            Arquivar
          </DropdownMenuItem>
        )}
        
        {ptrab.status === 'arquivado' && (
            <DropdownMenuItem 
                onClick={() => onReactivate(ptrab.id, ptrabName)}
            >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reativar
            </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => onDelete(ptrab.id)}
          className="text-red-600"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};