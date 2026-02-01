import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, Plus, AlertCircle, Zap, Droplet } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/formatUtils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIAS_CONCESSIONARIA, CategoriaConcessionaria, DiretrizConcessionaria } from "@/types/diretrizesConcessionaria";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Tipo de seleção que será retornado ao formulário principal
export interface ConcessionariaSelection extends DiretrizConcessionaria {
    // A diretriz completa já contém todas as informações necessárias (consumo, custo, etc.)
}

interface ConcessionariaDiretrizSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (selections: ConcessionariaSelection[]) => void;
    selectedYear: number;
    initialSelections: ConcessionariaSelection[];
    onAddContract: () => void;
}

const fetchDiretrizesConcessionaria = async (year: number): Promise<DiretrizConcessionaria[]> => {
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
    return (data || []).map((d: Tables<'diretrizes_concessionaria'>) => ({
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
    const [selectedDiretrizes, setSelectedDiretrizes] = useState<ConcessionariaSelection[]>(initialSelections);
    const [selectedTab, setSelectedTab] = useState<CategoriaConcessionaria>(CATEGORIAS_CONCESSIONARIA[0]);

    const { data: allDiretrizes, isLoading, isError } = useQuery<DiretrizConcessionaria[]>({
        queryKey: ['diretrizesConcessionaria', selectedYear],
        queryFn: () => fetchDiretrizesConcessionaria(selectedYear),
        enabled: open,
    });
    
    // Reset state when dialog opens/closes
    useEffect(() => {
        if (open) {
            setSelectedDiretrizes(initialSelections);
        }
    }, [open, initialSelections]);

    const handleToggleDiretriz = (diretriz: DiretrizConcessionaria) => {
        const isSelected = selectedDiretrizes.some(d => d.id === diretriz.id);
        
        // Concessionária é um item único por categoria.
        // Se o usuário selecionar uma nova diretriz na mesma categoria, a anterior é substituída.
        
        if (isSelected) {
            // Remove a diretriz
            setSelectedDiretrizes(prev => prev.filter(d => d.id !== diretriz.id));
        } else {
            // Verifica se já existe uma diretriz da mesma categoria
            const existingIndex = selectedDiretrizes.findIndex(d => d.categoria === diretriz.categoria);
            
            const newSelection: ConcessionariaSelection = diretriz as ConcessionariaSelection;
            
            if (existingIndex !== -1) {
                // Substitui a existente
                setSelectedDiretrizes(prev => {
                    const newArray = [...prev];
                    newArray[existingIndex] = newSelection;
                    return newArray;
                });
            } else {
                // Adiciona nova
                setSelectedDiretrizes(prev => [...prev, newSelection]);
            }
        }
    };

    const handleConfirm = () => {
        if (selectedDiretrizes.length === 0) {
            toast.warning("Selecione pelo menos uma diretriz de concessionária.");
            return;
        }
        onSelect(selectedDiretrizes);
        onOpenChange(false);
    };
    
    const filteredDiretrizes = useMemo(() => {
        return allDiretrizes?.filter(d => d.categoria === selectedTab) || [];
    }, [allDiretrizes, selectedTab]);
    
    const isDiretrizSelected = (id: string) => selectedDiretrizes.some(d => d.id === id);
    
    const selectedCategories = useMemo(() => {
        return new Set(selectedDiretrizes.map(d => d.categoria));
    }, [selectedDiretrizes]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>
                        Selecionar Diretrizes de Concessionária ({selectedYear})
                    </DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto space-y-4 p-1">
                    
                    {isError && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Erro ao carregar diretrizes</AlertTitle>
                            <AlertDescription>
                                Não foi possível carregar as diretrizes de concessionária para o ano {selectedYear}. Verifique as configurações.
                            </AlertDescription>
                        </Alert>
                    )}
                    
                    {isLoading ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as CategoriaConcessionaria)}>
                            <TabsList className="grid w-full grid-cols-2">
                                {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                    <TabsTrigger key={cat} value={cat} className="flex items-center gap-2">
                                        {cat === 'Água/Esgoto' ? <Droplet className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                                        {cat}
                                        {selectedCategories.has(cat) && <Check className="h-4 w-4 text-green-500" />}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            
                            {CATEGORIAS_CONCESSIONARIA.map(cat => (
                                <TabsContent key={cat} value={cat} className="mt-4">
                                    <div className="space-y-3">
                                        {filteredDiretrizes.length === 0 ? (
                                            <Card className="p-4 text-center text-muted-foreground">
                                                Nenhuma diretriz de {cat} cadastrada para o ano {selectedYear}.
                                            </Card>
                                        ) : (
                                            filteredDiretrizes.map(d => {
                                                const isSelected = isDiretrizSelected(d.id);
                                                return (
                                                    <Card 
                                                        key={d.id} 
                                                        className={cn(
                                                            "cursor-pointer transition-all hover:shadow-md",
                                                            isSelected ? "border-2 border-primary bg-primary/5" : "border"
                                                        )}
                                                        onClick={() => handleToggleDiretriz(d)}
                                                    >
                                                        <CardContent className="p-4 flex justify-between items-center">
                                                            <div className="space-y-1">
                                                                <h4 className="font-semibold text-base">
                                                                    {d.nome_concessionaria}
                                                                </h4>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Consumo: {d.consumo_pessoa_dia} {d.unidade_custo}/pessoa/dia | Custo Unitário: {formatCurrency(d.custo_unitario)}
                                                                </p>
                                                            </div>
                                                            {isSelected ? (
                                                                <Check className="h-6 w-6 text-primary" />
                                                            ) : (
                                                                <Plus className="h-6 w-6 text-muted-foreground" />
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })
                                        )}
                                    </div>
                                </TabsContent>
                            ))}
                        </Tabs>
                    )}
                    
                    <div className="flex justify-end pt-4 border-t mt-4">
                        <Button type="button" variant="link" onClick={onAddContract}>
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar/Editar Diretrizes de Concessionária
                        </Button>
                    </div>
                </div>
                
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedDiretrizes.length === 0 || isLoading}>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção ({selectedDiretrizes.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ConcessionariaDiretrizSelectorDialog;