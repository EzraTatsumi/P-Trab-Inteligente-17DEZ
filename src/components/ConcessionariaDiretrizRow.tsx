import React from 'react';
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { DiretrizConcessionaria } from "@/types/diretrizesConcessionaria";
import { formatCurrency } from "@/lib/formatUtils";

interface ConcessionariaDiretrizRowProps {
    diretriz: DiretrizConcessionaria;
    onEdit: (diretriz: DiretrizConcessionaria) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading: boolean;
}

const ConcessionariaDiretrizRow: React.FC<ConcessionariaDiretrizRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading,
}) => {
    const { id, nome_concessionaria, consumo_pessoa_dia, custo_unitario, unidade_custo } = diretriz;

    return (
        <TableRow>
            <TableCell className="font-medium">{nome_concessionaria}</TableCell>
            <TableCell className="text-center">
                {consumo_pessoa_dia} {unidade_custo}/pessoa/dia
            </TableCell>
            <TableCell className="text-right">
                {formatCurrency(custo_unitario)} / {unidade_custo}
            </TableCell>
            <TableCell className="w-[100px] text-center">
                <div className="flex justify-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(diretriz)}
                        disabled={loading}
                        className="h-8 w-8"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(id, nome_concessionaria)}
                        disabled={loading}
                        className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-600"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
};

export default ConcessionariaDiretrizRow;