import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, ChevronDown, ChevronUp, Plane, Bus, Ship } from "lucide-react";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format } from 'date-fns';
import { Tables } from "@/integrations/supabase/types"; // Importando Tables

// Usando o tipo de Row do Supabase para garantir que as propriedades de data existam
type DiretrizPassagemRow = Tables<'diretrizes_passagens'>;

interface PassagemDiretrizRowProps {
    diretriz: DiretrizPassagem; // Usando o tipo corrigido
    onEdit: (diretriz: DiretrizPassagem) => void;
    onDelete: (id: string, omName: string) => void;
    loading: boolean;
}

const getTransportIcon = (tipo: TipoTransporte) => {
    switch (tipo) {
        case 'AEREO': return <Plane className="h-4 w-4 text-blue-600" />;
        case 'TERRESTRE': return <Bus className="h-4 w-4 text-green-600" />;
        case 'FLUVIAL': return <Ship className="h-4 w-4 text-cyan-600" />;
        default: return null;
    }
};

const PassagemDiretrizRow: React.FC<PassagemDiretrizRowProps> = ({ diretriz, onEdit, onDelete, loading }) => {
    const [isOpen, setIsOpen] = useState(false);
    // CORREÇÃO: O campo trechos é TrechoPassagem[] no tipo DiretrizPassagem
    const trechos = diretriz.trechos;
    const hasTrechos = trechos.length > 0;
    
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try {
            // O campo de data do Supabase é string (ISO 8601)
            return format(new Date(dateString), 'dd/MM/yyyy');
        } catch {
            return 'Inválida';
        }
    };

    return (
        <React.Fragment>
            <TableRow className={cn(
                "hover:bg-muted/50 transition-colors",
                isOpen && "bg-muted/50 border-b-0"
            )}>
                {/* OM Referência (2 linhas) */}
                <TableCell className="font-medium">
                    <div className="flex flex-col">
                        <span>{diretriz.om_referencia}</span>
                        <span className="text-xs text-muted-foreground">({formatCodug(diretriz.ug_referencia)})</span>
                    </div>
                </TableCell>
                
                {/* Pregão */}
                <TableCell>{diretriz.numero_pregao || 'N/A'}</TableCell>
                
                {/* Vigência (2 linhas) */}
                <TableCell className="text-center text-xs">
                    <div className="flex flex-col">
                        <span className="font-medium text-foreground">Início: {formatDate(diretriz.data_inicio_vigencia)}</span>
                        <span className="text-muted-foreground">Fim: {formatDate(diretriz.data_fim_vigencia)}</span>
                    </div>
                </TableCell>
                
                {/* Trechos (com botão de colapsar próximo) */}
                <TableCell className="text-center flex items-center justify-center h-[60px]">
                    <span className="mr-1">{trechos.length}</span>
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
                </TableCell>
                
                {/* Ações (Centralizado) */}
                <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
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
                    <TableCell colSpan={5} className="p-0 border-t-0">
                        <Collapsible open={isOpen}>
                            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                                <div className="p-4 bg-muted/50 border-t border-border">
                                    <h5 className="text-sm font-semibold mb-2">Trechos Cadastrados ({trechos.length})</h5>
                                    <div className="space-y-2">
                                        {trechos.map((trecho, index) => (
                                            <div key={trecho.id} className="flex items-center justify-between text-sm p-2 bg-background rounded-md shadow-sm border">
                                                <div className="flex items-center gap-3 font-medium">
                                                    {getTransportIcon(trecho.tipo_transporte)}
                                                    <span>{trecho.origem} &rarr; {trecho.destino}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-right">
                                                    <span className="text-xs text-muted-foreground">
                                                        {trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'} ({trecho.quantidade_passagens}x)
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