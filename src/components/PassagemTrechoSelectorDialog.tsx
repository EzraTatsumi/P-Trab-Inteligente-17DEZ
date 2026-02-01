import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plane, AlertTriangle, Check, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types'; // Importando Tables
import { formatCurrency, formatDate, formatCodug } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';

// Re-defining types based on Supabase schema to ensure all fields are present
type DiretrizPassagemRow = Tables<'diretrizes_passagens'>;
export type TrechoPassagem = {
    id: string;
    origem: string;
    destino: string;
    tipo_transporte: string;
    is_ida_volta: boolean;
    valor: number;
};

// Tipo de Diretriz com os trechos tipados corretamente
export interface DiretrizPassagem extends Omit<DiretrizPassagemRow, 'trechos'> {
    trechos: TrechoPassagem[];
}

// Define a estrutura de seleção de trecho que será retornada
export interface TrechoSelection extends TrechoPassagem {
    diretriz_id: string;
    om_detentora: string;
    ug_detentora: string;
    quantidade_passagens: number; // Quantidade solicitada para este trecho
    valor_unitario: number; // Adicionado para resolver o erro TS2353
    // Nota: O ID do trecho é herdado de TrechoPassagem (propriedade 'id')
}

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onSelect: (trechos: TrechoSelection[]) => void;
    initialSelections: TrechoSelection[];
    onAddContract: () => void; // Nova prop para lidar com o redirecionamento
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
        // O campo 'trechos' é armazenado como Json (array de TrechoPassagem)
        trechos: (d.trechos as unknown as TrechoPassagem[]) || [],
    })) as DiretrizPassagem[];
};

const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onSelect,
    initialSelections,
    onAddContract, // Recebendo a nova prop
}) => {
    const [currentSelections, setCurrentSelections] = useState<TrechoSelection[]>(initialSelections);
    // Inicializa o estado de colapso para que todos os contratos comecem FECHADOS
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
            
            // Garante que todos os contratos comecem fechados ao abrir o diálogo
            if (diretrizes) {
                const initialCollapseState: Record<string, boolean> = {};
                diretrizes.forEach(d => {
                    initialCollapseState[d.id] = false; // Começa fechado
                });
                setCollapseState(initialCollapseState);
            }
        }
    }, [open, initialSelections, diretrizes]);
    
    // Calcula o total de trechos selecionados
    const totalTrechosSelecionados = useMemo(() => {
        return currentSelections.length;
    }, [currentSelections]);

    const isSelected = (trechoId: string): boolean => {
        // Usa 'id' (herdado de TrechoPassagem) para verificar a seleção
        return currentSelections.some(t => t.id === trechoId);
    };

    const handleSelectionChange = (trechoId: string, isChecked: boolean, diretriz: DiretrizPassagem, trecho: TrechoPassagem) => {
        setCurrentSelections(prev => {
            // Usa 'id' para encontrar o índice existente
            const existingIndex = prev.findIndex(t => t.id === trechoId);
            
            if (isChecked) {
                // Adiciona seleção (se não existir)
                if (existingIndex === -1) {
                    const newSelection: TrechoSelection = {
                        ...trecho,
                        diretriz_id: diretriz.id,
                        om_detentora: diretriz.om_referencia,
                        ug_detentora: diretriz.ug_referencia,
                        quantidade_passagens: 1, // Assumimos 1 passagem ao selecionar
                        valor_unitario: trecho.valor, // Usar 'valor' do TrechoPassagem como 'valor_unitario'
                    };
                    return [...prev, newSelection];
                }
                // Se já existir, retorna o estado anterior (evita duplicação)
                return prev; 
            } else {
                // Remove seleção
                return prev.filter(t => t.id !== trechoId);
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
    
    const handleAddContractClick = () => {
        onOpenChange(false); // Fecha o diálogo
        onAddContract(); // Chama a função de redirecionamento
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
                                    open={collapseState[diretriz.id] ?? false} // Começa fechado
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
                                                    {/* Erros 2 e 3 corrigidos: data_inicio_vigencia e data_fim_vigencia agora existem no tipo DiretrizPassagem */}
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
                                                    <TableHead className="w-[5%]"></TableHead> {/* Checkbox */}
                                                    <TableHead className="w-[45%]">Trecho</TableHead>
                                                    <TableHead className="w-[25%]">Tipo</TableHead>
                                                    <TableHead className="w-[25%] text-right">Valor Unitário</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {diretriz.trechos.map(trecho => {
                                                    const isTrechoSelected = isSelected(trecho.id);
                                                    
                                                    // Função de toggle para a linha
                                                    const toggleSelection = () => {
                                                        handleSelectionChange(trecho.id, !isTrechoSelected, diretriz, trecho);
                                                    };

                                                    return (
                                                        <TableRow 
                                                            key={trecho.id} 
                                                            className={cn(
                                                                "cursor-pointer",
                                                                isTrechoSelected ? "bg-green-500/10 hover:bg-green-500/20" : "hover:bg-muted/50"
                                                            )}
                                                            onClick={toggleSelection}
                                                        >
                                                            <TableCell>
                                                                <Checkbox 
                                                                    checked={isTrechoSelected}
                                                                    // Previne que o clique no checkbox dispare o clique na linha duas vezes
                                                                    onCheckedChange={(checked) => {
                                                                        // O clique na linha já trata o toggle. 
                                                                        // Se o usuário clicar diretamente no checkbox, garantimos a consistência.
                                                                        handleSelectionChange(trecho.id, checked === true, diretriz, trecho);
                                                                    }}
                                                                    // Adiciona onClick para parar a propagação e evitar duplo toggle
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
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
                    <div className="flex items-center justify-between w-full gap-2">
                        {/* NOVO BOTÃO: Adicionar Contrato */}
                        <Button 
                            type="button" 
                            variant="link" 
                            onClick={handleAddContractClick}
                            className="gap-2"
                        >
                            <PlusCircle className="h-4 w-4" />
                            Adicionar Contrato/Trecho
                        </Button>
                        
                        {/* Botões de Ação Principal */}
                        <div className="flex gap-2">
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
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;