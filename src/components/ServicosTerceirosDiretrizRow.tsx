import React, { useState, useRef, useEffect } from 'react';
import { TableCell, TableRow, Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { DiretrizServicosTerceiros, ItemAquisicaoServico } from "@/types/diretrizesServicosTerceiros";
import ItemAquisicaoServicoDraggableRow from "./ItemAquisicaoServicoDraggableRow";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface ServicosTerceirosDiretrizRowProps {
    diretriz: DiretrizServicosTerceiros;
    onEdit: (diretriz: DiretrizServicosTerceiros) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading: boolean;
    onMoveItem: (item: ItemAquisicaoServico, sourceDiretrizId: string, targetDiretrizId: string) => void;
    id: string;
    forceOpen: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

const ServicosTerceirosDiretrizRow: React.FC<ServicosTerceirosDiretrizRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading,
    onMoveItem,
    id,
    forceOpen,
    isExpanded,
    onToggleExpand,
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    const isOpen = isExpanded !== undefined ? isExpanded : internalIsOpen;
    const toggleOpen = onToggleExpand || (() => setInternalIsOpen(!internalIsOpen));
    
    const expandTimerRef = useRef<number | null>(null); 
    
    useEffect(() => {
        if (forceOpen && !isOpen) {
            toggleOpen();
        }
    }, [forceOpen]);
    
    const itensAquisicao = diretriz.itens_aquisicao || [];
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }
    };
    
    const handleDragLeave = () => setIsDragOver(false);
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;
        try {
            const { item, sourceDiretrizId } = JSON.parse(data) as { item: ItemAquisicaoServico, sourceDiretrizId: string };
            if (sourceDiretrizId === diretriz.id) return;
            if (!isOpen) toggleOpen(); 
            onMoveItem(item, sourceDiretrizId, diretriz.id);
        } catch (error) {
            console.error("Erro ao processar dados de drop:", error);
        }
    };
    
    const handleDragEnterTrigger = (e: React.DragEvent<HTMLTableRowElement>) => {
        if (!e.dataTransfer.types.includes("application/json") || isOpen || expandTimerRef.current) return;
        expandTimerRef.current = setTimeout(() => {
            if (!isOpen) toggleOpen();
            expandTimerRef.current = null;
        }, 300) as unknown as number;
    };
    
    const handleDragLeaveTrigger = () => {
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }
    };

    return (
        <React.Fragment>
            <TableRow 
                id={id}
                className={cn("hover:bg-muted/50 transition-colors cursor-pointer", isOpen && "bg-muted/50")}
                onClick={toggleOpen}
                onDragEnter={handleDragEnterTrigger}
                onDragLeave={handleDragLeaveTrigger}
            >
                <TableCell className="font-semibold w-[150px] text-center">
                    <div className="flex items-center justify-center gap-2">
                        {diretriz.nr_subitem}
                        {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                </TableCell>
                <TableCell className="font-medium">
                    {diretriz.nome_subitem}
                    {!diretriz.ativo && <Badge variant="destructive" className="ml-2">Inativo</Badge>}
                </TableCell>
                <TableCell className="text-right w-[100px]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(diretriz)} disabled={loading}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(diretriz.id, diretriz.nome_subitem)} disabled={loading} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            <TableRow className="p-0">
                <TableCell colSpan={3} className="p-0">
                    <Collapsible open={isOpen}>
                        <CollapsibleContent>
                            <div
                                className={cn("p-4 bg-muted/50 border-t border-border transition-colors", isDragOver && "bg-primary/10 border-primary ring-2 ring-primary/50")}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                {itensAquisicao.length > 0 ? (
                                    <Table className="bg-background border rounded-md overflow-hidden">
                                        <thead>
                                            <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                <th className="px-4 py-2 text-left font-normal w-[20px]"></th>
                                                <th className="px-4 py-2 text-left font-normal w-[30%]">Descrição Reduzida</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Cód. CATSER</th>
                                                <th className="px-4 py-2 text-center font-normal w-[8%]">Unid.</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Pregão</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">UASG</th>
                                                <th className="px-4 py-2 text-center font-normal w-[15%]">Valor Unitário</th>
                                            </TableRow>
                                        </thead>
                                        <tbody>
                                            {itensAquisicao.map((item) => (
                                                <ItemAquisicaoServicoDraggableRow key={item.id} item={item} diretrizId={diretriz.id} />
                                            ))}
                                        </tbody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        {isDragOver ? "Solte o item aqui para movê-lo para este subitem." : "Nenhum item de aquisição detalhado para este subitem."}
                                    </p>
                                )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

export default ServicosTerceirosDiretrizRow;