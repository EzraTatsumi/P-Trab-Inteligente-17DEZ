import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, Package, Plus, Minus, Plane, AlertTriangle, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from '@/types/diretrizesPassagens';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Define TrechoSelection baseado na necessidade de rastrear quantidade e contexto pai
export interface TrechoSelection extends TrechoPassagem {
    quantidade_passagens: number;
    om_detentora: string; // OM Contratante
    ug_detentora: string; // UG Contratante
    diretriz_id: string; // ID da Diretriz (Contrato)
}

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (trechos: TrechoSelection[]) => void;
    selectedYear: number;
    initialSelections: TrechoSelection[];
}

// --- Data Fetching ---
const fetchDiretrizesPassagens = async (year: number): Promise<DiretrizPassagem[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .eq('ativo', true)
        .order('om_referencia', { ascending: true });
        
    if (error) throw error;
    
    return data as DiretrizPassagem[];
};

// --- Component ---
const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
    selectedYear,
    initialSelections,
}) => {
    const { data: diretrizes, isLoading, error } = useQuery({
        queryKey: ['diretrizesPassagens', selectedYear],
        queryFn: () => fetchDiretrizesPassagens(selectedYear),
    });
    
    // State to manage selections locally, including quantity
    const [localSelections, setLocalSelections] = useState<TrechoSelection[]>(initialSelections);

    // Sync local state when dialog opens or initialSelections change
    useEffect(() => {
        if (open) {
            setLocalSelections(initialSelections);
        }
    }, [open, initialSelections]);

    // Flatten all available trechos from all active directives
    const allAvailableTrechos = useMemo(() => {
        if (!diretrizes) return [];
        
        const flattened: (TrechoPassagem & { diretriz_id: string, om_detentora: string, ug_detentora: string })[] = [];
        
        diretrizes.forEach(diretriz => {
            (diretriz.trechos as TrechoPassagem[]).forEach(trecho => {
                flattened.push({
                    ...trecho,
                    diretriz_id: diretriz.id,
                    om_detentora: diretriz.om_referencia,
                    ug_detentora: diretriz.ug_referencia,
                });
            });
        });
        
        return flattened;
    }, [diretrizes]);

    // Map to quickly check if a trecho is selected
    const selectedMap = useMemo(() => {
        return new Map(localSelections.map(t => [t.trecho_id, t]));
    }, [localSelections]);

    // --- Handlers ---
    
    const handleToggleSelection = useCallback((trecho: typeof allAvailableTrechos[number]) => {
        setLocalSelections(prev => {
            const isSelected = selectedMap.has(trecho.id);
            
            if (isSelected) {
                // Remove selection
                return prev.filter(t => t.trecho_id !== trecho.id);
            } else {
                // Add selection with default quantity 1
                const newSelection: TrechoSelection = {
                    ...trecho,
                    quantidade_passagens: 1,
                    valor: trecho.valor, // Ensure 'valor' is present
                };
                return [...prev, newSelection];
            }
        });
    }, [selectedMap]);

    const handleQuantityChange = useCallback((trechoId: string, quantity: number) => {
        setLocalSelections(prev => {
            return prev.map(t => 
                t.trecho_id === trechoId ? { ...t, quantidade_passagens: Math.max(1, quantity) } : t
            );
        });
    }, []);

    const handleConfirm = () => {
        // Filter out any selections where quantity might have been set to 0 manually
        const finalSelections = localSelections.filter(t => t.quantidade_passagens > 0);
        
        if (finalSelections.length === 0) {
            toast.error("Selecione pelo menos um trecho com quantidade maior que zero.");
            return;
        }
        
        onSelect(finalSelections);
        onOpenChange(false);
    };
    
    const handleClose = () => {
        // Reset local state to initial state on close
        setLocalSelections(initialSelections);
        onOpenChange(false);
    };

    // --- Render Logic ---
    
    if (error) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" /> Erro ao Carregar Contratos
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground">
                        Não foi possível carregar as diretrizes de passagens para o ano {selectedYear}. Verifique se os contratos foram cadastrados em "Configurações - Custos Operacionais".
                    </p>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Fechar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary" />
                        Selecionar Trechos de Passagem ({selectedYear})
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Selecione os trechos de passagem disponíveis nos contratos cadastrados para o ano de referência.
                    </p>
                </DialogHeader>
                
                {isLoading ? (
                    <div className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2 mx-auto" />
                        <p className="text-sm text-muted-foreground">Carregando contratos...</p>
                    </div>
                ) : allAvailableTrechos.length === 0 ? (
                    <div className="text-center py-8">
                        <AlertTriangle className="h-6 w-6 mx-auto text-yellow-600 mb-2" />
                        <p className="text-sm text-muted-foreground">
                            Nenhum trecho de passagem ativo encontrado para o ano {selectedYear}. Cadastre os contratos em "Configurações - Custos Operacionais".
                        </p>
                    </div>
                ) : (
                    <div className="py-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[20%]">Contratante (OM/UG)</TableHead>
                                    <TableHead className="w-[30%]">Trecho</TableHead>
                                    <TableHead className="w-[15%]">Tipo</TableHead>
                                    <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                                    <TableHead className="w-[10%] text-center">Qtd</TableHead>
                                    <TableHead className="w-[10%] text-center">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allAvailableTrechos.map((trecho) => {
                                    const selectedItem = selectedMap.get(trecho.id);
                                    const isSelected = !!selectedItem;
                                    
                                    // Se estiver selecionado, usa a quantidade do estado local
                                    const currentQuantity = selectedItem?.quantidade_passagens || 0;
                                    
                                    // Lógica do botão (conforme solicitado)
                                    const buttonContent = isSelected ? (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" /> Adicionado
                                        </>
                                    ) : (
                                        <>
                                            <Package className="w-4 h-4 mr-2" /> Selecionar
                                        </>
                                    );
                                    
                                    const buttonClassName = isSelected 
                                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                                        : 'bg-primary hover:bg-primary-light text-primary-foreground';

                                    return (
                                        <TableRow key={trecho.id}>
                                            <TableCell>
                                                <p className="font-medium">{trecho.om_detentora}</p>
                                                <p className="text-xs text-muted-foreground">UG: {formatCodug(trecho.ug_detentora)}</p>
                                            </TableCell>
                                            <TableCell>
                                                {trecho.origem} &rarr; {trecho.destino}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {trecho.tipo_transporte} ({trecho.is_ida_volta ? 'Ida/Volta' : 'Ida'})
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(trecho.valor)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {isSelected ? (
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={currentQuantity}
                                                        onChange={(e) => handleQuantityChange(trecho.id, parseInt(e.target.value) || 1)}
                                                        className="w-16 text-center h-8 mx-auto [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button 
                                                    size="sm"
                                                    className={cn("transition-all duration-200", buttonClassName)}
                                                    onClick={() => handleToggleSelection(trecho)}
                                                >
                                                    {buttonContent}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <DialogFooter>
                    <Button onClick={handleConfirm} disabled={localSelections.length === 0 || isLoading}>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção ({localSelections.length})
                    </Button>
                    <Button variant="outline" onClick={handleClose}>
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;