import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
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
    const icon = isAgua ? <Droplet className="h-4 w-4 text-blue-500" /> : <Zap className="h-4 w-4 text-yellow-600" />;

    // Handler local para iniciar a edição, passando a memória correta
    const handleLocalIniciarEdicao = () => {
        const memoriaParaEdicao = hasCustomMemoria 
            ? registro.detalhamento_customizado! 
            : memoriaAutomatica; 
            
        handleIniciarEdicaoMemoria(registro, memoriaParaEdicao);
    };

    return (
        <div className="space-y-3 border p-3 rounded-lg bg-background/50">
            
            <div className="flex items-start justify-between gap-4 border-b pb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h4 className="text-sm font-semibold text-foreground">
                            {registro.categoria} - {registro.detalhamento?.split(': ')[1] || 'Detalhe não disponível'}
                        </h4>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Total: {formatCurrency(registro.valor_total)} | ND 39: {formatCurrency(registro.valor_nd_39)}
                    </p>
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
                        <>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleLocalIniciarEdicao}
                                disabled={isSaving || !isPTrabEditable}
                                className="gap-2 h-7 text-xs"
                            >
                                <Pencil className="h-3 w-3" />
                                Editar
                            </Button>
                            
                            {hasCustomMemoria && (
                                <Button
                                    type="button" 
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={isSaving || !isPTrabEditable}
                                    className="gap-2 h-7 text-xs text-muted-foreground"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Restaurar
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                type="button" 
                                size="sm"
                                variant="default"
                                onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                disabled={isSaving}
                                className="gap-2 h-7 text-xs"
                            >
                                <Check className="h-3 w-3" />
                                Salvar
                            </Button>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                                className="gap-2 h-7 text-xs"
                            >
                                <XCircle className="h-3 w-3" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            <Card className="p-3 rounded-lg border">
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
            </Card>
        </div>
    );
};