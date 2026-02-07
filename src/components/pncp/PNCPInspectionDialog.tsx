import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Import, Check, X, AlertTriangle, Save, BookOpen, Info } from "lucide-react";
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
        mutationFn: async ({ item, shortDescription }: { item: InspectionItem, shortDescription: string }) => {
            await saveNewCatmatEntry(
                item.mappedItem.codigo_catmat,
                item.mappedItem.descricao_item,
                shortDescription
            );
            return item.originalPncpItem.id;
        },
        onSuccess: (itemId) => {
            toast.success("Descrição reduzida salva no Catálogo CATMAT!");
            
            // Atualiza o estado local para marcar o item como 'valid'
            setInspectionList(prev => prev.map(item => {
                if (item.originalPncpItem.id === itemId) {
                    return {
                        ...item,
                        status: 'valid',
                        mappedItem: {
                            ...item.mappedItem,
                            descricao_reduzida: item.userShortDescription,
                        },
                        messages: ['Pronto para importação.'],
                        // Limpa a sugestão PDM após a validação
                        pdmSuggestion: null, 
                    };
                }
                return item;
            }));
            
            // Invalida a query do catálogo para que a próxima busca já use o novo valor
            queryClient.invalidateQueries({ queryKey: ['catmatCatalog'] });
        },
        onError: (error) => {
            toast.error(error.message || "Falha ao salvar descrição reduzida.");
        }
    });
    
    const handleUpdateShortDescription = (itemId: string, value: string) => {
        setInspectionList(prev => prev.map(item => {
            if (item.originalPncpItem.id === itemId) {
                return { ...item, userShortDescription: value };
            }
            return item;
        }));
    };
    
    // Função corrigida para chamar a mutação
    const handleSaveAndValidateCatmat = (item: InspectionItem) => {
        // Garante que userShortDescription é uma string e remove espaços
        const shortDescription = (item.userShortDescription || '').trim();
        
        if (!shortDescription) {
            toast.error("A descrição reduzida não pode ser vazia.");
            return;
        }
        
        saveCatmatMutation.mutate({ item, shortDescription });
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
                            <TableHead className="w-[10%]">Cód. CATMAT</TableHead>
                            <TableHead className="w-[35%]">Descrição da ARP</TableHead>
                            {/* NOVO: Coluna para Descrição Oficial (PNCP) */}
                            <TableHead className="w-[35%]">Descrição Oficial (PNCP)</TableHead> 
                            {status === 'needs_catmat_info' && <TableHead className="w-[10%]">Descrição Reduzida *</TableHead>}
                            {status !== 'needs_catmat_info' && <TableHead className="w-[10%]">Status</TableHead>}
                            <TableHead className="w-[10%] text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map(item => (
                            <TableRow key={item.originalPncpItem.id}>
                                <TableCell className="font-semibold text-sm">{item.mappedItem.codigo_catmat}</TableCell>
                                
                                {/* Descrição da ARP (Original) */}
                                <TableCell className="text-sm max-w-xs whitespace-normal">
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
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Pregão: {item.mappedItem.numero_pregao} | UASG: {item.mappedItem.uasg}
                                    </p>
                                </TableCell>
                                
                                {/* Descrição Oficial (PNCP) - CORRIGIDO: Verifica se a descrição é a mensagem de falha */}
                                <TableCell className="text-sm max-w-xs whitespace-normal text-muted-foreground">
                                    {item.officialPncpDescription && item.officialPncpDescription !== "Falha ao carregar descrição oficial." ? item.officialPncpDescription : 'N/A'}
                                </TableCell>
                                
                                {status === 'needs_catmat_info' && (
                                    <TableCell>
                                        <div className="space-y-1">
                                            <Input
                                                value={item.userShortDescription}
                                                onChange={(e) => handleUpdateShortDescription(item.originalPncpItem.id, e.target.value)}
                                                placeholder={item.pdmSuggestion || "Nome curto para o catálogo"}
                                                disabled={saveCatmatMutation.isPending}
                                            />
                                            {item.pdmSuggestion && (
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Info className="h-3 w-3" />
                                                    Sugestão PDM: {item.pdmSuggestion}
                                                </p>
                                            )}
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => handleSaveAndValidateCatmat(item)}
                                                disabled={saveCatmatMutation.isPending || !item.userShortDescription.trim()}
                                            >
                                                {saveCatmatMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-2" />
                                                )}
                                                Salvar & Validar
                                            </Button>
                                        </div>
                                    </TableCell>
                                )}
                                
                                {status !== 'needs_catmat_info' && (
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {status === 'valid' && <Check className="h-4 w-4 text-green-600" />}
                                            {status === 'duplicate' && <X className="h-4 w-4 text-red-600" />}
                                            <span className={cn("text-sm", status === 'duplicate' && "text-red-600")}>
                                                {item.messages[0]}
                                            </span>
                                        </div>
                                    </TableCell>
                                )}
                                
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => handleRemoveItem(item.originalPncpItem.id)}
                                        className="text-red-600 hover:bg-red-100"
                                    >
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
                            Estes itens possuem códigos CATMAT válidos, mas não têm uma descrição reduzida cadastrada no seu catálogo. Por favor, forneça um nome curto para facilitar a identificação e clique em "Salvar & Validar".
                        </p>
                        {renderInspectionTable('needs_catmat_info')}
                    </TabsContent>
                    
                    <TabsContent value="duplicate">
                        <p className="text-sm text-muted-foreground mb-3 text-red-600">
                            Estes itens já existem na diretriz de destino (mesma Descrição Completa, CATMAT, Pregão e UASG). Remova-os para evitar duplicidade.
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