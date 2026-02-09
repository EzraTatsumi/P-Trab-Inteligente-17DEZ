import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Pencil, Trash2, Package, FileText } from "lucide-react";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ConsolidatedMaterialConsumoRecord } from "@/lib/materialConsumoUtils";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Tipo local para o grupo consolidado (para evitar dependência circular)
interface ConsolidatedMaterialConsumo extends ConsolidatedMaterialConsumoRecord {
    groupKey: string; 
}

interface AcquisitionGroupRowProps {
    group: ConsolidatedMaterialConsumo;
    isPTrabEditable: boolean;
    onEdit: (group: ConsolidatedMaterialConsumo) => void;
    onDelete: (group: ConsolidatedMaterialConsumo) => void;
    isSaving: boolean;
    forceOpen?: boolean; // Propriedade para forçar a abertura (usada na busca)
}

const AcquisitionGroupRow: React.FC<AcquisitionGroupRowProps> = ({
    group,
    isPTrabEditable,
    onEdit,
    onDelete,
    isSaving,
    forceOpen = false,
}) => {
    const [isOpen, setIsOpen] = React.useState(forceOpen);
    
    // Efeito para forçar a abertura quando a prop forceOpen muda
    React.useEffect(() => {
        if (forceOpen) {
            setIsOpen(true);
        }
    }, [forceOpen]);

    const totalGroups = group.records.length;
    const groupText = totalGroups === 1 ? 'Grupo' : 'Grupos';
    const omName = group.organizacao;
    const ug = group.ug;
    const faseAtividade = group.fase_atividade || 'Não Definida';
    
    // Em MaterialConsumo, cada registro é um grupo de aquisição.
    // Usamos o primeiro registro para obter os detalhes do grupo.
    const firstRecord = group.records[0];
    const acquisitionGroup = firstRecord.itens_aquisicao as unknown as ItemAquisicao[];
    const groupName = firstRecord.group_name;
    const groupPurpose = firstRecord.group_purpose;

    return (
        <Card className="border-l-4 border-primary/70 shadow-sm">
            <Collapsible 
                open={isOpen} 
                onOpenChange={setIsOpen}
            >
                <CollapsibleTrigger asChild>
                    <div className="flex justify-between items-center p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-primary shrink-0" />
                            <div className="flex flex-col items-start">
                                <span className="font-semibold text-base text-foreground">
                                    {groupName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {groupPurpose || 'Sem finalidade detalhada'}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                            <span className="font-extrabold text-lg text-primary">
                                {formatCurrency(group.totalGeral)}
                            </span>
                            {isOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                        </div>
                    </div>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="border-t p-4 bg-background">
                    <div className="space-y-4">
                        
                        {/* Detalhes do Lote (Contexto) */}
                        <div className="grid grid-cols-2 gap-2 text-xs border-b pb-2">
                            <span className="text-muted-foreground">OM Favorecida:</span>
                            <span className="text-right font-medium">{omName} ({formatCodug(ug)})</span>
                            
                            <span className="text-muted-foreground">Fase da Atividade:</span>
                            <span className="text-right font-medium">{faseAtividade}</span>
                            
                            <span className="text-muted-foreground">ND 33.90.30 / ND 33.90.39:</span>
                            <span className="text-right font-medium text-green-600">
                                {formatCurrency(group.totalND30)} / {formatCurrency(group.totalND39)}
                            </span>
                        </div>

                        {/* Tabela de Itens de Aquisição */}
                        <h4 className="font-semibold text-sm mb-2">Itens de Aquisição ({acquisitionGroup.length})</h4>
                        <Table className="border">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">CATMAT</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead className="text-center w-[80px]">Qtd</TableHead>
                                    <TableHead className="text-right w-[120px]">Valor Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {acquisitionGroup.map((item, index) => (
                                    <TableRow key={item.id || index}>
                                        <TableCell className="text-xs font-mono">{item.codigo_catmat}</TableCell>
                                        <TableCell className="text-xs">
                                            {item.descricao_item}
                                            <p className="text-muted-foreground text-[10px] mt-0.5">
                                                {item.numero_pregao} | {item.uasg} | ND {item.nd}
                                            </p>
                                        </TableCell>
                                        <TableCell className="text-center text-xs">{item.quantidade}</TableCell>
                                        <TableCell className="text-right text-xs font-medium">{formatCurrency(item.valor_total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        
                        {/* Ações */}
                        <div className="flex justify-end gap-2 pt-3 border-t mt-3">
                            <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={() => onEdit(group)}
                                disabled={!isPTrabEditable || isSaving}
                            >
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar Lote
                            </Button>
                            <Button 
                                type="button" 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => onDelete(group)}
                                disabled={!isPTrabEditable || isSaving}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Lote
                            </Button>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

export default AcquisitionGroupRow;