import React, { useState, useMemo, useCallback } from 'react';
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
import { useQueryClient } from '@tanstack/react-query'; // Mantém useQueryClient para invalidar o cache após a importação final
import { cn } from '@/lib/utils';
import { formatCodug, formatCurrency } from '@/lib/formatUtils';

interface PNCPInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionList: InspectionItem[];
    onFinalImport: (items: ItemAquisicao[]) => void;
    onReviewItem: (item: ItemAquisicao) => void; // Função para revisar o item
}

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
    const totalPending = totalNeedsInfo + totalDuplicates;

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
     * Lógica de importação final, incluindo persistência no catálogo CATMAT.
     */
    const handleFinalImport = async () => {
        if (totalNeedsInfo > 0) {
            toast.error("Ainda existem itens que requerem descrição reduzida. Por favor, preencha ou remova-os.");
            setActiveTab('needs_catmat_info');
            return;
        }
        
        // Filtra apenas itens válidos que tiveram a descrição reduzida preenchida
        const itemsToPersist = inspectionList
            .filter(item => item.status === 'valid' && item.userShortDescription.trim() !== '');
            
        const finalItems = inspectionList
            .filter(item => item.status === 'valid')
            .map(item => item.mappedItem);
        
        if (finalItems.length === 0) {
            toast.error("Nenhum item válido para importação.");
            return;
        }
        
        setIsSavingCatmat(true);
        toast.info(`Persistindo ${itemsToPersist.length} descrições reduzidas no catálogo...`);
        
        try {
            // 1. Persistir no catálogo CATMAT (apenas para itens que foram validados manualmente)
            const persistencePromises = itemsToPersist.map(item => {
                // Usa a descrição reduzida que foi preenchida e validada
                const shortDescription = item.mappedItem.descricao_reduzida || item.userShortDescription;
                
                if (shortDescription.trim() !== '') {
                    return saveNewCatmatEntry(
                        item.mappedItem.codigo_catmat,
                        item.mappedItem.descricao_item,
                        shortDescription
                    );
                }
                return Promise.resolve();
            });
            
            await Promise.all(persistencePromises);
            
            // 2. Invalida a query do catálogo para que a próxima busca já use os novos valores
            queryClient.invalidateQueries({ queryKey: ['catmatCatalog'] });
            
            // 3. Chama a importação final no componente pai
            onFinalImport(finalItems);
            
        } catch (error: any) {
            console.error("Erro durante a persistência CATMAT na importação final:", error);
            // Se a persistência falhar, ainda podemos tentar importar os itens, mas avisamos o usuário.
            // No entanto, para manter a integridade, vamos cancelar a importação se a persistência falhar.
            toast.error(`Falha ao salvar no catálogo CATMAT. Importação cancelada. Detalhes: ${error.message}`);
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
        const catmatWidth = 'w-[5%]'; // 5%
        const arpDescWidth = 'w-[33%]'; // 33%
        const pncpDescWidth = 'w-[33%]'; // 33%
        const statusOrShortDescWidth = 'w-[24%]'; // 24%
        const actionWidth = 'w-[5%]'; // 5%
        // Total: 5 + 33 + 33 + 24 + 5 = 100%

        return (
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            {/* Centralizando cabeçalhos */}
                            <TableHead className={cn(catmatWidth, "text-center")}>Cód. CATMAT</TableHead>
                            <TableHead className={cn(arpDescWidth, "text-center")}>Descrição Completa (ARP)</TableHead>
                            <TableHead className={cn(pncpDescWidth, "text-center")}>Descrição Completa (PNCP)</TableHead>
                            
                            {/* Lógica Condicional para o Cabeçalho */}
                            {status === 'needs_catmat_info' ? (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Nome Reduzido *</TableHead>
                            ) : status === 'valid' ? (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Nome Reduzido</TableHead>
                            ) : (
                                <TableHead className={cn(statusOrShortDescWidth, "text-center")}>Status</TableHead>
                            )}
                            
                            <TableHead className={actionWidth + " text-center"}>Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.originalPncpItem.id}>
                                {/* Centralizando células */}
                                <TableCell className={cn("font-semibold text-sm text-center")}>{item.mappedItem.codigo_catmat}</TableCell>
                                
                                {/* Coluna Descrição Completa (ARP) - EDITÁVEL SE needs_catmat_info */}
                                <TableCell className={cn("text-sm max-w-xs whitespace-normal text-center", status !== 'needs_catmat_info' && "py-4")}>
                                    {status === 'needs_catmat_info' ? (
                                        <Input
                                            value={item.mappedItem.descricao_item}
                                            onChange={(e) => handleUpdateFullDescription(item.originalPncpItem.id, e.target.value)}
                                            className="text-center h-8"
                                            disabled={isSavingCatmat}
                                        />
                                    ) : (
                                        item.mappedItem.descricao_item
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {/* Ajuste de formatação: Pregão sem zero à esquerda (se for numérico), UASG formatado em parênteses, e Valor Unitário formatado */}
                                        Pregão: {item.mappedItem.numero_pregao.replace(/^0+/, '')} ({formatCodug(item.mappedItem.uasg)}) | R$: {formatCurrency(item.mappedItem.valor_unitario)}
                                    </p>
                                </TableCell>
                                
                                {/* Coluna Descrição Completa (PNCP) - Centralizando o bloco */}
                                <TableCell className={cn("text-sm max-w-xs whitespace-normal text-muted-foreground text-center")}>
                                    {item.fullPncpDescription}
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
                                    /* Coluna Status para Duplicados */
                                    <TableCell className={cn("py-2 text-center")}>
                                        <div className="flex items-center justify-center gap-2">
                                            {status === 'valid' && <Check className="h-4 w-4 text-green-600" />}
                                            {status === 'duplicate' && <X className="h-4 w-4 text-red-600" />}
                                            <span className={cn("text-sm", status === 'duplicate' && "text-red-600")}>
                                                {item.messages[0]}
                                            </span>
                                        </div>
                                    </TableCell>
                                )}
                                
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

                                    {/* Botão Revisar (Apenas nas abas Prontos e Duplicados) */}
                                    {status !== 'needs_catmat_info' && (
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
                                    
                                    {/* Botão Remover (Com ícone de Lixeira) */}
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
                            </TableRow>
                        ))}
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
                        Revise os {initialInspectionList.length} itens selecionados. Itens duplicados ou que requerem descrição reduzida devem ser resolvidos antes da importação final.
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
                            <p className="text-sm text-muted-foreground mb-3 text-red-600">
                                Estes itens já existem na diretriz de destino (mesma Descrição Completa, CATMAT, Pregão e UASG). Remova-os para evitar duplicidade.
                            </p>
                            {renderInspectionTable('duplicate')}
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="flex justify-between items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                        {totalPending > 0 ? 
                            <span className="text-red-600 font-medium">Atenção: {totalPending} itens requerem ação antes da importação.</span> :
                            <span className="text-green-600 font-medium">Todos os {totalValid} itens estão prontos para importação.</span>
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
                            Importar {totalValid} Itens Válidos
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