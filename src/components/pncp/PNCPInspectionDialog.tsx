import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Import, Check, X, AlertTriangle, Save, BookOpen, Info, Send } from "lucide-react";
import { ItemAquisicao } from "@/types/diretrizesMaterialConsumo";
import { InspectionItem, InspectionStatus } from "@/types/pncpInspection";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveNewCatmatEntry } from '@/integrations/supabase/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

interface PNCPInspectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inspectionList: InspectionItem[];
    onFinalImport: (items: ItemAquisicao[]) => void;
}

const PNCPInspectionDialog: React.FC<PNCPInspectionDialogProps> = ({
    open,
    onOpenChange,
    inspectionList: initialInspectionList,
    onFinalImport,
}) => {
    const [inspectionList, setInspectionList] = useState(initialInspectionList);
    const [activeTab, setActiveTab] = useState<InspectionStatus>('valid');
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

    // Mutação para salvar a nova descrição reduzida no catálogo CATMAT
    const saveCatmatMutation = useMutation({
        mutationFn: async ({ item, shortDescription, fullDescription }: { item: InspectionItem, shortDescription: string, fullDescription: string }) => {
            // Chama a API para salvar/atualizar o catálogo CATMAT
            await saveNewCatmatEntry(
                item.mappedItem.codigo_catmat,
                fullDescription, // Usa a descrição completa fornecida pelo usuário
                shortDescription
            );
            return { itemId: item.originalPncpItem.id, shortDescription, fullDescription };
        },
        onSuccess: ({ itemId, shortDescription, fullDescription }) => {
            toast.success("Descrição reduzida salva no Catálogo CATMAT!");
            
            // Atualiza o estado local para marcar o item como 'valid'
            setInspectionList(prev => prev.map(item => {
                if (item.originalPncpItem.id === itemId) {
                    return {
                        ...item,
                        status: 'valid',
                        mappedItem: {
                            ...item.mappedItem,
                            descricao_reduzida: shortDescription,
                            descricao_item: fullDescription, // Atualiza a descrição completa no mappedItem
                        },
                        messages: ['Pronto para importação.'],
                        userShortDescription: shortDescription, // Mantém o valor salvo
                        pdmSuggestion: null, 
                    };
                }
                return item;
            }));
            
            // Invalida a query do catálogo para que a próxima busca já use o novo valor
            queryClient.invalidateQueries({ queryKey: ['catmatCatalog'] });
            
            // Se a aba atual for 'needs_catmat_info', tenta mudar para 'valid' se não houver mais pendências
            if (activeTab === 'needs_catmat_info' && (groupedItems.needs_catmat_info?.length || 0) <= 1) {
                setActiveTab('valid');
            }
        },
        onError: (error) => {
            toast.error(error.message || "Falha ao salvar descrição reduzida.");
        }
    });
    
    // Função para atualizar a Descrição Reduzida (userShortDescription)
    const handleUpdateShortDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                return { ...item, userShortDescription: value };
            }
            return item;
        }));
    };
    
    // NOVO: Função para atualizar a Descrição Completa (mappedItem.descricao_item)
    const handleUpdateARPDescription = (itemId: string, value: string) => {
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
    
    // Função corrigida para chamar a mutação (Salvar & Validar)
    const handleSaveAndValidateCatmat = (item: InspectionItem) => {
        const shortDescription = (item.userShortDescription || '').trim();
        const fullDescription = (item.mappedItem.descricao_item || '').trim();
        
        if (!shortDescription) {
            toast.error("A descrição reduzida não pode ser vazia.");
            return;
        }
        if (!fullDescription) {
            toast.error("A descrição completa não pode ser vazia.");
            return;
        }
        
        saveCatmatMutation.mutate({ item, shortDescription, fullDescription });
    };
    
    // NOVO: Função para enviar item 'valid' para 'needs_catmat_info' (Enviar para Revisão)
    const handleSendToReview = (itemId: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                toast.info("Item movido para 'Requer Revisão'. Edite e salve para atualizar o catálogo.");
                return { 
                    ...item, 
                    status: 'needs_catmat_info',
                    messages: ['Revisão solicitada pelo usuário.'],
                    // Mantém a descrição reduzida atual como sugestão inicial
                    userShortDescription: item.mappedItem.descricao_reduzida, 
                };
            }
            return item;
        }));
        // Tenta mudar para a aba de revisão
        setActiveTab('needs_catmat_info');
    };

    const handleRemoveItem = (itemId: string) => {
        setInspectionList(prev => prev.filter(item => item.originalPncpItem.id !== itemId));
    };

    const handleFinalImport = () => {
        if (totalNeedsInfo > 0) {
            toast.error("Ainda existem itens que requerem descrição reduzida. Por favor, preencha ou remova-os.");
            setActiveTab('needs_catmat_info');
            return;
        }
        
        const finalItems = inspectionList
            .filter(item => item.status === 'valid')
            .map(item => item.mappedItem);
            
        onFinalImport(finalItems);
        onOpenChange(false);
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
        
        return (
            <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                            <TableHead className="w-[10%] text-center">Cód. CATMAT</TableHead>
                            {/* Coluna 2: Descrição Completa (ARP ou Catálogo) */}
                            <TableHead className="w-[30%] text-center">Descrição Completa</TableHead> 
                            {/* Coluna 3: Descrição Oficial (PNCP) */}
                            <TableHead className="w-[30%] text-center">Descrição Oficial (PNCP)</TableHead> 
                            {/* Coluna 4: Descrição Reduzida */}
                            <TableHead className="w-[15%]text-center">Descrição Reduzida</TableHead>
                            <TableHead className="w-[15%] text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => {
                            const isSaving = saveCatmatMutation.isPending && saveCatmatMutation.variables?.item.originalPncpItem.id === item.originalPncpItem.id;
                            
                            return (
                                <TableRow key={item.originalPncpItem.id}>
                                    <TableCell className="font-semibold text-sm">
                                        {item.mappedItem.codigo_catmat}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {item.mappedItem.numero_pregao} | {item.mappedItem.uasg}
                                        </p>
                                    </TableCell>
                                    
                                    {/* Coluna 2: Descrição Completa (Editável se needs_catmat_info) */}
                                    <TableCell className="text-sm max-w-xs whitespace-normal">
                                        {status === 'needs_catmat_info' ? (
                                            <Textarea
                                                value={item.mappedItem.descricao_item}
                                                onChange={(e) => handleUpdateARPDescription(item.originalPncpItem.id, e.target.value)}
                                                placeholder="Edite a descrição completa"
                                                rows={3}
                                                disabled={isSaving}
                                            />
                                        ) : (
                                            <div className="flex items-start gap-1">
                                                {item.descriptionMismatch && (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-1 flex-shrink-0" />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-xs">
                                                                <p>Divergência: A descrição da ARP difere da descrição oficial do Catálogo de Material do PNCP.</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                                <span>{item.mappedItem.descricao_item}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    
                                    {/* Coluna 3: Descrição Oficial (PNCP) - Bruta, apenas para referência */}
                                    <TableCell className="text-sm max-w-xs whitespace-normal text-muted-foreground">
                                        {status === 'duplicate' ? 'N/A' : (item.officialPncpDescription && item.officialPncpDescription !== "Falha ao carregar descrição oficial." ? item.officialPncpDescription : 'N/A')}
                                    </TableCell>
                                    
                                    {/* Coluna 4: Descrição Reduzida (Editável se needs_catmat_info) */}
                                    <TableCell>
                                        {status === 'needs_catmat_info' ? (
                                            <div className="space-y-1">
                                                <Input
                                                    value={item.userShortDescription}
                                                    onChange={(e) => handleUpdateShortDescription(item.originalPncpItem.id, e.target.value)}
                                                    placeholder={item.pdmSuggestion || "Nome curto para o catálogo"}
                                                    disabled={isSaving}
                                                />
                                                {item.pdmSuggestion && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Info className="h-3 w-3" />
                                                        Sugestão PDM: {item.pdmSuggestion}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="font-medium text-sm">
                                                {item.mappedItem.descricao_reduzida || 'N/A'}
                                            </span>
                                        )}
                                    </TableCell>
                                    
                                    {/* Coluna 5: Ações */}
                                    <TableCell className="text-right">
                                        <div className="flex flex-col gap-2">
                                            {status === 'needs_catmat_info' && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleSaveAndValidateCatmat(item)}
                                                    disabled={isSaving || !item.userShortDescription.trim() || !item.mappedItem.descricao_item.trim()}
                                                >
                                                    {isSaving ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    ) : (
                                                        <Save className="h-4 w-4 mr-2" />
                                                    )}
                                                    Salvar & Validar
                                                </Button>
                                            )}
                                            
                                            {status === 'valid' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleSendToReview(item.originalPncpItem.id)}
                                                >
                                                    <Send className="h-4 w-4 mr-2" />
                                                    Enviar para Revisão
                                                </Button>
                                            )}
                                            
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleRemoveItem(item.originalPncpItem.id)}
                                                className="text-red-600 hover:bg-red-100"
                                                disabled={isSaving}
                                            >
                                                Remover
                                            </Button>
                                        </div>
                                    </TableCell>
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
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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

                    <TabsContent value="valid">
                        {renderInspectionTable('valid')}
                    </TabsContent>
                    
                    <TabsContent value="needs_catmat_info">
                        <p className="text-sm text-muted-foreground mb-3">
                            Estes itens não possuem descrição reduzida no catálogo. Edite a Descrição Completa (se necessário) e forneça um nome curto para o catálogo.
                        </p>
                        {renderInspectionTable('needs_catmat_info')}
                    </TabsContent>
                    
                    <TabsContent value="duplicate">
                        <p className="text-sm text-muted-foreground mb-3 text-red-600">
                            Estes itens já existem na diretriz de destino (mesmo CATMAT, Pregão e UASG). Remova-os para evitar duplicidade.
                        </p>
                        {renderInspectionTable('duplicate')}
                    </TabsContent>
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
                            disabled={totalValid === 0 || totalNeedsInfo > 0 || saveCatmatMutation.isPending}
                        >
                            <Import className="h-4 w-4 mr-2" />
                            Importar {totalValid} Itens Válidos
                        </Button>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saveCatmatMutation.isPending}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PNCPInspectionDialog;