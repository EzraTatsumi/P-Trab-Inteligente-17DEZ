import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Plus, AlertCircle, Zap, Droplet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorUtils";
import { formatCurrency, formatNumber } from "@/lib/formatUtils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoriaConcessionaria, DiretrizConcessionaria, CATEGORIAS_CONCESSIONARIA } from "@/types/diretrizesConcessionaria";
import { DiretrizSelection } from "@/lib/concessionariaUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ConcessionariaDiretrizSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (diretrizes: DiretrizSelection[]) => void;
    selectedYear: number;
    initialSelections: DiretrizSelection[];
    onAddContract: () => void;
}

const fetchDiretrizes = async (year: number): Promise<DiretrizConcessionaria[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado.");

    const { data, error } = await supabase
        .from('diretrizes_concessionaria')
        .select('*')
        .eq('user_id', user.id)
        .eq('ano_referencia', year)
        .order('categoria', { ascending: true })
        .order('nome_concessionaria', { ascending: true });

    if (error) throw error;
    
    // Ensure numeric types are correct
    return (data || []).map(d => ({
        ...d,
        consumo_pessoa_dia: Number(d.consumo_pessoa_dia),
        custo_unitario: Number(d.custo_unitario),
    })) as DiretrizConcessionaria[];
};

const ConcessionariaDiretrizSelectorDialog: React.FC<ConcessionariaDiretrizSelectorDialogProps> = ({
    open,
    onOpenChange,
    onSelect,
    selectedYear,
    initialSelections,
    onAddContract,
}) => {
    const { data: availableDiretrizes, isLoading, error } = useQuery<DiretrizConcessionaria[]>({
        queryKey: ['concessionariaDiretrizes', selectedYear],
        queryFn: () => fetchDiretrizes(selectedYear),
        enabled: open,
    });
    
    const [selectedDiretrizIds, setSelectedDiretrizIds] = useState<Set<string>>(new Set());
    const [selectedTab, setSelectedTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);

    useEffect(() => {
        if (open) {
            // Initialize selected IDs from initialSelections
            const initialIds = new Set(initialSelections.map(d => d.id));
            setSelectedDiretrizIds(initialIds);
        }
    }, [open, initialSelections]);

    const handleToggleSelection = (diretriz: DiretrizConcessionaria) => {
        setSelectedDiretrizIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(diretriz.id)) {
                newSet.delete(diretriz.id);
            } else {
                newSet.add(diretriz.id);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        if (!availableDiretrizes) return;

        const selectedItems: DiretrizSelection[] = availableDiretrizes
            .filter(d => selectedDiretrizIds.has(d.id))
            .map(d => d as DiretrizSelection); 

        onSelect(selectedItems);
        onOpenChange(false);
    };
    
    const groupedDiretrizes = useMemo(() => {
        return (availableDiretrizes || []).reduce((acc, diretriz) => {
            const category = diretriz.categoria as CategoriaConcessionaria;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(diretriz);
            return acc;
        }, {} as Record<CategoriaConcessionaria, DiretrizConcessionaria[]>);
    }, [availableDiretrizes]);
    
    const renderDiretrizTable = (category: CategoriaConcessionaria) => {
        const diretrizes = groupedDiretrizes[category] || [];
        
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-muted-foreground">Carregando diretrizes...</span>
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="flex items-center justify-center h-32 text-destructive">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <span className="text-sm">Erro ao carregar diretrizes: {sanitizeError(error)}</span>
                </div>
            );
        }

        if (diretrizes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <span className="text-sm">Nenhuma diretriz de {category} encontrada para o ano {selectedYear}.</span>
                    <Button 
                        type="button" 
                        variant="link" 
                        onClick={onAddContract} 
                        className="mt-2 h-8 text-xs"
                    >
                        <Plus className="mr-1 h-3 w-3" />
                        Adicionar Contrato
                    </Button>
                </div>
            );
        }
        
        const unidade = category === 'Água/Esgoto' ? 'm³' : 'kWh';

        return (
            <div className="max-h-[400px] overflow-y-auto border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Concessionária</TableHead>
                            <TableHead className="text-center">Consumo/Pessoa/Dia ({unidade})</TableHead>
                            <TableHead className="text-right">Custo Unitário ({unidade})</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {diretrizes.map(diretriz => (
                            <TableRow 
                                key={diretriz.id} 
                                onClick={() => handleToggleSelection(diretriz)}
                                className="cursor-pointer hover:bg-muted/50"
                            >
                                <TableCell>
                                    <Checkbox 
                                        checked={selectedDiretrizIds.has(diretriz.id)}
                                        onCheckedChange={() => handleToggleSelection(diretriz)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">
                                    {diretriz.nome_concessionaria}
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {diretriz.fonte_custo || 'Fonte de Custo não informada'}
                                    </p>
                                </TableCell>
                                <TableCell className="text-center">
                                    {formatNumber(diretriz.consumo_pessoa_dia, 4)}
                                </TableCell>
                                <TableCell className="text-right">
                                    {formatCurrency(diretriz.custo_unitario)}
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
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Droplet className="h-5 w-5 text-primary" />
                        Selecionar Diretrizes de Concessionária ({selectedYear})
                    </DialogTitle>
                    <DialogDescription>
                        Selecione os contratos de concessionária (Água/Esgoto e Energia Elétrica) que serão utilizados no cálculo.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-hidden space-y-4">
                    <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as CategoriaConcessionaria)}>
                        <TabsList className="grid w-full grid-cols-2">
                            {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                                    {cat === 'Água/Esgoto' ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                    {cat}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        
                        {CATEGORIAS_CONCESSIONARIA.map(cat => (
                            <TabsContent key={cat} value={cat} className="mt-4">
                                {renderDiretrizTable(cat)}
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:items-center pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2 sm:mb-0">
                        {selectedDiretrizIds.size} contrato(s) selecionado(s).
                    </p>
                    <Button 
                        type="button" 
                        onClick={handleConfirm} 
                        disabled={selectedDiretrizIds.size === 0 || isLoading}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizSelectorDialog;