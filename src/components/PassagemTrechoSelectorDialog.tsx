import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Plane, AlertTriangle, Check, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from '@/types/diretrizesPassagens';
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// Define a estrutura de seleção de trecho que será retornada
export interface TrechoSelection extends TrechoPassagem {
    diretriz_id: string;
    om_detentora: string;
    ug_detentora: string;
    quantidade_passagens: number; // Quantidade solicitada para este trecho
}

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onSelect: (trechos: TrechoSelection[]) => void;
    initialSelections: TrechoSelection[];
}

// Função para calcular o valor total de um trecho (considerando ida/volta)
const calculateTrechoTotal = (trecho: TrechoPassagem, quantidade: number): number => {
    const multiplier = trecho.is_ida_volta ? 2 : 1;
    return trecho.valor * quantidade * multiplier;
};

const fetchDiretrizesPassagens = async (year: number): Promise<DiretrizPassagem[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Busca diretrizes ativas para o ano selecionado
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .eq('ativo', true)
        .order('om_referencia', { ascending: true });

    if (error) throw error;
    
    // Garante que trechos é um array de TrechoPassagem
    return (data || []).map(d => ({
        ...d,
        trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
    })) as DiretrizPassagem[];
};

const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onSelect,
    initialSelections,
}) => {
    const [currentSelections, setCurrentSelections] = useState<TrechoSelection[]>(initialSelections);
    const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});

    const { data: diretrizes, isLoading, isError } = useQuery({
        queryKey: ['diretrizesPassagens', selectedYear],
        queryFn: () => fetchDiretrizesPassagens(selectedYear),
        enabled: open,
    });
    
    // Sincroniza as seleções iniciais quando o diálogo abre
    useEffect(() => {
        if (open) {
            setCurrentSelections(initialSelections);
        }
    }, [open, initialSelections]);
    
    // Calcula o total de passagens selecionadas
    const totalPassagens = useMemo(() => {
        return currentSelections.reduce((sum, t) => sum + t.quantidade_passagens, 0);
    }, [currentSelections]);

    const handleQuantityChange = (trechoId: string, quantity: number, diretriz: DiretrizPassagem, trecho: TrechoPassagem) => {
        if (quantity < 0) return;

        setCurrentSelections(prev => {
            const existingIndex = prev.findIndex(t => t.trecho_id === trechoId);
            
            if (quantity === 0) {
                // Remove se a quantidade for zero
                return prev.filter(t => t.trecho_id !== trechoId);
            }

            const newSelection: TrechoSelection = {
                ...trecho,
                diretriz_id: diretriz.id,
                om_detentora: diretriz.om_referencia,
                ug_detentora: diretriz.ug_referencia,
                quantidade_passagens: quantity,
            };

            if (existingIndex !== -1) {
                // Atualiza a quantidade
                const newSelections = [...prev];
                newSelections[existingIndex] = newSelection;
                return newSelections;
            } else {
                // Adiciona novo trecho
                return [...prev, newSelection];
            }
        });
    };
    
    const handleConfirm = () => {
        if (totalPassagens === 0) {
            // Permite fechar sem seleção, mas avisa
            onSelect([]);
            onOpenChange(false);
            return;
        }
        onSelect(currentSelections);
        onOpenChange(false);
    };
    
    const getQuantity = (trechoId: string): number => {
        return currentSelections.find(t => t.trecho_id === trechoId)?.quantidade_passagens || 0;
    };
    
    const handleToggleCollapse = (diretrizId: string) => {
        setCollapseState(prev => ({
            ...prev,
            [diretrizId]: !prev[diretrizId],
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plane className="h-6 w-6 text-primary" />
                        Seleção de Trechos de Passagens
                    </DialogTitle>
                    <DialogDescription>
                        Selecione os trechos e a quantidade de passagens necessárias com base nos contratos ativos para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Carregando contratos...</p>
                        </div>
                    ) : diretrizes && diretrizes.length > 0 ? (
                        <div className="space-y-4">
                            {diretrizes.map(diretriz => (
                                <Collapsible 
                                    key={diretriz.id} 
                                    open={collapseState[diretriz.id] ?? false} 
                                    onOpenChange={() => handleToggleCollapse(diretriz.id)}
                                    className="border rounded-lg"
                                >
                                    <CollapsibleTrigger asChild>
                                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex flex-col text-left">
                                                <h4 className="font-semibold text-base">
                                                    Contrato: {diretriz.om_referencia} (UG: {formatCodug(diretriz.ug_referencia)})
                                                </h4>
                                                <p className="text-sm text-muted-foreground">
                                                    Pregão: {diretriz.numero_pregao || 'N/A'} | Vigência: {formatDate(diretriz.data_inicio_vigencia)} a {formatDate(diretriz.data_fim_vigencia)}
                                                </p>
                                            </div>
                                            {collapseState[diretriz.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[30%]">Trecho</TableHead>
                                                    <TableHead className="w-[15%]">Tipo</TableHead>
                                                    <TableHead className="w-[15%] text-right">Valor Unitário</TableHead>
                                                    <TableHead className="w-[20%] text-center">Quantidade</TableHead>
                                                    <TableHead className="w-[20%] text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {diretriz.trechos.map(trecho => {
                                                    const quantidade = getQuantity(trecho.id);
                                                    const total = calculateTrechoTotal(trecho, quantidade);
                                                    
                                                    return (
                                                        <TableRow key={trecho.id} className={cn(quantidade > 0 && "bg-green-500/10 hover:bg-green-500/20")}>
                                                            <TableCell className="font-medium">
                                                                {trecho.origem} &rarr; {trecho.destino}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {trecho.tipo_transporte} ({trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'})
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatCurrency(trecho.valor)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button 
                                                                        type="button" 
                                                                        variant="outline" 
                                                                        size="icon" 
                                                                        className="h-6 w-6"
                                                                        onClick={() => handleQuantityChange(trecho.id, quantidade - 1, diretriz, trecho)}
                                                                    >
                                                                        <Minus className="h-3 w-3" />
                                                                    </Button>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        value={quantidade === 0 ? "" : quantidade}
                                                                        onChange={(e) => handleQuantityChange(trecho.id, parseInt(e.target.value) || 0, diretriz, trecho)}
                                                                        className="w-16 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    <Button 
                                                                        type="button" 
                                                                        variant="outline" 
                                                                        size="icon" 
                                                                        className="h-6 w-6"
                                                                        onClick={() => handleQuantityChange(trecho.id, quantidade + 1, diretriz, trecho)}
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-semibold">
                                                                {formatCurrency(total)}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <AlertTriangle className="h-8 w-8 text-destructive mb-2 mx-auto" />
                            <p className="text-sm text-muted-foreground">
                                Nenhum contrato de passagens ativo encontrado para o ano {selectedYear}. 
                                Cadastre-os em "Configurações - Custos Operacionais".
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    <div className="flex items-center justify-between w-full">
                        <div className="text-lg font-bold">
                            Total de Passagens: <span className="text-primary">{totalPassagens}</span>
                        </div>
                        <div className="flex gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline">
                                    Cancelar
                                </Button>
                            </DialogClose>
                            <Button 
                                type="button" 
                                onClick={handleConfirm}
                                disabled={isLoading}
                            >
                                <Check className="mr-2 h-4 w-4" />
                                Confirmar Seleção
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;