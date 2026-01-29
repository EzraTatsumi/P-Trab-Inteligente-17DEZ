import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plane, AlertTriangle, Check, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from '@/types/diretrizesPassagens';
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
// Removendo importação de Checkbox

// Define a estrutura de seleção de trecho que será retornada
export interface TrechoSelection extends TrechoPassagem {
    diretriz_id: string;
    om_detentora: string;
    ug_detentora: string;
    quantidade_passagens: number; // Quantidade solicitada para este trecho (assumida como 1 na seleção inicial)
}

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onSelect: (trechos: TrechoSelection[]) => void;
    initialSelections: TrechoSelection[];
}

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
    // Mantemos a quantidade na seleção, mas a definimos como 1 ao selecionar
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
            // Filtra para garantir que apenas trechos com quantidade > 0 sejam mantidos
            setCurrentSelections(initialSelections.filter(t => t.quantidade_passagens > 0));
        }
    }, [open, initialSelections]);
    
    // Calcula o total de trechos selecionados
    const totalTrechosSelecionados = useMemo(() => {
        return currentSelections.length;
    }, [currentSelections]);

    const isSelected = (trechoId: string): boolean => {
        return currentSelections.some(t => t.trecho_id === trechoId);
    };

    // Adaptando a função para ser chamada por um clique de botão
    const handleSelectionToggle = (diretriz: DiretrizPassagem, trecho: TrechoPassagem) => {
        const trechoId = trecho.id;
        
        setCurrentSelections(prev => {
            const existingIndex = prev.findIndex(t => t.trecho_id === trechoId);
            
            if (existingIndex === -1) {
                // Adiciona seleção (Selecionar -> Selecionado)
                const newSelection: TrechoSelection = {
                    ...trecho,
                    diretriz_id: diretriz.id,
                    om_detentora: diretriz.om_referencia,
                    ug_detentora: diretriz.ug_referencia,
                    quantidade_passagens: 1, // Assumimos 1 passagem ao selecionar
                    valor_unitario: trecho.valor, // Usar 'valor' do TrechoPassagem como 'valor_unitario'
                };
                return [...prev, newSelection];
            } else {
                // Remove seleção (Selecionado -> Selecionar)
                return prev.filter(t => t.trecho_id !== trechoId);
            }
        });
    };
    
    const handleConfirm = () => {
        // Retorna apenas os trechos selecionados (que terão quantidade_passagens >= 1)
        onSelect(currentSelections);
        onOpenChange(false);
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
                        Selecione os trechos de passagens necessários com base nos contratos ativos para o ano {selectedYear}.
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
                                                    <TableHead className="w-[15%] text-center">Ação</TableHead> {/* Aumentando a largura para o botão */}
                                                    <TableHead className="w-[35%]">Trecho</TableHead>
                                                    <TableHead className="w-[25%]">Tipo</TableHead>
                                                    <TableHead className="w-[25%] text-right">Valor Unitário</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {diretriz.trechos.map(trecho => {
                                                    const isTrechoSelected = isSelected(trecho.id);
                                                    
                                                    return (
                                                        <TableRow key={trecho.id} className={cn(isTrechoSelected && "bg-green-500/10 hover:bg-green-500/20")}>
                                                            <TableCell className="text-center">
                                                                <Button
                                                                    size="sm"
                                                                    variant={isTrechoSelected ? "secondary" : "default"}
                                                                    onClick={() => handleSelectionToggle(diretriz, trecho)}
                                                                    className={cn(
                                                                        "w-full",
                                                                        isTrechoSelected ? "bg-green-600 hover:bg-green-700 text-white" : "bg-primary hover:bg-primary/90"
                                                                    )}
                                                                >
                                                                    {isTrechoSelected ? (
                                                                        <>
                                                                            <Check className="mr-2 h-4 w-4" />
                                                                            Selecionado
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Plus className="mr-2 h-4 w-4" />
                                                                            Selecionar
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell className="font-medium">
                                                                {trecho.origem} &rarr; {trecho.destino}
                                                            </TableCell>
                                                            <TableCell className="text-xs">
                                                                {trecho.tipo_transporte} ({trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'})
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {formatCurrency(trecho.valor)}
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
                    <div className="flex items-center justify-end w-full gap-2">
                        <Button 
                            type="button" 
                            onClick={handleConfirm}
                            disabled={isLoading || totalTrechosSelecionados === 0}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Confirmar Seleção ({totalTrechosSelecionados})
                        </Button>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancelar
                            </Button>
                        </DialogClose>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;