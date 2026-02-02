import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2, Droplet, Zap } from "lucide-react";
import { ConcessionariaRegistroComDiretriz, generateConcessionariaMemoriaCalculo } from "@/lib/concessionariaUtils";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

interface ConcessionariaMemoriaItemProps {
    registro: ConcessionariaRegistroComDiretriz;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (registro: ConcessionariaRegistroComDiretriz, memoriaCompleta: string) => void;
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
    const memoriaAutomaticaCompleta = useMemo(() => {
        return generateConcessionariaMemoriaCalculo(registro);
    }, [registro]);

    // 2. Determinar a memória a ser exibida/editada
    let memoriaExibida = memoriaAutomaticaCompleta;
    
    if (isEditing) {
        memoriaExibida = memoriaEdit;
    } else if (hasCustomMemoria) {
        memoriaExibida = registro.detalhamento_customizado!;
    }
    
    // Verifica se a OM Detentora é diferente da OM Favorecida
    const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao || registro.ug_detentora !== registro.ug;

    // Handler local para iniciar a edição, passando a memória completa
    const handleLocalIniciarEdicao = () => {
        const memoriaParaEdicao = hasCustomMemoria 
            ? registro.detalhamento_customizado! 
            : memoriaAutomaticaCompleta; 
            
        handleIniciarEdicaoMemoria(registro, memoriaParaEdicao);
    };

    const isAgua = registro.categoria === 'Água/Esgoto';

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            {/* Header e Botões de Ação */}
            <div className="flex items-start justify-between gap-4 mb-0"> {/* FIX: mb-2 changed to mb-0 */}
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                            {isAgua ? <Droplet className="h-4 w-4 text-blue-600" /> : <Zap className="h-4 w-4 text-yellow-600" />}
                            {registro.categoria} - {registro.nome_concessionaria}
                        </h4>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                    {isDifferentOmInMemoria && (
                        <div className="flex items-center gap-1 mt-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-sm font-medium text-red-600">
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
                                className="gap-2"
                            >
                                <Pencil className="h-4 w-4" />
                                Editar Memória
                            </Button>
                            
                            {hasCustomMemoria && (
                                <Button
                                    type="button" 
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={isSaving || !isPTrabEditable}
                                    className="gap-2 text-muted-foreground"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Restaurar Automática
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
                                className="gap-2"
                            >
                                <Check className="h-4 w-4" />
                                Salvar
                            </Button>
                            <Button
                                type="button" 
                                size="sm"
                                variant="outline"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                                className="gap-2"
                            >
                                <XCircle className="h-4 w-4" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Área de Texto da Memória */}
            <CardContent className="p-0 pt-0"> {/* FIX: pt-3 changed to pt-0 */}
                
                <div className="p-4 bg-background rounded-lg border">
                    {isEditing ? (
                        <Textarea
                            value={memoriaExibida}
                            onChange={(e) => setMemoriaEdit(e.target.value)}
                            className="min-h-[300px] font-mono text-sm"
                            placeholder="Digite a memória de cálculo..."
                        />
                    ) : (
                        <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                            {memoriaExibida}
                        </pre>
                    )}
                </div>
            </CardContent>
        </div>
    );
};