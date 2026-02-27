import React, { useState, useRef, useEffect } from 'react';
import { TableCell, TableRow, Table } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { DiretrizMaterialConsumo, ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import ItemAquisicaoDraggableRow from "./ItemAquisicaoDraggableRow";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';

interface MaterialConsumoDiretrizRowProps {
    diretriz: DiretrizMaterialConsumo;
    onEdit: (diretriz: DiretrizMaterialConsumo) => void;
    onDelete: (id: string, nome: string) => Promise<void>;
    loading: boolean;
    // NOVO: Função de movimentação injetada pelo hook
    onMoveItem: (item: ItemAquisicao, sourceDiretrizId: string, targetDiretrizId: string) => void;
    // NOVO: ID para rolagem
    id: string;
    // NOVO: Propriedade para forçar a abertura (usada pela busca)
    forceOpen: boolean;
}

const MaterialConsumoDiretrizRow: React.FC<MaterialConsumoDiretrizRowProps> = ({
    diretriz,
    onEdit,
    onDelete,
    loading,
    onMoveItem, // NOVO
    id, // NOVO
    forceOpen, // NOVO
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    
    // Ref para o temporizador de expansão automática
    const expandTimerRef = useRef<number | null>(null); 
    
    // Efeito para forçar a abertura quando a prop forceOpen muda para true
    useEffect(() => {
        if (forceOpen && !isOpen) {
            setIsOpen(true);
        }
    }, [forceOpen]);
    
    const itensAquisicao = diretriz.itens_aquisicao || [];
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // Necessário para permitir o drop
        e.dataTransfer.dropEffect = "move";
        setIsDragOver(true);
        
        // Se estiver arrastando sobre o alvo de drop (o div interno), cancela o temporizador de expansão
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }
    };
    
    const handleDragLeave = () => {
        setIsDragOver(false);
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;
        
        try {
            const { item, sourceDiretrizId } = JSON.parse(data) as { item: ItemAquisicao, sourceDiretrizId: string };
            
            // Previne o drop na mesma diretriz
            if (sourceDiretrizId === diretriz.id) {
                return;
            }
            
            // Garante que o alvo permaneça aberto após o drop
            setIsOpen(true); 
            
            // Chama a função de movimentação centralizada
            onMoveItem(item, sourceDiretrizId, diretriz.id);
            
        } catch (error) {
            console.error("Erro ao processar dados de drop:", error);
        }
    };
    
    // Handler para Drag Enter na linha principal (trigger)
    const handleDragEnterTrigger = (e: React.DragEvent<HTMLTableRowElement>) => {
        // Verifica se o item arrastado é um item de aquisição (heurística)
        const data = e.dataTransfer.types.includes("application/json");
        if (!data) return;
        
        // Se já estiver aberto, não faz nada
        if (isOpen) return;
        
        // Se já houver um timer, não cria outro
        if (expandTimerRef.current) return;
        
        // Inicia o temporizador para abrir após 300ms
        expandTimerRef.current = setTimeout(() => {
            setIsOpen(true);
            expandTimerRef.current = null;
        }, 300) as unknown as number; // Casting para number para compatibilidade com window.setTimeout
    };
    
    // Handler para Drag Leave na linha principal (trigger)
    const handleDragLeaveTrigger = (e: React.DragEvent<HTMLTableRowElement>) => {
        // Cancela o temporizador se o mouse sair da área do trigger
        if (expandTimerRef.current) {
            clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }
    };

    return (
        <React.Fragment>
            {/* A linha principal (TableRow) agora é o elemento que contém o CollapsibleTrigger */}
            <TableRow 
                id={diretriz.id === 'ghost-subitem-24' ? 'diretriz-material-consumo-ghost-subitem-24' : id}
                className={cn(
                    "hover:bg-muted/50 transition-colors cursor-pointer",
                    isOpen && "bg-muted/50"
                )}
                onClick={() => setIsOpen(!isOpen)}
                // Adiciona os handlers de Drag Enter/Leave para o trigger
                onDragEnter={handleDragEnterTrigger}
                onDragLeave={handleDragLeaveTrigger}
            >
                {/* Coluna Nr Subitem */}
                <TableCell className="font-semibold w-[150px] text-center">
                    <div className="flex items-center justify-center gap-2">
                        {diretriz.nr_subitem}
                        {isOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                </TableCell>
                
                {/* Coluna Nome do Subitem */}
                <TableCell className="font-medium">
                    {diretriz.nome_subitem}
                    {!diretriz.ativo && <Badge variant="destructive" className="ml-2">Inativo</Badge>}
                </TableCell>
                
                {/* Coluna Ações */}
                <TableCell className="text-right w-[100px]" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(diretriz)}
                            disabled={loading}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(diretriz.id, diretriz.nome_subitem)}
                            disabled={loading}
                            className="text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            
            {/* Linha de Conteúdo Colapsável */}
            <TableRow className="p-0">
                <TableCell colSpan={3} className="p-0">
                    <Collapsible open={isOpen}>
                        <CollapsibleContent>
                            <div
                                className={cn(
                                    "p-4 bg-muted/50 border-t border-border transition-colors",
                                    isDragOver && "bg-primary/10 border-primary ring-2 ring-2 ring-primary/50"
                                )}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            >
                                
                                {itensAquisicao.length > 0 ? (
                                    <Table className="bg-background border rounded-md overflow-hidden">
                                        <thead>
                                            <TableRow className="text-xs text-muted-foreground hover:bg-background">
                                                <th className="px-4 py-2 text-left font-normal w-[20px]"></th> {/* Coluna para o ícone de arrastar */}
                                                <th className="px-4 py-2 text-left font-normal w-[35%]">Descrição Reduzida</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Cód. CATMAT</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">Pregão</th>
                                                <th className="px-4 py-2 text-center font-normal w-[10%]">UASG</th>
                                                <th className="px-4 py-2 text-center font-normal w-[15%]">Valor Unitário</th>
                                            </TableRow>
                                        </thead>
                                        <tbody>
                                            {itensAquisicao.map((item) => (
                                                <ItemAquisicaoDraggableRow
                                                    key={item.id}
                                                    item={item}
                                                    diretrizId={diretriz.id}
                                                />
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

export default MaterialConsumoDiretrizRow;