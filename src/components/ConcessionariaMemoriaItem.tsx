import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2, Droplet, Zap } from "lucide-react";
import { ConcessionariaRegistro, generateConcessionariaMemoriaCalculo } from "@/lib/concessionariaUtils";
import { formatCodug, formatCurrency } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface ConcessionariaMemoriaItemProps {
    registro: ConcessionariaRegistro;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (registro: ConcessionariaRegistro, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConcessionariaMemoriaItem: React.FC<ConcessionariaMemoriaItemProps> = ({
    registro,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica,
}) => {
    const isEditing = editingMemoriaId === registro.id;
    const hasCustomMemoria = !!registro.detalhamento_customizado;
    
    // 1. Gerar a memória automática individual
    const memoriaAutomatica = useMemo(() => {
        return generateConcessionariaMemoriaCalculo(registro);
    }, [registro]);

    // 2. Determinar a memória a ser exibida/editada
    let memoriaExibida = memoriaAutomatica;
    
    if (isEditing) {
        memoriaExibida = memoriaEdit;
    } else if (hasCustomMemoria) {
        memoriaExibida = registro.detalhamento_customizado!;
    }
    
    const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao || registro.ug_detentora !== registro.ug;
    const isAgua = registro.categoria === 'Água/Esgoto';
    
    // Handler local para iniciar a edição, passando a memória correta
    const handleLocalIniciarEdicao = () => {
        const memoriaParaEdicao = hasCustomMemoria 
            ? registro.detalhamento_customizado! 
            : memoriaAutomatica; 
            
        handleIniciarEdicaoMemoria(registro, memoriaParaEdicao);
    };

    // Extrai o nome da concessionária do detalhamento
    const detalhamentoParts = registro.detalhamento?.split(' - ');
    const nomeConcessionaria = detalhamentoParts && detalhamentoParts.length > 1 ? detalhamentoParts[1] : 'Detalhe não disponível';
    
    // Define a cor do badge da categoria
    const categoryBadgeVariant = isAgua ? "default" : "secondary";
    const categoryBadgeClass = isAgua ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-yellow-600 hover:bg-yellow-700 text-white";

    return (
        <Card className="space-y-3 p-4 rounded-lg bg-background shadow-md">
            
            <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-foreground">
                            {registro.organizacao} (UG: {formatCodug(registro.ug)})
                        </h4>
                        <Badge 
                            className={cn("text-xs font-semibold", categoryBadgeClass)}
                        >
                            {registro.categoria}
                        </Badge>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada Manualmente
                            </Badge>
                        )}
                    </div>
                    {isDifferentOmInMemoria && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-3 w-3 text-red-600" />
                            <span className="text-[10px] font-medium text-red-600">
                                Destino Recurso: {registro.om_detentora} ({formatCodug(registro.ug_detentora)})
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                        <Button
                            type="button" 
                            size="sm"
                            variant="outline"
                            onClick={handleLocalIniciarEdicao}
                            disabled={isSaving || !isPTrabEditable}
                            className="gap-2 h-8 text-sm"
                        >
                            <Pencil className="h-4 w-4" />
                            Editar Memória
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button" 
                                size="sm"
                                variant="default"
                                onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                disabled={isSaving}
                                className="gap-2 h-8 text-sm"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Salvar
                            </Button>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                                className="gap-2 h-8 text-sm"
                            >
                                <XCircle className="h-4 w-4" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Área de Texto da Memória */}
            <CardContent className="p-0 pt-3">
                {/* Exibe o nome da concessionária e o total dentro do corpo da memória */}
                <p className="text-sm font-medium mb-2">
                    {registro.categoria}: {nomeConcessionaria}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                    Total: {formatCurrency(registro.valor_total)} | ND 39: {formatCurrency(registro.valor_nd_39)}
                </p>
                
                <div className="p-3 rounded-lg border bg-muted/50">
                    {isEditing ? (
                        <Textarea
                            value={memoriaExibida}
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            className="min-h-[150px] font-mono text-xs"
                            placeholder="Digite a memória de cálculo..."
                        />
                    ) : (
                        <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                            {memoriaExibida}
                        </pre>
                    )}
                </div>
                
                {hasCustomMemoria && !isEditing && isPTrabEditable && (
                    <div className="flex justify-end mt-2">
                        <Button
                            type="button" 
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                            disabled={isSaving}
                            className="gap-2 h-7 text-xs text-muted-foreground hover:text-destructive"
                        >
                            <RefreshCw className="h-3 w-3" />
                            Restaurar Automática
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};