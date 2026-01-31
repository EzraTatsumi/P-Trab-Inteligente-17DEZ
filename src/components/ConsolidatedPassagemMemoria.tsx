import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, XCircle, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { ConsolidatedPassagemRecord, generateConsolidatedPassagemMemoriaCalculo } from "@/lib/passagemUtils";
import { formatCodug } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";
import { usePassagemDiretrizDetails } from "@/hooks/usePassagemDiretrizDetails";

interface ConsolidatedPassagemMemoriaProps {
    group: ConsolidatedPassagemRecord;
    isPTrabEditable: boolean;
    isSaving: boolean;
    editingMemoriaId: string | null;
    memoriaEdit: string;
    setMemoriaEdit: (value: string) => void;
    // O handler agora recebe a string da memória completa (automática ou customizada)
    handleIniciarEdicaoMemoria: (group: ConsolidatedPassagemRecord, memoriaCompleta: string) => void;
    handleCancelarEdicaoMemoria: () => void;
    handleSalvarMemoriaCustomizada: (registroId: string) => Promise<void>;
    handleRestaurarMemoriaAutomatica: (registroId: string) => Promise<void>;
}

export const ConsolidatedPassagemMemoria: React.FC<ConsolidatedPassagemMemoriaProps> = ({
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
}) => {
    const firstRecord = group.records[0];
    const isEditing = editingMemoriaId === firstRecord.id;
    let hasCustomMemoria = !!firstRecord.detalhamento_customizado;
    
    // Assumimos que todos os registros no grupo têm o mesmo diretriz_id
    const diretrizId = firstRecord.diretriz_id;

    // Busca os detalhes da diretriz (Pregão/UASG)
    const { data: diretrizDetails, isLoading: isLoadingDiretriz } = usePassagemDiretrizDetails(diretrizId);

    // 1. Gerar a memória automática consolidada COMPLETA (incluindo Pregão/UASG)
    const memoriaAutomaticaCompleta = useMemo(() => {
        if (isLoadingDiretriz) return "Carregando detalhes do contrato...";
        
        let memoria = generateConsolidatedPassagemMemoriaCalculo(group);
        
        // Adicionar Pregão/UASG dinamicamente
        if (diretrizDetails?.numero_pregao && diretrizDetails?.ug_referencia) {
            memoria += `(Pregão ${diretrizDetails.numero_pregao} - UASG ${formatCodug(diretrizDetails.ug_referencia)})\n`;
        } else if (diretrizDetails) {
            memoria += `(Detalhes do contrato não disponíveis ou incompletos)\n`;
        }
        
        return memoria;
    }, [group, diretrizDetails, isLoadingDiretriz]);

    // 2. Determinar a memória a ser exibida/editada
    let memoriaExibida = memoriaAutomaticaCompleta;
    
    // Se estiver editando, usa o estado de edição
    if (isEditing) {
        memoriaExibida = memoriaEdit;
    } 
    // Se houver customização (e não estiver editando), usa a customizada, garantindo a linha do Pregão/UASG
    else if (hasCustomMemoria) {
        let customMemoria = firstRecord.detalhamento_customizado!;
        
        if (diretrizDetails?.numero_pregao && diretrizDetails?.ug_referencia) {
            const pregaoLine = `(Pregão ${diretrizDetails.numero_pregao} - UASG ${formatCodug(diretrizDetails.ug_referencia)})`;
            // Evita duplicar a linha se o usuário já a incluiu
            if (!customMemoria.includes('Pregão')) {
                customMemoria += `\n${pregaoLine}\n`;
            }
        }
        memoriaExibida = customMemoria;
    }
    
    // Verifica se a OM Detentora é diferente da OM Favorecida
    const isDifferentOmInMemoria = group.om_detentora !== group.organizacao || group.ug_detentora !== group.ug;

    // Handler local para iniciar a edição, passando a memória completa
    const handleLocalIniciarEdicao = () => {
        // Se houver customização, passamos a customizada (que já tem o Pregão/UASG adicionado se necessário)
        // Se não houver customização, passamos a automática completa.
        const memoriaParaEdicao = hasCustomMemoria 
            ? memoriaExibida // Usa a versão customizada (que já tem o Pregão/UASG adicionado se necessário)
            : memoriaAutomaticaCompleta;
            
        handleIniciarEdicaoMemoria(group, memoriaParaEdicao);
    };

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-muted/30">
            
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                            {group.organizacao} (UG: {formatCodug(group.ug)})
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
                                Destino Recurso: {group.om_detentora} ({formatCodug(group.ug_detentora)})
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
                                onClick={handleLocalIniciarEdicao} // Usando o handler local
                                disabled={isSaving || !isPTrabEditable || isLoadingDiretriz}
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
                                    onClick={() => handleRestaurarMemoriaAutomatica(firstRecord.id)}
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
                                onClick={() => handleSalvarMemoriaCustomizada(firstRecord.id)}
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
                {isLoadingDiretriz ? (
                    <div className="flex items-center justify-center h-20">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Carregando detalhes do contrato...</span>
                    </div>
                ) : isEditing ? (
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