import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PTrab } from "@/pages/PTrabManager"; // Importar o tipo PTrab
import { formatDateTime } from "@/pages/PTrabManager"; // Importar a função de formatação de data/hora

// Configuração de status (duplicada aqui para o componente)
const statusConfig = {
    'aberto': { 
      variant: 'default' as const, 
      label: 'Aberto',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
    },
    'em_andamento': { 
      variant: 'secondary' as const, 
      label: 'Em Andamento',
      className: 'bg-blue-100 text-blue-800 hover:bg-blue-200'
    },
    'completo': { 
      variant: 'default' as const, 
      label: 'Aprovado',
      className: 'bg-green-100 text-green-800 hover:bg-green-200'
    },
    'arquivado': { 
      variant: 'outline' as const, 
      label: 'Arquivado',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }
};

interface StatusCellProps {
    ptrab: PTrab;
    isNumbered: boolean;
    handleStatusChange: (ptrabId: string, oldStatus: string, newStatus: string) => void;
}

export const StatusCell = ({ ptrab, isNumbered, handleStatusChange }: StatusCellProps) => {
    const currentStatusConfig = statusConfig[ptrab.status as keyof typeof statusConfig];
    
    if (!isNumbered) {
      // Se não estiver numerado, exibe apenas o Badge
      return (
        <div className="flex flex-col items-center">
          <Badge 
            variant="outline" 
            className={cn("w-[140px] h-7 text-xs justify-center", currentStatusConfig?.className || 'bg-background')}
          >
            {currentStatusConfig?.label || ptrab.status}
          </Badge>
          <div className="text-xs text-muted-foreground mt-1">
            Última alteração: {formatDateTime(ptrab.updated_at)}
          </div>
        </div>
      );
    }

    // Se estiver numerado, permite a alteração de status
    return (
      <div className="flex flex-col items-center">
        <Select
          value={ptrab.status}
          onValueChange={(value) => handleStatusChange(ptrab.id, ptrab.status, value)}
        >
          <SelectTrigger className={cn("w-[140px] h-7 text-xs justify-between", currentStatusConfig?.className || 'bg-background')}>
            <SelectValue>
              {currentStatusConfig?.label || ptrab.status}
            </SelectValue>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </SelectTrigger>
          <SelectContent className="bg-background border shadow-lg z-50">
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem 
                key={key} 
                value={key}
                className="cursor-pointer hover:bg-accent"
              >
                <span className={cn("inline-block px-2 py-1 rounded text-xs", config.className)}>
                  {config.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground mt-1">
          Última alteração: {formatDateTime(ptrab.updated_at)}
        </div>
      </div>
    );
};