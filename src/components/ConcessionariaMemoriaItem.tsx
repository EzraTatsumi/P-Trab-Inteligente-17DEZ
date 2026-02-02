import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Droplet, Zap } from "lucide-react";
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
    
    // 1. Gerar a memória automática
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
    
    // Verifica se a OM Detentora é diferente da OM Favorecida
    const isDifferentOmInMemoria = registro.om_detentora !== registro.organizacao || registro.ug_detentora !== registro.ug;
    const isAgua = registro.categoria === 'Água/Esgoto';

    // Handler local para iniciar a edição, passando a memória completa
    const handleLocalIniciarEdicao = () => {
        // Passa APENAS o texto customizado do DB para edição, se existir. Caso contrário, passa a automática.
        const memoriaParaEdicao = hasCustomMemoria 
            ? registro.detalhamento_customizado! 
            : memoriaAutomatica; 
            
        handleIniciarEdicaoMemoria(registro, memoriaParaEdicao);
    };

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                            {registro.organizacao} ({formatCodug(registro.ug)})
                        </h4>
                        <Badge 
                            variant="outline" 
                            className={cn(
                                "text-xs font-medium", 
                                isAgua ? "border-blue-500 text-blue-700 bg-blue-50/50" : "border-yellow-500 text-yellow-700 bg-yellow-50/50"
                            )}
                        >
                            {registro.categoria}
                        </Badge>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Concessionária: {registro.nome_concessionaria}
                    </p>
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
            
            <Card className="p-4 bg-background rounded-lg border">
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
            </Card>
        </div>
    );
};