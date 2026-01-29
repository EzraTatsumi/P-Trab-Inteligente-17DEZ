import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Plane, Bus, Ship, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from '@/types/diretrizesPassagens';
import { Tables } from '@/integrations/supabase/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatCodug } from '@/lib/formatUtils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// Tipo de retorno simplificado para o formulário
interface SelectedTrecho {
    om_detentora: string;
    ug_detentora: string;
    diretriz_id: string;
    trecho_id: string;
    origem: string;
    destino: string;
    tipo_transporte: TipoTransporte;
    is_ida_volta: boolean;
    valor_unitario: number;
}

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (trecho: SelectedTrecho) => void;
    selectedYear: number;
}

const getTransportIcon = (tipo: TipoTransporte) => {
    switch (tipo) {
        case 'AÉREO': return <Plane className="h-4 w-4 text-blue-600" />;
        case 'TERRESTRE': return <Bus className="h-4 w-4 text-green-600" />;
        case 'FLUVIAL': return <Ship className="h-4 w-4 text-cyan-600" />;
        default: return null;
    }
};

const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({ open, onOpenChange, onSelect, selectedYear }) => {
    const { user } = useSession();
    const [selectedDiretrizId, setSelectedDiretrizId] = useState<string | null>(null);
    const [selectedTrecho, setSelectedTrecho] = useState<TrechoPassagem | null>(null);

    // Fetch Diretrizes de Passagens para o ano selecionado
    const { data: diretrizes, isLoading: isLoadingDiretrizes, isError } = useQuery<DiretrizPassagem[]>({
        queryKey: ['diretrizesPassagens', user?.id, selectedYear],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('diretrizes_passagens')
                .select('*')
                .eq('user_id', user.id)
                .eq('ano_referencia', selectedYear)
                .eq('ativo', true)
                .order('om_referencia', { ascending: true });
            
            if (error) throw error;
            return data as DiretrizPassagem[];
        },
        enabled: open && !!user?.id && !!selectedYear,
    });

    // Reset state when dialog opens/closes
    useEffect(() => {
        if (open) {
            setSelectedDiretrizId(null);
            setSelectedTrecho(null);
        }
    }, [open]);

    const currentDiretriz = useMemo(() => {
        return diretrizes?.find(d => d.id === selectedDiretrizId) || null;
    }, [diretrizes, selectedDiretrizId]);

    const handleSelectDiretriz = (id: string) => {
        setSelectedDiretrizId(id);
        setSelectedTrecho(null); // Reset trecho ao mudar a diretriz
    };

    const handleSelectTrecho = (trecho: TrechoPassagem) => {
        setSelectedTrecho(trecho);
    };

    const handleConfirm = () => {
        if (currentDiretriz && selectedTrecho) {
            const result: SelectedTrecho = {
                om_detentora: currentDiretriz.om_referencia,
                ug_detentora: currentDiretriz.ug_referencia,
                diretriz_id: currentDiretriz.id,
                trecho_id: selectedTrecho.id,
                origem: selectedTrecho.origem,
                destino: selectedTrecho.destino,
                tipo_transporte: selectedTrecho.tipo_transporte,
                is_ida_volta: selectedTrecho.is_ida_volta,
                valor_unitario: selectedTrecho.valor,
            };
            onSelect(result);
            onOpenChange(false);
        }
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy');
        } catch {
            return 'Inválida';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Selecionar Trecho de Passagem</DialogTitle>
                    <DialogDescription>
                        Escolha a OM Contratante e o trecho desejado para a solicitação de passagens.
                    </DialogDescription>
                </DialogHeader>

                {isLoadingDiretrizes ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2">Carregando contratos...</span>
                    </div>
                ) : isError || !diretrizes || diretrizes.length === 0 ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <CardTitle>Nenhum Contrato Ativo</CardTitle>
                        <p className="text-sm">Não foram encontradas diretrizes de passagens ativas para o ano {selectedYear}. Cadastre-as em Configurações > Custos Operacionais.</p>
                    </Alert>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Coluna 1: Seleção da OM Contratante */}
                        <Card className="h-full">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">1. OM Contratante (Detentora do Recurso)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={selectedDiretrizId || ''} onValueChange={handleSelectDiretriz}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione a OM Contratante" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {diretrizes.map(d => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.om_referencia} ({formatCodug(d.ug_referencia)}) - Pregão {d.numero_pregao || 'N/A'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                
                                {currentDiretriz && (
                                    <div className="mt-3 text-xs text-muted-foreground space-y-1 p-2 border rounded-md">
                                        <p><strong>Pregão:</strong> {currentDiretriz.numero_pregao || 'N/A'}</p>
                                        <p><strong>Vigência:</strong> {formatDate(currentDiretriz.data_inicio_vigencia)} a {formatDate(currentDiretriz.data_fim_vigencia)}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Coluna 2: Seleção do Trecho */}
                        <Card className="h-full">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">2. Trecho Disponível</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {currentDiretriz ? (
                                    currentDiretriz.trechos.length > 0 ? (
                                        currentDiretriz.trechos.map(trecho => (
                                            <div 
                                                key={trecho.id}
                                                className={cn(
                                                    "flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all",
                                                    selectedTrecho?.id === trecho.id ? "border-primary ring-2 ring-primary/50 bg-primary/5" : "hover:bg-muted/50"
                                                )}
                                                onClick={() => handleSelectTrecho(trecho)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {getTransportIcon(trecho.tipo_transporte)}
                                                    <div className="text-sm font-medium">
                                                        {trecho.origem} &rarr; {trecho.destino}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block font-bold text-base text-foreground">
                                                        {formatCurrency(trecho.valor)}
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        {trecho.is_ida_volta ? 'Ida e Volta' : 'Somente Ida'} ({trecho.tipo_transporte})
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum trecho cadastrado neste contrato.</p>
                                    )
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Selecione uma OM Contratante.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button onClick={handleConfirm} disabled={!selectedTrecho || isLoadingDiretrizes}>
                        <Check className="mr-2 h-4 w-4" />
                        Confirmar Seleção
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;