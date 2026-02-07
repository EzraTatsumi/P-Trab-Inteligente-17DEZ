import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Import, Check, X, AlertTriangle, Save, BookOpen, Pencil, Trash2 } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { InspectionItem, InspectionStatus } from "@/types/pncpInspection";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNewCatmatEntry } from '@/integrations/supabase/api';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatCodug, formatCurrency } from '@/lib/formatUtils';
import { Textarea } from "@/components/ui/textarea";

interface PNCPInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionList: InspectionItem[];
    onFinalImport: (items: ItemAquisicao[]) => void;
    onReviewItem: (item: ItemAquisicao) => void; // Função para revisar o item
}

// Função auxiliar para formatar a contagem de itens com concordância
const formatItemCount = (count: number) => {
    const itemWord = count === 1 ? 'item' : 'itens';
    return `${count} ${itemWord}`;
};

// Componente auxiliar para Textarea com auto-ajuste
const AutoResizeTextarea: React.FC<{
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    disabled: boolean;
    className?: string;
}> = ({ value, onChange, disabled, className }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            // Resetar a altura para calcular a altura de rolagem correta
            textareaRef.current.style.height = 'auto';
            // Definir a altura para a altura de rolagem, garantindo um mínimo
            const scrollHeight = textareaRef.current.scrollHeight;
            const minHeight = 80; // Altura mínima de 3 linhas (aprox.)
            textareaRef.current.style.height = `${Math.max(scrollHeight, minHeight)}px`;
        }
    }, [value]);

    return (
        <Textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={cn("text-center text-sm overflow-hidden resize-none", className)}
            disabled={disabled}
            rows={1} // Começa com 1 linha, a lógica de auto-ajuste fará o resto
        />
    );
};


const PNCPInspectionDialog: React.FC<PNCPInspectionDialogProps> = ({
    open,
    onOpenChange,
    inspectionList: initialInspectionList,
    onFinalImport,
    onReviewItem,
}) => {
    const [inspectionList, setInspectionList] = useState(initialInspectionList);
    const [activeTab, setActiveTab] = useState<InspectionStatus>('valid');
    const [isSavingCatmat, setIsSavingCatmat] = useState(false); // Novo estado de loading para a persistência final
    const queryClient = useQueryClient();

    // Atualiza a lista interna se a lista inicial mudar (ex: nova busca)
    React.useEffect(() => {
        setInspectionList(initialInspectionList);
        // Tenta abrir a aba de itens que precisam de atenção primeiro
        if (initialInspectionList.some(item => item.status === 'needs_catmat_info')) {
            setActiveTab('needs_catmat_info');
        } else {
            setActiveTab('valid');
        }
    }, [initialInspectionList]);

    const groupedItems = useMemo(() => {
        return inspectionList.reduce((acc, item) => {
            if (!acc[item.status]) {
                acc[item.status] = [];
            }
            acc[item.status].push(item);
            return acc;
        }, {} as Record<InspectionStatus, InspectionItem[]>);
    }, [inspectionList]);
    
    const totalValid = groupedItems.valid?.length || 0;
    const totalNeedsInfo = groupedItems.needs_catmat_info?.length || 0;
    const totalDuplicates = groupedItems.duplicate?.length || 0;
    
    // NOVO CÁLCULO: Apenas itens que requerem ação (needs_catmat_info)
    const totalPendingAction = totalNeedsInfo; 

    const handleUpdateShortDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                return { ...item, userShortDescription: value };
            }
            return item;
        }));
    };
    
    /**
     * NOVO: Permite editar a descrição completa (ARP) no estado local.
     */
    const handleUpdateFullDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                return { 
                    ...item, 
                    mappedItem: {
                        ...item.mappedItem,
                        descricao_item: value,
                    }
                };
            }
            return item;
        }));
    };
    
    /**
     * Marca o item localmente como 'valid' e move para a aba Prontos.
     * A persistência no BD é adiada para a importação final.
     */
    const handleMarkAsValid = (item: InspectionItem) => {
        // Garante que userShortDescription é uma string e remove espaços
        const shortDescription = (item.userShortDescription || '').trim();
        
        if (!shortDescription) {
            toast.error("A descrição reduzida não pode ser vazia.");
            return;
        }
        
        // Atualiza o estado local para marcar o item como 'valid'
        setInspectionList(prev => prev.map(i => {
            if (i.originalPncpItem.id === item.originalPncpItem.id) {
                return {
                    ...i,
                    status: 'valid', // <-- Apenas este item é alterado
                    mappedItem: {
                        ...i.mappedItem,
                        descricao_reduzida: shortDescription, // Usa o valor preenchido
                    },
                    messages: ['Pronto para importação.'],
                };
            }
            return i;
        }));
        
        toast.success("Item movido para a aba 'Prontos'.");
    };

    const handleRemoveItem = (itemId: string) => {
        setInspectionList(prev => prev.filter(item => item.originalPncpItem.id !== itemId));
    };
    
    // Função para revisar o item (mantida)
    const handleReviewItemLocal = (item: InspectionItem) => {
        if (item.status === 'valid') {
            // Se o item está válido, o usuário quer movê-lo para revisão interna
            setInspectionList(prev => prev.map(i => {
                if (i.originalPncpItem.id === item.originalPncpItem.id) {
                    return {
                        ...i,
                        status: 'needs_catmat_info',
                        messages: ['Item movido para revisão manual.'],
                        // Mantém a descrição reduzida preenchida para edição
                        userShortDescription: item.mappedItem.descricao_reduzida || '', 
                    };
                }
                return i;
            }));
            
            // Muda para a aba de revisão
            setActiveTab('needs_catmat_info');
            toast.info("Item movido para a aba 'Requer Revisão'.");
            
        } else {
            // Se o item já está em needs_catmat_info ou duplicate, o usuário quer editar no formulário principal
            
            // 1. Chama a função de callback com o item mapeado.
            onReviewItem(item.mappedItem);
            
            // 2. Fecha o diálogo de inspeção (o pai ItemAquisicaoPNCPDialog fechará em seguida)
            onOpenChange(false);
        }
    };

    /**
     * Lógica de importação final. A persistência no catálogo CATMAT foi removida
     * para evitar erros de RLS, focando apenas na importação para a diretriz.
     */
    const handleFinalImport = async () => {
        if (totalNeedsInfo > 0) {
            toast.error("Ainda existem itens que requerem descrição reduzida. Por favor, preencha ou remova-os.");
            setActiveTab('needs_catmat_info');
            return;
        }
            
        const finalItems = inspectionList
            .filter(item => item.status === 'valid')
            .map(item => item.mappedItem);
        
        if (finalItems.length === 0) {
            toast.error("Nenhum item válido para importação.");
            return;
        }
        
        setIsSavingCatmat(true); // Mantemos o loading para feedback visual
        
        try {
            // 1. Não tentamos mais persistir no catálogo CATMAT devido a erros de RLS.
            // A descrição reduzida (descricao_reduzida) já está preenchida no mappedItem
            // se foi encontrada no catálogo local ou se foi validada pelo usuário.
            
            // 2. Invalida a query do catálogo (mantido para limpar cache, mas sem garantia de novos dados)
            queryClient.invalidateQueries({ queryKey: ['catmatCatalog'] });
            
            // 3. Chama a importação final no componente pai
            onFinalImport(finalItems);
            
            // Sucesso na importação para o formulário principal
            toast.success(`Importação de ${formatItemCount(finalItems.length)} concluída.`);
            
        } catch (error: any) {
            // Se houver erro aqui, é um erro inesperado, mas o fluxo principal deve ser garantido.
            console.error("Erro durante a importação final:", error);
            toast.error(`Falha inesperada durante a importação. Detalhes: ${error.message}`);
        } finally {
            setIsSavingCatmat(false);
        }
    };
    
    const renderInspectionTable = (status: InspectionStatus) => {
        const items = groupedItems[status] || [];
        
        if (items.length === 0) {
            return (
                <div className="text-center py-8 text-muted-foreground">
                    {status === 'valid' && "Todos os itens que requerem atenção foram resolvidos."}
                    {status === 'needs_catmat_info' && "Nenhum item requer descrição reduzida."}
                    {status === 'duplicate' && "Nenhum item duplicado encontrado."}
                </div>
            );
        }
        
        // Ajuste de largura das colunas conforme solicitado:
        let catmatWidth = 'w-[5%]';
        let arpDescWidth = 'w-[33%]';
        let pncpDescWidth = 'w-[33%]';
        let statusOrShortDescWidth = 'w-[24%]';
        let actionWidth = 'w-[5%]';

        // Se for Duplicado, remove a coluna Ações e redistribui a largura
        if (status === 'duplicate') {
            actionWidth = 'w-[0%]'; // Remove a coluna
            catmatWidth = 'w-[10%]'; // 5% -> 10%
            arpDescWidth = 'w-[35%]'; // 33% -> 35%
            pncpDescWidth = 'w-[35%]'; // 33% -> 35%
            statusOrShortDescWidth = 'w-[20%]'; // 24% -> 20%
            // Total: 10 + 35 + 35 + 20 = 100%
        }


        return (
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            {/* Centralizando cabeçalhos */}
                            <TableHead className={cn(catmatWidth, "text-center")}>Cód. CATMAT</TableHead>
                            <TableHead className={cn(arpDescWidth, "text-center")}>Descrição Completa (ARP)</TableHead>
                            
                            {/* MUDANÇA 2: Coluna Descrição Completa (PNCP) -> Nome Reduzido se for Duplicado */}
                            {status === 'duplicate' ? (
                                <TableHead className={cn(pncpDescWidth, "text-center")}>Nome Reduzido (PNCP)</TableHead>
                            ) : (
                                <TableHead className={cn(pncpDescWidth, "text-center")}>Descrição Completa (PNCP)</TableHead>
                            )}
                            
                            {/* Lógica Condicional para o Cabeçalho */}
                            {status === 'needs_catmat_info' ? (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Nome Reduzido *</TableHead>
                            ) : status === 'valid' ? (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Nome Reduzido</TableHead>
                            ) : (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Status</TableHead>
                            )}
                            
                            {status !== 'duplicate' && (
                                <TableHead className={actionWidth + " text-center"}>Ações</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => {
                            // CORREÇÃO: Usar a nova flag isCatmatCataloged
                            const isCataloged = item.isCatmatCataloged;
                            
                            return (
                                <TableRow key={item.originalPncpItem.id}>
                                    {/* Centralizando células */}
                                    <TableCell className={cn("font-semibold text-sm text-center")}>{item.mappedItem.codigo_catmat}</TableCell>
                                    
                                    {/* Coluna Descrição Completa (ARP) - EDITÁVEL SE needs_catmat_info */}
                                    <TableCell className={cn("text-sm max-w-xs whitespace-normal text-center", status !== 'needs_catmat_info' && "py-4")}>
                                        {status === 'needs_catmat_info' ? (
                                            <AutoResizeTextarea
                                                value={item.mappedItem.descricao_item}
                                                onChange={(e) => handleUpdateFullDescription(item.originalPncpItem.id, e.target.value)}
                                                disabled={isSavingCatmat}
                                            />
                                        ) : (
                                            item.mappedItem.descricao_item
                                        )}
                                        {/* Detalhes de Pregão/UASG/Valor Unitário */}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Pregão: {item.mappedItem.numero_pregao.replace(/^0+/, '')} ({formatCodug(item.mappedItem.uasg)}) | R$: {formatCurrency(item.mappedItem.valor_unitario)}
                                        </p>
                                    </TableCell>
                                    
                                    {/* Coluna Descrição Completa (PNCP) / Nome Reduzido */}
                                    <TableCell className={cn("text-sm max-w-xs whitespace-normal text-muted-foreground text-center")}>
                                        {status === 'duplicate' ? (
                                            <span className="text-gray-800 font-medium">
                                                {item.nomePdm || 'N/A'} {/* Mostrar nomePdm para duplicados */}
                                            </span>
                                        ) : (
                                            item.fullPncpDescription
                                        )}
                                    </TableCell>
                                    
                                    {/* Coluna Condicional: Descrição Reduzida, Nome Reduzido ou Status */}
                                    {status === 'needs_catmat_info' ? (
                                        <TableCell className="py-2">
                                            <Input
                                                value={item.userShortDescription}
                                                onChange={(e) => handleUpdateShortDescription(item.originalPncpItem.id, e.target.value)}
                                                placeholder={"Inserir nome reduzido"}
                                                disabled={isSavingCatmat}
                                            />
                                            {item.nomePdm && (
                                                <p className="text-xs text-muted-foreground mt-1 text-center">
                                                    Sugestão PNCP: {item.nomePdm}
                                                </p>
                                            )}
                                        </TableCell>
                                    ) : status === 'valid' ? (
                                        // Exibe o Nome Reduzido para itens válidos
                                        <TableCell className={cn("py-2 font-medium text-sm text-center")}>
                                            {item.mappedItem.descricao_reduzida}
                                        </TableCell>
                                    ) : (
                                        /* Coluna Status para Duplicados (Ajustada) */
                                        <TableCell className={cn("py-2 text-center")}>
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                {/* 1. Mensagem de Duplicidade Específica */}
                                                <span className="text-xs text-red-600 font-medium">
                                                    {/* Exibe a mensagem detalhada de duplicidade */}
                                                    Há duplicidade na Chave de Contrato. {item.messages[0]}
                                                </span>
                                                
                                                {/* 2. Status do Catálogo com cores */}
                                                <p className={cn("text-xs mt-1", isCataloged ? "text-green-600" : "text-red-600")}>
                                                    {isCataloged ? 
                                                        "Item presente no Catálogo CATMAT local" : 
                                                        "Item não presente no Catálogo CATMAT local"
                                                    }
                                                </p>
                                            </div>
                                        </TableCell>
                                    )}
                                    
                                    {/* Coluna Ações (Visível apenas se não for Duplicado) */}
                                    {status !== 'duplicate' && (
                                        <TableCell className="text-right space-y-1">
                                            {/* Botão Validar (Apenas na aba Requer Revisão) */}
                                            {status === 'needs_catmat_info' && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => handleMarkAsValid(item)}
                                                    disabled={isSavingCatmat || !item.userShortDescription.trim()}
                                                >
                                                    <Check className="h-4 w-4 mr-2" />
                                                    Validar
                                                </Button>
                                            )}

                                            {/* Botão Revisar (Apenas na aba Prontos) */}
                                            {status === 'valid' && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    onClick={() => handleReviewItemLocal(item)}
                                                    className="w-full"
                                                >
                                                    <Pencil className="h-4 w-4 mr-1" />
                                                    Revisar
                                                </Button>
                                            )}
                                            
                                            {/* Botão Remover */}
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleRemoveItem(item.originalPncpItem.id)}
                                                className="w-full text-red-600 border-red-300 hover:bg-red-100 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Remover
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl">
                <DialogHeader>
                    <DialogTitle>Inspeção de Itens PNCP</DialogTitle>
                    <DialogDescription>
                        Revise os {formatItemCount(initialInspectionList.length)} selecionados. 
                        {totalDuplicates === 1 ? 
                            `1 item duplicado será descartado.` : 
                            `${totalDuplicates} itens duplicados serão descartados.`
                        } 
                        Itens que requerem descrição reduzida devem ser resolvidos antes da importação final.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InspectionStatus)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="valid" className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            Prontos ({totalValid})
                        </TabsTrigger>
                        <TabsTrigger value="needs_catmat_info" className="flex items-center gap-2" disabled={totalNeedsInfo === 0}>
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Requer Revisão ({totalNeedsInfo})
                        </TabsTrigger>
                        <TabsTrigger value="duplicate" className="flex items-center gap-2" disabled={totalDuplicates === 0}>
                            <X className="h-4 w-4 text-red-600" />
                            Duplicados ({totalDuplicates})
                        </TabsTrigger>
                    </TabsList>
                    
                    {/* Container com altura mínima para estabilizar o layout */}
                    <div className="min-h-[55vh]">
                        <TabsContent value="valid">
                            {/* Placeholder para estabilizar a altura */}
                            <p className="text-sm text-muted-foreground mb-3 opacity-0 select-none pointer-events-none">
                                Estes itens possuem códigos CATMAT válidos, mas não têm um nome reduzido cadastrado no seu catálogo. Por favor, forneça um nome curto para facilitar a identificação e clique em "Validar".
                            </p>
                            {renderInspectionTable('valid')}
                        </TabsContent>
                        
                        <TabsContent value="needs_catmat_info">
                            <p className="text-sm text-muted-foreground mb-3">
                                Estes itens possuem códigos CATMAT válidos, mas não têm um nome reduzido cadastrado no seu catálogo. Por favor, forneça um nome curto para facilitar a identificação e clique em "Validar".
                            </p>
                            {renderInspectionTable('needs_catmat_info')}
                        </TabsContent>
                        
                        <TabsContent value="duplicate">
                            {/* Ajuste do texto da descrição da aba Duplicados */}
                            <p className="text-sm text-muted-foreground mb-3 text-red-600">
                                Estes itens foram identificados como duplicados e serão descartados da importação. Eles possuem a mesma **Chave de Contrato** (Pregão, UASG e Valor Unitário) e pelo menos uma **Chave de Item** (CATMAT, Descrição Completa ou Nome Reduzido) idêntica a um item já existente.
                            </p>
                            {renderInspectionTable('duplicate')}
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        {totalPendingAction > 0 ? 
                            <span className="text-red-600 font-medium">Atenção: {formatItemCount(totalPendingAction)} requerem ação antes da importação.</span> :
                            <span className="text-green-600 font-medium">Todos os {formatItemCount(totalValid)} estão prontos para importação.</span>
                        }
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            onClick={handleFinalImport}
                            disabled={totalValid === 0 || totalNeedsInfo > 0 || isSavingCatmat}
                        >
                            {isSavingCatmat ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Import className="h-4 w-4 mr-2" />
                            )}
                            Importar {formatItemCount(totalValid)} Válido{totalValid === 1 ? '' : 's'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSavingCatmat}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PNCPInspectionDialog;