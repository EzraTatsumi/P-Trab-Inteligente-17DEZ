import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, XCircle, Zap, Droplet, AlertCircle, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatCodug } from "@/lib/formatUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    DiretrizConcessionaria, 
    ConcessionariaDiretrizSelection, 
    CATEGORIAS_CONCESSIONARIA, 
    CategoriaConcessionaria 
} from "@/types/diretrizesConcessionaria";
import { cn } from "@/lib/utils";

interface ConcessionariaDiretrizSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (selections: ConcessionariaDiretrizSelection[]) => void;
    selectedYear: number;
    initialSelections: ConcessionariaDiretrizSelection[];
    onAddContract: () => void;
    efetivo: number;
    diasOperacao: number;
}

const ConcessionariaDiretrizSelectorDialog: React.FC<ConcessionariaDiretrizSelectorDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
    selectedYear,
    initialSelections,
    onAddContract,
    efetivo,
    diasOperacao,
}) => {
    const [selectedCategory, setSelectedCategory] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);
    const [selections, setSelections] = useState<ConcessionariaDiretrizSelection[]>([]);
    
    // Estado temporário para armazenar a quantidade manual de unidades (m³ ou kWh)
    const [manualQuantity, setManualQuantity] = useState<Record<string, number>>({});

    // Carrega as diretrizes de concessionária para o ano selecionado
    const { data: diretrizes, isLoading } = useQuery<DiretrizConcessionaria[]>({
        queryKey: ['concessionariaDiretrizes', selectedYear],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            
            const { data, error } = await supabase
                .from('diretrizes_concessionaria')
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', selectedYear)
                .order('categoria', { ascending: true })
                .order('nome_concessionaria', { ascending: true });
                
            if (error) throw error;
            
            return (data || []) as DiretrizConcessionaria[];
        },
        enabled: open && !!selectedYear,
    });
    
    // Inicializa as seleções e as quantidades manuais quando o diálogo abre
    useEffect(() => {
        if (open) {
            setSelections(initialSelections);
            
            const initialManualQuantities: Record<string, number> = {};
            initialSelections.forEach(s => {
                // Se a quantidade solicitada for diferente da quantidade calculada automaticamente,
                // assumimos que foi inserida manualmente.
                const calculatedQuantity = s.consumo_pessoa_dia * efetivo * diasOperacao;
                if (Math.abs(s.quantidade_solicitada - calculatedQuantity) > 0.01) {
                    initialManualQuantities[s.id] = s.quantidade_solicitada;
                }
            });
            setManualQuantity(initialManualQuantities);
        }
    }, [open, initialSelections, efetivo, diasOperacao]);

    // Filtra as diretrizes pela categoria selecionada
    const filteredDiretrizes = useMemo(() => {
        return diretrizes?.filter(d => d.categoria === selectedCategory) || [];
    }, [diretrizes, selectedCategory]);
    
    // Calcula a quantidade automática (Efetivo * Dias * Consumo/Pessoa/Dia)
    const calculateAutomaticQuantity = (diretriz: DiretrizConcessionaria): number => {
        if (efetivo <= 0 || diasOperacao <= 0) return 0;
        return diretriz.consumo_pessoa_dia * efetivo * diasOperacao;
    };

    // Handler para selecionar/desselecionar uma diretriz
    const handleToggleSelection = (diretriz: DiretrizConcessionaria) => {
        setSelections(prev => {
            const existingIndex = prev.findIndex(s => s.id === diretriz.id);
            
            if (existingIndex !== -1) {
                // Desselecionar
                setManualQuantity(mq => {
                    const newMq = { ...mq };
                    delete newMq[diretriz.id];
                    return newMq;
                });
                return prev.filter(s => s.id !== diretriz.id);
            } else {
                // Selecionar
                const automaticQuantity = calculateAutomaticQuantity(diretriz);
                
                const newSelection: ConcessionariaDiretrizSelection = {
                    id: diretriz.id,
                    categoria: diretriz.categoria as CategoriaConcessionaria,
                    nome_concessionaria: diretriz.nome_concessionaria,
                    consumo_pessoa_dia: diretriz.consumo_pessoa_dia,
                    custo_unitario: diretriz.custo_unitario,
                    unidade_custo: diretriz.unidade_custo,
                    quantidade_solicitada: automaticQuantity, // Inicia com o cálculo automático
                };
                return [...prev, newSelection];
            }
        });
    };
    
    // Handler para atualizar a quantidade manual
    const handleManualQuantityChange = (diretrizId: string, rawValue: string) => {
        const numericValue = parseFloat(rawValue.replace(',', '.')) || 0;
        
        setManualQuantity(prev => ({
            ...prev,
            [diretrizId]: numericValue,
        }));
        
        // Atualiza o estado de selections imediatamente
        setSelections(prev => prev.map(s => {
            if (s.id === diretrizId) {
                return { ...s, quantidade_solicitada: numericValue };
            }
            return s;
        }));
    };

    // Handler para restaurar o cálculo automático
    const handleRestoreAutomatic = (diretriz: DiretrizConcessionaria) => {
        const automaticQuantity = calculateAutomaticQuantity(diretriz);
        
        setManualQuantity(prev => {
            const newMq = { ...prev };
            delete newMq[diretriz.id];
            return newMq;
        });
        
        setSelections(prev => prev.map(s => {
            if (s.id === diretriz.id) {
                return { ...s, quantidade_solicitada: automaticQuantity };
            }
            return s;
        }));
    };

    const handleConfirm = () => {
        if (selections.length === 0) {
            toast.warning("Selecione pelo menos uma diretriz de concessionária.");
            return;
        }
        
        // Validação final: garantir que todas as quantidades sejam > 0
        const invalidSelections = selections.filter(s => s.quantidade_solicitada <= 0);
        if (invalidSelections.length > 0) {
            toast.error("A quantidade solicitada para todas as diretrizes deve ser maior que zero.");
            return;
        }
        
        onSelect(selections);
        onOpenChange(false);
    };
    
    const selectedDiretrizIds = useMemo(() => selections.map(s => s.id), [selections]);
    
    const totalCost = useMemo(() => {
        return selections.reduce((sum, s) => sum + (s.quantidade_solicitada * s.custo_unitario), 0);
    }, [selections]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Droplet className="h-5 w-5 text-blue-500" />
                        Selecionar Diretrizes de Concessionária ({selectedYear})
                    </DialogTitle>
                    <DialogDescription>
                        Selecione os contratos de concessionária (Água/Esgoto e Energia Elétrica) aplicáveis ao P Trab.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    
                    {/* Alerta de Dados de Cálculo */}
                    {(efetivo <= 0 || diasOperacao <= 0) && (
                        <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-md flex items-center gap-2 text-sm text-yellow-800">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>Preencha o Efetivo e o Período (Dias) no formulário principal para calcular o consumo automaticamente.</span>
                        </div>
                    )}
                    
                    <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as CategoriaConcessionaria)}>
                        <TabsList className="grid w-full grid-cols-2">
                            {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                                    {cat === 'Água/Esgoto' ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                    {cat}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        
                        {CATEGORIAS_CONCESSIONARIA.map(cat => (
                            <TabsContent key={cat} value={cat}>
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-40">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                ) : filteredDiretrizes.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground border rounded-md">
                                        Nenhuma diretriz de {cat} cadastrada para o ano {selectedYear}.
                                        <Button variant="link" onClick={onAddContract} className="p-0 h-auto ml-1">
                                            Clique aqui para cadastrar.
                                        </Button>
                                    </div>
                                ) : (
                                    <Table className="border rounded-md overflow-hidden">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[50px]">Sel.</TableHead>
                                                <TableHead>Concessionária / Consumo</TableHead>
                                                <TableHead className="text-right">Custo Unitário</TableHead>
                                                <TableHead className="w-[200px] text-center">Qtd Solicitada ({filteredDiretrizes[0]?.unidade_custo})</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredDiretrizes.map(diretriz => {
                                                const isSelected = selectedDiretrizIds.includes(diretriz.id);
                                                const selection = selections.find(s => s.id === diretriz.id);
                                                const automaticQuantity = calculateAutomaticQuantity(diretriz);
                                                const isManual = !!manualQuantity[diretriz.id];
                                                
                                                const totalCostDiretriz = (selection?.quantidade_solicitada || 0) * diretriz.custo_unitario;

                                                return (
                                                    <TableRow key={diretriz.id} className={cn(isSelected && "bg-primary/5")}>
                                                        <TableCell>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleSelection(diretriz)}
                                                                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <p className="font-medium">{diretriz.nome_concessionaria}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Consumo/Pessoa/Dia: {diretriz.consumo_pessoa_dia} {diretriz.unidade_custo}/dia
                                                            </p>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {formatCurrency(diretriz.custo_unitario)} / {diretriz.unidade_custo}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {isSelected && (
                                                                <div className="space-y-1">
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        min={0}
                                                                        value={isManual ? manualQuantity[diretriz.id] : (selection?.quantidade_solicitada || 0).toFixed(2)}
                                                                        onChange={(e) => handleManualQuantityChange(diretriz.id, e.target.value)}
                                                                        className="w-full text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                    />
                                                                    {isManual && (
                                                                        <Button 
                                                                            variant="link" 
                                                                            size="xs" 
                                                                            onClick={() => handleRestoreAutomatic(diretriz)}
                                                                            className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                                                                        >
                                                                            (Restaurar cálculo automático: {automaticQuantity.toFixed(2)} {diretriz.unidade_custo})
                                                                        </Button>
                                                                    )}
                                                                    <p className="text-xs font-semibold mt-1">
                                                                        Total: {formatCurrency(totalCostDiretriz)}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </TabsContent>
                        ))}
                    </Tabs>
                    
                    {/* Resumo da Seleção */}
                    {selections.length > 0 && (
                        <div className="border-t pt-4 flex justify-between items-center">
                            <span className="font-semibold">Total de Diretrizes Selecionadas: {selections.length}</span>
                            <span className="font-extrabold text-lg text-primary">Custo Estimado: {formatCurrency(totalCost)}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={selections.length === 0}>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizSelectorDialog;