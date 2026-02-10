"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, XCircle, Save, RefreshCw, FileText } from "lucide-react";
import { ComplementoAlimentacaoRegistro, generateComplementoMemoriaCalculo } from "@/lib/complementoAlimentacaoUtils";

interface Props {
    registro: any;
    context: any;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (val: string) => void;
    handleIniciarEdicaoMemoria: (id: string, text: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (id: string) => void;
    handleRestaurarMemoriaAutomatica: (id: string) => void;
}

const ComplementoAlimentacaoMemoria = ({
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
    handleRestaurarMemoriaAutomatica
}: Props) => {
    const isEditing = editingMemoriaId === registro.id;
    const memoriaAutomatica = generateComplementoMemoriaCalculo(registro, context);
    const memoriaExibicao = registro.detalhamento_customizado || memoriaAutomatica;

    return (
        <Card key={registro.id} className="border-l-4 border-l-accent shadow-sm">
            <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-accent" />
                    Memória: {registro.group_name} ({registro.categoria_complemento})
                </CardTitle>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleIniciarEdicaoMemoria(registro.id, memoriaExibicao)}
                                disabled={!isPTrabEditable || isSaving}
                            >
                                <Pencil className="h-3 w-3 mr-1" />
                                Editar
                            </Button>
                            {registro.detalhamento_customizado && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRestaurarMemoriaAutomatica(registro.id)}
                                    disabled={!isPTrabEditable || isSaving}
                                    className="text-orange-600"
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Restaurar
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSalvarMemoriaCustomizada(registro.id)}
                                disabled={isSaving}
                                className="text-green-600"
                            >
                                <Save className="h-3 w-3 mr-1" />
                                Salvar
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelarEdicaoMemoria}
                                disabled={isSaving}
                            >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </CardHeader>
            <CardContent className="py-2">
                {isEditing ? (
                    <Textarea
                        value={memoriaEdit}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        className="min-h-[120px] text-xs font-mono"
                    />
                ) : (
                    <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded border">
                        {memoriaExibicao}
                    </pre>
                )}
            </CardContent>
        </Card>
    );
};

export default ComplementoAlimentacaoMemoria;