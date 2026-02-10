"use client";

import React from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { MaterialConsumoRegistro, generateMaterialConsumoMemoriaCalculo } from "@/lib/materialConsumoUtils";
import { Badge } from "@/components/ui/badge";

interface MaterialConsumoMemoriaProps {
    registro: MaterialConsumoRegistro;
    context: { organizacao: string, ug: string, efetivo: number, dias_operacao: number, fase_atividade: string | null };
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (registroId: string, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

const MaterialConsumoMemoria: React.FC<MaterialConsumoMemoriaProps> = ({
    registro,
    context,
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
    
    // A memória automática é gerada para este registro específico
    const memoriaAutomatica = generateMaterialConsumoMemoriaCalculo(registro, context);
    
    // A memória customizada
    const memoriaCustomizada = registro.detalhamento_customizado;
    
    // A memória a ser exibida
    const memoriaDisplay = memoriaCustomizada || memoriaAutomatica;
    
    const currentMemoriaText = isEditing ? memoriaEdit : memoriaDisplay;
    const hasCustomMemoria = !!memoriaCustomizada;

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-semibold text-foreground">
                            {context.organizacao} (UG: {formatCodug(context.ug)})
                        </h4>
                        <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                            {registro.group_name}
                        </Badge>
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                        <>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleIniciarEdicaoMemoria(registro.id, memoriaDisplay)}
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
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
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
                        value={memoriaEdit}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        className="min-h-[250px] font-mono text-sm"
                        placeholder="Digite a memória de cálculo..."
                    />
                ) : (
                    <pre className="text-sm font-mono whitespace-pre-wrap text-foreground">
                        {currentMemoriaText}
                    </pre>
                )}
            </Card>
            
        </div>
    );
};

export default MaterialConsumoMemoria;