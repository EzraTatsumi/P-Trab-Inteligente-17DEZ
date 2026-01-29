import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, ChevronDown, ChevronUp, Plane, Car, Ship } from "lucide-react";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface PassagemDiretrizRowProps {
    diretriz: DiretrizPassagem;
    onEdit: (diretriz: DiretrizPassagem) => void;
    onDelete: (id: string, omName: string) => void;
    loading: boolean;
}

const getTransportIcon = (tipo: TipoTransporte) => {
    switch (tipo) {
        case 'AÉREO': return <Plane className="h-4 w-4 text-blue-600" />;
        case 'TERRESTRE': return <Car className="h-4 w-4 text-green-600" />;
        case 'FLUVIAL': return <Ship className="h-4 w-4 text-cyan-600" />;
        default: return null;
    }
};

const PassagemDiretrizRow: React.FC<PassagemDiretrizRowProps> = ({ diretriz, onEdit, onDelete, loading }) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasTrechos = diretriz.trechos.length > 0;

    return (
        <React.Fragment>
            <TableRow className={cn(
                "hover:bg-muted/50 transition-colors",
                isOpen && "bg-muted/50 border-b-0"
            )}>
                <TableCell className="font-medium">
                    {diretriz.om_referencia} ({formatCodug(diretriz.ug_referencia)})
                </TableCell>
                <TableCell>{diretriz.numero_pregao || 'N/A'}</TableCell>
                <TableCell className="text-center">
                    {diretriz.trechos.length}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                        {/* Botão de Colapsar/Expandir */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => hasTrechos && setIsOpen(!isOpen)}
                            disabled={!hasTrechos}
                            className={cn("h-8 w-8", !hasTrechos && "opacity-50 cursor-not-allowed")}
                        >
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        
                        {/* Botão de Edição */}
                        <Button variant="ghost" size="icon" onClick={() => onEdit(diretriz)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        
                        {/* Botão de Exclusão */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => onDelete(diretriz.id, diretriz.om_referencia)} 
                            disabled={loading} 
                            className="text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            
            {/* Linha de Detalhes Colapsável */}
            {hasTrechos && (
                <TableRow className={cn(
                    "p-0 border-t-0",
                    !isOpen && "hidden"
                )}>
                    <TableCell colSpan={4} className="p-0 border-t-0">
                        <Collapsible open={isOpen}>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                <div className="p-4 bg-muted/50 border-t border-border">
                                    <h5 className="text-sm font-semibold mb-2">Trechos Cadastrados ({diretriz.trechos.length})</h5>
                                    <div className="space-y-2">
                                        {diretriz.trechos.map((trecho, index) => (
                                            <div key={trecho.id} className="flex items-center justify-between text-sm p-2 bg-background rounded-md shadow-sm border">
                                                <div className="flex items-center gap-3 font-medium">
                                                    {getTransportIcon(trecho.tipo_transporte)}
                                                    <span>{trecho.origem} &rarr; {trecho.destino}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-right">
                                                    <span className="text-xs text-muted-foreground">
                                                        {trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'}
                                                    </span>
                                                    <span className="font-bold text-primary">
                                                        {formatCurrency(trecho.valor)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </TableCell>
                </TableRow>
            )}
        </React.Fragment>
    );
};

export default PassagemDiretrizRow;