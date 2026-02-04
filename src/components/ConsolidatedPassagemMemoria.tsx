import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, RefreshCw, XCircle, Check } from "lucide-react";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { ConsolidatedPassagemRecord, generateConsolidatedPassagemMemoriaCalculo } from "@/lib/passagemUtils";
import { Badge } from "@/components/ui/badge"; // Importando Badge

interface ConsolidatedPassagemMemoriaProps {
    group: ConsolidatedPassagemRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    handleIniciarEdicaoMemoria: (group: ConsolidatedPassagemRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedPassagemMemoria = ({
    group,
    isPTrabEditable,
    isSaving,
    editingMemoriaId,
    memoriaEdit,
    setMemoriaEdit,
    handleIniciarEdicaoMemoria,
    handleCancelarEdicaoMemoria,
    handleSalvarMemoriaCustomizada,
    handleRestaurarMemoriaAutomatica,
}: ConsolidatedPassagemMemoriaProps) => {
    
    // O ID do registro que está sendo editado (sempre o primeiro do grupo)
    const firstRecordId = group.records[0].id;
    const isEditing = editingMemoriaId === firstRecordId;
    
    // A memória automática é gerada a partir do grupo consolidado
    const memoriaAutomatica = generateConsolidatedPassagemMemoriaCalculo(group);
    
    // A memória customizada é armazenada no primeiro registro do grupo
    const memoriaCustomizada = group.records[0].detalhamento_customizado;
    
    // A memória a ser exibida é a customizada, se existir, senão a automática
    const memoriaDisplay = memoriaCustomizada || memoriaAutomatica;
    
    // O texto que está no editor (se estiver editando) ou o texto de display
    const currentMemoriaText = isEditing ? memoriaEdit : memoriaDisplay;
    
    const hasCustomMemoria = !!memoriaCustomizada;

    return (
        // PADRONIZAÇÃO: Cor de fundo do card da OM (bg-muted/30)
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            {/* Container para H4 e Botões (Header) */}
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                            {group.organizacao} (UG: {formatCodug(group.ug)})
                        </h4>
                        {/* BADGE DE MEMÓRIA CUSTOMIZADA */}
                        {hasCustomMemoria && !isEditing && (
                            <Badge variant="outline" className="text-xs">
                                Editada manualmente
                            </Badge>
                        )}
                    </div>
                </div>
                
                {/* Botões de Ação (PADRONIZAÇÃO: Posição e Ordem) */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                    {!isEditing ? (
                        <>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleIniciarEdicaoMemoria(group, memoriaDisplay)}
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
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecordId)}
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
                            {/* PADRONIZAÇÃO: Salvar primeiro, depois Cancelar */}
                            <Button
                                type="button"
                                size="sm"
                                variant="default"
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecordId)}
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
            
            {/* Área de Visualização/Edição da Memória */}
            <Card className="p-4 bg-background rounded-lg border">
                {isEditing ? (
                    <Textarea
                        value={memoriaEdit}
                        onChange={(e) => setMemoriaEdit(e.target.value)}
                        className="min-h-[300px] font-mono text-sm"
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