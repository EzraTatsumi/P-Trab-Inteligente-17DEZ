import { useState, useEffect } from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { DiretrizServicoTerceiro } from "@/types/diretrizesServicosTerceiros";
import { formatCurrency } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface ServicosTerceirosDiretrizRowProps {
  diretriz: DiretrizServicoTerceiro;
  onEdit: (diretriz: DiretrizServicoTerceiro) => void;
  onDelete: (id: string) => void;
  onToggleAtivo: (id: string, currentStatus: boolean) => void;
  id?: string;
  forceOpen?: boolean;
}

export function ServicosTerceirosDiretrizRow({
  diretriz,
  onEdit,
  onDelete,
  onToggleAtivo,
  id,
  forceOpen
}: ServicosTerceirosDiretrizRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sincroniza a expansão se vier do buscador
  useEffect(() => {
    if (forceOpen) {
      setIsExpanded(true);
    }
  }, [forceOpen]);

  return (
    <>
      <TableRow id={id} className={cn(
          !diretriz.ativo && "opacity-60 bg-muted/30",
          forceOpen && "bg-primary/5 ring-1 ring-primary/20"
      )}>
        <TableCell>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-bold">{diretriz.nr_subitem}</TableCell>
        <TableCell className="font-medium">{diretriz.nome_subitem}</TableCell>
        <TableCell>
          <Badge variant="secondary">
            {diretriz.itens_aquisicao?.length || 0} itens
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant={diretriz.ativo ? "ptrab-aprovado" : "outline"}>
            {diretriz.ativo ? "Ativo" : "Inativo"}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => onToggleAtivo(diretriz.id, diretriz.ativo)}
              title={diretriz.ativo ? "Desativar" : "Ativar"}
            >
              {diretriz.ativo ? <PowerOff className="h-4 w-4 text-orange-500" /> : <Power className="h-4 w-4 text-green-500" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={() => onEdit(diretriz)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive" 
              onClick={() => {
                if (confirm("Tem certeza que deseja excluir esta diretriz e todos os seus itens?")) {
                  onDelete(diretriz.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/20">
          <TableCell colSpan={6} className="p-0">
            <div className="p-4 space-y-3">
              {diretriz.descricao_subitem && (
                <p className="text-xs text-muted-foreground italic mb-2">
                  Obs: {diretriz.descricao_subitem}
                </p>
              )}
              
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-2 font-semibold">Cód. CATSER</th>
                      <th className="text-left p-2 font-semibold">Nome Reduzido</th>
                      <th className="text-left p-2 font-semibold">Unidade</th>
                      <th className="text-left p-2 font-semibold">Valor Unitário</th>
                      <th className="text-left p-2 font-semibold">Pregão/ARP</th>
                      <th className="text-left p-2 font-semibold">UASG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diretriz.itens_aquisicao.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2">{item.codigo_catser || "-"}</td>
                        <td className="p-2 font-medium">{item.nome_reduzido}</td>
                        <td className="p-2">{item.unidade_medida}</td>
                        <td className="p-2 text-blue-600 font-semibold">{formatCurrency(item.valor_unitario)}</td>
                        <td className="p-2">{item.numero_pregao || "-"}</td>
                        <td className="p-2">{item.uasg || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}