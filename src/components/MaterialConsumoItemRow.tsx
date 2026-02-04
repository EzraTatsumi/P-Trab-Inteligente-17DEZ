import { Tables } from "@/integrations/supabase/types";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatUtils";
import { DiretrizMaterialConsumoItem } from "@/types/diretrizesMaterialConsumo";

interface MaterialConsumoItemRowProps {
  item: DiretrizMaterialConsumoItem;
  onEdit: (item: DiretrizMaterialConsumoItem) => void;
  onDelete: (id: string, descricao: string) => Promise<void>;
  loading: boolean;
}

const MaterialConsumoItemRow: React.FC<MaterialConsumoItemRowProps> = ({ item, onEdit, onDelete, loading }) => {
  
  const handleDelete = () => {
    if (item.id) {
      onDelete(item.id, item.descricao_item);
    }
  };
  
  return (
    <TableRow key={item.id}>
      <TableCell className="font-medium">{item.descricao_item}</TableCell>
      <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(item.preco_unitario))}</TableCell>
      <TableCell className="text-center">{item.numero_pregao || '-'}</TableCell>
      <TableCell className="text-center">{item.uasg_referencia || '-'}</TableCell>
      <TableCell className="w-[100px] text-center">
        <div className="flex justify-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onEdit(item)}
            disabled={loading}
            className="h-8 w-8"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDelete}
            disabled={loading}
            className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default MaterialConsumoItemRow;
