import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Check, Plane } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatCodug } from "@/lib/formatUtils";
import { DiretrizPassagem, TrechoPassagem, TipoTransporte } from "@/types/diretrizesPassagens";
import { useSession } from "@/components/SessionContextProvider";
import { cn } from "@/lib/utils";

interface PassagemTrechoSelectorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedYear: number;
    onSelect: (trecho: {
        om_detentora: string;
        ug_detentora: string;
        diretriz_id: string;
        trecho_id: string;
        origem: string;
        destino: string;
        tipo_transporte: TipoTransporte;
        is_ida_volta: boolean;
        valor_unitario: number;
    }) => void;
}

const fetchDiretrizesPassagens = async (userId: string, year: number): Promise<DiretrizPassagem[]> => {
    const { data, error } = await supabase
        .from('diretrizes_passagens')
        .select('*')
        .eq('user_id', userId)
        .eq('ano_referencia', year)
        .eq('ativo', true)
        .order('om_referencia', { ascending: true });
        
    if (error) throw new Error("Falha ao carregar diretrizes de passagens.");
    
    return data as DiretrizPassagem[];
};

const PassagemTrechoSelectorDialog: React.FC<PassagemTrechoSelectorDialogProps> = ({
    open,
    onOpenChange,
    selectedYear,
    onSelect,
}) => {
    const { user } = useSession();
    const [selectedTrecho, setSelectedTrecho] = useState<TrechoPassagem & { diretriz_id: string, om_referencia: string, ug_referencia: string, data_inicio_vigencia: string | null, data_fim_vigencia: string | null } | null>(null);
    const [selectedDiretriz, setSelectedDiretriz] = useState<DiretrizPassagem | null>(null);

    const { data: diretrizes, isLoading, isError } = useQuery({
        queryKey: ['diretrizesPassagens', user?.id, selectedYear],
        queryFn: () => fetchDiretrizesPassagens(user!.id, selectedYear),
        enabled: open && !!user?.id && !!selectedYear,
    });
    
    // Reset state when dialog opens/closes
    if (!open && (selectedTrecho || selectedDiretriz)) {
        setSelectedTrecho(null);
        setSelectedDiretriz(null);
    }

    const allTrechos = useMemo(() => {
        if (!diretrizes) return [];
        
        return diretrizes.flatMap(diretriz => 
            (diretriz.trechos as TrechoPassagem[]).map(trecho => ({
                ...trecho,
                diretriz_id: diretriz.id,
                om_referencia: diretriz.om_referencia,
                ug_referencia: diretriz.ug_referencia,
                numero_pregao: diretriz.numero_pregao,
                data_inicio_vigencia: diretriz.data_inicio_vigencia,
                data_fim_vigencia: diretriz.data_fim_vigencia,
            }))
        );
    }, [diretrizes]);
    
    const handleSelectTrecho = (trecho: TrechoPassagem & { diretriz_id: string, om_referencia: string, ug_referencia: string, data_inicio_vigencia: string | null, data_fim_vigencia: string | null }) => {
        setSelectedTrecho(trecho);
        setSelectedDiretriz(diretrizes?.find(d => d.id === trecho.diretriz_id) || null);
    };
    
    const handleConfirmSelection = () => {
        if (!selectedTrecho || !selectedDiretriz) return;
        
        onSelect({
            om_detentora: selectedDiretriz.om_referencia,
            ug_detentora: selectedDiretriz.ug_referencia,
            diretriz_id: selectedDiretriz.id,
            trecho_id: selectedTrecho.id,
            origem: selectedTrecho.origem,
            destino: selectedTrecho.destino,
            tipo_transporte: selectedTrecho.tipo_transporte,
            is_ida_volta: selectedTrecho.is_ida_volta,
            valor_unitario: selectedTrecho.valor,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plane className="h-5 w-5 text-primary" />
                        Seleção de Trecho de Passagem
                    </DialogTitle>
                    <DialogDescription>
                        Selecione um trecho de passagem ativo de um contrato cadastrado para o ano {selectedYear}.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground mt-2">Carregando contratos...</p>
                    </div>
                ) : isError || allTrechos.length === 0 ? (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Nenhum Contrato Ativo</AlertTitle>
                        <p className="text-sm">Não foram encontradas diretrizes de passagens ativas para o ano {selectedYear}. Cadastre-as em Configurações > Custos Operacionais.</p>
                    </Alert>
                ) : (
                    <div className="space-y-4">
                        <div className="max-h-[50vh] overflow-y-auto border rounded-lg">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10">
                                    <TableRow>
                                        <TableHead className="w-[10%]">Tipo</TableHead>
                                        <TableHead className="w-[30%]">Trecho</TableHead>
                                        <TableHead className="w-[15%] text-center">Valor</TableHead>
                                        <TableHead className="w-[25%]">Contratante (OM)</TableHead>
                                        <TableHead className="w-[20%]">Vigência</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allTrechos.map((trecho, index) => (
                                        <TableRow 
                                            key={index} 
                                            onClick={() => handleSelectTrecho(trecho)}
                                            className={cn(
                                                "cursor-pointer hover:bg-muted/50",
                                                selectedTrecho?.id === trecho.id && "bg-primary/10 hover:bg-primary/20 border-l-4 border-primary"
                                            )}
                                        >
                                            <TableCell className="font-medium text-xs">
                                                {trecho.tipo_transporte}
                                                <div className="text-muted-foreground text-[10px]">{trecho.is_ida_volta ? 'Ida/Volta' : 'Somente Ida'}</div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {trecho.origem} &rarr; {trecho.destino}
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-sm">
                                                {formatCurrency(trecho.valor)}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {trecho.om_referencia} ({trecho.numero_pregao})
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatDate(trecho.data_inicio_vigencia)} - {formatDate(trecho.data_fim_vigencia)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        
                        {selectedTrecho && (
                            <Alert variant="default" className="bg-primary/10 border-primary/50">
                                <Check className="h-4 w-4 text-primary" />
                                <AlertTitle>Trecho Selecionado:</AlertTitle>
                                <AlertDescription className="text-sm font-medium">
                                    {selectedTrecho.origem} &rarr; {selectedTrecho.destino} ({selectedTrecho.tipo_transporte}) - {formatCurrency(selectedTrecho.valor)}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Contratante: {selectedDiretriz?.om_referencia} (UG: {formatCodug(selectedDiretriz?.ug_referencia)})
                                    </p>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirmSelection} disabled={!selectedTrecho || isLoading}>
                        Confirmar Seleção
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PassagemTrechoSelectorDialog;